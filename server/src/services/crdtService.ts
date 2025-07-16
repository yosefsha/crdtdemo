import { PixelDataCRDT, PixelDeltaPacket } from "../crdt/PixelDataCRDT";
// TODO: Move PixelDataCRDT to a shared directory/package (e.g., ../../shared/crdt/PixelDataCRDT)
// and import from there in both client and server for a single source of truth.
import { getTimestamp } from "./helpers";
import { userCrdtDb, upsertUserCrdtDocument } from "./userCrdtDb";

class CRDTService {
  /**
   * Merge another user's CRDT into the current user's CRDT and persist the result.
   * @param userId The current user's ID
   * @param otherCRDT The PixelDataCRDT instance to merge in
   * @returns The merged DeltasPacket containing the deltas from the merge
   */
  async mergeUserCRDTs(userId: string, otherCRDT: PixelDataCRDT) {
    console.debug(
      `[${getTimestamp()}] [DEBUG][mergeUserCRDTs] Step 1: Get or create userPixelData for userId:`,
      userId
    );
    const userPixelData = this.getOrCreateUserPixelData(userId);
    console.debug(
      `[${getTimestamp()}] [DEBUG][mergeUserCRDTs] Step 2: userPixelData before merge:`,
      userPixelData
    );
    const otherDeltasPacket = otherCRDT.getAllDeltas();
    console.debug(
      `[${getTimestamp()}] [DEBUG][mergeUserCRDTs] Step 3: otherCRDT.getAllDeltas() result:`,
      otherDeltasPacket
    );
    const agentId = otherCRDT.getId() || "other";
    console.debug(
      `[${getTimestamp()}] [DEBUG][mergeUserCRDTs] Step 4: agentId for merge:`,
      agentId
    );
    // Merge the other user's CRDT into the current user's CRDT
    const mergeResult = userPixelData.merge({
      deltas: otherDeltasPacket.deltas,
      agentId,
    });
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
    return mergeResult;
  }
  private static instance: CRDTService;
  private pixelData: PixelDataCRDT;
  private userPixelData: Record<string, PixelDataCRDT> = {};

  constructor() {
    this.pixelData = new PixelDataCRDT(`ServerPixelData${getTimestamp()}`);
  }

  static getInstance(): CRDTService {
    if (!CRDTService.instance) {
      CRDTService.instance = new CRDTService();
    }
    return CRDTService.instance;
  }

  getPixelData(): PixelDataCRDT {
    return this.pixelData;
  }

  // getCurrentState(): State<[number, number, number]> {
  //   return this.pixelData.state;
  // }

  setPixelData(pixelData: PixelDataCRDT) {
    this.pixelData = pixelData;
  }

  // syncState(state: State<[number, number, number]>) {
  //   this.pixelData.merge(state);
  //   return this.pixelData.state;
  // }
  syncDeltas(deltas: PixelDeltaPacket) {
    return this.pixelData.merge(deltas);
  }

  getOrCreateUserPixelData(userId: string): PixelDataCRDT {
    if (!this.userPixelData[userId]) {
      this.userPixelData[userId] = new PixelDataCRDT(
        `UserPixelData_${userId}_${getTimestamp()}`
      );
    }
    return this.userPixelData[userId];
  }

  async syncUserDeltas(userId: string, deltas: PixelDeltaPacket) {
    const userPixelData = this.getOrCreateUserPixelData(userId);
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

  async getUserPixelDataFromDb(userId: string) {
    // Efficiently load the latest CRDT document for this user using upsertDocument's filter
    const doc = await userCrdtDb.upsertDocument({ _id: userId }, {}); // upsertDocument returns the doc, but we don't want to update, just fetch
    // If not found, upsertDocument will create an empty doc, so instead use a new method for find
    if (doc && doc.crdt) {
      return PixelDataCRDT.fromJSON(doc.crdt);
    }
    return null;
  }

  async loadUserPixelData(userId: string) {
    const crdt = await this.getUserPixelDataFromDb(userId);
    if (crdt) {
      // Replace in-memory CRDT for this user
      this.userPixelData[userId] = crdt;
    }
    return this.userPixelData[userId] || null;
  }
}

export const crdtService = new CRDTService();
