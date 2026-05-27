# CRDT: Concepts, Design, and Implementation

## 1. The Problem: Collaborative State Without a Coordinator

In any collaborative application — shared documents, multiplayer games, pixel canvases — multiple clients need to modify shared state concurrently. The naive solution is to funnel every write through a single authoritative server that serializes operations. That works, but it has serious costs:

- **Latency**: every write is blocked until the server round-trips
- **Availability**: if the server is down, nothing works
- **Offline support**: impossible — you can't write if you can't phone home

The classical distributed systems answer is **Operational Transformation (OT)**, used by Google Docs. OT tracks every edit as an operation and transforms concurrent operations against each other. It works, but it requires a central server to act as the transformation arbiter — which reintroduces the bottleneck — and the transformation rules are notoriously complex to implement correctly.

**CRDTs (Conflict-free Replicated Data Types)** solve the same problem differently: instead of transforming operations, they define data types whose merge function is always correct, regardless of the order in which updates arrive. Any two replicas that have seen the same set of updates will converge to the same state — with no coordinator and no transformation logic.

The three algebraic properties that make this possible:
- **Commutative**: `merge(A, B) == merge(B, A)` — order of arrival doesn't matter
- **Associative**: `merge(merge(A, B), C) == merge(A, merge(B, C))` — grouping doesn't matter
- **Idempotent**: `merge(A, A) == A` — applying the same update twice is harmless

If a merge function satisfies these three properties, the system guarantees eventual consistency without any coordination.

---

## 2. CRDT Families

There are two main families:

**State-based CRDTs (CvRDT)**: replicas exchange their full state; merge computes the join (least upper bound) of two states. Simple but bandwidth-heavy for large states.

**Operation-based CRDTs (CmRDT)**: replicas broadcast individual operations; the data structure is designed so any ordering of those operations produces the same result. Bandwidth-efficient but requires reliable delivery.

**Delta-state CRDTs**: a middle ground — only the *delta* (changed portion) of the state is shipped, not the full state. This is what this codebase implements. Each sync sends only the items that changed since the peer last synced.

---

## 3. Last-Write-Wins (LWW)

The simplest and most practical CRDT strategy for mutable values is **Last-Write-Wins (LWW)**. The idea: attach a timestamp to every write. When two replicas have different values for the same key, the one with the higher timestamp wins. The older write is discarded.

LWW is a CRDT because:
- Comparing timestamps is commutative and associative
- Applying the same update twice still results in the same winner (idempotent)
- Every replica runs identical comparison logic → identical result

The weakness: clock skew. If two clients' clocks differ, the "later" write might not actually be the one the user intended. In practice, for low-stakes data like a collaborative canvas, this tradeoff is acceptable. For financial or ordering-sensitive data, you would use a more sophisticated CRDT (e.g., a sequence CRDT or hybrid logical clocks).

---

## 4. This Codebase: Architecture

The implementation lives in `shared/crdt/` and is a four-class hierarchy:

```
CRDTDatabase          (facade; manages multiple documents per agent)
  └── Document        (sync unit; holds multiple collections + vector clocks)
        └── Collection (map of itemId → CRDTItem; computes deltas)
              └── CRDTItem (one value + timestamp + replicaId + agentId)
```

`PixelDocument` (`shared/crdt/PixelDocument.ts`) is a thin application-specific wrapper over `Document` that fixes the collection ID to `"pixels"` and the key format to `"x,y"`.

### CRDTItem — the atomic unit

```typescript
// shared/crdt/database/CRDTItem.ts

class CRDTItem<T> {
  private value: T | null;
  private metadata: { timestamp: number; replicaId: ReplicaId; agentId: AgentId };

  update(newValue, timestamp, replicaId, agentId): boolean {
    if (timestamp > this.metadata.timestamp) {
      this.value = newValue;
      this.metadata = { timestamp, replicaId, agentId };
      return true; // accepted
    }
    if (timestamp === this.metadata.timestamp && replicaId > this.metadata.replicaId) {
      this.value = newValue;
      this.metadata = { timestamp, replicaId, agentId };
      return true; // accepted via tiebreaker
    }
    return false; // rejected
  }
}
```

**Rule**: newer timestamp wins. Equal timestamps broken by `replicaId` string comparison. This is deterministic — every replica reaches the same winner, so they all converge.

### Collection — a keyed map with delta computation

