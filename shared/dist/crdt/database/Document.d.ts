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
 * Options for batching large delta packets
 */
export interface BatchOptions {
    maxBytesPerBatch?: number;
    maxItemsPerBatch?: number;
    estimator?: (item: any) => number;
}
/**
 * Batch session for managing multi-batch syncs
 */
export interface BatchSession<T = any> {
    batchId: string;
    agentId: AgentId;
    replicaId?: ReplicaId;
    documentId: DocumentId;
    batches: DocumentDeltaPacket<T>[];
    acknowledgedBatches: Set<number>;
    totalItems: number;
    createdAt: number;
    expiresAt: number;
}
/**
 * Result of a batched delta operation
 */
export interface BatchedDeltaResult<T = any> {
    packet: DocumentDeltaPacket<T>;
    batchInfo: {
        batchId: string;
        batchIndex: number;
        totalBatches: number;
        isComplete: boolean;
        itemsInBatch: number;
        totalItems: number;
    };
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
    private batchSessions?;
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
     * @param agentId - The agent to get deltas for
     * @param maxDeltasPerCollection - Optional limit on deltas per collection for batching
     * @returns DocumentDeltaPacket or null if no deltas available
     */
    getDeltasForAgent(agentId: AgentId, maxDeltasPerCollection?: number): DocumentDeltaPacket<T> | null;
    /**
     * Get deltas for an agent with pagination support
     * @param agentId - The agent to get deltas for
     * @param options - Pagination options
     * @returns Paginated delta packet with metadata
     */
    getDeltasForAgentPaginated(agentId: AgentId, options?: {
        batchSize?: number;
        collectionId?: CollectionId;
        offset?: number;
    }): {
        packet: DocumentDeltaPacket<T> | null;
        hasMore: boolean;
        totalDeltas: number;
    };
    /**
     * Get all items from all collections
     */
    getAllItems(): Record<CollectionId, Record<ItemId, T | null>>;
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
     * Start batched delta sync for an agent
     * Automatically splits into batches if the delta packet is too large
     */
    startBatchedDeltasForAgent(agentId: AgentId, options?: BatchOptions): BatchedDeltaResult<T> | null;
    /**
     * Start batched delta sync for a replica
     * Automatically splits into batches if the delta packet is too large
     */
    startBatchedDeltasForReplica(replicaId: ReplicaId, options?: BatchOptions): BatchedDeltaResult<T> | null;
    /**
     * Get next batch in an ongoing session
     */
    getNextBatch(batchId: string): BatchedDeltaResult<T> | null;
    /**
     * Acknowledge batch receipt
     * Updates vector clocks for items in this batch only
     */
    acknowledgeBatch(batchId: string, batchIndex: number, mergeResult: DocumentMergeResult<T>): void;
    /**
     * Cancel batch session
     */
    cancelBatch(batchId: string): void;
    /**
     * Cleanup expired batch sessions (call periodically)
     */
    cleanupExpiredBatches(): void;
    /**
     * Estimate size of a delta packet in bytes
     * Uses sampling to avoid serializing the entire packet
     */
    private estimatePacketSize;
    /**
     * Sample random deltas for size estimation
     */
    private sampleDeltas;
    /**
     * Split deltas into batches based on size constraints
     */
    private splitIntoBatches;
    /**
     * Helper: count total deltas in packet
     */
    private countDeltas;
    /**
     * Helper: generate unique batch ID
     */
    private generateBatchId;
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