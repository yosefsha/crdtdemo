from aws_cdk import Stack, Duration
from aws_cdk import aws_ec2 as ec2
from aws_cdk import aws_lambda as lambda_
from aws_cdk import aws_lambda_event_sources as event_sources
from constructs import Construct

from stacks.network_stack import NetworkStack
from stacks.data_stack import DataStack
from stacks.messaging_stack import MessagingStack
from stacks.compute_stack import ComputeStack


class LambdaStack(Stack):
    def __init__(
        self,
        scope: Construct,
        id: str,
        network: NetworkStack,
        data: DataStack,
        messaging: MessagingStack,
        compute: ComputeStack,
        **kwargs,
    ) -> None:
        super().__init__(scope, id, **kwargs)

        # Internal callback URL — Lambda POSTs enrichment result here so server
        # can emit via Socket.IO. Uses ALB DNS (routes through HTTPS listener).
        # Note: the /api/enrich-internal-callback route is protected by X-Internal-Token header.
        server_callback_url = f"https://{compute.alb_dns}/api/enrich-internal-callback"

        enrich_fn = lambda_.Function(
            self,
            "EnrichFunction",
            function_name="crdt-enrich-worker",
            runtime=lambda_.Runtime.NODEJS_20_X,
            handler="index.handler",
            code=lambda_.Code.from_asset("lambda/enrich"),
            timeout=Duration.seconds(120),
            memory_size=256,
            vpc=network.vpc,
            vpc_subnets=ec2.SubnetSelection(subnet_type=ec2.SubnetType.PRIVATE_WITH_EGRESS),
            security_groups=[network.lambda_sg],
            # Throttle concurrent executions to cap Replicate API spend
            reserved_concurrent_executions=5,
            environment={
                "SERVER_CALLBACK_URL": server_callback_url,
            },
            description="Processes image enrichment requests via Replicate SDXL API",
        )

        # Inject secrets at runtime (not baked into image)
        data.replicate_token.grant_read(enrich_fn.role)
        data.internal_callback_secret.grant_read(enrich_fn.role)

        # Add secret ARNs as env vars so Lambda can fetch them via SDK
        enrich_fn.add_environment(
            "REPLICATE_TOKEN_SECRET_ARN", data.replicate_token.secret_arn
        )
        enrich_fn.add_environment(
            "CALLBACK_SECRET_ARN", data.internal_callback_secret.secret_arn
        )

        # SQS event source — batch_size=1 because each Replicate call is heavy
        enrich_fn.add_event_source(
            event_sources.SqsEventSource(
                messaging.enrich_requests_queue,
                batch_size=1,
                report_batch_item_failures=True,
            )
        )

        # Allow Lambda to consume from SQS
        messaging.enrich_requests_queue.grant_consume_messages(enrich_fn)
