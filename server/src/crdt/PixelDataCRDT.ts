import { LWWMap, ICRDT, IDelta } from "./CRDTTypes";

export type RGB = [number, number, number];

export interface PixelDeltaPacket {
  deltas: PixelDelta[];
  agentId: string;
}

export interface PixelDelta extends IDelta<RGB | null> {
  x: number;
  y: number;
}

export class PixelDataCRDT implements ICRDT<RGB, PixelDelta> {
  private dataMap: LWWMap<RGB>;
  private id: string;

  public getState(): LWWMap<RGB> {
    return this.dataMap;
  }
  public getId(): string {
    return this.id;
  }
  // private history: PixelDelta[] = [];

  constructor(id: string) {
    this.id = id;
    this.dataMap = new LWWMap<RGB>(id, {});
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

  merge(packet: PixelDeltaPacket): PixelDeltaPacket {
    if (packet.agentId === this.id) return { deltas: [], agentId: this.id };
    const newDeltas: PixelDelta[] = [];

    packet.deltas.forEach((delta) => {
      const key = PixelDataCRDT.getKey(delta.x, delta.y);

      // Merge using LWWMap (it ensures timestamp-based resolution)
      if (this.dataMap.set(key, delta.value)) {
        newDeltas.push(delta);
      }
    });
    console.log("newDeltas lenght: ", newDeltas.length);
    console.log("newDeltas", newDeltas);
    // this.history.push(...newDeltas);
    return { deltas: newDeltas, agentId: this.id };
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
}
