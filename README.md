# CRDT Demo - Collaborative Pixel Canvas

A real-time collaborative pixel canvas application demonstrating Conflict-free Replicated Data Types (CRDTs) with Last-Write-Wins (LWW) semantics.

## 🏗️ Architecture

This is a monorepo project with three main components:

```
crdtdemo/
├── shared/         # Shared CRDT library (npm package)
├── server/         # Node.js Express backend with Socket.io
├── rclient/        # React frontend (Create React App)
└── auth/           # Authentication service (Flask)
```

### Key Features

- **Real-time collaboration**: Multiple users can edit the same canvas simultaneously
- **Conflict resolution**: CRDT-based architecture ensures eventual consistency
- **Agent/Replica model**: Supports multiple replicas per agent for offline-first capabilities
- **WebSocket sync**: Real-time updates via Socket.io
- **Docker deployment**: Full stack containerized with Docker Compose

## 🧩 CRDT System

### Database Abstraction Layer

The project uses a three-tier CRDT architecture:

1. **CRDTDatabase** - Top-level facade managing multiple documents
2. **Document** - Container for multiple collections with synchronized deltas
3. **Collection** - LWW-based collection of CRDT items with conflict resolution

### PixelDataCRDT

A thin wrapper over `CRDTDatabase` specifically for pixel data:

```typescript
// Create a CRDT instance
const crdt = new PixelDataCRDT(agentId, replicaId);

// Set pixel color at coordinate "x,y"
crdt.set("10,20", [255, 0, 0]); // Red pixel

// Get pixel color
const color = crdt.get("10,20"); // [255, 0, 0]

// Sync with another agent
const packet = crdt.getDeltasForAgent(otherAgentId);
const result = otherCrdt.merge(packet);
```

### Sync Patterns

