from aws_cdk import Stack, Duration, CfnOutput
from aws_cdk import aws_ec2 as ec2
from aws_cdk import aws_ecs as ecs
from aws_cdk import aws_elasticloadbalancingv2 as elbv2
from aws_cdk import aws_ecr as ecr
from aws_cdk import aws_iam as iam
from aws_cdk import aws_logs as logs
from aws_cdk import aws_certificatemanager as acm
from aws_cdk import aws_route53 as route53
from aws_cdk import aws_route53_targets as route53_targets
from constructs import Construct

from stacks.network_stack import NetworkStack
from stacks.data_stack import DataStack
from stacks.messaging_stack import MessagingStack

# Existing ACM certificate (covers *.yossidemo.click and yossidemo.click)
ACM_CERT_ARN = "arn:aws:acm:us-east-1:963352896991:certificate/6c4adc69-fe9a-4f1c-91c6-1a6d98e49f21"
ECR_ACCOUNT = "963352896991.dkr.ecr.us-east-1.amazonaws.com"


class ComputeStack(Stack):
    def __init__(
        self,
        scope: Construct,
        id: str,
        network: NetworkStack,
        data: DataStack,
        messaging: MessagingStack,
        **kwargs,
    ) -> None:
        super().__init__(scope, id, **kwargs)

        # ECS Cluster
        self.cluster = ecs.Cluster(
            self,
            "CrdtCluster",
            vpc=network.vpc,
            cluster_name="crdt-demo",
            container_insights_v2=ecs.ContainerInsights.ENABLED,
        )

        # ALB
        alb = elbv2.ApplicationLoadBalancer(
            self,
            "Alb",
            vpc=network.vpc,
            internet_facing=True,
            security_group=network.alb_sg,
            load_balancer_name="crdt-demo-alb",
        )

        certificate = acm.Certificate.from_certificate_arn(self, "Cert", ACM_CERT_ARN)

        # HTTP → HTTPS redirect
        alb.add_listener(
            "HttpListener",
            port=80,
            default_action=elbv2.ListenerAction.redirect(
                protocol="HTTPS", port="443", permanent=True
            ),
        )

        # HTTPS listener — default returns 404 (only matched paths are forwarded)
        https_listener = alb.add_listener(
            "HttpsListener",
            port=443,
            certificates=[certificate],
            default_action=elbv2.ListenerAction.fixed_response(
                404, content_type="text/plain", message_body="Not found"
            ),
        )

        # ── SERVER FARGATE SERVICE ────────────────────────────────────────────

        server_repo = ecr.Repository.from_repository_name(self, "ServerRepo", "crdtdemo/node")

        server_task = ecs.FargateTaskDefinition(
            self, "ServerTask", cpu=512, memory_limit_mib=1024
        )
        # Grant server task permissions
        messaging.enrich_requests_queue.grant_send_messages(server_task.task_role)
        data.jwt_secret.grant_read(server_task.task_role)
        data.db_credentials.grant_read(server_task.task_role)
        data.internal_callback_secret.grant_read(server_task.task_role)

        server_log_group = logs.LogGroup(
            self,
            "ServerLogs",
            log_group_name="/ecs/crdt-server",
            retention=logs.RetentionDays.ONE_WEEK,
        )

        server_container = server_task.add_container(
            "ServerContainer",
            image=ecs.ContainerImage.from_ecr_repository(server_repo, tag="latest"),
            logging=ecs.LogDrivers.aws_logs(
                stream_prefix="server", log_group=server_log_group
            ),
            environment={
                "PORT": "5001",
                "CLIENT_ORIGIN": "https://yossidemo.click",
                "SQS_REQUEST_QUEUE_URL": messaging.enrich_requests_queue.queue_url,
                "AWS_REGION": "us-east-1",
            },
            secrets={
                "JWT_SECRET": ecs.Secret.from_secrets_manager(data.jwt_secret),
                "POSTGRES_URL": ecs.Secret.from_secrets_manager(
                    data.db_credentials, field="dbInstanceIdentifier"
                ),
                "INTERNAL_CALLBACK_SECRET": ecs.Secret.from_secrets_manager(
                    data.internal_callback_secret
                ),
            },
            health_check=ecs.HealthCheck(
                command=["CMD-SHELL", "curl -f http://localhost:5001/api/health || exit 1"],
                interval=Duration.seconds(30),
                timeout=Duration.seconds(5),
                retries=3,
                start_period=Duration.seconds(60),
            ),
        )
        server_container.add_port_mappings(ecs.PortMapping(container_port=5001))

        server_service = ecs.FargateService(
            self,
            "ServerService",
            cluster=self.cluster,
            task_definition=server_task,
            desired_count=1,
            security_groups=[network.server_sg],
            vpc_subnets=ec2.SubnetSelection(subnet_type=ec2.SubnetType.PRIVATE_WITH_EGRESS),
            service_name="crdt-server",
            enable_execute_command=True,  # allows `aws ecs execute-command` for debugging
        )

        # Server target group — sticky sessions required for Socket.IO long-poll fallback
        server_tg = elbv2.ApplicationTargetGroup(
            self,
            "ServerTg",
            vpc=network.vpc,
            port=5001,
            protocol=elbv2.ApplicationProtocol.HTTP,
            targets=[server_service],
            health_check=elbv2.HealthCheck(
                path="/api/health",
                interval=Duration.seconds(30),
                timeout=Duration.seconds(5),
                healthy_http_codes="200",
            ),
            stickiness_cookie_duration=Duration.hours(1),
            target_group_name="crdt-server-tg",
        )

        # Path-based routing — mirrors Traefik labels in docker-compose.yaml
        https_listener.add_action(
            "ApiRoute",
            priority=10,
            conditions=[elbv2.ListenerCondition.path_patterns(["/api/*"])],
            action=elbv2.ListenerAction.forward([server_tg]),
        )
        https_listener.add_action(
            "SocketRoute",
            priority=11,
            conditions=[elbv2.ListenerCondition.path_patterns(["/socket/*", "/socket.io/*"])],
            action=elbv2.ListenerAction.forward([server_tg]),
        )

        # ── AUTH FARGATE SERVICE ──────────────────────────────────────────────

        auth_repo = ecr.Repository.from_repository_name(self, "AuthRepo", "crdtdemo/auth")

        auth_task = ecs.FargateTaskDefinition(
            self, "AuthTask", cpu=256, memory_limit_mib=512
        )
        data.jwt_secret.grant_read(auth_task.task_role)
        data.db_credentials.grant_read(auth_task.task_role)

        auth_log_group = logs.LogGroup(
            self,
            "AuthLogs",
            log_group_name="/ecs/crdt-auth",
            retention=logs.RetentionDays.ONE_WEEK,
        )

        auth_container = auth_task.add_container(
            "AuthContainer",
            image=ecs.ContainerImage.from_ecr_repository(auth_repo, tag="latest"),
            logging=ecs.LogDrivers.aws_logs(
                stream_prefix="auth", log_group=auth_log_group
            ),
            secrets={
                "JWT_SECRET": ecs.Secret.from_secrets_manager(data.jwt_secret),
                "POSTGRES_URL": ecs.Secret.from_secrets_manager(
                    data.db_credentials, field="dbInstanceIdentifier"
                ),
            },
            health_check=ecs.HealthCheck(
                command=["CMD-SHELL", "curl -f http://localhost:4000/auth/health || exit 1"],
                interval=Duration.seconds(30),
                timeout=Duration.seconds(5),
                retries=3,
                start_period=Duration.seconds(60),
            ),
        )
        auth_container.add_port_mappings(ecs.PortMapping(container_port=4000))

        auth_service = ecs.FargateService(
            self,
            "AuthService",
            cluster=self.cluster,
            task_definition=auth_task,
            desired_count=1,
            security_groups=[network.auth_sg],
            vpc_subnets=ec2.SubnetSelection(subnet_type=ec2.SubnetType.PRIVATE_WITH_EGRESS),
            service_name="crdt-auth",
            enable_execute_command=True,
        )

        auth_tg = elbv2.ApplicationTargetGroup(
            self,
            "AuthTg",
            vpc=network.vpc,
            port=4000,
            protocol=elbv2.ApplicationProtocol.HTTP,
            targets=[auth_service],
            health_check=elbv2.HealthCheck(
                path="/auth/health",
                interval=Duration.seconds(30),
                timeout=Duration.seconds(5),
                healthy_http_codes="200",
            ),
            target_group_name="crdt-auth-tg",
        )

        https_listener.add_action(
            "AuthRoute",
            priority=20,
            conditions=[elbv2.ListenerCondition.path_patterns(["/auth/*"])],
            action=elbv2.ListenerAction.forward([auth_tg]),
        )

        # ── DNS ───────────────────────────────────────────────────────────────

        zone = route53.HostedZone.from_lookup(self, "Zone", domain_name="yossidemo.click")
        route53.ARecord(
            self,
            "ApiDns",
            zone=zone,
            record_name="api",
            target=route53.RecordTarget.from_alias(route53_targets.LoadBalancerTarget(alb)),
        )

        # Export ALB DNS so LambdaStack can build the internal callback URL
        self.alb_dns = alb.load_balancer_dns_name

        CfnOutput(self, "AlbDns", value=alb.load_balancer_dns_name, description="ALB DNS name")
