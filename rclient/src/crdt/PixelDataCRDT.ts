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
  private state: LWWMap<RGB>;
  private id: string;

  public getState(): LWWMap<RGB> {
    return this.state;
  }
  public getId(): string {
    return this.id;
  }
  // private history: PixelDelta[] = [];

  constructor(id: string) {
    this.id = id;
    this.state = new LWWMap<RGB>(id, {});
  }

  get(key: string): RGB {
    // const key = this.getKey(x, y);
    return this.state.get(key) || [255, 255, 255];
  }

  set(key: string, color: RGB | null): PixelDelta | null {
    const [x, y] = PixelDataCRDT.getXYfromKey(key);
    const currentPixel = this.state.get(key);
    if (currentPixel && currentPixel.toString() === color?.toString()) {
      return null;
    }
    const timestamp = Date.now();
    this.state.set(key, color);
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
      if (this.state.set(key, delta.value)) {
        newDeltas.push(delta);
      }
    });
    console.log("newDeltas lenght: ", newDeltas.length);
    console.log("newDeltas", newDeltas);
    // this.history.push(...newDeltas);
    return { deltas: newDeltas, agentId: this.id };
  }

  // getDeltas returns an array of PixelDelta objects of the current state
  getAllDeltas(): PixelDeltaPacket {
    const deltas: PixelDelta[] = [];
    for (const [key, register] of Object.entries(this.state.state)) {
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
    for (const [key, register] of Object.entries(this.state.state)) {
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
      state: this.state.state, // LWWMap's internal state
    };
  }

  /**
   * Load a PixelDataCRDT from a plain JSON object.
   */
  static fromJSON(json: any): PixelDataCRDT {
    const crdt = new PixelDataCRDT(json.id || "loaded");
    // LWWMap constructor accepts id and state
    crdt.state = new (crdt.state.constructor as any)(crdt.id, json.state || {});
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
