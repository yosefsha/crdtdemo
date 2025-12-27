// Document: A sync unit containing multiple collections
// Documents are the unit of synchronization in the CRDT system

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
  maxBytesPerBatch?: number; // Default: 5_000_000 (5 MB)
  maxItemsPerBatch?: number; // Default: 20_000 items
  estimator?: (item: any) => number; // Custom size estimator
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
export class Document<T = any> {
  private documentId: DocumentId;
  private collections: Map<CollectionId, Collection<T>>;

  // Vector clocks for tracking what each agent/replica has seen
  // For each collection and item, track the last timestamp seen from each agent
  private agentTimestamps: Map<AgentId, Map<CollectionId, Map<ItemId, number>>>;
  private replicaTimestamps: Map<
    ReplicaId,
    Map<CollectionId, Map<ItemId, number>>
  >;

  // Batch sessions for managing large delta transfers (in-memory only)
  private batchSessions?: Map<string, BatchSession<T>>;

  constructor(documentId: DocumentId) {
    this.documentId = documentId;
    this.collections = new Map();
    this.agentTimestamps = new Map();
    this.replicaTimestamps = new Map();
  }

  /**
   * Get the document ID
   */
  getDocumentId(): DocumentId {
    return this.documentId;
  }

  /**
   * Get or create a collection
   */
  getCollection(collectionId: CollectionId): Collection<T> {
    let collection = this.collections.get(collectionId);
    if (!collection) {
      collection = new Collection<T>(collectionId);
      this.collections.set(collectionId, collection);
    }
    return collection;
  }

  /**
   * Check if a collection exists
   */
  hasCollection(collectionId: CollectionId): boolean {
    return this.collections.has(collectionId);
  }

  /**
   * Get all collection IDs
   */
  getAllCollectionIds(): CollectionId[] {
    return Array.from(this.collections.keys());
  }

  /**
   * Set an item in a collection
   * Automatically creates the collection if it doesn't exist
   */
  setItem(
    collectionId: CollectionId,
    itemId: ItemId,
    value: T | null,
    timestamp: number,
    replicaId: ReplicaId,
    agentId: AgentId
  ): CollectionDelta<T> | null {
    const collection = this.getCollection(collectionId);
    const delta = collection.setItem(
      itemId,
      value,
      timestamp,
      replicaId,
      agentId
    );

    // Update vector clocks if delta was applied
    if (delta) {
      this.updateVectorClock(
        collectionId,
        itemId,
        timestamp,
        agentId,
        replicaId
      );
    }

    return delta;
  }

  /**
   * Get an item from a collection
   */
  getItem(collectionId: CollectionId, itemId: ItemId): T | null {
    const collection = this.collections.get(collectionId);
    return collection ? collection.getItem(itemId) : null;
  }

  /**
   * Update vector clocks when an item is updated
   */
  private updateVectorClock(
    collectionId: CollectionId,
    itemId: ItemId,
    timestamp: number,
    agentId: AgentId,
    replicaId: ReplicaId
  ): void {
    // Update agent timestamp
    if (!this.agentTimestamps.has(agentId)) {
      this.agentTimestamps.set(agentId, new Map());
    }
    const agentCollections = this.agentTimestamps.get(agentId)!;
    if (!agentCollections.has(collectionId)) {
      agentCollections.set(collectionId, new Map());
    }
    const agentItems = agentCollections.get(collectionId)!;
    agentItems.set(itemId, timestamp);

    // Update replica timestamp
    if (!this.replicaTimestamps.has(replicaId)) {
      this.replicaTimestamps.set(replicaId, new Map());
    }
    const replicaCollections = this.replicaTimestamps.get(replicaId)!;
    if (!replicaCollections.has(collectionId)) {
      replicaCollections.set(collectionId, new Map());
    }
    const replicaItems = replicaCollections.get(collectionId)!;
    replicaItems.set(itemId, timestamp);
  }

