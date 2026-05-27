# Feature Roadmap

## Distributed Tombstone Garbage Collection

**Status:** Design complete, not yet implemented

### Problem

Deleted pixels are stored as null-value tombstones (`value = null`) in the collection Map but are never physically removed. The Map grows unboundedly as pixels are deleted.

### Design Principle

The server is treated as just another peer — no central coordinator. Every peer runs identical GC logic and reaches the same conclusion independently via gossip.

### New Per-Peer State

```typescript
// Max timestamp this peer has received from each agent
// Updated inside merge() as deltas arrive
acknowledgedVector: Map<AgentId, number>

// What this peer has learned about every other peer's acknowledgedVector
// Updated at the sync/transport layer when exchanging deltas
knownVectors: Map<PeerId, Map<AgentId, number>>
```

At ~200 peers × 200 agents × 8 bytes ≈ 320KB per peer.

### Stable Frontier (computed locally, no coordination)

```typescript
stableVector[agentId] = min(knownVectors[peer][agentId]) for all peer in activeMembership
```

A tombstone from `agentId` at `timestamp T` is safe to physically delete when `stableVector[agentId] >= T` — meaning every known peer has received that agent's updates up to at least T.

### Sync Protocol Change

Piggyback `acknowledgedVector` on every existing delta exchange. No extra round-trips:

```
Peer A → Peer B:  { deltas, acknowledgedVector: A's vector }
Peer B → Peer A:  { deltas, acknowledgedVector: B's vector }
```

### Membership

A CRDT grow-set of peers, each entry carrying a last-heartbeat timestamp. Gossips passively with deltas.

- **Peer offline temporarily** — frozen in membership, its last-known vector doesn't update, GC stalls for its tombstones until it reconnects or TTL expires.
- **Peer TTL expires** (30 days no heartbeat) — evicted from membership, no longer blocks GC.
- **Peer reconnects after TTL** — receives a full state snapshot from any live peer instead of deltas (deltas for that era are gone, same as Postgres WAL recycling).

### GC Sweep (background job on each peer)

```typescript
for (const [itemId, item] of collection.items) {
  if (item.getValue() === null &&
      item.getMetadata().timestamp <= stableVector[item.getMetadata().agentId]) {
    collection.items.delete(itemId)
  }
}
```

Runs independently on each peer. Converges to the same result because `stableVector` converges via gossip.

### New Peer Bootstrap

A fresh peer requests a full materialized snapshot from any live peer. The snapshot contains only live (non-null) values — tombstones below the stable frontier are already GC'd and don't need to be transmitted.

### Files to Modify

| File | Change |
|---|---|
| `shared/crdt/database/CRDTItem.ts` | No change needed |
| `shared/crdt/database/Collection.ts` | Add GC sweep method |
| `shared/crdt/database/Document.ts` | Add `acknowledgedVector`, update on `merge()` |
| `shared/crdt/database/CRDTDatabase.ts` | Add `knownVectors`, membership set, `stableVector` computation |
| `server/src/` / sync layer | Exchange `acknowledgedVector` alongside deltas |
| `shared/crdt/PixelDataCRDT.ts` | Expose GC trigger if needed |
