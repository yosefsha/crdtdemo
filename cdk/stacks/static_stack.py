from aws_cdk import Stack, RemovalPolicy, CfnOutput
from aws_cdk import aws_s3 as s3
from aws_cdk import aws_cloudfront as cloudfront
from aws_cdk import aws_cloudfront_origins as origins
from aws_cdk import aws_certificatemanager as acm
from aws_cdk import aws_route53 as route53
from aws_cdk import aws_route53_targets as route53_targets
from constructs import Construct

# CloudFront certificate MUST be in us-east-1
ACM_CERT_ARN = "arn:aws:acm:us-east-1:963352896991:certificate/6c4adc69-fe9a-4f1c-91c6-1a6d98e49f21"


class StaticStack(Stack):
    def __init__(self, scope: Construct, id: str, **kwargs) -> None:
        super().__init__(scope, id, **kwargs)

        bucket = s3.Bucket(
            self,
            "ClientBucket",
            bucket_name="yossidemo-click-client",
            block_public_access=s3.BlockPublicAccess.BLOCK_ALL,
            removal_policy=RemovalPolicy.RETAIN,
            versioned=False,
        )

        cf_cert = acm.Certificate.from_certificate_arn(self, "CfCert", ACM_CERT_ARN)

        # Origin Access Control for S3 (modern replacement for OAI)
        oac = cloudfront.S3OriginAccessControl(self, "OAC")

        distribution = cloudfront.Distribution(
            self,
            "ClientDistribution",
            default_behavior=cloudfront.BehaviorOptions(
                origin=origins.S3BucketOrigin.with_origin_access_control(bucket, origin_access_control=oac),
                viewer_protocol_policy=cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
                cache_policy=cloudfront.CachePolicy.CACHING_OPTIMIZED,
                allowed_methods=cloudfront.AllowedMethods.ALLOW_GET_HEAD,
            ),
            domain_names=["yossidemo.click"],
            certificate=cf_cert,
            default_root_object="index.html",
            # SPA fallback — replaces nginx try_files $uri /index.html
            error_responses=[
                cloudfront.ErrorResponse(
                    http_status=403,
                    response_http_status=200,
                    response_page_path="/index.html",
                    ttl=RemovalPolicy.DESTROY and None,
                ),
                cloudfront.ErrorResponse(
                    http_status=404,
                    response_http_status=200,
                    response_page_path="/index.html",
                ),
            ],
        )

        zone = route53.HostedZone.from_lookup(self, "Zone", domain_name="yossidemo.click")
        route53.ARecord(
            self,
            "ClientDns",
            zone=zone,
            target=route53.RecordTarget.from_alias(
                route53_targets.CloudFrontTarget(distribution)
            ),
        )

        CfnOutput(self, "BucketName", value=bucket.bucket_name, description="S3 bucket for React SPA")
        CfnOutput(self, "DistributionId", value=distribution.distribution_id, description="CloudFront distribution ID")
        CfnOutput(self, "ClientUrl", value="https://yossidemo.click", description="React app URL")