```typescript
// shared/crdt/database/Collection.ts

class Collection<T> {
  private items: Map<ItemId, CRDTItem<T>>;

  // Returns only items with timestamp > what the caller already knows
  getDeltasSince(timestamps: Map<ItemId, number>): CollectionDelta<T>[] {
    const deltas = [];
    this.items.forEach((item, itemId) => {
      const lastKnown = timestamps.get(itemId) || 0;
      if (item.getTimestamp() > lastKnown) {
        deltas.push({ itemId, value, timestamp, replicaId, agentId });
      }
    });
    return deltas;
  }

  // Applies incoming deltas; returns only the ones that were accepted
  applyDeltas(deltas): CollectionDelta<T>[] {
    return deltas.filter(delta => this.applyDelta(delta));
  }
}
```

### Document — the sync unit

`Document` contains multiple `Collection`s and owns the two vector clock systems that make efficient delta sync possible.

```typescript
// shared/crdt/database/Document.ts

class Document<T> {
  private collections: Map<CollectionId, Collection<T>>;
  private agentTimestamps:  Map<AgentId,  Map<CollectionId, Map<ItemId, number>>>;
  private replicaTimestamps: Map<ReplicaId, Map<CollectionId, Map<ItemId, number>>>;
}
```

---

## 5. Two Vector Clock Systems: Agent vs. Replica

This is the most important design distinction in the system.

### Agent (inter-user sync)

An **agent** is a user. `agentTimestamps` answers: *"for each item, what is the latest timestamp that agent X has authored or received?"*

- **Used for**: syncing between different users
- **Persisted**: yes — stored in the database via `toDBJSON()`
- **Method**: `getDeltasForAgent(agentId)` returns all items where `item.timestamp > agentTimestamps[agentId][collectionId][itemId]`

When agent A sends deltas to agent B, A calls `acknowledgeMerge(B, result)` on its document. This records what B now has, so future calls to `getDeltasForAgent(B)` skip those items.

### Replica (intra-user sync)

A **replica** is a browser tab / connection. `replicaTimestamps` answers: *"for this specific connection, what has it received so far?"*

- **Used for**: syncing between the server and a specific client connection
- **Persisted**: **NO** — deliberately excluded from `toDBJSON()` (see ADR-001 below)
- **Method**: `getDeltasForReplica(replicaId)` works identically but consults `replicaTimestamps`

**ADR-001 decision**: Persisting `replicaTimestamps` caused a 404 bug after re-login. The server remembered that a previous connection had received data, and served empty deltas to a new connection with the same user ID. The fix: `replicaTimestamps` are ephemeral (session-only). On server restart or re-login, the new connection gets a full sync. Slightly more data on reconnect, but always correct.

---

## 6. The Merge Algorithm

```typescript
// Document.merge() — shared/crdt/database/Document.ts:368

merge(packet: DocumentDeltaPacket<T>): DocumentMergeResult<T> {
  const applied = {};
  const missing = {};

  // Phase 1: apply incoming deltas using LWW
  for (const [collectionId, deltas] of Object.entries(packet.collectionDeltas)) {
    const collection = this.getCollection(collectionId);
    const appliedDeltas = collection.applyDeltas(deltas); // LWW inside

    if (appliedDeltas.length > 0) {
      applied[collectionId] = appliedDeltas;
      // Update vector clocks for items that changed
      for (const delta of appliedDeltas) {
        this.updateVectorClock(collectionId, delta.itemId, delta.timestamp,
                               delta.agentId, delta.replicaId);
      }
    }
  }

  // Phase 2: calculate what the sender is missing
  for (const [collectionId, collection] of this.collections) {
    const senderItems = this.agentTimestamps.get(packet.fromAgent)
                          ?.get(collectionId) || new Map();
    const missingDeltas = collection.getDeltasSince(senderItems);
    if (missingDeltas.length > 0) missing[collectionId] = missingDeltas;
  }

  return { applied, missing };
}
```

`applied` = what we accepted from the sender (they should acknowledge receipt).
`missing` = what we have that the sender doesn't (we can push it back, or suppress it — see the sync loop issue below).

### acknowledgeMerge

After the sender receives the merge result, it calls `acknowledgeMerge(agentId, result)`:

