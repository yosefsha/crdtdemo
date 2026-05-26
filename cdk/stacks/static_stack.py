from aws_cdk import Stack, RemovalPolicy, CfnOutput
from aws_cdk import aws_s3 as s3
from aws_cdk import aws_cloudfront as cloudfront
from aws_cdk import aws_cloudfront_origins as origins
from aws_cdk import aws_certificatemanager as acm
from aws_cdk import aws_route53 as route53
from aws_cdk import aws_route53_targets as route53_targets
from constructs import Construct

HOSTED_ZONE_ID = "Z03443351PW97OGJ1VSIF"
HOSTED_ZONE_NAME = "yossidemo.click"
FRONTEND_SUBDOMAIN = "crdt"                        # crdt.yossidemo.click


class StaticStack(Stack):
    def __init__(self, scope: Construct, id: str, **kwargs) -> None:
        super().__init__(scope, id, **kwargs)

        zone = route53.HostedZone.from_hosted_zone_attributes(
            self, "Zone",
            hosted_zone_id=HOSTED_ZONE_ID,
            zone_name=HOSTED_ZONE_NAME,
        )

        # CloudFront cert must be in us-east-1 — we're already deploying there
        certificate = acm.Certificate(
            self, "FrontendCert",
            domain_name=f"{FRONTEND_SUBDOMAIN}.{HOSTED_ZONE_NAME}",
            validation=acm.CertificateValidation.from_dns(zone),
        )

        bucket = s3.Bucket(
            self,
            "ClientBucket",
            bucket_name="crdt-yossidemo-client",
            block_public_access=s3.BlockPublicAccess.BLOCK_ALL,
            removal_policy=RemovalPolicy.RETAIN,
        )

        oac = cloudfront.S3OriginAccessControl(self, "OAC")

        distribution = cloudfront.Distribution(
            self,
            "ClientDistribution",
            default_behavior=cloudfront.BehaviorOptions(
                origin=origins.S3BucketOrigin.with_origin_access_control(
                    bucket, origin_access_control=oac
                ),
                viewer_protocol_policy=cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
                cache_policy=cloudfront.CachePolicy.CACHING_OPTIMIZED,
                allowed_methods=cloudfront.AllowedMethods.ALLOW_GET_HEAD,
            ),
            domain_names=[f"{FRONTEND_SUBDOMAIN}.{HOSTED_ZONE_NAME}"],
            certificate=certificate,
            default_root_object="index.html",
            # SPA fallback — replaces nginx try_files $uri /index.html
            error_responses=[
                cloudfront.ErrorResponse(
                    http_status=403,
                    response_http_status=200,
                    response_page_path="/index.html",
                ),
                cloudfront.ErrorResponse(
                    http_status=404,
                    response_http_status=200,
                    response_page_path="/index.html",
                ),
            ],
        )

        route53.ARecord(
            self,
            "ClientDns",
            zone=zone,
            record_name=FRONTEND_SUBDOMAIN,
            target=route53.RecordTarget.from_alias(
                route53_targets.CloudFrontTarget(distribution)
            ),
        )

        CfnOutput(self, "BucketName", value=bucket.bucket_name, description="S3 bucket for React SPA")
        CfnOutput(self, "DistributionId", value=distribution.distribution_id, description="CloudFront distribution ID")
        CfnOutput(self, "ClientUrl", value=f"https://{FRONTEND_SUBDOMAIN}.{HOSTED_ZONE_NAME}", description="React app URL")
