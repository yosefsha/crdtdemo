import {
  Document,
  DocumentDeltaPacket,
  DocumentMergeResult,
  RGB,
} from "@crdtdemo/shared";
import { getTimestamp } from "./helpers";
import { userCrdtDb, upsertUserCrdtDocument } from "./userCrdtDb";

class CRDTService {
  /**
   * Singleton instance of CRDTService.
   * Use CRDTService.getInstance() to access the singleton instance.
   */
  private static instance: CRDTService;
  private userDocuments: Record<string, Document<RGB>> = {};
  constructor() {
    // Private constructor to enforce singleton pattern
    console.debug(
      `[${getTimestamp()}] [DEBUG][CRDTService] Singleton instance created`
    );
  }
  /**
   * Get the singleton instance of CRDTService.
   * @returns The singleton instance of CRDTService
   */
  static getInstance(): CRDTService {
    if (!CRDTService.instance) {
      CRDTService.instance = new CRDTService();
    }
    return CRDTService.instance;
  }
  /**
   * Merge another user's CRDT into the current user's CRDT and persist the result.
   * @param userId The current user's ID
   * @param otherAgentId The other user's ID
   * @returns The merged DocumentDeltaPacket containing the deltas from the merge
   */
  async mergeOtherUserCRDTs(
    userId: string,
    otherAgentId: string
  ): Promise<DocumentDeltaPacket<RGB> | null> {
    console.debug(
      `[${getTimestamp()}] [DEBUG][mergeOtherUserCRDTs] Step 1: Get or create userDocument for userId:`,
      userId
    );
    const userDocument = await this.getOrCreateUserDocument(userId);
    console.debug(
      `[${getTimestamp()}] [DEBUG][mergeOtherUserCRDTs] Step 2: userDocument after creation:`,
      userDocument
    );
    // Load the other user's CRDT data
    const otherUserDocument = await this.getOrCreateUserDocument(otherAgentId);
    console.debug(
      `[${getTimestamp()}] [DEBUG][mergeUserCRDTs] Step 2: otherUserDocument after creation:`,
      otherUserDocument
    );

    const otherDeltasPacket = otherUserDocument.getDeltasForAgent(userId);

    if (!otherDeltasPacket) {
      console.warn(
        `[${getTimestamp()}] [WARN][mergeUserCRDTs] No deltas found for other user:`,
        otherAgentId
      );
      return null; // No deltas to merge
    }

    const mergeResult = userDocument.merge(otherDeltasPacket);
    console.debug(
      `[${getTimestamp()}] [DEBUG][mergeUserCRDTs] Step 4: Merging deltas from other user:`,
      otherAgentId,
      `Result:`,
      mergeResult
    );
    otherUserDocument.acknowledgeMerge(userId, mergeResult);

    console.debug(
      `[${getTimestamp()}] [DEBUG][mergeUserCRDTs] Step 3: otherUserDocument.getDeltasForAgent() result:`,
      otherDeltasPacket
    );

    console.debug(
      `[${getTimestamp()}] [DEBUG][mergeUserCRDTs] Step 5: merge result:`,
      mergeResult
    );
    // Persist the merged CRDT
    const toSave = {
      _id: userId,
      userId,
      timestamp: new Date(),
      crdt: userDocument.toDBJSON(),
    };
    console.debug(
      `[${getTimestamp()}] [DEBUG][mergeUserCRDTs] Step 6: Document to save:`,
      toSave
    );
    await upsertUserCrdtDocument({ _id: userId }, toSave);
    console.debug(
      `[${getTimestamp()}] [DEBUG][mergeUserCRDTs] Step 7: Merge and save complete for userId:`,
      userId
    );
    // Return the merged deltas packet
    return otherDeltasPacket;
  }
  /**
   * Get or create a Document instance for a specific user.
   * If it doesn't exist, create a new one with the userId.
   * @param userId The user's ID
   * @returns The Document instance for the user
   */
  async getOrCreateUserDocument(userId: string): Promise<Document<RGB>> {
    // Check if the userDocument already exists in memory
    let res: Document<RGB> | null = this.userDocuments[userId];
    if (res) {
      console.debug(
        `[${getTimestamp()}] [DEBUG][CRDTService] Found existing userDocument in memory for userId:`,
        userId
      );
      return res; // Return existing instance
    }

    res = await this.getUserDocumentFromDb(userId);
    if (!res) {
      console.debug(
        `[${getTimestamp()}] [DEBUG][CRDTService] No existing userDocument found in DB for userId:`,
        userId
      );
      // Create a new Document instance for this user
      console.debug(
        `[${getTimestamp()}] [DEBUG][CRDTService] Creating new Document instance for userId:`,
        userId
      );
      res = new Document<RGB>(userId);
      this.userDocuments[userId] = res;
    }
    return res;
  }