  /**
   * Get deltas for an agent (inter-agent sync)
   * @param agentId - The agent to get deltas for
   * @param maxDeltasPerCollection - Optional limit on deltas per collection for batching
   * @returns DocumentDeltaPacket or null if no deltas available
   */
  getDeltasForAgent(
    agentId: AgentId,
    maxDeltasPerCollection?: number
  ): DocumentDeltaPacket<T> | null {
    const collectionDeltas: Record<CollectionId, CollectionDelta<T>[]> = {};
    const agentCollections = this.agentTimestamps.get(agentId) || new Map();

    this.collections.forEach((collection, collectionId) => {
      const agentItems = agentCollections.get(collectionId) || new Map();
      let deltas = collection.getDeltasSince(agentItems);

      // Apply batching limit if specified
      if (maxDeltasPerCollection && deltas.length > maxDeltasPerCollection) {
        deltas = deltas.slice(0, maxDeltasPerCollection);
      }

      if (deltas.length > 0) {
        collectionDeltas[collectionId] = deltas;
      }
    });

    if (Object.keys(collectionDeltas).length === 0) {
      return null;
    }

    return {
      documentId: this.documentId,
      collectionDeltas,
      fromReplica: "", // Will be set by caller
      fromAgent: "", // Will be set by caller
    };
  }

  /**
   * Get deltas for an agent with pagination support
   * @param agentId - The agent to get deltas for
   * @param options - Pagination options
   * @returns Paginated delta packet with metadata
   */
  getDeltasForAgentPaginated(
    agentId: AgentId,
    options: {
      batchSize?: number;
      collectionId?: CollectionId;
      offset?: number;
    } = {}
  ): {
    packet: DocumentDeltaPacket<T> | null;
    hasMore: boolean;
    totalDeltas: number;
  } {
    const { batchSize = 1000, collectionId, offset = 0 } = options;
    const agentCollections = this.agentTimestamps.get(agentId) || new Map();

    let totalDeltas = 0;
    let currentOffset = offset;
    const collectionDeltas: Record<CollectionId, CollectionDelta<T>[]> = {};

    // Filter collections if specific collection requested
    const collectionsToSync = collectionId
      ? this.collections.has(collectionId)
        ? [[collectionId, this.collections.get(collectionId)!] as const]
        : []
      : Array.from(this.collections.entries());

    for (const [colId, collection] of collectionsToSync) {
      const agentItems = agentCollections.get(colId) || new Map();
      const allDeltas = collection.getDeltasSince(agentItems);
      totalDeltas += allDeltas.length;

      // Skip deltas before offset
      if (currentOffset >= allDeltas.length) {
        currentOffset -= allDeltas.length;
        continue;
      }

      // Take deltas for this batch
      const deltasToTake = Math.min(
        batchSize - Object.values(collectionDeltas).flat().length,
        allDeltas.length - currentOffset
      );

      if (deltasToTake > 0) {
        collectionDeltas[colId] = allDeltas.slice(
          currentOffset,
          currentOffset + deltasToTake
        );
        currentOffset = 0;
      }

      // Stop if batch is full
      if (Object.values(collectionDeltas).flat().length >= batchSize) {
        break;
      }
    }

    const packet =
      Object.keys(collectionDeltas).length > 0
        ? {
            documentId: this.documentId,
            collectionDeltas,
            fromReplica: "",
            fromAgent: "",
          }
        : null;

    const deltasReturned = Object.values(collectionDeltas).flat().length;
    const hasMore = offset + deltasReturned < totalDeltas;

    return { packet, hasMore, totalDeltas };
  }

  /**
   * Get all items from all collections
   */
  getAllItems(): Record<CollectionId, Record<ItemId, T | null>> {
    const result: Record<CollectionId, Record<ItemId, T | null>> = {};

    this.collections.forEach((collection, collectionId: CollectionId) => {
      result[collectionId] = Object.fromEntries(collection.getAllItems());
    });

    return result;
  }

  /**
   * Get deltas for a replica (intra-agent sync)
   */
  getDeltasForReplica(replicaId: ReplicaId): DocumentDeltaPacket<T> | null {
    const collectionDeltas: Record<CollectionId, CollectionDelta<T>[]> = {};
    const isNewReplica = !this.replicaTimestamps.has(replicaId);

    // If this is a new replica and we have collections, return all deltas
    if (isNewReplica && this.collections.size > 0) {
      this.collections.forEach((collection, collectionId) => {
        const deltas = collection.getAllDeltas();
        if (deltas.length > 0) {
          collectionDeltas[collectionId] = deltas;
        }
      });
    } else {
      // For existing replicas, return only incremental deltas
      const replicaCollections =
        this.replicaTimestamps.get(replicaId) || new Map();

      this.collections.forEach((collection, collectionId) => {
        const replicaItems = replicaCollections.get(collectionId) || new Map();
        const deltas = collection.getDeltasSince(replicaItems);

        if (deltas.length > 0) {
          collectionDeltas[collectionId] = deltas;
        }
      });
    }

    if (Object.keys(collectionDeltas).length === 0) {
      return null;
    }

    return {
      documentId: this.documentId,
      collectionDeltas,
      fromReplica: "", // Will be set by caller
      fromAgent: "", // Will be set by caller
    };
  }

