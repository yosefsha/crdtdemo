export type RGB = [number, number, number];

interface Pixel {
  color: RGB;
  timestamp: number;
}

interface State {
  [key: string]: Pixel;
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
    return { x, y, color, timestamp };
  }

  merge(deltas: PixelDelta[]): void {
    deltas.forEach((delta) => {
      const key = this.getKey(delta.x, delta.y);
      const currentPixel = this.state[key];
      if (!currentPixel || delta.timestamp > currentPixel.timestamp) {
        this.state[key] = { color: delta.color, timestamp: delta.timestamp };
      }
    });
  }

  getDeltas(): PixelDelta[] {
    return Object.keys(this.state).map((key) => {
      const [x, y] = key.split(",").map(Number);
      const { color, timestamp } = this.state[key];
      return { x, y, color, timestamp };
    });
  }

  private getKey(x: number, y: number): string {
    return `${x},${y}`;
  }
}
