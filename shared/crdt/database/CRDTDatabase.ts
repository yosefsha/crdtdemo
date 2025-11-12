// CRDTDatabase: Main facade for the CRDT database system
// Manages documents which contain collections of CRDT items

import {
  Document,
  DocumentDeltaPacket,
  DocumentMergeResult,
  DocumentId,
  CollectionId,
} from "./Document";
import { CollectionDelta } from "./Collection";
import { AgentId, ReplicaId, ItemId } from "./CRDTItem";

export { AgentId, ReplicaId, ItemId, DocumentId, CollectionId };
export { CollectionDelta, DocumentDeltaPacket, DocumentMergeResult };
export { CRDTItem, CRDTMetadata } from "./CRDTItem";
export { Collection } from "./Collection";
export { Document } from "./Document";

/**
 * Main CRDTDatabase class
 * Manages multiple documents, each containing multiple collections
 */
export class CRDTDatabase {
  private agentId: AgentId;
  private replicaId: ReplicaId;
  private documents: Map<DocumentId, Document<any>>;

  constructor(agentId: AgentId, replicaId: ReplicaId) {
    this.agentId = agentId;
    this.replicaId = replicaId;
    this.documents = new Map();
  }

  /**
   * Get database info
   */
  getInfo(): { agentId: AgentId; replicaId: ReplicaId } {
    return {
      agentId: this.agentId,
      replicaId: this.replicaId,
    };
  }

  /**
   * Get or create a document
   */
  getDocument<T = any>(documentId: DocumentId): Document<T> {
    let doc = this.documents.get(documentId);
    if (!doc) {
      doc = new Document<T>(documentId);
      this.documents.set(documentId, doc);
    }
    return doc as Document<T>;
  }

  /**
   * Check if a document exists
   */
  hasDocument(documentId: DocumentId): boolean {
    return this.documents.has(documentId);
  }

  /**
   * Get all document IDs
   */
  getAllDocumentIds(): DocumentId[] {
    return Array.from(this.documents.keys());
  }

  /**
   * Set an item in a document's collection
   * This is the main user-facing API
   * Timestamp is generated automatically
   */
  setItem<T>(
    documentId: DocumentId,
    collectionId: CollectionId,
    itemId: ItemId,
    value: T | null
  ): CollectionDelta<T> | null {
    const timestamp = Date.now();
    const doc = this.getDocument<T>(documentId);
    return doc.setItem(
      collectionId,
      itemId,
      value,
      timestamp,
      this.replicaId,
      this.agentId
    );
  }

  /**
   * Get an item from a document's collection
   */
  getItem<T>(
    documentId: DocumentId,
    collectionId: CollectionId,
    itemId: ItemId
  ): T | null {
    const doc = this.documents.get(documentId);
    return doc ? doc.getItem(collectionId, itemId) : null;
  }

  /**
   * Get deltas for a document to sync with an agent
   */
  getDeltasForAgent(
    documentId: DocumentId,
    agentId: AgentId
  ): DocumentDeltaPacket | null {
    const doc = this.documents.get(documentId);
    if (!doc) return null;

    const packet = doc.getDeltasForAgent(agentId);
    if (packet) {
      packet.fromAgent = this.agentId;
      packet.fromReplica = this.replicaId;
    }
    return packet;
  }

  /**
   * Get deltas for a document to sync with a replica
   */
  getDeltasForReplica(
    documentId: DocumentId,
    replicaId: ReplicaId
  ): DocumentDeltaPacket | null {
    const doc = this.documents.get(documentId);
    if (!doc) return null;

    const packet = doc.getDeltasForReplica(replicaId);
    if (packet) {
      packet.fromAgent = this.agentId;
      packet.fromReplica = this.replicaId;
    }
    return packet;
  }

  /**
   * Merge a delta packet for a document
   */
  mergeDocument(packet: DocumentDeltaPacket): DocumentMergeResult {
    const doc = this.getDocument(packet.documentId);
    return doc.merge(packet);
  }

  /**
   * Acknowledge that deltas were sent to an agent and they confirmed receipt
   * Call this after sending deltas and receiving the merge result back
   */
  acknowledgeMerge(
    documentId: DocumentId,
    agentId: AgentId,
    mergeResult: DocumentMergeResult
  ): void {
    const doc = this.documents.get(documentId);
    if (doc) {
      doc.acknowledgeMerge(agentId, mergeResult);
    }
  }

  /**
   * Get all deltas for a document
   */
  getAllDeltas(documentId: DocumentId): DocumentDeltaPacket | null {
    const doc = this.documents.get(documentId);
    if (!doc) return null;

    const packet = doc.getAllDeltas();
    packet.fromAgent = this.agentId;
    packet.fromReplica = this.replicaId;
    return packet;
  }

  /**
   * Serialize to JSON
   */
  toJSON(): {
    agentId: AgentId;
    replicaId: ReplicaId;
    documents: Record<DocumentId, ReturnType<Document<any>["toJSON"]>>;
  } {
    const documentsObj: Record<
      DocumentId,
      ReturnType<Document<any>["toJSON"]>
    > = {};
    this.documents.forEach((doc, docId) => {
      documentsObj[docId] = doc.toJSON();
    });

    return {
      agentId: this.agentId,
      replicaId: this.replicaId,
      documents: documentsObj,
    };
  }

  /**
   * Deserialize from JSON
   */
  static fromJSON(json: {
    agentId: AgentId;
    replicaId: ReplicaId;
    documents: Record<DocumentId, any>;
  }): CRDTDatabase {
    const db = new CRDTDatabase(json.agentId, json.replicaId);

    Object.entries(json.documents).forEach(([docId, docData]) => {
      const doc = Document.fromJSON(docData);
      db.documents.set(docId, doc);
    });

    return db;
  }
}

/**
 * Utility function for testing
 */
export function createTestDatabase(
  agentId: string,
  replicaId: string
): CRDTDatabase {
  return new CRDTDatabase(agentId, replicaId);
}
