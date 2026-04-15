# AWS Deployment Status

## Stacks

| Stack | Status | Notes |
|---|---|---|
| `CrdtNetworkStack` | ✅ Deployed | VPC, security groups |
| `CrdtMessagingStack` | ✅ Deployed | SQS queue + DLQ |
| `CrdtDataStack` | ✅ Deployed | RDS PostgreSQL 15.17, Secrets Manager |
| `CrdtComputeStack` | ❌ Not deployed | See fixes below |
| `CrdtLambdaStack` | ❌ Not deployed | Depends on compute |
| `CrdtStaticStack` | ❌ Not deployed | S3 + CloudFront |

## Fixes Required Before Next Deploy

### 1. POSTGRES_URL secret field is wrong (`compute_stack.py`)
Both server and auth containers have:
```python
"POSTGRES_URL": ecs.Secret.from_secrets_manager(data.db_credentials, field="dbInstanceIdentifier")
```
`dbInstanceIdentifier` is the RDS instance name — not a connection URL. Options:
- Pass individual fields as separate secrets and construct URL in server code
- Create a dedicated Secrets Manager secret with the full connection string

### 2. Verify `/auth/health` endpoint exists in Flask auth service
The ECS health check calls `GET /auth/health`. Check `auth/app.py` — if the route is missing, add it.

### 3. `/api/health` is confirmed present in `server/src/index.ts` ✅

## Already Fixed (committed on `awscdk` branch)

| Fix | File |
|---|---|
| Health checks use `wget` (not `curl` — not in `node:18`) | `cdk/stacks/compute_stack.py` |
| Images built with `--platform linux/amd64` (Fargate needs amd64, M-series builds arm64) | `scripts/build-and-push.sh` |
| PostgreSQL version uses `of("15.17")` (named constant `VER_15_17` not in CDK lib) | `cdk/stacks/data_stack.py` |
| TypeScript compiled at build time via `RUN npx tsc` (not at runtime — devDeps excluded) | `server/Dockerfile` |
| `crdtdemo/auth` ECR repository created | manual / AWS console |
| Subdomains: `crdt.yossidemo.click` (frontend), `crdtapi.yossidemo.click` (API) | `cdk/stacks/compute_stack.py`, `static_stack.py` |

## Next Session Checklist

1. Fix `POSTGRES_URL` in `cdk/stacks/compute_stack.py`
2. Verify / add `/auth/health` route in `auth/app.py`
3. `./scripts/cdk-deploy.sh foundation`
4. `./scripts/cdk-deploy.sh compute`
5. Set Replicate API token: `aws secretsmanager put-secret-value --secret-id crdtdemo/replicate-api-token --secret-string "r8_..."`
6. `./scripts/cdk-deploy.sh lambda`
7. `./scripts/cdk-deploy.sh static` + `./scripts/deploy-client.sh`

## Deployment Scripts

| Script | Usage |
|---|---|
| `./scripts/cdk-deploy.sh [foundation\|compute\|lambda\|static\|all]` | Deploy CDK stacks |
| `./scripts/build-and-push.sh [server\|auth\|all]` | Build amd64 images + push to ECR |
| `./scripts/deploy-client.sh` | Build React + sync to S3 + CloudFront invalidation |
