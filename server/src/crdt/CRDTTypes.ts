// this is a simple CRDT interface that can be used to implement CRDTs

export interface CRDT<T, S> {
  value: T;
  state: S;
  merge(state: S): void;
}

// LWWElementSet is a Last-Write-Wins Element Set CRDT

// State is a map of keys to the full state of the corresponding register

export type Values<T> = {
  [key: string]: T;
};
// State is a record of keys to the full state of the corresponding register

export interface IDelta<T> {
  timestamp: number;
  value: T | null;
}

export interface ICRDT<T, D extends IDelta<T>> {
  get(key: string): T | null;
  set(key: string, value: T): D | null;
  /**
   * Bidirectional merge: applies incoming deltas, returns both applied and missing deltas for the peer.
   * If packet.peerPixelTimestamps is provided, computes missing deltas for the peer.
   */
  merge(packet: {
    deltas: D[];
    agentId: string;
    peerTimestamps?: Record<string, number>;
  }): { applied: D[]; missing: D[] };
  getAllDeltas(): { deltas: D[]; agentId: string };
  getDeltaSince(timestamp: number): { deltas: D[]; agentId: string };
}
///////new
export type RGB = [number, number, number];
export type ReplicaId = string;
export type AgentId = string;
export type Key = string;

export interface PixelDelta {
  x: number;
  y: number;
  timestamp: number;
  value: RGB | null;
  replicaId: ReplicaId;
  agentId: AgentId;
}

export class LWWRegister<T> {
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
    const [rCur, tCur] = this.state;
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

export type RegisterState<T> = [replicaId: string, timestamp: number, value: T];
export type State<T> = Record<Key, RegisterState<T | null>>;

export class LWWMap<T> {
  #data = new Map<string, LWWRegister<T | null>>();

  get state(): State<T> {
    const out: State<T> = {};
    for (const [k, reg] of this.#data) out[k] = reg.state;
    return out;
  }

  get values(): Record<string, T> {
    const out: Record<string, T> = {};
    for (const [k, reg] of this.#data) {
      if (reg.value !== null) {
        out[k] = reg.value;
      }
    }
    return out;
  }

  get(key: Key): T | null {
    return this.#data.get(key)?.value || null;
  }

  set(replicaId: ReplicaId, key: Key, value: T | null) {
    const reg = this.#data.get(key);
    if (reg) reg.set(replicaId, value);
    else this.#data.set(key, new LWWRegister([replicaId, Date.now(), value]));
  }

  merge(state: State<T>): string[] {
    const updated: string[] = [];
    for (const [key, incoming] of Object.entries(state)) {
      const reg = this.#data.get(key);
      if (reg) {
        if (reg.merge(incoming)) updated.push(key);
      } else {
        this.#data.set(key, new LWWRegister(incoming));
        updated.push(key);
      }
    }
    return updated;
  }
}