- **Agent-level sync**: Between different users (never tracks other agents' replicas)
- **Replica-level sync**: Between replicas of the same agent (for offline support)

## 🚀 Getting Started

### Prerequisites

- Node.js 16+
- Docker & Docker Compose (for containerized deployment)
- Python 3.9+ (for auth service)

### Local Development

#### 1. Install Dependencies

```bash
# Install shared package dependencies
cd shared
npm install
npm run build

# Install server dependencies
cd ../server
npm install

# Install client dependencies
cd ../rclient
npm install
```

#### 2. Run Services

**Server:**

```bash
cd server
npm start
```

**Client:**

```bash
cd rclient
npm start
```

**Auth Service:**

```bash
cd auth
pip install -r requirements.txt
python app.py
```

### Docker Deployment

```bash
# Build and start all services
docker-compose up --build

# Access the application
# Client: http://localhost
# Server API: http://localhost/api
# Traefik Dashboard: http://localhost:8080
```

## 🧪 Testing

### Server Tests

```bash
cd server
npm test                                    # Run all tests
npm test -- --testPathPattern=pixeldata    # Run specific test suite
```

### Client Tests

```bash
cd rclient
npm test                                    # Run all tests
npm test -- --testPathPattern=sharedImport # Run shared import tests
```

### Shared Package Tests

```bash
cd shared
npm test
```

## 📦 Shared Package

The `shared/` directory is a standalone npm package used by both server and client:

- **Server**: Imports via TypeScript path mapping (`@crdtdemo/shared`)
- **Client**: Imports as npm package (installed via `npm install ../shared`)

### Building Shared Package

```bash
cd shared
npm run build  # Compiles TypeScript to dist/
```

The client requires the compiled `dist/` folder. After making changes to `shared/`:

1. Rebuild: `cd shared && npm run build`
2. Client will pick up changes automatically (package installed as symlink)

## 🏛️ Project Structure

### Shared Package (`shared/`)

```
shared/
├── crdt/
│   ├── database/
│   │   ├── CRDTDatabase.ts    # Main database facade
│   │   ├── Document.ts         # Document container
│   │   ├── Collection.ts       # LWW collection
│   │   └── CRDTItem.ts         # Individual CRDT item
│   └── PixelDataCRDT.ts        # Pixel-specific wrapper
├── dist/                       # Compiled JavaScript (for client)
├── package.json
└── tsconfig.json
```

### Server (`server/`)

```
server/
├── src/
│   ├── routes/
│   │   └── crdtRoutes.ts       # CRDT API endpoints
│   ├── services/
│   │   ├── crdtService.ts      # CRDT business logic
│   │   └── userCrdtDb.ts       # MongoDB persistence
│   └── __tests__/
│       └── pixeldata.test.ts   # CRDT tests
└── socket.js                    # Socket.io real-time sync
```

### Client (`rclient/`)

```
rclient/
├── src/
│   ├── components/
│   │   ├── CanvasEditor.tsx    # Canvas drawing component
│   │   └── UserCRDTPanel.tsx   # Main CRDT integration
│   ├── actions/                 # Redux actions
│   ├── reducers/                # Redux reducers
│   └── __tests__/
└── build/                       # Production build
```

## 🔧 Key APIs

### CRDT Endpoints

- `GET /api/sync` - Load user's CRDT state from server
- `POST /api/sync` - Push local deltas to server
- `WebSocket /socket` - Real-time bidirectional sync

### PixelDataCRDT Methods

```typescript
set(key: Key, color: RGBHEX | null): CollectionDelta | null
get(key: Key): RGBHEX | null
getDeltasForAgent(agentId: AgentId): DocumentDeltaPacket | null
getDeltasForReplica(replicaId: ReplicaId): DocumentDeltaPacket | null
merge(packet: DocumentDeltaPacket): DocumentMergeResult
acknowledgeMerge(result: DocumentMergeResult): void
```

## 🐳 Docker Services

- **traefik**: Reverse proxy (port 80, 8080)
- **server**: Node.js backend (internal port 5001)
- **client**: React app served by nginx (internal port 80)
- **auth**: Flask authentication service

## 📝 Development Notes

### Refactoring History

This project underwent a major refactoring to abstract CRDT logic:

1. **Phase 1**: Created generic `CRDTDatabase` abstraction
2. **Phase 2**: Refactored server to use `CRDTDatabase` (12/12 tests passing)
3. **Phase 3**: Refactored client to use shared implementation
4. **Cleanup**: Removed duplicate code, established single source of truth

### TypeScript Configuration

- **Server**: Uses `ts-node` to compile TypeScript on-the-fly
- **Client**: Uses `react-scripts` (webpack) with compiled `shared` package
- **Shared**: Compiles to CommonJS in `dist/` for client consumption

### Import Strategy

```typescript
// Server (TypeScript path mapping)
import { PixelDataCRDT } from "@crdtdemo/shared";

// Client (npm package)
import { PixelDataCRDT } from "@crdtdemo/shared";
```

Both use the same import path, but resolve differently based on environment.

## 🤝 Contributing

1. Make changes in appropriate directory (`shared/`, `server/`, or `rclient/`)
2. If modifying `shared/`, rebuild: `cd shared && npm run build`
3. Run tests to verify changes
4. Test Docker build: `docker-compose up --build`

## 📄 License

This is a demo project for educational purposes.

## 🔗 Related Documentation

- [CRDT Wikipedia](https://en.wikipedia.org/wiki/Conflict-free_replicated_data_type)
- [Last-Write-Wins](https://en.wikipedia.org/wiki/Last-write-wins)
- [Socket.io](https://socket.io/)
- [Create React App](https://create-react-app.dev/)

## 📋 Architecture Decision Records (ADRs)

### ADR-001: Do Not Persist Replica Timestamps to Database

**Date:** 2025-11-13  
**Status:** Accepted  
**Context:** Migration from old PixelDataCRDT to new Document-based CRDT architecture

#### Problem

After migrating to the new Document-based CRDT system, users experienced a 404 error when logging in after drawing pixels and syncing. The error occurred in this flow:

1. User logs in → draws pixels → syncs (POST /api/sync) → logs out
2. User logs in again → GET /api/sync returns 404: "CRDT not found for user"

**Root Cause Analysis:**

The `Document.toJSON()` method was persisting both `agentTimestamps` AND `replicaTimestamps` to MongoDB:

```typescript
// What was being saved to MongoDB:
{
  collections: { pixels: { items: {...} } },
  agentTimestamps: { userId: { pixels: { "10,20": 12345 } } },
  replicaTimestamps: { "userId_client": { pixels: { "10,20": 12345 } } }  // ❌ Problem!
}
```

When the server loaded this data from DB, the `replicaTimestamps` indicated the client replica had already seen all the data. The `getDeltasForReplica()` method logic:

```typescript
const isNewReplica = !this.replicaTimestamps.has(replicaId);

if (isNewReplica && this.collections.size > 0) {
  // Return all deltas for NEW replica
} else {
  // Return only incremental deltas for EXISTING replica
  // But no new items → returns null → 404 error
}
```

#### The Core Issue

**Replica timestamps are runtime session state, NOT persistent data:**

- `agentTimestamps`: Track what each AGENT (user) has authored → **PERSIST** for conflict resolution
- `replicaTimestamps`: Track what each REPLICA (client connection) has seen → **DON'T PERSIST** (session-only)

When `replicaTimestamps` are persisted:

- Server thinks: "This client has seen all this data"
- Reality: Client disconnected, cleared local state, now wants data back
- Result: Server returns null → 404 error

#### Decision

**Remove `replicaTimestamps` from `Document.toJSON()` serialization.**

Only persist:

- `collections` (actual pixel data)
- `agentTimestamps` (for conflict resolution between agents)

Do NOT persist:

- `replicaTimestamps` (runtime tracking only)

#### Consequences

**Positive:**

- ✅ Fixes 404 error on re-login
- ✅ Simpler mental model: replicas are ephemeral, agents are persistent
- ✅ Data correctness maintained (CRDT guarantees preserved)
- ✅ Reduces storage size (no replica tracking in DB)

**Negative:**

- ⚠️ **Performance tradeoff**: After server restart, first sync sends ALL data instead of incremental deltas
- ⚠️ Each new login treated as "new replica" → full state sent
- ⚠️ Loss of cross-session incremental sync optimization

**Mitigation Strategies for Performance Impact:**

Current implementation accepts the tradeoff because:

1. **CRDT idempotency**: Client can safely merge duplicate deltas (no correctness issue)
2. **Single-user scenario**: `replicaId = userId_client` means one replica per user, so multi-device issues don't apply
3. **Simplicity over optimization**: Server restarts should be rare; sending full state occasionally is acceptable
4. **Future improvement path**: Can implement client-driven sync protocol later ("I last saw timestamp X")

**Alternative Approaches Considered:**

| Approach                   | Pros                       | Cons                                   | Decision                |
| -------------------------- | -------------------------- | -------------------------------------- | ----------------------- |
| **Don't persist replicas** | Simple, correct, fixes bug | Sends full state after restart         | ✅ **Chosen**           |
| Persist replicas           | Optimal bandwidth          | Complex cleanup, current bug persists  | ❌ Rejected             |
| Client-driven sync         | Best performance           | Requires protocol change, more complex | 🔮 Future consideration |
| Always send full state     | Simplest                   | Wasteful even during active sessions   | ❌ Rejected             |

#### Implementation

Modified `shared/crdt/database/Document.ts`:

```typescript
toJSON() {
  return {
    documentId: this.documentId,
    collections: {...},
    agentTimestamps: {...},
    // replicaTimestamps: {...}  ← REMOVED: Don't persist session state
  };
}
```

Modified `getDeltasForReplica()` to check if replica is new:

```typescript
const isNewReplica = !this.replicaTimestamps.has(replicaId);

if (isNewReplica && this.collections.size > 0) {
  // New replica or post-restart → return ALL deltas
  return this.getAllDeltas();
} else {
  // Existing replica in current session → return incremental deltas
  return this.getDeltasSinceLastSeen(replicaId);
}
```

#### References

- Issue: 404 error on GET /api/sync after re-login
- MongoDB inspection: `replicaTimestamps` found in persisted documents
- Server logs: "No deltas found" when replicas already tracked
- CRDT principles: Session state vs. persistent state separation

---
