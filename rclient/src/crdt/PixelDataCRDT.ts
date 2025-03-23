import { LWWMap } from "./CRDTTypes";

export type RGB = [number, number, number];

export interface PixelDeltaPacket {
  deltas: PixelDelta[];
  agentId: string;
}

export interface PixelDelta {
  x: number;
  y: number;
  color: RGB | null;
  timestamp: number;
}

export class PixelDataCRDT {
  private state: LWWMap<RGB>;
  private id: string;
  private history: PixelDelta[] = [];

  constructor(id: string) {
    this.id = id;
    this.state = new LWWMap<RGB>(id, {});
  }

  get(x: number, y: number): RGB {
    const key = this.getKey(x, y);
    return this.state.get(key) || [255, 255, 255];
  }

  set(x: number, y: number, color: RGB): PixelDelta | null {
    const key = this.getKey(x, y);
    const currentPixel = this.state.get(key);
    if (currentPixel && currentPixel.toString() === color.toString()) {
      return null;
    }
    const timestamp = Date.now();

    this.state.set(key, color);
    const delta: PixelDelta = { x, y, color, timestamp };
    this.history.push(delta);
    return delta;
  }

  merge(packet: PixelDeltaPacket): PixelDeltaPacket {
    if (packet.agentId === this.id) return { deltas: [], agentId: this.id };
    const newDeltas: PixelDelta[] = [];

    packet.deltas.forEach((delta) => {
      const key = this.getKey(delta.x, delta.y);

      // Merge using LWWMap (it ensures timestamp-based resolution)
      if (this.state.set(key, delta.color)) {
        newDeltas.push(delta);
      }
    });
    console.log("newDeltas lenght: ", newDeltas.length);
    console.log("newDeltas", newDeltas);
    this.history.push(...newDeltas);
    return { deltas: newDeltas, agentId: this.id };
  }

  // getDeltas returns an array of PixelDelta objects of the current state
  getAllDeltas(): PixelDeltaPacket {
    // const deltas = Object.keys(this.state)
    //   .map((key) => {
    //     const [x, y] = key.split(",").map(Number);
    //     const color = this.state.get(key);
    //     if (color) {
    //       return {
    //         x,
    //         y,
    //         color,
    //         timestamp: p.timestamp,
    //         agentId: this.id,
    //       };
    //     } else {
    //       return null;
    //     }
    //   })
    //   .filter((p) => p !== null) as PixelDelta[];
    // return { deltas, agentId: this.id };
    const deltas: PixelDelta[] = [];
    for (const [key, register] of Object.entries(this.state.state)) {
      const [x, y] = key.split(",").map(Number);
      const [, timestamp, color] = register; // Extract timestamp from LWWRegister

      deltas.push({ x, y, color, timestamp });
    }

    return { deltas, agentId: this.id };
  }

  // TODO: add a methot that checks current version of the state and returns the deltas that are not in the current state

  private getKey(x: number, y: number): string {
    return `${x},${y}`;
  }
}