  /**
   * Merge a delta packet into this document
   */
  merge(packet: DocumentDeltaPacket<T>): DocumentMergeResult<T> {
    const applied: Record<CollectionId, CollectionDelta<T>[]> = {};
    const missing: Record<CollectionId, CollectionDelta<T>[]> = {};

    Object.entries(packet.collectionDeltas).forEach(
      ([collectionId, deltas]) => {
        const collection = this.getCollection(collectionId);
        const appliedDeltas = collection.applyDeltas(deltas);

        if (appliedDeltas.length > 0) {
          applied[collectionId] = appliedDeltas;

          // Update vector clocks for applied deltas
          appliedDeltas.forEach((delta: CollectionDelta<T>) => {
            this.updateVectorClock(
              collectionId,
              delta.itemId,
              delta.timestamp,
              delta.agentId,
              delta.replicaId
            );
          });
        }
      }
    );

    // Calculate missing deltas (what the sender doesn't have)
    this.collections.forEach((collection, collectionId) => {
      const senderAgent = packet.fromAgent;
      const senderCollections =
        this.agentTimestamps.get(senderAgent) || new Map();
      const senderItems = senderCollections.get(collectionId) || new Map();

      const missingDeltas = collection.getDeltasSince(senderItems);
      if (missingDeltas.length > 0) {
        missing[collectionId] = missingDeltas;
      }
    });

    return { applied, missing };
  }

  /**
   * Acknowledge that we sent deltas to an agent and they confirmed receipt
   * This updates our tracking of what the agent has seen
   * Call this after receiving merge result from the agent
   */
  acknowledgeMerge(
    agentId: AgentId,
    mergeResult: DocumentMergeResult<T>
  ): void {
    // Update tracking for all applied deltas - the agent now has these
    Object.entries(mergeResult.applied).forEach(([collectionId, deltas]) => {
      if (!this.agentTimestamps.has(agentId)) {
        this.agentTimestamps.set(agentId, new Map());
      }
      const agentCollections = this.agentTimestamps.get(agentId)!;
      if (!agentCollections.has(collectionId)) {
        agentCollections.set(collectionId, new Map());
      }
      const agentItems = agentCollections.get(collectionId)!;

      deltas.forEach((delta) => {
        const currentTimestamp = agentItems.get(delta.itemId);
        if (
          currentTimestamp === undefined ||
          delta.timestamp > currentTimestamp
        ) {
          agentItems.set(delta.itemId, delta.timestamp);
        }
      });
    });

    // Also update for missing deltas - the agent sent these in their original packet
    // so they definitely have them (they're "missing" from our perspective, not theirs)
    Object.entries(mergeResult.missing).forEach(([collectionId, deltas]) => {
      if (!this.agentTimestamps.has(agentId)) {
        this.agentTimestamps.set(agentId, new Map());
      }
      const agentCollections = this.agentTimestamps.get(agentId)!;
      if (!agentCollections.has(collectionId)) {
        agentCollections.set(collectionId, new Map());
      }
      const agentItems = agentCollections.get(collectionId)!;

      deltas.forEach((delta) => {
        const currentTimestamp = agentItems.get(delta.itemId);
        if (
          currentTimestamp === undefined ||
          delta.timestamp > currentTimestamp
        ) {
          agentItems.set(delta.itemId, delta.timestamp);
        }
      });
    });
  }

