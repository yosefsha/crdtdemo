/**
 * Batch service for handling large CRDT delta syncs
 * Implements server-side batching logic using Document class methods
 */

import {
  Document,
  BatchedDeltaResult,
  DocumentMergeResult,
  BatchOptions,
} from "@crdtdemo/shared";
import { crdtService } from "./crdtService";
import { upsertUserCrdtDocument } from "./userCrdtDb";

export interface BatchSyncRequest {
  deltas: any;
  batchInfo: {
    batchId: string;
    batchIndex: number;
    totalBatches: number;
    isComplete: boolean;
    itemsInBatch: number;
    totalItems: number;
  };
  targetUser?: string;
}

export class BatchService {
  // In-memory batch sessions for tracking client batches
  // Maps userId -> batchId -> session state
  private clientBatchSessions: Map<
    string,
    Map<
      string,
      {
        batchInfo: BatchSyncRequest["batchInfo"];
        receivedBatches: Set<number>;
        createdAt: number;
      }
    >
  >;

  constructor() {
    this.clientBatchSessions = new Map();

    // Cleanup expired sessions every 5 minutes
    setInterval(() => this.cleanupExpiredClientSessions(), 5 * 60 * 1000);
  }

  /**
   * Handle batched sync from client to server
   * Server receives batches from client and merges them
   */
  async handleBatchSync(
    userId: string,
    request: BatchSyncRequest
  ): Promise<DocumentMergeResult<any>> {
    const { deltas, batchInfo } = request;

    console.info(
      `[BatchService] Receiving batch ${batchInfo.batchIndex + 1}/${
        batchInfo.totalBatches
      } from user ${userId}, batchId: ${batchInfo.batchId || "SINGLE"}`
    );

    // For single-batch requests (totalBatches === 1), skip session tracking
    if (batchInfo.totalBatches === 1) {
      console.info(`[BatchService] Single batch, processing immediately`);
      const mergeResult = await crdtService.syncUserDeltas(userId, deltas);
      return mergeResult;
    }

    // Track client batch session for multi-batch requests
    if (!this.clientBatchSessions.has(userId)) {
      this.clientBatchSessions.set(userId, new Map());
    }

    const userSessions = this.clientBatchSessions.get(userId)!;

    if (!userSessions.has(batchInfo.batchId)) {
      console.info(
        `[BatchService] Starting new batch session ${batchInfo.batchId}`
      );
      userSessions.set(batchInfo.batchId, {
        batchInfo,
        receivedBatches: new Set(),
        createdAt: Date.now(),
      });
    }

    const session = userSessions.get(batchInfo.batchId)!;
    session.receivedBatches.add(batchInfo.batchIndex);

    // Sync this batch using existing sync method
    // Note: CRDTs are idempotent - if same deltas arrive twice,
    // the second time will result in no changes (applied: {}, missing: same)
    console.info(
      `[BatchService] 📦 Processing batch ${batchInfo.batchIndex + 1}/${
        batchInfo.totalBatches
      } (batchId: ${batchInfo.batchId})`
    );
    const mergeResult = await crdtService.syncUserDeltas(userId, deltas);

    // Count actual items inside each collection
    const appliedCount = Object.values(mergeResult.applied).reduce(
      (sum, collection: any) => sum + Object.keys(collection).length,
      0
    );
    const missingCount = Object.values(mergeResult.missing).reduce(
      (sum, collection: any) => sum + Object.keys(collection).length,
      0
    );

    console.info(
      `[BatchService] ✅ Applied batch ${batchInfo.batchIndex + 1}/${
        batchInfo.totalBatches
      } - Applied: ${appliedCount} items, Missing: ${missingCount} items`
    );

    // Cleanup if all batches received
    if (
      batchInfo.isComplete ||
      session.receivedBatches.size === batchInfo.totalBatches
    ) {
      userSessions.delete(batchInfo.batchId);
      console.info(
        `[BatchService] Completed batched sync from user ${userId}, received ${session.receivedBatches.size} batches`
      );
    }

    return mergeResult;
  }

