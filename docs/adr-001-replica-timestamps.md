# ADR-001: Do Not Persist Replica Timestamps to Database

**Date:** 2025-11-13
**Status:** Accepted

## Problem

After migrating to the Document-based CRDT system, users got a 404 error on GET `/api/sync` after re-login.

**Flow:**
1. User logs in → draws pixels → syncs (POST /api/sync) → logs out
2. User logs in again → GET /api/sync returns `404: CRDT not found for user`

## Root Cause

`Document.toJSON()` was persisting `replicaTimestamps` to MongoDB. On reload, the server thought the client had already seen all data, so `getDeltasForReplica()` returned `null` → 404.

## Key Distinction

| Timestamp Type | What It Tracks | Persist? |
|---|---|---|
| `agentTimestamps` | What each user (agent) has authored | YES — needed for conflict resolution |
| `replicaTimestamps` | What each client connection has received | NO — runtime session state only |

## Decision

Remove `replicaTimestamps` from `Document.toJSON()`. Only persist `collections` and `agentTimestamps`.

## Consequences

**Positive:**
- Fixes 404 on re-login
- Simpler mental model: replicas are ephemeral, agents are persistent
- Smaller DB storage

**Negative:**
- After server restart, first sync sends ALL data instead of incremental deltas
- Each new login treated as a new replica → full state sync

This tradeoff is acceptable because CRDT idempotency makes full-state syncs safe, and server restarts are rare.

## Implementation

`shared/crdt/database/Document.ts`:

```typescript
toJSON() {
  return {
    documentId: this.documentId,
    collections: { ... },
    agentTimestamps: { ... },
    // replicaTimestamps omitted — session state only
  };
}
```

```typescript
const isNewReplica = !this.replicaTimestamps.has(replicaId);

if (isNewReplica && this.collections.size > 0) {
  return this.getAllDeltas();   // new login or post-restart: full state
} else {
  return this.getDeltasSinceLastSeen(replicaId);  // active session: incremental
}
```

## Future Consideration

Client-driven sync protocol ("I last saw timestamp X") could restore incremental sync across sessions without persisting replica state on the server.
