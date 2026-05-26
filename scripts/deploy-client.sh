#!/usr/bin/env bash
# Build React client and deploy to S3 + invalidate CloudFront
# Usage: ./scripts/deploy-client.sh

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

log() { echo "▶ $*"; }
err() { echo "✗ $*" >&2; exit 1; }

BUCKET=$(aws cloudformation describe-stacks \
  --stack-name CrdtStaticStack \
  --query "Stacks[0].Outputs[?OutputKey=='BucketName'].OutputValue" \
  --output text 2>/dev/null) || err "CrdtStaticStack not deployed yet. Run: ./scripts/cdk-deploy.sh static"

DIST_ID=$(aws cloudformation describe-stacks \
  --stack-name CrdtStaticStack \
  --query "Stacks[0].Outputs[?OutputKey=='DistributionId'].OutputValue" \
  --output text)

log "Building React client (REACT_APP_MYENV=prod)..."
cd "$REPO_ROOT/rclient"
REACT_APP_MYENV=prod npm run build

log "Syncing to S3 bucket: $BUCKET"
aws s3 sync build/ "s3://$BUCKET" --delete

log "Invalidating CloudFront distribution: $DIST_ID"
INVALIDATION_ID=$(aws cloudfront create-invalidation \
  --distribution-id "$DIST_ID" \
  --paths "/*" \
  --query "Invalidation.Id" \
  --output text)

log "Invalidation started: $INVALIDATION_ID"
log "App will be live at https://crdt.yossidemo.click in ~30 seconds"
