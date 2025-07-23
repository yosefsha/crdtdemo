// Minified replica-aware CRDT with core logic only

export type RGB = [number, number, number];
export type ReplicaId = string;

export interface PixelDeltaMinified {
  x: number;
  y: number;
  timestamp: number;
  value: RGB | null;
  replicaId: ReplicaId;
}

export interface MergeResultMinified {
  applied: PixelDeltaMinified[];
  missing: PixelDeltaMinified[]; // optional, unused in minified
}

export class LWWRegisterMinified<T> {
  state: [replicaId: string, timestamp: number, value: T];

  constructor(initial: [string, number, T]) {
    this.state = initial;
  }

  set(replicaId: string, value: T): boolean {
    const [, , currentValue] = this.state;
    if (currentValue === value) return false;
    this.state = [replicaId, Date.now(), value];
    return true;
  }

  merge(incoming: [string, number, T]): boolean {
    const [rIn, tIn, vIn] = incoming;
    const [rCur, tCur, vCur] = this.state;
    if (tIn > tCur || (tIn === tCur && rIn > rCur)) {
      this.state = incoming;
      return true;
    }
    return false;
  }

  get value() {
    return this.state[2];
  }
}

export type KeyMinified = string;
export type RegisterStateMinified<T> = [
  replicaId: string,
  timestamp: number,
  value: T
];
export type StateMinified<T> = Record<
  KeyMinified,
  RegisterStateMinified<T | null>
>;

export class LWWMapMinified<T> {
  #data = new Map<string, LWWRegisterMinified<T | null>>();

  get state(): StateMinified<T> {
    const out: StateMinified<T> = {};
    for (const [k, reg] of this.#data) out[k] = reg.state;
    return out;
  }

  get(key: KeyMinified): T | null {
    return this.#data.get(key)?.value || null;
  }

  set(replicaId: ReplicaId, key: KeyMinified, value: T | null) {
    const reg = this.#data.get(key);
    if (reg) reg.set(replicaId, value);
    else
      this.#data.set(
        key,
        new LWWRegisterMinified([replicaId, Date.now(), value])
      );
  }

  merge(state: StateMinified<T>): string[] {
    const updated: string[] = [];
    for (const [key, incoming] of Object.entries(state)) {
      const reg = this.#data.get(key);
      if (reg) {
        if (reg.merge(incoming)) updated.push(key);
      } else {
        this.#data.set(key, new LWWRegisterMinified(incoming));
        updated.push(key);
      }
    }
    return updated;
  }
}

export class PixelDataCRDTMinified {
  private replicaId: ReplicaId;
  private map: LWWMapMinified<RGB>;

  constructor(replicaId: ReplicaId) {
    this.replicaId = replicaId;
    this.map = new LWWMapMinified();
  }

  static getKey(x: number, y: number): string {
    return `${x},${y}`;
  }

  static getXYfromKey(key: string): [number, number] {
    const [x, y] = key.split(",").map(Number);
    return [x, y];
  }

  set(key: KeyMinified, color: RGB | null): PixelDeltaMinified | null {
    const old = this.map.get(key);
    if (old && old.toString() === color?.toString()) return null;
    const ts = Date.now();
    this.map.set(this.replicaId, key, color);
    const [x, y] = PixelDataCRDTMinified.getXYfromKey(key);
    return { x, y, timestamp: ts, value: color, replicaId: this.replicaId };
  }

  merge(packet: { deltas: PixelDeltaMinified[] }): MergeResultMinified {
    const incoming: StateMinified<RGB> = {};
    for (const { x, y, value, timestamp, replicaId } of packet.deltas) {
      incoming[`${x},${y}`] = [replicaId, timestamp, value];
    }
    const updated = this.map.merge(incoming);
    const applied = packet.deltas.filter((d) =>
      updated.includes(`${d.x},${d.y}`)
    );
    return { applied, missing: [] };
  }

  get(key: KeyMinified): RGB | null {
    return this.map.get(key);
  }

  getAllDeltas(): PixelDeltaMinified[] {
    const result: PixelDeltaMinified[] = [];
    for (const [key, [replicaId, timestamp, value]] of Object.entries(
      this.map.state
    )) {
      const [x, y] = PixelDataCRDTMinified.getXYfromKey(key);
      result.push({ x, y, timestamp, value, replicaId });
    }
    return result;
  }
}
