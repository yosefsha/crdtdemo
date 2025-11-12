// SIMPLIFIED PixelDataCRDT - Just a thin wrapper over CRDTDatabase
// Breaking changes: No backward compatibility with old format

import {
  CRDTDatabase,
  AgentId,
  ReplicaId,
  DocumentDeltaPacket,
  DocumentMergeResult,
} from "@crdtdemo/shared";
import type { Key } from "./CRDTTypes";

// Pixel-specific types
export type RGB = [number, number, number];

const DOCUMENT_ID = "canvas";
const COLLECTION_ID = "pixels";

// Re-export for convenience
export type { AgentId, ReplicaId };
export type {
  DocumentDeltaPacket as PixelDeltaPacket,
  DocumentMergeResult as MergeResult,
};

export class PixelDataCRDT {
  private db: CRDTDatabase;

  constructor(agentId: AgentId, replicaId: ReplicaId) {
    this.db = new CRDTDatabase(agentId, replicaId);
  }

  // Match old API: set(key, color) where key is "x,y"
  set(key: Key, color: RGB | null) {
    return this.db.setItem(DOCUMENT_ID, COLLECTION_ID, key, color);
  }

  // Match old API: get(key) where key is "x,y"
  get(key: Key): RGB | null {
    return this.db.getItem<RGB>(DOCUMENT_ID, COLLECTION_ID, key);
  }

  getDeltasForAgent(agentId: AgentId) {
    return this.db.getDeltasForAgent(DOCUMENT_ID, agentId);
  }

  // Alias for old tests
  getDeltaForAgent(agentId: AgentId) {
    return this.getDeltasForAgent(agentId);
  }

  getDeltasForReplica(replicaId: ReplicaId) {
    return this.db.getDeltasForReplica(DOCUMENT_ID, replicaId);
  }

  // Alias for old tests
  getDeltaForReplica(replicaId: ReplicaId) {
    return this.getDeltasForReplica(replicaId);
  }

  merge(packet: any) {
    return this.db.mergeDocument(packet);
  }

  acknowledgeMerge(agentId: AgentId, mergeResult: any) {
    this.db.acknowledgeMerge(DOCUMENT_ID, agentId, mergeResult);
  }

  // Old API: calls acknowledgeMerge and returns deltas
  handleMergeAgentResult(result: any, fromAgent: AgentId) {
    this.acknowledgeMerge(fromAgent, result);
    return this.getDeltaForAgent(fromAgent);
  }

  // Old API: for replica-level sync
  handleMergeReplicaResult(result: any, fromReplica: ReplicaId) {
    this.db.acknowledgeReplicaMerge(DOCUMENT_ID, fromReplica, result);
    return this.getDeltaForReplica(fromReplica);
  }

  getAllDeltas() {
    return this.db.getAllDeltas(DOCUMENT_ID);
  }

  getInfo() {
    return this.db.getInfo();
  }

  // Get all pixel values as a flat object
  get values(): Record<string, RGB> {
    const doc = this.db["documents"].get(DOCUMENT_ID);
    if (!doc) return {};

    const collection = doc["collections"].get(COLLECTION_ID);
    if (!collection) return {};

    const result: Record<string, RGB> = {};
    for (const [key, item] of collection["items"]) {
      if (item.getValue() !== null) {
        result[key] = item.getValue() as RGB;
      }
    }
    return result;
  }

  toJSON() {
    return this.db.toJSON();
  }

  static fromJSON(json: any) {
    const db = CRDTDatabase.fromJSON(json);
    const info = db.getInfo();
    const crdt = new PixelDataCRDT(info.agentId, info.replicaId);
    crdt.db = db;
    return crdt;
  }
}