```typescript
acknowledgeMerge(agentId, mergeResult): void {
  // Mark applied deltas as known to this agent
  for (const [collectionId, deltas] of Object.entries(mergeResult.applied)) {
    for (const delta of deltas) {
      agentTimestamps[agentId][collectionId][delta.itemId] =
        max(current, delta.timestamp);
    }
  }
  // Also mark missing deltas — sender had them, so they definitely have them
  for (const [collectionId, deltas] of Object.entries(mergeResult.missing)) {
    // same update logic
  }
}
```

After this, the next `getDeltasForAgent(agentId)` call will skip all acknowledged items.

---

## 7. Full Request/Response Flow → Convergence

### 7a. Client Boot: GET /api/sync

```
Browser opens canvas
  → GET /api/sync (JWT in header)
  → Server: load user's Document from DB
  → Server: getDeltasForReplica(clientConnectionId)
      replicaTimestamps has no entry for this new connection
      → returns ALL items (getDeltasSince(empty map) = everything)
  → Response: { packet: DocumentDeltaPacket }
  → Client: crdt.merge(packet) → local CRDT populated
  → Client: Redux store updated → canvas renders
```

### 7b. User Draws a Pixel: POST /api/sync

```
User clicks canvas at (10, 20) with color #FF0000
  → pixelDocument.set("10,20", "ff0000ff")
      timestamp = Date.now()   ← client-side clock
      CRDTItem created/updated with LWW check
      returns CollectionDelta if accepted, null if LWW rejected

  → Client: accumulate deltas since last sync
  → Client batchService: measure JSON.stringify size
      if < 4MB:  single POST /api/sync  { packet: DocumentDeltaPacket }
      if ≥ 4MB:  split → sequential POST requests with batchId

  → Server receives batch:
      crdtService.syncUserDeltas(userId, packet)
        → document.merge(packet)
            LWW runs on each delta
            applied = deltas accepted
            missing = what client doesn't have (suppressed — see below)
        → document.acknowledgeReplicaMerge(clientId, { applied, missing: {} })
        → save document to DB (toDBJSON — no replicaTimestamps)
      → respond { applied: [...], missing: {} }

  → Client: acknowledge applied deltas
  → Client: update local replicaTimestamps

WHY missing is suppressed:
  If server returned missing deltas, client would merge them, then try to
  push them back on the next sync, causing an infinite echo loop.
  Fix: server returns missing: {} for POST /api/sync. Client only uses
  the applied result to update its vector clock.
```

### 7c. Real-time Propagation: WebSocket

```
Another user (B) draws a pixel
  → B's client POST /api/sync → server merges → saves

  → Server: socket.io broadcasts delta packet to all connected clients
  → Client A receives: socket event with DocumentDeltaPacket
  → Client A: crdt.merge(packet)
      LWW resolves any conflicts with local state
  → Redux store dispatched → React re-renders affected pixels
```

### 7d. Inter-User Sync: GET /api/sync-from-other

This is how User A loads User B's canvas:

```
User A wants to see User B's state
  → GET /api/sync-from-other?sourceUser=B
  → Server: load User B's Document from DB
  → Server: B_document.getDeltasForAgent(A)
      agentTimestamps[A] → only items A hasn't seen
      If > 4MB: startBatchedDeltasForAgent(A) → splits into batches
  → Response: { packet, batchInfo }

  → Client A: merge packet into local CRDT
  → Client A: POST /api/acknowledge-from-other { sourceUser: B, mergeResult }
  → Server: load User B's Document
  → Server: B_document.acknowledgeMerge(A, mergeResult)
      agentTimestamps[B][...][A] updated
  → Server: save User B's Document

  → Next sync-from-other: getDeltasForAgent(A) skips acknowledged items
```

### 7e. Concurrent Conflict: Two Users Write the Same Pixel

```
Time T — both users online, drawing simultaneously:

User A: set("10,20", "ff0000ff") at timestamp T=1000, replicaId="replica-A"
User B: set("10,20", "0000ffff") at timestamp T=1001, replicaId="replica-B"

A's delta arrives at server first:
  → CRDTItem("10,20"): value=RED, timestamp=1000, replicaId="replica-A"

B's delta arrives 50ms later:
  → CRDTItem.update(BLUE, 1001, "replica-B", ...)
  → 1001 > 1000  → accept
  → CRDTItem("10,20"): value=BLUE, timestamp=1001, replicaId="replica-B"

Server saves BLUE. WebSocket broadcasts BLUE to A.
A's client receives packet → crdt.merge():
  → local CRDTItem("10,20") is RED at T=1000
  → incoming: BLUE at T=1001
  → 1001 > 1000 → accept BLUE
  → A's canvas now shows BLUE

Result: both clients converge to BLUE regardless of arrival order.

Same-millisecond tiebreaker:
  A: T=1000, replicaId="replica-A"
  B: T=1000, replicaId="replica-B"
  → "replica-B" > "replica-A" (string compare)
  → B wins → BLUE
  → deterministic on all replicas
```

