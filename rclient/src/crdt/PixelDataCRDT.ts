export type RGB = [number, number, number];

interface Pixel {
  color: RGB;
  timestamp: number;
}

interface State {
  [key: string]: Pixel;
}

export interface PixelDeltaPacket {
  deltas: PixelDelta[];
  agentId: string;
}

export interface PixelDelta {
  x: number;
  y: number;
  color: RGB;
  timestamp: number;
}

export class PixelDataCRDT {
  private state: State;
  private id: string;
  private history: PixelDelta[] = [];
  constructor(id: string) {
    this.id = id;
    this.state = {};
  }

  get(x: number, y: number): RGB {
    const key = this.getKey(x, y);
    return this.state[key]?.color || [255, 255, 255];
  }

  set(x: number, y: number, color: RGB): PixelDelta {
    const key = this.getKey(x, y);
    const timestamp = Date.now();
    this.state[key] = { color, timestamp };
    const delta: PixelDelta = { x, y, color, timestamp };
    this.history.push(delta);

    return delta;
  }

  merge(packet: PixelDeltaPacket): PixelDeltaPacket {
    if (packet.agentId === this.id) return { deltas: [], agentId: this.id };
    const newDeltas: PixelDelta[] = [];

    packet.deltas.forEach((delta) => {
      const key = this.getKey(delta.x, delta.y);
      const currentPixel = this.state[key];
      if (!currentPixel || delta.timestamp > currentPixel.timestamp) {
        this.state[key] = { color: delta.color, timestamp: delta.timestamp };
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
    const deltas = Object.keys(this.state).map((key) => {
      const [x, y] = key.split(",").map(Number);
      const { color, timestamp } = this.state[key];
      return { x, y, color, timestamp, agentId: this.id };
    });
    return { deltas, agentId: this.id };
  }

  // TODO: add a methot that checks current version of the state and returns the deltas that are not in the current state

  private getKey(x: number, y: number): string {
    return `${x},${y}`;
  }
}
