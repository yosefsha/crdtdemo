import { PixelDataCRDT, PixelDeltaPacket } from "../crdt/PixelDataCRDT";
import { getCurrentDateTimeString } from "./helpers";
import { userCrdtDb, upsertUserCrdtDocument } from "./userCrdtDb";

class CRDTService {
  /**
   * Merge another user's CRDT into the current user's CRDT and persist the result.
   * @param userId The current user's ID
   * @param otherCRDT The PixelDataCRDT instance to merge in
   * @returns The merged CRDT for the current user
   */
  async mergeUserCRDTs(userId: string, otherCRDT: PixelDataCRDT) {
    const userPixelData = this.getOrCreateUserPixelData(userId);
    // Merge the other user's CRDT into the current user's CRDT
    userPixelData.merge({
      deltas: otherCRDT.state
        ? Object.values((otherCRDT as any).state.map)
        : [],
      agentId: otherCRDT.id || "other",
    });
    // Persist the merged CRDT
    await upsertUserCrdtDocument(
      { _id: userId },
      {
        _id: userId,
        userId,
        timestamp: new Date(),
        crdt: userPixelData.toJSON(),
      }
    );
    return userPixelData;
  }
  private static instance: CRDTService;
  private pixelData: PixelDataCRDT;
  private userPixelData: Record<string, PixelDataCRDT> = {};

  constructor() {
    this.pixelData = new PixelDataCRDT(
      `ServerPixelData${getCurrentDateTimeString()}`
    );
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
        `UserPixelData_${userId}_${getCurrentDateTimeString()}`
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
