#!/usr/bin/env bash
# Full CDK deployment for CRDT Demo (ECS Fargate)
# Usage:
#   ./scripts/cdk-deploy.sh              # deploy all stacks
#   ./scripts/cdk-deploy.sh foundation  # network + data + messaging only
#   ./scripts/cdk-deploy.sh compute     # ECS + ALB only
#   ./scripts/cdk-deploy.sh lambda      # Lambda + SQS event source only
#   ./scripts/cdk-deploy.sh static      # S3 + CloudFront only
#   ./scripts/cdk-deploy.sh destroy     # tear down all stacks (careful!)

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CDK_DIR="$REPO_ROOT/cdk"

log() { echo "▶ $*"; }
err() { echo "✗ $*" >&2; exit 1; }

# Confirm AWS identity before doing anything
log "AWS identity check..."
aws sts get-caller-identity --query "[Account, Arn]" --output text || err "Not authenticated with AWS. Run 'aws configure' or set credentials."

cd "$CDK_DIR"

deploy_foundation() {
  log "Deploying foundation stacks (network, data, messaging)..."
  cdk deploy CrdtNetworkStack CrdtDataStack CrdtMessagingStack --require-approval never
  log "Foundation stacks deployed."
  echo ""
  echo "⚠️  Next: set the Replicate API token if not already done:"
  echo "   aws secretsmanager put-secret-value \\"
  echo "     --secret-id crdtdemo/replicate-api-token \\"
  echo "     --secret-string 'r8_YOUR_TOKEN_HERE'"
}

deploy_compute() {
  log "Deploying compute stack (ECS Fargate + ALB)..."
  cdk deploy CrdtComputeStack --require-approval never
  log "Compute stack deployed."
}

deploy_lambda() {
  log "Deploying lambda stack..."
  cdk deploy CrdtLambdaStack --require-approval never
  log "Lambda stack deployed."
}

deploy_static() {
  log "Deploying static stack (S3 + CloudFront)..."
  cdk deploy CrdtStaticStack --require-approval never

  BUCKET=$(aws cloudformation describe-stacks \
    --stack-name CrdtStaticStack \
    --query "Stacks[0].Outputs[?OutputKey=='BucketName'].OutputValue" \
    --output text)
  DIST_ID=$(aws cloudformation describe-stacks \
    --stack-name CrdtStaticStack \
    --query "Stacks[0].Outputs[?OutputKey=='DistributionId'].OutputValue" \
    --output text)

  log "Static stack deployed. Bucket: $BUCKET"

  if [ -d "$REPO_ROOT/rclient/build" ]; then
    log "Syncing React build to S3..."
    aws s3 sync "$REPO_ROOT/rclient/build/" "s3://$BUCKET" --delete
    log "Invalidating CloudFront cache..."
    aws cloudfront create-invalidation --distribution-id "$DIST_ID" --paths "/*" --query "Invalidation.Id" --output text
    log "Done. App available at https://crdt.yossidemo.click"
  else
    echo ""
    echo "⚠️  React build not found. Build first, then sync:"
    echo "   cd rclient && REACT_APP_MYENV=prod npm run build"
    echo "   aws s3 sync rclient/build/ s3://$BUCKET --delete"
    echo "   aws cloudfront create-invalidation --distribution-id $DIST_ID --paths '/*'"
  fi
}

destroy_all() {
  echo "⚠️  This will destroy all CRDT demo stacks. RDS has deletion protection enabled."
  read -p "Type 'yes' to confirm: " confirm
  [ "$confirm" = "yes" ] || err "Aborted."
  cdk destroy CrdtLambdaStack CrdtStaticStack CrdtComputeStack CrdtMessagingStack CrdtDataStack CrdtNetworkStack --force
}

case "${1:-all}" in
  foundation) deploy_foundation ;;
  compute)    deploy_compute ;;
  lambda)     deploy_lambda ;;
  static)     deploy_static ;;
  destroy)    destroy_all ;;
  all)
    deploy_foundation
    deploy_compute
    deploy_lambda
    deploy_static
    ;;
  *) err "Unknown target: $1. Use: foundation | compute | lambda | static | all | destroy" ;;
esac
