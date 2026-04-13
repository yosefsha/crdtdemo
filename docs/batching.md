# Batching System

Handles large CRDT payloads (>4MB) that would exceed HTTP limits by splitting them into sequential batches.

## Flow

1. Client measures payload size before POST `/api/sync`
2. If <4MB → single request with `batchInfo` metadata
3. If ≥4MB → split into N batches, send sequentially
4. Server accumulates batches by `batchId`, merges incrementally
5. CRDT idempotency handles any duplicates automatically

## Files

| File | Role |
|---|---|
| `rclient/src/services/batchService.ts` | Client-side splitting and sending |
| `server/src/services/batchService.ts` | Server-side session tracking and merging |
| `shared/crdt/database/Document.ts` | `startBatchedDeltasForAgent/Replica()`, `getNextBatch()`, `acknowledgeBatch()`, `cancelBatch()` |

## Limits

- Max batch size: **4MB** (configurable via `maxBatchSize`)
- Max items per batch: **20,000**
- Session TTL: **5 minutes**
- Cleanup interval: every 5 minutes

## Server Log Format

```
[BatchService] Receiving batch 1/7 from user 1, batchId: batch_1735315200000_a3f9e
[BatchService] 📦 Processing batch 1/7 (batchId: batch_1735315200000_a3f9e)
[BatchService] ✅ Applied batch 1/7 - Applied: 15432 items, Missing: 0 items
...
[BatchService] Completed batched sync from user 1, received 7 batches
```

**Applied** = new deltas merged. **Missing** = deltas server had that client didn't send.

## Monitoring

```bash
# Real-time batch activity
docker compose logs server -f | grep -E "(batch|Batch|📦|✅)"

# Last 100 lines filtered
docker compose logs server --tail=100 | grep -E "(batch|Batch)"
```

## Duplicate Handling

No explicit dedup — relies on CRDT idempotency:
- First application: `Applied: N items`
- Second application (duplicate): `Applied: 0 items`, state unchanged

This makes network retries and React StrictMode double-renders harmless.

## Troubleshooting

### No batch logs appearing
- Check browser console for client errors
- Look for "Sync already in progress" guard firing
- Verify requests are reaching the server: `docker compose logs server -f`
- Rebuild client if stale: `docker compose build client && docker compose up client -d`

### Batches hang / sync never completes
```bash
# Check for server errors
docker compose logs server --tail=200 | grep -E "(Error|error|Exception)"

# Test server responsiveness
curl -X POST http://localhost/api/sync \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"deltas":{},"batchInfo":{"batchId":"","batchIndex":0,"totalBatches":1,"isComplete":true}}'
```

### Every batch shows `Applied: 0 items`
This is a problem (nothing is syncing). Check:
- Client is sending real delta data, not empty objects
- Server is loading the correct user's CRDT from DB
- Auth token is valid

`Applied: 0` on a *retry* of an already-applied batch is normal.
