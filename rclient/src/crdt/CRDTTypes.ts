// this is a simple CRDT interface that can be used to implement CRDTs

export interface CRDT<T, S> {
  value: T;
  state: S;
  merge(state: S): void;
}

// LWWElementSet is a Last-Write-Wins Element Set CRDT
export class LWWRegister<T> {
  readonly id: string;
  state: [peer: string, timestamp: number, value: T];

  get value() {
    return this.state[2];
  }

  constructor(id: string, state: [string, number, T]) {
    this.id = id;
    this.state = state;
  }

  set(value: T): boolean {
    // set the peer ID to the local ID, increment the local timestamp by 1 and set the value
    if (this.state[2] === value) return false; // Avoid unnecessary updates
    this.state = [this.id, Date.now(), value];
    return true;
  }

  merge(state: [peer: string, timestamp: number, value: T]) {
    const [remotePeer, remoteTimestamp] = state;
    const [localPeer, localTimestamp] = this.state;

    // if the local timestamp is greater than the remote timestamp, discard the incoming value
    if (localTimestamp > remoteTimestamp) return;

    // if the timestamps are the same but the local peer ID is greater than the remote peer ID, discard the incoming value
    if (localTimestamp === remoteTimestamp && localPeer > remotePeer) return;

    // otherwise, overwrite the local state with the remote state
    this.state = state;
  }
}

export class LWWMap<T> {
  readonly id: string;
  #data = new Map<string, LWWRegister<T | null>>();

  constructor(id: string, state: State<T>) {
    this.id = id;

    // create a new register for each key in the initial state
    for (const [key, register] of Object.entries(state)) {
      this.#data.set(key, new LWWRegister(this.id, register));
    }
  }

  get value(): Value<T> {
    const value: Value<T> = {};

    // build up an object where each value is set to the value of the register at the corresponding key
    for (const [key, register] of this.#data.entries()) {
      if (register.value !== null) value[key] = register.value;
    }

    return value;
  }

  get state() {
    const state: State<T> = {};

    // build up an object where each value is set to the full state of the register at the corresponding key
    for (const [key, register] of this.#data.entries()) {
      if (register) state[key] = register.state;
    }

    return state;
  }

  has(key: string) {
    return this.#data.get(key)?.value !== null;
  }

  get(key: string) {
    return this.#data.get(key)?.value;
  }

  set(key: string, value: T | null) {
    // get the register at the given key
    let register = this.#data.get(key);

    // if the register already exists, set the value
    if (register) {
      return register.set(value);
    }
    // otherwise, instantiate a new `LWWRegister` with the value
    this.#data.set(key, new LWWRegister(this.id, [this.id, 1, value]));
    return true;
  }

  delete(key: string) {
    // set the register to null, if it exists
    this.#data.get(key)?.set(null);
  }

  merge(state: State<T>) {
    // recursively merge each key's register with the incoming state for that key
    for (const [key, remote] of Object.entries(state)) {
      const local = this.#data.get(key);

      // if the register already exists, merge it with the incoming state
      if (local) local.merge(remote);
      // otherwise, instantiate a new `LWWRegister` with the incoming state
      else this.#data.set(key, new LWWRegister(this.id, remote));
    }
  }
}

// State is a map of keys to the full state of the corresponding register
export type State<T> = Record<string, LWWRegister<T | null>["state"]>;

export type Value<T> = {
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
  merge(packet: { deltas: D[]; agentId: string }): {
    deltas: D[];
    agentId: string;
  };
  getAllDeltas(): { deltas: D[]; agentId: string };
  getDeltaSince(timestamp: number): { deltas: D[]; agentId: string };
}
