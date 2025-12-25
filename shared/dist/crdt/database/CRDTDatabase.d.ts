import { Document, DocumentDeltaPacket, DocumentMergeResult, DocumentId, CollectionId } from "./Document";
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
export declare class CRDTDatabase {
    private agentId;
    private replicaId;
    private documents;
    constructor(agentId: AgentId, replicaId: ReplicaId);
    /**
     * Get database info
     */
    getInfo(): {
        agentId: AgentId;
        replicaId: ReplicaId;
    };
    /**
     * Get or create a document
     */
    getDocument<T = any>(documentId: DocumentId): Document<T>;
    /**
     * Check if a document exists
     */
    hasDocument(documentId: DocumentId): boolean;
    /**
     * Get all document IDs
     */
    getAllDocumentIds(): DocumentId[];
    /**
     * Set an item in a document's collection
     * This is the main user-facing API
     * Timestamp is generated automatically
     */
    setItem<T>(documentId: DocumentId, collectionId: CollectionId, itemId: ItemId, value: T | null): CollectionDelta<T> | null;
    /**
     * Get an item from a document's collection
     */
    getItem<T>(documentId: DocumentId, collectionId: CollectionId, itemId: ItemId): T | null;
    /**
     * Get deltas for a document to sync with an agent
     */
    getDeltasForAgent(documentId: DocumentId, agentId: AgentId): DocumentDeltaPacket | null;
    /**
     * Get deltas for a document to sync with a replica
     */
    getDeltasForReplica(documentId: DocumentId, replicaId: ReplicaId): DocumentDeltaPacket | null;
    /**
     * Merge a delta packet for a document
     */
    mergeDocument(packet: DocumentDeltaPacket): DocumentMergeResult;
    /**
     * Acknowledge that deltas were sent to an agent and they confirmed receipt
     * Call this after sending deltas and receiving the merge result back
     */
    acknowledgeMerge(documentId: DocumentId, agentId: AgentId, mergeResult: DocumentMergeResult): void;
    /**
     * Acknowledge that deltas were sent to a replica and they confirmed receipt
     * Call this after sending deltas and receiving the merge result back from a replica
     */
    acknowledgeReplicaMerge(documentId: DocumentId, replicaId: ReplicaId, mergeResult: DocumentMergeResult): void;
    /**
     * Get all deltas for a document
     */
    getAllDeltas(documentId: DocumentId): DocumentDeltaPacket | null;
    /**
     * Serialize to JSON
     */
    toJSON(): {
        agentId: AgentId;
        replicaId: ReplicaId;
        documents: Record<DocumentId, ReturnType<Document<any>["toJSON"]>>;
    };
    /**
     * Deserialize from JSON
     */
    static fromJSON(json: {
        agentId: AgentId;
        replicaId: ReplicaId;
        documents: Record<DocumentId, any>;
    }): CRDTDatabase;
}
/**
 * Utility function for testing
 */
export declare function createTestDatabase(agentId: string, replicaId: string): CRDTDatabase;
//# sourceMappingURL=CRDTDatabase.d.ts.map