  /**
   * Acknowledge that we sent deltas to a replica and they confirmed receipt
   * This updates our tracking of what the replica has seen
   * Call this after receiving merge result from the replica
   */
  acknowledgeReplicaMerge(
    replicaId: ReplicaId,
    mergeResult: DocumentMergeResult<T>
  ): void {
    // Update tracking for all applied deltas - the replica now has these
    Object.entries(mergeResult.applied).forEach(([collectionId, deltas]) => {
      if (!this.replicaTimestamps.has(replicaId)) {
        this.replicaTimestamps.set(replicaId, new Map());
      }
      const replicaCollections = this.replicaTimestamps.get(replicaId)!;
      if (!replicaCollections.has(collectionId)) {
        replicaCollections.set(collectionId, new Map());
      }
      const replicaItems = replicaCollections.get(collectionId)!;

      deltas.forEach((delta) => {
        const currentTimestamp = replicaItems.get(delta.itemId);
        if (
          currentTimestamp === undefined ||
          delta.timestamp > currentTimestamp
        ) {
          replicaItems.set(delta.itemId, delta.timestamp);
        }
      });
    });

    // Also update for missing deltas - the replica sent these in their original packet
    // so they definitely have them (they're "missing" from our perspective, not theirs)
    Object.entries(mergeResult.missing).forEach(([collectionId, deltas]) => {
      if (!this.replicaTimestamps.has(replicaId)) {
        this.replicaTimestamps.set(replicaId, new Map());
      }
      const replicaCollections = this.replicaTimestamps.get(replicaId)!;
      if (!replicaCollections.has(collectionId)) {
        replicaCollections.set(collectionId, new Map());
      }
      const replicaItems = replicaCollections.get(collectionId)!;

      deltas.forEach((delta) => {
        const currentTimestamp = replicaItems.get(delta.itemId);
        if (
          currentTimestamp === undefined ||
          delta.timestamp > currentTimestamp
        ) {
          replicaItems.set(delta.itemId, delta.timestamp);
        }
      });
    });
  }

  /**
   * Get all deltas (entire document state)
   */
  getAllDeltas(): DocumentDeltaPacket<T> {
    const collectionDeltas: Record<CollectionId, CollectionDelta<T>[]> = {};

    this.collections.forEach((collection, collectionId) => {
      const deltas = collection.getAllDeltas();
      if (deltas.length > 0) {
        collectionDeltas[collectionId] = deltas;
      }
    });

    return {
      documentId: this.documentId,
      collectionDeltas,
      fromReplica: "",
      fromAgent: "",
    };
  }

  // ============================================================================
  // Batching Methods (Type-Agnostic)
  // ============================================================================

  /**
   * Start batched delta sync for an agent
   * Automatically splits into batches if the delta packet is too large
   */
  startBatchedDeltasForAgent(
    agentId: AgentId,
    options: BatchOptions = {}
  ): BatchedDeltaResult<T> | null {
    // Get full deltas using existing method
    const fullPacket = this.getDeltasForAgent(agentId);

    if (!fullPacket) {
      return null; // No deltas to send
    }

    // Estimate size
    const estimatedSize = this.estimatePacketSize(fullPacket);
    const threshold = options.maxBytesPerBatch ?? 5_000_000;

    // If small enough, return as single batch
    if (estimatedSize < threshold * 0.8) {
      // 80% threshold for safety
      return {
        packet: fullPacket,
        batchInfo: {
          batchId: "", // No batch ID needed
          batchIndex: 0,
          totalBatches: 1,
          isComplete: true,
          itemsInBatch: this.countDeltas(fullPacket),
          totalItems: this.countDeltas(fullPacket),
        },
      };
    }

    // Split into batches
    const batches = this.splitIntoBatches(fullPacket, options);
    const batchId = this.generateBatchId();

    // Store session
    const session: BatchSession<T> = {
      batchId,
      agentId,
      documentId: this.documentId,
      batches,
      acknowledgedBatches: new Set(),
      totalItems: this.countDeltas(fullPacket),
      createdAt: Date.now(),
      expiresAt: Date.now() + 5 * 60 * 1000, // 5 minute TTL
    };

    if (!this.batchSessions) {
      this.batchSessions = new Map();
    }
    this.batchSessions.set(batchId, session);

    // Return first batch
    return {
      packet: batches[0],
      batchInfo: {
        batchId,
        batchIndex: 0,
        totalBatches: batches.length,
        isComplete: false,
        itemsInBatch: this.countDeltas(batches[0]),
        totalItems: session.totalItems,
      },
    };
  }