  /**
   * Handle batched sync from client to another user via server
   */
  async handleBatchSyncFromOther(
    sourceUserId: string,
    request: BatchSyncRequest
  ): Promise<DocumentMergeResult<any>> {
    const { deltas, batchInfo, targetUser } = request;

    if (!targetUser) {
      throw new Error("Target user is required for batch sync from other");
    }

    console.info(
      `[BatchService] Receiving batch ${batchInfo.batchIndex + 1}/${
        batchInfo.totalBatches
      } from ${sourceUserId} to ${targetUser}`
    );

    // Track client batch session
    const sessionKey = `${sourceUserId}->${targetUser}`;
    if (!this.clientBatchSessions.has(sessionKey)) {
      this.clientBatchSessions.set(sessionKey, new Map());
    }

    const userSessions = this.clientBatchSessions.get(sessionKey)!;

    if (!userSessions.has(batchInfo.batchId)) {
      userSessions.set(batchInfo.batchId, {
        batchInfo,
        receivedBatches: new Set(),
        createdAt: Date.now(),
      });
    }

    const session = userSessions.get(batchInfo.batchId)!;
    session.receivedBatches.add(batchInfo.batchIndex);

    console.debug(
      `[BatchService] [DEBUG] Processing batch for ${sourceUserId} -> ${targetUser}`,
      {
        batchId: batchInfo.batchId,
        batchIndex: batchInfo.batchIndex,
        deltasPresent: !!deltas,
        deltasKeys: deltas ? Object.keys(deltas) : [],
      }
    );

    // Get target user's document and merge the deltas from this batch
    const targetDoc = await crdtService.getOrCreateUserDocument(targetUser);
    console.debug(
      `[BatchService] [DEBUG] Target doc retrieved for ${targetUser}`
    );

    const mergeResult = targetDoc.merge(deltas);
    console.debug(`[BatchService] [DEBUG] Merge result:`, {
      appliedKeys: Object.keys(mergeResult.applied),
      missingKeys: Object.keys(mergeResult.missing),
    });

    // Persist the updated document properly
    const toSave = {
      _id: targetUser,
      userId: targetUser,
      timestamp: new Date(),
      crdt: targetDoc.toDBJSON(),
    };
    await upsertUserCrdtDocument({ _id: targetUser }, toSave);
    console.debug(`[BatchService] [DEBUG] Document saved for ${targetUser}`);

    // Cleanup if all batches received
    if (
      batchInfo.isComplete ||
      session.receivedBatches.size === batchInfo.totalBatches
    ) {
      userSessions.delete(batchInfo.batchId);
      console.info(
        `[BatchService] Completed batched sync from ${sourceUserId} to ${targetUser}, received ${session.receivedBatches.size} batches`
      );
    }

    return mergeResult;
  }

  /**
   * Start batched delta sync for a user's replica
   * Server creates batches to send to client
   */
  async startBatchedReplicaSync(
    userId: string,
    replicaId: string,
    options: BatchOptions = {}
  ): Promise<BatchedDeltaResult<any> | null> {
    const doc = await crdtService.getOrCreateUserDocument(userId);

    if (!doc) {
      return null;
    }

    console.info(
      `[BatchService] Starting batched replica sync for user ${userId}, replica ${replicaId}`
    );

    return doc.startBatchedDeltasForReplica(replicaId, options);
  }

  /**
   * Start batched delta sync for agent-to-agent
   * Server creates batches for inter-agent sync
   */
  async startBatchedAgentSync(
    userId: string,
    targetAgentId: string,
    options: BatchOptions = {}
  ): Promise<BatchedDeltaResult<any> | null> {
    const doc = await crdtService.getOrCreateUserDocument(userId);

    if (!doc) {
      return null;
    }

    console.info(
      `[BatchService] Starting batched agent sync for user ${userId}, target agent ${targetAgentId}`
    );

    return doc.startBatchedDeltasForAgent(targetAgentId, options);
  }

  /**
   * Get next batch for an ongoing session
   */
  async getNextBatch(
    userId: string,
    batchId: string
  ): Promise<BatchedDeltaResult<any> | null> {
    const doc = await crdtService.getOrCreateUserDocument(userId);

    if (!doc) {
      return null;
    }

    return doc.getNextBatch(batchId);
  }

  /**
   * Acknowledge batch receipt
   */
  async acknowledgeBatch(
    userId: string,
    batchId: string,
    batchIndex: number,
    mergeResult: DocumentMergeResult<any>
  ): Promise<void> {
    const doc = await crdtService.getOrCreateUserDocument(userId);

    if (!doc) {
      throw new Error(`Document not found for user ${userId}`);
    }

    doc.acknowledgeBatch(batchId, batchIndex, mergeResult);
  }

  /**
   * Cleanup expired client batch sessions
   */
  private cleanupExpiredClientSessions(): void {
    const now = Date.now();
    const maxAge = 5 * 60 * 1000; // 5 minutes

    this.clientBatchSessions.forEach((userSessions, key) => {
      const toDelete: string[] = [];

      userSessions.forEach((session, batchId) => {
        if (now - session.createdAt > maxAge) {
          toDelete.push(batchId);
        }
      });

      toDelete.forEach((batchId) => {
        userSessions.delete(batchId);
        console.warn(
          `[BatchService] Cleaned up expired batch session ${batchId} for ${key}`
        );
      });

      if (userSessions.size === 0) {
        this.clientBatchSessions.delete(key);
      }
    });
  }
}

export const batchService = new BatchService();