  async syncUserDeltas(
    userId: string,
    deltas: DocumentDeltaPacket<RGB>
  ): Promise<DocumentMergeResult<RGB>> {
    const userDocument = await this.getOrCreateUserDocument(userId);
    const merged = userDocument.merge(deltas);
    // Save to MongoDB after merge (upsert by userId)
    try {
      await upsertUserCrdtDocument(
        { _id: userId },
        {
          _id: userId,
          userId,
          timestamp: new Date(),
          crdt: userDocument.toDBJSON(), // Store as JSON
        }
      );
    } catch (err) {
      // This catch is mostly redundant, but you can keep it for synchronous errors
      console.error(
        `Unexpected error in syncUserDeltas for user ${userId}:`,
        err
      );
    }
    return merged;
  }

  async syncReplicaDeltas(
    userId: string,
    replicaId: string,
    deltas: DocumentDeltaPacket<RGB>
  ): Promise<DocumentMergeResult<RGB>> {
    const userDocument = await this.getOrCreateUserDocument(userId);

    const mergeResult = userDocument.merge(deltas);
    // Save to MongoDB after merge (upsert by userId)
    try {
      await upsertUserCrdtDocument(
        { _id: userId },
        {
          _id: userId,
          userId,
          timestamp: new Date(),
          crdt: userDocument.toDBJSON(), // Store as JSON
        }
      );
    } catch (err) {
      // This catch is mostly redundant, but you can keep it for synchronous errors
      console.error(
        `Unexpected error in syncUserDeltas for user ${userId}:`,
        err
      );
    }
    return mergeResult;
  }

  async getAllReplicaDeltas(
    userId: string
  ): Promise<DocumentDeltaPacket<RGB> | null> {
    await this.loadUserDocument(userId);

    const userDocument = await this.getOrCreateUserDocument(userId);
    if (!userDocument) {
      console.warn(
        `[${getTimestamp()}] [WARN][CRDTService] getAllReplicaDeltas: No document found for user:`,
        userId
      );
      return null; // No deltas to merge
    }

    // Get deltas for the client replica
    console.info(
      `[${getTimestamp()}] [INFO][CRDTService] getAllReplicaDeltas: Fetching deltas for userId:`,
      userId
    );
    const deltas = userDocument.getDeltasForReplica(`${userId}_client`);
    if (!deltas) {
      console.warn(
        `[${getTimestamp()}] [WARN][CRDTService] getAllReplicaDeltas: No deltas found for user:`,
        userId
      );
      return null; // No deltas to return
    }
    console.info(
      `[${getTimestamp()}] [INFO][CRDTService] getAllReplicaDeltas: fetched deltas for userId:`,
      userId
    );
    return deltas;
  }

  async getUserDocumentFromDb(userId: string): Promise<Document<RGB> | null> {
    // Efficiently load the latest CRDT document for this user using upsertDocument's filter
    const doc = await userCrdtDb.upsertDocument({ _id: userId }, {}); // upsertDocument returns the doc, but we don't want to update, just fetch
    // If not found, upsertDocument will create an empty doc, so instead use a new method for find
    if (doc && doc.crdt) {
      return Document.fromJSON<RGB>(doc.crdt);
    }
    return null;
  }

  async loadUserDocument(userId: string): Promise<void> {
    const crdt = await this.getUserDocumentFromDb(userId);
    if (crdt) {
      // Replace in-memory CRDT for this user
      this.userDocuments[userId] = crdt;
    }
  }
}

export const crdtService = new CRDTService();