  /**
   * Start batched delta sync for a replica
   * Automatically splits into batches if the delta packet is too large
   */
  startBatchedDeltasForReplica(
    replicaId: ReplicaId,
    options: BatchOptions = {}
  ): BatchedDeltaResult<T> | null {
    // Get full deltas using existing method
    const fullPacket = this.getDeltasForReplica(replicaId);

    if (!fullPacket) {
      return null; // No deltas to send
    }

    // Estimate size
    const estimatedSize = this.estimatePacketSize(fullPacket);
    const threshold = options.maxBytesPerBatch ?? 5_000_000;

    // If small enough, return as single batch
    if (estimatedSize < threshold * 0.8) {
      // 80% threshold for safety
      return {
        packet: fullPacket,
        batchInfo: {
          batchId: "", // No batch ID needed
          batchIndex: 0,
          totalBatches: 1,
          isComplete: true,
          itemsInBatch: this.countDeltas(fullPacket),
          totalItems: this.countDeltas(fullPacket),
        },
      };
    }

    // Split into batches
    const batches = this.splitIntoBatches(fullPacket, options);
    const batchId = this.generateBatchId();

    // Store session
    const session: BatchSession<T> = {
      batchId,
      agentId: "", // Not used for replica sync
      replicaId,
      documentId: this.documentId,
      batches,
      acknowledgedBatches: new Set(),
      totalItems: this.countDeltas(fullPacket),
      createdAt: Date.now(),
      expiresAt: Date.now() + 5 * 60 * 1000, // 5 minute TTL
    };

    if (!this.batchSessions) {
      this.batchSessions = new Map();
    }
    this.batchSessions.set(batchId, session);

    // Return first batch
    return {
      packet: batches[0],
      batchInfo: {
        batchId,
        batchIndex: 0,
        totalBatches: batches.length,
        isComplete: false,
        itemsInBatch: this.countDeltas(batches[0]),
        totalItems: session.totalItems,
      },
    };
  }

  /**
   * Get next batch in an ongoing session
   */
  getNextBatch(batchId: string): BatchedDeltaResult<T> | null {
    const session = this.batchSessions?.get(batchId);

    if (!session) {
      return null; // Session expired or doesn't exist
    }

    // Check expiration
    if (Date.now() > session.expiresAt) {
      this.batchSessions?.delete(batchId);
      return null;
    }

    // Find next unacknowledged batch
    let nextIndex = -1;
    for (let i = 0; i < session.batches.length; i++) {
      if (!session.acknowledgedBatches.has(i)) {
        nextIndex = i;
        break;
      }
    }

    if (nextIndex === -1) {
      // All batches acknowledged
      this.batchSessions?.delete(batchId);
      return null;
    }

    const isComplete = nextIndex === session.batches.length - 1;

    return {
      packet: session.batches[nextIndex],
      batchInfo: {
        batchId,
        batchIndex: nextIndex,
        totalBatches: session.batches.length,
        isComplete,
        itemsInBatch: this.countDeltas(session.batches[nextIndex]),
        totalItems: session.totalItems,
      },
    };
  }

  /**
   * Acknowledge batch receipt
   * Updates vector clocks for items in this batch only
   */
  acknowledgeBatch(
    batchId: string,
    batchIndex: number,
    mergeResult: DocumentMergeResult<T>
  ): void {
    const session = this.batchSessions?.get(batchId);

    if (!session) {
      return; // Session expired
    }

    // Mark batch as acknowledged
    session.acknowledgedBatches.add(batchIndex);

    // Update vector clocks using existing method
    if (session.agentId) {
      this.acknowledgeMerge(session.agentId, mergeResult);
    } else if (session.replicaId) {
      this.acknowledgeReplicaMerge(session.replicaId, mergeResult);
    }

    // Cleanup if all batches acknowledged
    if (session.acknowledgedBatches.size === session.batches.length) {
      this.batchSessions?.delete(batchId);
    }
  }

  /**
   * Cancel batch session
   */
  cancelBatch(batchId: string): void {
    this.batchSessions?.delete(batchId);
  }

  /**
   * Cleanup expired batch sessions (call periodically)
   */
  cleanupExpiredBatches(): void {
    if (!this.batchSessions) return;

    const now = Date.now();
    const toDelete: string[] = [];

    this.batchSessions.forEach((session, batchId) => {
      if (now > session.expiresAt) {
        toDelete.push(batchId);
      }
    });

    toDelete.forEach((batchId) => this.batchSessions?.delete(batchId));
  }

