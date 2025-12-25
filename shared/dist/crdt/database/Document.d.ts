import { Collection, CollectionDelta } from "./Collection";
import { AgentId, ReplicaId, ItemId } from "./CRDTItem";
export type DocumentId = string;
export type CollectionId = string;
/**
 * Delta packet for a document, containing deltas from multiple collections
 */
export interface DocumentDeltaPacket<T = any> {
    documentId: DocumentId;
    collectionDeltas: Record<CollectionId, CollectionDelta<T>[]>;
    fromReplica: ReplicaId;
    fromAgent: AgentId;
}
/**
 * Merge result indicating what was applied and what's missing
 */
export interface DocumentMergeResult<T = any> {
    applied: Record<CollectionId, CollectionDelta<T>[]>;
    missing: Record<CollectionId, CollectionDelta<T>[]>;
}
/**
 * A document containing multiple named collections
 * Documents are the unit of synchronization
 */
export declare class Document<T = any> {
    private documentId;
    private collections;
    private agentTimestamps;
    private replicaTimestamps;
    constructor(documentId: DocumentId);
    /**
     * Get the document ID
     */
    getDocumentId(): DocumentId;
    /**
     * Get or create a collection
     */
    getCollection(collectionId: CollectionId): Collection<T>;
    /**
     * Check if a collection exists
     */
    hasCollection(collectionId: CollectionId): boolean;
    /**
     * Get all collection IDs
     */
    getAllCollectionIds(): CollectionId[];
    /**
     * Set an item in a collection
     * Automatically creates the collection if it doesn't exist
     */
    setItem(collectionId: CollectionId, itemId: ItemId, value: T | null, timestamp: number, replicaId: ReplicaId, agentId: AgentId): CollectionDelta<T> | null;
    /**
     * Get an item from a collection
     */
    getItem(collectionId: CollectionId, itemId: ItemId): T | null;
    /**
     * Update vector clocks when an item is updated
     */
    private updateVectorClock;
    /**
     * Get deltas for an agent (inter-agent sync)
     */
    getDeltasForAgent(agentId: AgentId): DocumentDeltaPacket<T> | null;
    /**
     * Get deltas for a replica (intra-agent sync)
     */
    getDeltasForReplica(replicaId: ReplicaId): DocumentDeltaPacket<T> | null;
    /**
     * Merge a delta packet into this document
     */
    merge(packet: DocumentDeltaPacket<T>): DocumentMergeResult<T>;
    /**
     * Acknowledge that we sent deltas to an agent and they confirmed receipt
     * This updates our tracking of what the agent has seen
     * Call this after receiving merge result from the agent
     */
    acknowledgeMerge(agentId: AgentId, mergeResult: DocumentMergeResult<T>): void;
    /**
     * Acknowledge that we sent deltas to a replica and they confirmed receipt
     * This updates our tracking of what the replica has seen
     * Call this after receiving merge result from the replica
     */
    acknowledgeReplicaMerge(replicaId: ReplicaId, mergeResult: DocumentMergeResult<T>): void;
    /**
     * Get all deltas (entire document state)
     */
    getAllDeltas(): DocumentDeltaPacket<T>;
    /**
     * Serialize to JSON for database persistence
     * Excludes replicaTimestamps as they are session-only state
     */
    toDBJSON(): {
        documentId: DocumentId;
        collections: Record<CollectionId, ReturnType<Collection<T>["toJSON"]>>;
        agentTimestamps: Record<AgentId, Record<CollectionId, Record<ItemId, number>>>;
    };
    /**
     * Serialize to JSON
     */
    toJSON(): {
        documentId: DocumentId;
        collections: Record<CollectionId, ReturnType<Collection<T>["toJSON"]>>;
        agentTimestamps: Record<AgentId, Record<CollectionId, Record<ItemId, number>>>;
        replicaTimestamps: Record<ReplicaId, Record<CollectionId, Record<ItemId, number>>>;
    };
    /**
     * Deserialize from JSON
     */
    static fromJSON<T>(json: {
        documentId: DocumentId;
        collections: Record<CollectionId, any>;
        agentTimestamps: Record<AgentId, Record<CollectionId, Record<ItemId, number>>>;
        replicaTimestamps?: Record<ReplicaId, Record<CollectionId, Record<ItemId, number>>>;
    }): Document<T>;
}
//# sourceMappingURL=Document.d.ts.map