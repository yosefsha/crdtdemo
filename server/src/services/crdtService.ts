import {
  MergeResult,
  PixelDataCRDT,
  PixelDeltaPacket,
} from "../crdt/PixelDataCRDT";
// TODO: Move PixelDataCRDT to a shared directory/package (e.g., ../../shared/crdt/PixelDataCRDT)
// and import from there in both client and server for a single source of truth.
import { getTimestamp } from "./helpers";
import { userCrdtDb, upsertUserCrdtDocument } from "./userCrdtDb";

class CRDTService {
  /**
   * Singleton instance of CRDTService.
   * Use CRDTService.getInstance() to access the singleton instance.
   */
  private static instance: CRDTService;
  private userPixelData: Record<string, PixelDataCRDT> = {};
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
   * @returns The merged MergeResult containing the deltas from the merge
   */
  async mergeOtherUserCRDTs(
    userId: string,
    otherAgentId: string
  ): Promise<PixelDeltaPacket | null> {
    console.debug(
      `[${getTimestamp()}] [DEBUG][mergeOtherUserCRDTs] Step 1: Get or create userPixelData for userId:`,
      userId
    );
    const userPixelData = await this.getOrCreateUserPixelData(userId);
    console.debug(
      `[${getTimestamp()}] [DEBUG][mergeOtherUserCRDTs] Step 2: userPixelData after creation:`,
      userPixelData
    );
    // Load the other user's CRDT data
    const otherUserPixelData = await this.getOrCreateUserPixelData(
      otherAgentId
    );
    console.debug(
      `[${getTimestamp()}] [DEBUG][mergeUserCRDTs] Step 2: otherUserPixelData after creation:`,
      otherUserPixelData
    );

    const otherDeltasPacket = otherUserPixelData.getDeltaForAgent(userId);

    const mergeResult = userPixelData.merge(otherDeltasPacket!);
    console.debug(
      `[${getTimestamp()}] [DEBUG][mergeUserCRDTs] Step 4: Merging deltas from other user:`,
      otherAgentId,
      `Result:`,
      mergeResult
    );
    otherUserPixelData.handleMergeAgentResult(
      mergeResult,
      userId // Handle the merge result for the current user
    );

    console.debug(
      `[${getTimestamp()}] [DEBUG][mergeUserCRDTs] Step 3: otherUserPixelData.getDeltaForAgent() result:`,
      otherDeltasPacket
    );
    if (!otherDeltasPacket) {
      console.warn(
        `[${getTimestamp()}] [WARN][mergeUserCRDTs] No deltas found for other user:`,
        otherAgentId
      );
      return null; // No deltas to merge
    }
    console.debug(
      `[${getTimestamp()}] [DEBUG][mergeUserCRDTs] Step 4: Merging deltas from other user:`,
      otherAgentId
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
      crdt: userPixelData.toJSON(),
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
   * Get or create a PixelDataCRDT instance for a specific user.
   * If it doesn't exist, create a new one with the userId and a server replicaId.
   * @param userId The user's ID
   * @returns The PixelDataCRDT instance for the user
   */
  async getOrCreateUserPixelData(userId: string): Promise<PixelDataCRDT> {
    // Check if the userPixelData already exists in memory
    let res: PixelDataCRDT | null = this.userPixelData[userId];
    if (res) {
      console.debug(
        `[${getTimestamp()}] [DEBUG][CRDTService] Found existing userPixelData in memory for userId:`,
        userId
      );
      return res; // Return existing instance
    }

    res = await this.getUserPixelDataFromDb(userId);
    if (!res) {
      console.debug(
        `[${getTimestamp()}] [DEBUG][CRDTService] No existing userPixelData found in DB for userId:`,
        userId
      );
      // Create a new PixelDataCRDT instance for this user
      console.debug(
        `[${getTimestamp()}] [DEBUG][CRDTService] Creating new PixelDataCRDT instance for userId:`,
        userId
      );
      res = new PixelDataCRDT(userId, `${userId}_server`);
      this.userPixelData[userId] = res;
    }
    return res;
  }

  async syncUserDeltas(userId: string, deltas: PixelDeltaPacket) {
    const userPixelData = await this.getOrCreateUserPixelData(userId);
    const merged = userPixelData.merge(deltas);
    // Save to MongoDB after merge (upsert by userId)
    try {
      await upsertUserCrdtDocument(
        { _id: userId },
        {
          _id: userId,
          userId,
          timestamp: new Date(),
          crdt: userPixelData.toJSON(), // Store as JSON
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
    deltas: PixelDeltaPacket
  ) {
    const userPixelData = await this.getOrCreateUserPixelData(userId);

    const mergeResult = userPixelData.merge(deltas);
    // Save to MongoDB after merge (upsert by userId)
    try {
      await upsertUserCrdtDocument(
        { _id: userId },
        {
          _id: userId,
          userId,
          timestamp: new Date(),
          crdt: userPixelData.toJSON(), // Store as JSON
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

  async getAllReplicaDeltas(userId: string): Promise<PixelDeltaPacket | null> {
    await this.loadUserPixelData(userId);

    const userPixelData = await this.getOrCreateUserPixelData(userId);
    if (!userPixelData) {
      console.warn(
        `[${getTimestamp()}] [WARN][CRDTService] getAllReplicaDeltas: No pixel data found for user:`,
        userId
      );
      return null; // No deltas to merge
    }

    // Get deltas for the client replica
    console.info(
      `[${getTimestamp()}] [INFO][CRDTService] getAllReplicaDeltas: Fetching deltas for userId:`,
      userId
    );
    const deltas = userPixelData.getDeltaForReplica(`${userId}_client`);
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

  async getUserPixelDataFromDb(userId: string): Promise<PixelDataCRDT | null> {
    // Efficiently load the latest CRDT document for this user using upsertDocument's filter
    const doc = await userCrdtDb.upsertDocument({ _id: userId }, {}); // upsertDocument returns the doc, but we don't want to update, just fetch
    // If not found, upsertDocument will create an empty doc, so instead use a new method for find
    if (doc && doc.crdt) {
      return PixelDataCRDT.fromJSON(doc.crdt);
    }
    return null;
  }

  async loadUserPixelData(userId: string): Promise<void> {
    const crdt = await this.getUserPixelDataFromDb(userId);
    if (crdt) {
      // Replace in-memory CRDT for this user
      this.userPixelData[userId] = crdt;
    }
  }
}

export const crdtService = new CRDTService();