  /**
   * Estimate size of a delta packet in bytes
   * Uses sampling to avoid serializing the entire packet
   */
  private estimatePacketSize(packet: DocumentDeltaPacket<T>): number {
    // Fast path: count deltas × average size
    let totalDeltas = 0;
    Object.values(packet.collectionDeltas).forEach((deltas) => {
      totalDeltas += deltas.length;
    });

    if (totalDeltas === 0) return 0;

    // Sample a few items to estimate average size
    const samples = this.sampleDeltas(packet, Math.min(10, totalDeltas));
    const avgSize =
      samples.reduce((sum, delta) => {
        return sum + JSON.stringify(delta).length;
      }, 0) / samples.length;

    // Estimate: total deltas × average + overhead
    const estimatedSize = totalDeltas * avgSize;
    const overhead = JSON.stringify({
      documentId: packet.documentId,
      fromReplica: packet.fromReplica,
      fromAgent: packet.fromAgent,
    }).length;

    return estimatedSize + overhead;
  }

  /**
   * Sample random deltas for size estimation
   */
  private sampleDeltas(
    packet: DocumentDeltaPacket<T>,
    count: number
  ): CollectionDelta<T>[] {
    const allDeltas: CollectionDelta<T>[] = [];
    Object.values(packet.collectionDeltas).forEach((deltas) => {
      allDeltas.push(...deltas);
    });

    // Simple random sampling
    const samples: CollectionDelta<T>[] = [];
    const step = Math.max(1, Math.floor(allDeltas.length / count));
    for (let i = 0; i < allDeltas.length; i += step) {
      samples.push(allDeltas[i]);
      if (samples.length >= count) break;
    }

    return samples;
  }

  /**
   * Split deltas into batches based on size constraints
   */
  private splitIntoBatches(
    fullPacket: DocumentDeltaPacket<T>,
    options: BatchOptions
  ): DocumentDeltaPacket<T>[] {
    const maxBytes = options.maxBytesPerBatch ?? 5_000_000;
    const maxItems = options.maxItemsPerBatch ?? 20_000;

    const batches: DocumentDeltaPacket<T>[] = [];
    let currentBatch: Record<CollectionId, CollectionDelta<T>[]> = {};
    let currentSize = 0;
    let currentItemCount = 0;

    // Iterate through collections and deltas
    Object.entries(fullPacket.collectionDeltas).forEach(
      ([collectionId, deltas]) => {
        for (const delta of deltas) {
          // Estimate size of this delta
          const deltaSize = JSON.stringify(delta).length;

          // Check if adding this delta would exceed limits
          if (
            currentItemCount > 0 && // Don't create empty batch
            (currentSize + deltaSize > maxBytes || currentItemCount >= maxItems)
          ) {
            // Finalize current batch
            batches.push({
              documentId: fullPacket.documentId,
              collectionDeltas: currentBatch,
              fromReplica: fullPacket.fromReplica,
              fromAgent: fullPacket.fromAgent,
            });

            // Start new batch
            currentBatch = {};
            currentSize = 0;
            currentItemCount = 0;
          }

          // Add delta to current batch
          if (!currentBatch[collectionId]) {
            currentBatch[collectionId] = [];
          }
          currentBatch[collectionId].push(delta);
          currentSize += deltaSize;
          currentItemCount++;
        }
      }
    );

    // Add final batch if not empty
    if (currentItemCount > 0) {
      batches.push({
        documentId: fullPacket.documentId,
        collectionDeltas: currentBatch,
        fromReplica: fullPacket.fromReplica,
        fromAgent: fullPacket.fromAgent,
      });
    }

    return batches;
  }

  /**
   * Helper: count total deltas in packet
   */
  private countDeltas(packet: DocumentDeltaPacket<T>): number {
    return Object.values(packet.collectionDeltas).reduce(
      (sum, deltas) => sum + deltas.length,
      0
    );
  }

