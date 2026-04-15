from aws_cdk import Stack, RemovalPolicy, Duration
from aws_cdk import aws_ec2 as ec2
from aws_cdk import aws_rds as rds
from aws_cdk import aws_secretsmanager as secretsmanager
from constructs import Construct

from stacks.network_stack import NetworkStack


class DataStack(Stack):
    def __init__(self, scope: Construct, id: str, network: NetworkStack, **kwargs) -> None:
        super().__init__(scope, id, **kwargs)

        # JWT secret — shared by server and auth services
        self.jwt_secret = secretsmanager.Secret(
            self,
            "JwtSecret",
            secret_name="crdtdemo/jwt-secret",
            generate_secret_string=secretsmanager.SecretStringGenerator(
                exclude_punctuation=True,
                password_length=32,
            ),
            description="JWT signing secret shared by server and auth services",
        )

        # Replicate API token — populated manually after first deploy:
        #   aws secretsmanager put-secret-value \
        #     --secret-id crdtdemo/replicate-api-token \
        #     --secret-string "r8_..."
        self.replicate_token = secretsmanager.Secret(
            self,
            "ReplicateToken",
            secret_name="crdtdemo/replicate-api-token",
            description="Replicate API token for SDXL image enrichment (set value manually)",
        )

        # Internal callback secret — Lambda uses this to authenticate calls to server
        self.internal_callback_secret = secretsmanager.Secret(
            self,
            "InternalCallbackSecret",
            secret_name="crdtdemo/internal-callback-secret",
            generate_secret_string=secretsmanager.SecretStringGenerator(
                exclude_punctuation=True,
                password_length=32,
            ),
            description="Shared secret for Lambda → server internal callback authentication",
        )

        # RDS PostgreSQL credentials
        self.db_credentials = rds.DatabaseSecret(
            self,
            "DbCredentials",
            username="postgres",
            secret_name="crdtdemo/db-credentials",
        )

        # RDS PostgreSQL instance
        self.db = rds.DatabaseInstance(
            self,
            "CrdtDb",
            engine=rds.DatabaseInstanceEngine.postgres(
                version=rds.PostgresEngineVersion.of("15.17", "15")
            ),
            instance_type=ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MICRO),
            vpc=network.vpc,
            vpc_subnets=ec2.SubnetSelection(subnet_type=ec2.SubnetType.PRIVATE_WITH_EGRESS),
            security_groups=[network.rds_sg],
            credentials=rds.Credentials.from_secret(self.db_credentials),
            database_name="crdtdemo",
            removal_policy=RemovalPolicy.SNAPSHOT,
            deletion_protection=True,
            backup_retention=Duration.days(7),
            multi_az=False,
            storage_encrypted=True,
        )
