import { LWWMap, ICRDT, IDelta } from "./CRDTTypes";

export type RGB = [number, number, number];

export interface PixelDeltaPacket {
  deltas: PixelDelta[];
  agentId: string;
  // Optional: peer's per-pixel vector clock (for bidirectional sync)
  peerTimestamps?: Record<string, number>;
}
export interface MergeResult {
  applied: PixelDelta[];
  missing: PixelDelta[];
  // Optional: peer's per-pixel vector clock (for bidirectional sync)
  peerTimestamps?: Record<string, number>;
}
export interface PixelDelta extends IDelta<RGB | null> {
  x: number;
  y: number;
}

export class PixelDataCRDT implements ICRDT<RGB, PixelDelta> {
  private dataMap: LWWMap<RGB>;
  private id: string;
  // Per-peer last sync timestamps (simple optimization)
  private peerTimestamps: Record<string, number> = {};
  // Per-peer, per-pixel vector clock: { peerId: { pixelKey: timestamp } }
  private peerPixelTimestamps: Record<string, Record<string, number>> = {};

  public getState(): LWWMap<RGB> {
    return this.dataMap;
  }
  public getId(): string {
    return this.id;
  }

  public get values(): Record<string, [string, number, RGB | null]> {
    return this.dataMap.state;
  }
  // private history: PixelDelta[] = [];

  constructor(id: string) {
    this.id = id;
    this.dataMap = new LWWMap<RGB>(id, {});
  }

  /**
   * Get deltas for a specific peer since the last sync with that peer.
   * Updates the peer's last sync timestamp to the latest delta sent.
   */
  getDeltaForPeer(peerId: string): PixelDeltaPacket | null {
    // Use per-pixel vector clock for this peer
    const peerPixels = this.peerPixelTimestamps[peerId] || {};
    const deltas: PixelDelta[] = [];
    for (const [key, register] of Object.entries(this.dataMap.state)) {
      const [x, y] = key.split(",").map(Number);
      const [, ts, color] = register;
      const lastSeen = peerPixels[key] || 0;
      if (ts > lastSeen) {
        deltas.push({ x, y, value: color, timestamp: ts });
      }
    }
    return deltas.length === 0
      ? null
      : {
          deltas,
          agentId: this.id,
          peerTimestamps: this.peerPixelTimestamps[peerId] || {},
        };
  }

  /**
   * Update the last sync timestamp for a peer (e.g., after receiving deltas from them).
   */
  updatePeerTimestamp(peerId: string, timestamp: number) {
    this.peerTimestamps[peerId] = Math.max(
      this.peerTimestamps[peerId] || 0,
      timestamp
    );
    // Optionally, update all per-pixel timestamps for this peer to at least this value
    if (!this.peerPixelTimestamps[peerId])
      this.peerPixelTimestamps[peerId] = {};
    for (const key of Object.keys(this.dataMap.state)) {
      this.peerPixelTimestamps[peerId][key] = Math.max(
        this.peerPixelTimestamps[peerId][key] || 0,
        timestamp
      );
    }
  }

  /**
   * Get the last sync timestamp for a peer.
   */
  getPeerTimestamp(peerId: string): number {
    return this.peerTimestamps[peerId] || 0;
  }

  /**
   * Get the last per-pixel timestamp for a peer and pixel key.
   */
  getPeerPixelTimestamp(peerId: string, key: string): number {
    return this.peerPixelTimestamps[peerId]?.[key] || 0;
  }

  get(key: string): RGB {
    // const key = this.getKey(x, y);
    return this.dataMap.get(key) || [255, 255, 255];
  }
  /**
   * Sets a pixel at (x, y) to the given color.
   * If the pixel is already set to the same color, returns null.
   * Otherwise, returns a PixelDelta object with the new color and timestamp.
   * @param key - The key in the format "x,y".
   * @param color - The RGB color to set the pixel to, or null to clear the pixel.
   * @returns PixelDelta object if the pixel was changed, null if it was already set to the same color.
   * @throws Error if the key is not in the correct
   */
  set(key: string, color: RGB | null): PixelDelta | null {
    const [x, y] = PixelDataCRDT.getXYfromKey(key);
    const currentPixel = this.dataMap.get(key);
    if (currentPixel && currentPixel.toString() === color?.toString()) {
      return null;
    }
    const timestamp = Date.now();
    this.dataMap.set(key, color);
    const delta: PixelDelta = { x, y, value: color, timestamp };
    // this.history.push(delta);
    return delta;
  }

