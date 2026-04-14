from aws_cdk import Stack
from aws_cdk import aws_ec2 as ec2
from constructs import Construct


class NetworkStack(Stack):
    def __init__(self, scope: Construct, id: str, **kwargs) -> None:
        super().__init__(scope, id, **kwargs)

        self.vpc = ec2.Vpc(
            self,
            "CrdtVpc",
            max_azs=2,
            nat_gateways=1,
            subnet_configuration=[
                ec2.SubnetConfiguration(
                    name="Public",
                    subnet_type=ec2.SubnetType.PUBLIC,
                    cidr_mask=24,
                ),
                ec2.SubnetConfiguration(
                    name="Private",
                    subnet_type=ec2.SubnetType.PRIVATE_WITH_EGRESS,
                    cidr_mask=24,
                ),
            ],
        )

        # --- Security Groups ---
        self.alb_sg = ec2.SecurityGroup(
            self, "AlbSg", vpc=self.vpc, description="ALB security group", allow_all_outbound=True
        )
        self.alb_sg.add_ingress_rule(ec2.Peer.any_ipv4(), ec2.Port.tcp(80), "HTTP from internet")
        self.alb_sg.add_ingress_rule(ec2.Peer.any_ipv4(), ec2.Port.tcp(443), "HTTPS from internet")

        self.server_sg = ec2.SecurityGroup(
            self, "ServerSg", vpc=self.vpc, description="Server ECS task security group", allow_all_outbound=True
        )
        self.server_sg.add_ingress_rule(self.alb_sg, ec2.Port.tcp(5001), "Server port from ALB")

        self.auth_sg = ec2.SecurityGroup(
            self, "AuthSg", vpc=self.vpc, description="Auth ECS task security group", allow_all_outbound=True
        )
        self.auth_sg.add_ingress_rule(self.alb_sg, ec2.Port.tcp(4000), "Auth port from ALB")

        self.rds_sg = ec2.SecurityGroup(
            self, "RdsSg", vpc=self.vpc, description="RDS security group", allow_all_outbound=False
        )
        self.rds_sg.add_ingress_rule(self.server_sg, ec2.Port.tcp(5432), "Postgres from server")
        self.rds_sg.add_ingress_rule(self.auth_sg, ec2.Port.tcp(5432), "Postgres from auth")

        self.lambda_sg = ec2.SecurityGroup(
            self, "LambdaSg", vpc=self.vpc, description="Lambda security group", allow_all_outbound=True
        )
        # Lambda calls server internal callback endpoint
        self.server_sg.add_ingress_rule(self.lambda_sg, ec2.Port.tcp(5001), "Internal callback from Lambda")