  /**
   * Helper: generate unique batch ID
   */
  private generateBatchId(): string {
    return `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Serialize to JSON for database persistence
   * Excludes replicaTimestamps as they are session-only state
   */
  toDBJSON(): {
    documentId: DocumentId;
    collections: Record<CollectionId, ReturnType<Collection<T>["toJSON"]>>;
    agentTimestamps: Record<
      AgentId,
      Record<CollectionId, Record<ItemId, number>>
    >;
  } {
    const collectionsObj: Record<
      CollectionId,
      ReturnType<Collection<T>["toJSON"]>
    > = {};
    this.collections.forEach((collection, collectionId) => {
      collectionsObj[collectionId] = collection.toJSON();
    });

    const agentTimestampsObj: Record<
      AgentId,
      Record<CollectionId, Record<ItemId, number>>
    > = {};
    this.agentTimestamps.forEach((colMap, agentId) => {
      agentTimestampsObj[agentId] = {};
      colMap.forEach((itemMap, collectionId) => {
        agentTimestampsObj[agentId][collectionId] = {};
        itemMap.forEach((timestamp, itemId) => {
          agentTimestampsObj[agentId][collectionId][itemId] = timestamp;
        });
      });
    });

    return {
      documentId: this.documentId,
      collections: collectionsObj,
      agentTimestamps: agentTimestampsObj,
      // NOTE: replicaTimestamps intentionally excluded - they are session-only state
    };
  }

  /**
   * Serialize to JSON
   */
  toJSON(): {
    documentId: DocumentId;
    collections: Record<CollectionId, ReturnType<Collection<T>["toJSON"]>>;
    agentTimestamps: Record<
      AgentId,
      Record<CollectionId, Record<ItemId, number>>
    >;
    replicaTimestamps: Record<
      ReplicaId,
      Record<CollectionId, Record<ItemId, number>>
    >;
  } {
    const collectionsObj: Record<
      CollectionId,
      ReturnType<Collection<T>["toJSON"]>
    > = {};
    this.collections.forEach((collection, collectionId) => {
      collectionsObj[collectionId] = collection.toJSON();
    });

    // Serialize agent timestamps
    const agentTimestampsObj: Record<
      AgentId,
      Record<CollectionId, Record<ItemId, number>>
    > = {};
    this.agentTimestamps.forEach((collections, agentId) => {
      agentTimestampsObj[agentId] = {};
      collections.forEach((items, collectionId) => {
        agentTimestampsObj[agentId][collectionId] = Object.fromEntries(items);
      });
    });

    // Serialize replica timestamps
    const replicaTimestampsObj: Record<
      ReplicaId,
      Record<CollectionId, Record<ItemId, number>>
    > = {};
    this.replicaTimestamps.forEach((collections, replicaId) => {
      replicaTimestampsObj[replicaId] = {};
      collections.forEach((items, collectionId) => {
        replicaTimestampsObj[replicaId][collectionId] =
          Object.fromEntries(items);
      });
    });

    return {
      documentId: this.documentId,
      collections: collectionsObj,
      agentTimestamps: agentTimestampsObj,
      replicaTimestamps: replicaTimestampsObj,
    };
  }

  /**
   * Deserialize from JSON
   */
  static fromJSON<T>(json: {
    documentId: DocumentId;
    collections: Record<CollectionId, any>;
    agentTimestamps: Record<
      AgentId,
      Record<CollectionId, Record<ItemId, number>>
    >;
    replicaTimestamps?: Record<
      ReplicaId,
      Record<CollectionId, Record<ItemId, number>>
    >;
  }): Document<T> {
    const doc = new Document<T>(json.documentId);

    // Deserialize collections
    Object.entries(json.collections).forEach(
      ([collectionId, collectionData]) => {
        const collection = Collection.fromJSON<T>(collectionData);
        doc.collections.set(collectionId, collection);
      }
    );

    // Deserialize agent timestamps
    Object.entries(json.agentTimestamps).forEach(([agentId, collections]) => {
      const agentMap = new Map<CollectionId, Map<ItemId, number>>();
      Object.entries(collections).forEach(([collectionId, items]) => {
        agentMap.set(
          collectionId,
          new Map(Object.entries(items as Record<ItemId, number>))
        );
      });
      doc.agentTimestamps.set(agentId, agentMap);
    });

    // Deserialize replica timestamps (optional - may not be present in DB data)
    if (json.replicaTimestamps) {
      Object.entries(json.replicaTimestamps).forEach(
        ([replicaId, collections]) => {
          const replicaMap = new Map<CollectionId, Map<ItemId, number>>();
          Object.entries(collections).forEach(([collectionId, items]) => {
            replicaMap.set(
              collectionId,
              new Map(Object.entries(items as Record<ItemId, number>))
            );
          });
          doc.replicaTimestamps.set(replicaId, replicaMap);
        }
      );
    }

    return doc;
  }
}
