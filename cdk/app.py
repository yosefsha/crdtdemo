#!/usr/bin/env python3
import aws_cdk as cdk

from stacks.network_stack import NetworkStack
from stacks.data_stack import DataStack
from stacks.messaging_stack import MessagingStack
from stacks.compute_stack import ComputeStack
from stacks.static_stack import StaticStack
from stacks.lambda_stack import LambdaStack

app = cdk.App()

env = cdk.Environment(account="963352896991", region="us-east-1")

# Phase 1: foundation
network = NetworkStack(app, "CrdtNetworkStack", env=env)
data = DataStack(app, "CrdtDataStack", network=network, env=env)
messaging = MessagingStack(app, "CrdtMessagingStack", env=env)

# Phase 2: compute (depends on network + data + messaging)
compute = ComputeStack(
    app,
    "CrdtComputeStack",
    network=network,
    data=data,
    messaging=messaging,
    env=env,
)

# Phase 3: lambda (depends on everything above; needs ALB DNS from compute)
lambda_stack = LambdaStack(
    app,
    "CrdtLambdaStack",
    network=network,
    data=data,
    messaging=messaging,
    compute=compute,
    env=env,
)

# Phase 3: static client (independent of compute; deploy in parallel with lambda)
static = StaticStack(app, "CrdtStaticStack", env=env)

app.synth()
