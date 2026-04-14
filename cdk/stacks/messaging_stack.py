from aws_cdk import Stack, Duration
from aws_cdk import aws_sqs as sqs
from constructs import Construct


class MessagingStack(Stack):
    def __init__(self, scope: Construct, id: str, **kwargs) -> None:
        super().__init__(scope, id, **kwargs)

        # Dead-letter queue — receives messages after 3 failed Lambda invocations
        self.enrich_dlq = sqs.Queue(
            self,
            "EnrichDlq",
            queue_name="enrich-requests-dlq",
            retention_period=Duration.days(14),
        )

        # Main enrichment request queue — replaces RabbitMQ enrich_requests
        # visibility_timeout must be >= 6x Lambda timeout (Lambda = 120s, so 900s is safe)
        self.enrich_requests_queue = sqs.Queue(
            self,
            "EnrichRequestsQueue",
            queue_name="enrich-requests",
            visibility_timeout=Duration.seconds(900),
            dead_letter_queue=sqs.DeadLetterQueue(
                max_receive_count=3,
                queue=self.enrich_dlq,
            ),
        )
