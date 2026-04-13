# CRDT Demo - Claude Code Guide

## Project Overview

Real-time collaborative pixel canvas using CRDT (Conflict-free Replicated Data Types) with Last-Write-Wins semantics. Monorepo with four services.

## Monorepo Structure

```
crdtdemo/
├── shared/     # CRDT library (npm package) — source of truth for CRDT logic
├── server/     # Node.js + Express + Socket.io backend
├── rclient/    # React frontend (Create React App + Redux)
└── auth/       # Flask authentication service
```

## Key Rule: Rebuild Shared After Changes

Whenever `shared/` is modified, rebuild before testing:

```bash
cd shared && npm run build
```

The client imports the compiled `dist/` folder. Skipping this is a common source of bugs.

## Local Development

```bash
# 1. Shared package
cd shared && npm install && npm run build

# 2. Server
cd server && npm install && npm start     # port 5001

# 3. Client
cd rclient && npm install && npm start    # port 3000

# 4. Auth (optional for local dev)
cd auth && pip install -r requirements.txt && python app.py
```

## Docker (Full Stack)

```bash
docker-compose up --build
# Client:  http://localhost
# API:     http://localhost/api
# Traefik: http://localhost:8080
```

## Testing

```bash
# Shared
cd shared && npm test

# Server
cd server && npm test
cd server && npm test -- --testPathPattern=pixeldata

# Client
cd rclient && npm test
cd rclient && npm test -- --testPathPattern=sharedImport
```

## CRDT Architecture

Three-tier hierarchy in `shared/crdt/database/`:

| Class | Role |
|---|---|
| `CRDTDatabase` | Top-level facade, manages multiple documents |
| `Document` | Container for collections, handles delta sync |
| `Collection` | LWW collection with conflict resolution |
| `CRDTItem` | Individual item with timestamp |

`PixelDataCRDT` (`shared/crdt/PixelDataCRDT.ts`) is a thin wrapper over `CRDTDatabase` for pixel data.

### Core API

```typescript
const crdt = new PixelDataCRDT(agentId, replicaId);

crdt.set("x,y", [255, 0, 0]);           // set pixel
crdt.get("x,y");                          // get pixel
crdt.getDeltasForAgent(otherAgentId);     // get deltas to send
crdt.merge(packet);                       // merge incoming deltas
crdt.acknowledgeMerge(result);            // confirm merge
```

### Sync Model

- **Agent sync**: Between different users — tracks what each agent has authored
- **Replica sync**: Between replicas of the same agent — for offline/multi-tab support
- `agentTimestamps` → persisted to DB (conflict resolution)
- `replicaTimestamps` → runtime only, NOT persisted (see [ADR-001](docs/adr-001-replica-timestamps.md))

## API Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/sync` | Load user's CRDT state from server |
| `POST` | `/api/sync` | Push local deltas to server |
| `WebSocket` | `/socket` | Real-time bidirectional sync |

## Batching System (Large Payloads)

Payloads >4MB are split into sequential batches. See [batching docs](docs/batching.md) for full details.

- Client (`rclient/src/services/batchService.ts`): detects size, splits if needed
- Server (`server/src/services/batchService.ts`): merges incrementally using `batchId`
- CRDT idempotency handles duplicate batches — no explicit dedup needed

**Batch limits:** 4MB / 20,000 items per batch. Sessions expire after 5 min.

**Debug batching:**
```bash
docker compose logs server -f | grep -E "(batch|Batch|📦|✅)"
```

## Import Strategy

Both server and client use `@crdtdemo/shared` but resolve differently:
- **Server**: TypeScript path mapping → resolves to `shared/` source
- **Client**: npm package → resolves to `shared/dist/` compiled output

## TypeScript Setup

- **Server**: `ts-node` (compile on-the-fly)
- **Client**: `react-scripts` / webpack
- **Shared**: Compiles to CommonJS in `dist/`

## Docker Services

| Service | Description | Port |
|---|---|---|
| `traefik` | Reverse proxy | 80, 8080 |
| `server` | Node.js backend | 5001 (internal) |
| `client` | React + nginx | 80 (internal) |
| `auth` | Flask auth | internal |

## Common Gotchas

1. **404 on GET /api/sync after re-login** — caused by persisting `replicaTimestamps`. Fixed in ADR-001.
2. **Client shows stale CRDT behavior** — likely forgot to rebuild shared: `cd shared && npm run build`
3. **Batch sync never completes** — check server memory, look for `Error` in logs
4. **Duplicate batches showing `Applied: 0`** — expected behavior in React StrictMode / on retry

## Additional Docs

- [ADR-001: Don't Persist Replica Timestamps](docs/adr-001-replica-timestamps.md)
- [Batching System](docs/batching.md)