### 7f. What "Convergence" Means Here

Two replicas have converged when:
1. They have exchanged all deltas (nothing in `getDeltasForAgent()` returns new items)
2. Every LWW conflict has been resolved identically (same timestamp comparison on both sides)
3. Both `agentTimestamps` agree on the latest timestamp for every item

Because the merge function is commutative and idempotent:
- Replay of the same packet changes nothing (idempotency → safe retries)
- Packets arriving in different orders produce the same result (commutativity → order independence)
- `agentTimestamps` ensure no item is shipped more than necessary (vector clocks → efficiency)

---

## 8. Batching: Handling Large Payloads

A canvas with 100,000 pixels can exceed 4MB of JSON. The batching system splits the sync into sequential chunks.

**Client** (`rclient/src/services/batchService.ts`):
```
measure size: new Blob([JSON.stringify(packet)]).size
if < 4MB → single POST with batchInfo
if ≥ 4MB → splitPayloadIntoBatches() → sequential POSTs
accumulate applied[] across all batches
```

**Server** (`server/src/services/batchService.ts`):
```
receive batch → crdtService.syncUserDeltas(userId, packet)
track session by batchId → merge incrementally
return { applied, missing: {} } per batch
on completion → clean up session
TTL: 5 minutes on incomplete sessions
```

**Shared layer** (`Document.startBatchedDeltasForAgent`):
- Estimates packet size by sampling deltas (avoids full JSON.stringify)
- Threshold: 80% of 5MB = ~4MB
- Splits at `maxItemsPerBatch` (20,000) or `maxBytesPerBatch` (5MB)
- CRDT idempotency handles duplicate batches automatically — no explicit dedup needed

---

## 9. Persistence Model

`Document.toDBJSON()` saves:
- `collections` — all items with their values and LWW metadata
- `agentTimestamps` — per-agent vector clock (needed for correct inter-user sync)

`Document.toDBJSON()` **intentionally excludes**:
- `replicaTimestamps` — session-only; a new connection always gets what it needs

DB schema (per user):
```json
{
  "userId": "user-123",
  "crdt": {
    "documentId": "user-123",
    "collections": {
      "pixels": {
        "items": {
          "10,20": { "value": "ff0000ff", "timestamp": 1748300000000,
                     "replicaId": "replica-A", "agentId": "user-123" }
        }
      }
    },
    "agentTimestamps": {
      "user-123": { "pixels": { "10,20": 1748300000000 } },
      "user-456": { "pixels": { "5,15":  1748299990000 } }
    }
  }
}
```

---

## 10. Key Design Decisions

| Decision | Why |
|---|---|
| LWW over other CRDTs | Pixel canvas has no ordering constraints; simpler is better |
| Client-side timestamps | Avoids server round-trip for writes; clock skew acceptable here |
| `replicaTimestamps` not persisted | Stale replica tracking caused 404s on re-login (ADR-001) |
| Suppress `missing` on POST /api/sync | Returning missing caused infinite echo loop between client and server |
| Delta-state, not full-state sync | Full canvas state can be 25MB+; delta keeps payloads small |
| `agentTimestamps` persisted | Required for correct per-user conflict tracking across server restarts |
| Batching at 4MB / 20k items | JSON over HTTP has practical limits; sequential batches preserve CRDT semantics |
| Socket.io for real-time push | Avoids polling; server pushes deltas immediately after merging a peer's update |

---

## 11. Summary: Why This Works

The system achieves eventual consistency through four interlocking mechanisms:

1. **LWW determinism**: any replica receiving the same set of deltas computes the same state
2. **Vector clocks**: track exactly what each peer has seen, preventing redundant sends
3. **Idempotency**: duplicate or out-of-order delivery cannot corrupt state
4. **Acknowledgement loop**: `acknowledgeMerge` updates the vector clock so `getDeltasForAgent` converges toward returning nothing (empty diff = fully synced)

The overall effect: users can draw freely, go offline, come back, and the canvas always reconciles — no locks, no coordinator, no user-visible conflict prompts.