  /**
   * Bidirectional merge: applies incoming deltas, returns both applied and missing deltas for the peer.
   * If packet.peerTimestamps is provided, computes missing deltas for the peer (per-pixel vector clock).
   */
  merge(packet: {
    deltas: PixelDelta[];
    agentId: string;
    peerTimestamps?: Record<string, number>;
  }): MergeResult {
    const incomingState: Record<string, [string, number, RGB | null]> = {};
    for (const delta of packet.deltas) {
      const key = PixelDataCRDT.getKey(delta.x, delta.y);
      incomingState[key] = [packet.agentId, delta.timestamp, delta.value];
    }
    // Use the new LWWMap.merge which returns updated keys
    const updatedKeys = this.dataMap.merge(incomingState);
    // Only return deltas for keys that were actually updated
    const applied = packet.deltas.filter((delta) => {
      const key = PixelDataCRDT.getKey(delta.x, delta.y);
      return updatedKeys.includes(key);
    });

    // --- NEW: After receiving data from peer, update peerPixelTimestamps for that peer ---
    if (!this.peerPixelTimestamps[packet.agentId]) {
      this.peerPixelTimestamps[packet.agentId] = {};
    }
    for (const delta of packet.deltas) {
      const key = PixelDataCRDT.getKey(delta.x, delta.y);
      this.peerPixelTimestamps[packet.agentId][key] = Math.max(
        this.peerPixelTimestamps[packet.agentId][key] || 0,
        delta.timestamp
      );
    }

    // Compute missing deltas for the peer, if peerTimestamps is provided (per-pixel vector clock)
    let missing: PixelDelta[] = [];
    if (packet.peerTimestamps) {
      for (const [key, register] of Object.entries(this.dataMap.state)) {
        const [x, y] = key.split(",").map(Number);
        const [, ts, color] = register;
        const peerTs = packet.peerTimestamps[key] || 0;
        if (ts > peerTs) {
          missing.push({ x, y, value: color, timestamp: ts });
        }
      }
    }
    return {
      applied,
      missing,
      peerTimestamps: this.peerPixelTimestamps[packet.agentId] || {},
    };
  }

  // getDeltas returns an array of PixelDelta objects of the current dataMap
  getAllDeltas(): PixelDeltaPacket {
    const deltas: PixelDelta[] = [];
    for (const [key, register] of Object.entries(this.dataMap.state)) {
      const [x, y] = key.split(",").map(Number);
      const [, timestamp, color] = register; // Extract timestamp from LWWRegister

      deltas.push({ x, y, value: color, timestamp });
    }
    return { deltas, agentId: this.id };
  }

  /**
   * Returns deltas that occurred after the given timestamp.
   */
  getDeltaSince(timestamp: number): PixelDeltaPacket {
    const deltas: PixelDelta[] = [];
    for (const [key, register] of Object.entries(this.dataMap.state)) {
      const [x, y] = key.split(",").map(Number);
      const [, ts, color] = register;
      if (ts > timestamp) {
        deltas.push({ x, y, value: color, timestamp: ts });
      }
    }
    return { deltas, agentId: this.id };
  }

  /**
   * Serialize the CRDT state to a plain JSON object for storage.
   */
  toJSON(): any {
    return {
      id: this.id,
      state: this.dataMap.state, // LWWMap's internal state
    };
  }

  /**
   * Load a PixelDataCRDT from a plain JSON object.
   */
  static fromJSON(json: any): PixelDataCRDT {
    const crdt = new PixelDataCRDT(json.id || "loaded");
    // LWWMap constructor accepts id and state
    crdt.dataMap = new (crdt.dataMap.constructor as any)(
      crdt.id,
      json.state || {}
    );
    return crdt;
  }

  // TODO: add a methot that checks current version of the state and returns the deltas that are not in the current state

  static getKey(x: number, y: number): string {
    return `${x},${y}`;
  }
  static getXYfromKey(key: string): [number, number] {
    const [x, y] = key.split(",").map(Number);
    return [x, y];
  }

  handleMergeResult(
    result: MergeResult,
    agentId: string
  ): PixelDeltaPacket | null {
    // Update the peer's pixel timestamps with the merged result
    if (!this.peerPixelTimestamps[agentId]) {
      this.peerPixelTimestamps[agentId] = {};
    }
    for (const delta of result.applied) {
      const key = PixelDataCRDT.getKey(delta.x, delta.y);
      this.peerPixelTimestamps[agentId][key] = Math.max(
        this.peerPixelTimestamps[agentId][key] || 0,
        delta.timestamp
      );
    }

    return this.getDeltaForPeer(agentId); // Return the deltas for this peer
  }

  ackPeerPixelDeltas(peerId: string, deltas: PixelDelta[]) {
    if (!this.peerPixelTimestamps[peerId])
      this.peerPixelTimestamps[peerId] = {};
    for (const delta of deltas) {
      const key = PixelDataCRDT.getKey(delta.x, delta.y);
      this.peerPixelTimestamps[peerId][key] = Math.max(
        this.peerPixelTimestamps[peerId][key] || 0,
        delta.timestamp
      );
    }
  }
}
