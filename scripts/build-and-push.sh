#!/usr/bin/env bash
# Build and push Docker images to ECR
# Usage:
#   ./scripts/build-and-push.sh          # build + push server and auth
#   ./scripts/build-and-push.sh server   # server only
#   ./scripts/build-and-push.sh auth     # auth only

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
AWS_ACCOUNT="963352896991"
AWS_REGION="us-east-1"
ECR_BASE="$AWS_ACCOUNT.dkr.ecr.$AWS_REGION.amazonaws.com"

log() { echo "▶ $*"; }
err() { echo "✗ $*" >&2; exit 1; }

ecr_login() {
  log "Logging in to ECR..."
  aws ecr get-login-password --region "$AWS_REGION" \
    | docker login --username AWS --password-stdin "$ECR_BASE"
}

build_push_server() {
  log "Building server image..."
  docker build -t "$ECR_BASE/crdtdemo/node:latest" "$REPO_ROOT/server"
  log "Pushing server image..."
  docker push "$ECR_BASE/crdtdemo/node:latest"
  log "Server image pushed: $ECR_BASE/crdtdemo/node:latest"
}

build_push_auth() {
  log "Building auth image..."
  docker build -t "$ECR_BASE/crdtdemo/auth:latest" "$REPO_ROOT/auth"
  log "Pushing auth image..."
  docker push "$ECR_BASE/crdtdemo/auth:latest"
  log "Auth image pushed: $ECR_BASE/crdtdemo/auth:latest"
}

force_redeploy() {
  log "Forcing ECS service redeployment..."
  aws ecs update-service \
    --cluster crdt-demo \
    --service crdt-server \
    --force-new-deployment \
    --query "service.serviceName" --output text
  aws ecs update-service \
    --cluster crdt-demo \
    --service crdt-auth \
    --force-new-deployment \
    --query "service.serviceName" --output text
  log "Redeployment triggered. Run 'aws ecs describe-services --cluster crdt-demo --services crdt-server crdt-auth' to check status."
}

ecr_login

case "${1:-all}" in
  server) build_push_server; force_redeploy ;;
  auth)   build_push_auth;   force_redeploy ;;
  all)    build_push_server; build_push_auth; force_redeploy ;;
  *) err "Unknown target: $1. Use: server | auth | all" ;;
esac
