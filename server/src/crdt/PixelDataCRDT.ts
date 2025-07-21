// Replica-aware CRDT with peer tracking, agent awareness, and delta filtering

/*
1. Sync Between Two Replicas of the Same Agent
Setup
agentId = "A"

replicaId = "A:tab1" and "A:tab2"

Steps
tab1 calls getDeltaForAgent("A")

It checks what replicas under agent A have already seen.

Finds updates that are new to the other replicas of "A" (e.g., "A:tab2").

tab2 calls merge() with the packet from tab1

Applies updates to local LWWMap.

Updates peerTimestamps["A"].replicas["A:tab1"].

tab2 optionally calls handleMergeResult(...)

To respond with any data tab1 might be missing.

This flow ensures a full sync between the two tabs of the same agent, while tracking which tab saw what pixel.

2. Sync Between Two Different Agents
Setup
Agent A has replicaId = "A:1"

Agent B has replicaId = "B:1"

Steps
Agent A calls getDeltaForAgent("B")

Collects any updates that B (based on all its replicas) hasn’t seen.

Agent B calls merge() with Agent A’s packet

Applies new data to local LWWMap.

Updates peerTimestamps["A"].replicas["A:1"].

Agent B computes missing[] in the MergeResult

This tells B what data A hasn’t seen.

Agent B calls handleMergeResult(..., {agentId: "A", replicaId: "A:1"})

Pushes those missing deltas back to Agent A.
*/
// Replica-aware CRDT with peer tracking, agent awareness, and delta filtering

// export type RGB = [number, number, number];
// export type ReplicaId = string;
// export type AgentId = string;

// export class LWWRegister<T> {
//   state: [replicaId: string, timestamp: number, value: T];

//   constructor(initial: [string, number, T]) {
//     this.state = initial;
//   }

//   set(replicaId: string, value: T): boolean {
//     const [, , currentValue] = this.state;
//     if (currentValue === value) return false;
//     this.state = [replicaId, Date.now(), value];
//     return true;
//   }

//   merge(incoming: [string, number, T]): boolean {
//     const [rIn, tIn, vIn] = incoming;
//     const [rCur, tCur] = this.state;
//     if (tIn > tCur || (tIn === tCur && rIn > rCur)) {
//       this.state = incoming;
//       return true;
//     }
//     return false;
//   }

//   get value() {
//     return this.state[2];
//   }
// }

//
// export type RegisterState<T> = [replicaId: string, timestamp: number, value: T];
// export type State<T> = Record<Key, RegisterState<T | null>>;

// export class LWWMap<T> {
//   #data = new Map<string, LWWRegister<T | null>>();

//   get state(): State<T> {
//     const out: State<T> = {};
//     for (const [k, reg] of this.#data) out[k] = reg.state;
//     return out;
//   }

//   get values(): Record<string, T> {
//     const out: Record<string, T> = {};
//     for (const [k, reg] of this.#data) {
//       if (reg.value !== null) {
//         out[k] = reg.value;
//       }
//     }
//     return out;
//   }

//   get(key: Key): T | null {
//     return this.#data.get(key)?.value || null;
//   }

//   set(replicaId: ReplicaId, key: Key, value: T | null) {
//     const reg = this.#data.get(key);
//     if (reg) reg.set(replicaId, value);
//     else this.#data.set(key, new LWWRegister([replicaId, Date.now(), value]));
//   }

//   merge(state: State<T>): string[] {
//     const updated: string[] = [];
//     for (const [key, incoming] of Object.entries(state)) {
//       const reg = this.#data.get(key);
//       if (reg) {
//         if (reg.merge(incoming)) updated.push(key);
//       } else {
//         this.#data.set(key, new LWWRegister(incoming));
//         updated.push(key);
//       }
//     }
//     return updated;
//   }
// }

import { LWWMap } from "./CRDTTypes";
import type { RGB, ReplicaId, AgentId, Key } from "./CRDTTypes";

export interface PixelDelta {
  x: number;
  y: number;
  timestamp: number;
  value: RGB | null;
  replicaId: ReplicaId;
  agentId: AgentId;
}

export interface MergeResult {
  applied: PixelDelta[];
  missing: PixelDelta[];
}
export interface PixelDeltaPacket {
  deltas: PixelDelta[];
  fromReplica: ReplicaId;
  fromAgent: AgentId;
}

export interface PixelDataCRDTInfo {
  agentId: AgentId;
  replicaId: ReplicaId;
}

export class PixelDataCRDT {
  private replicaId: ReplicaId;
  private agentId: AgentId;
  private map: LWWMap<RGB>;
  // For other agents: agent-level vector clock (Record<Key, number>)
  // For this agent: per-replica vector clocks (Record<ReplicaId, Record<Key, number>>)
  // For other agents: agent-level vector clock (Record<AgentId, Record<Key, number>>)
  private agentTimestamps: Record<AgentId, Record<Key, number>> = {};
  // For this agent: per-replica vector clocks (Record<ReplicaId, Record<Key, number>>)
  private replicaTimestamps: Record<ReplicaId, Record<Key, number>> = {};

  constructor(agentId: AgentId, replicaId: ReplicaId) {
    this.agentId = agentId;
    this.replicaId = replicaId;
    this.map = new LWWMap();
  }

  static getKey(x: number, y: number): string {
    return `${x},${y}`;
  }

  static getXYfromKey(key: string): [number, number] {
    const [x, y] = key.split(",").map(Number);
    return [x, y];
  }

  set(key: Key, color: RGB | null): PixelDelta | null {
    const old = this.map.get(key);
    if (old && old.toString() === color?.toString()) return null;
    const ts = Date.now();
    this.map.set(this.replicaId, key, color);
    const [x, y] = PixelDataCRDT.getXYfromKey(key);
    return {
      x,
      y,
      timestamp: ts,
      value: color,
      replicaId: this.replicaId,
      agentId: this.agentId,
    };
  }

  // AGENT-LEVEL SYNC: Used for inter-agent sync (never tracks other agents' replicas)
  getDeltaForAgent(agentId: AgentId): PixelDeltaPacket | null {
    const deltas: PixelDelta[] = [];
    const agentClock = this.agentTimestamps[agentId] || {};
    for (const [key, [repId, timestamp, value]] of Object.entries(
      this.map.state
    )) {
      const seen = agentClock[key] || 0;
      if (timestamp > seen) {
        const [x, y] = PixelDataCRDT.getXYfromKey(key);
        deltas.push({
          x,
          y,
          timestamp,
          value,
          replicaId: repId,
          agentId: this.agentId,
        });
      }
    }
    return deltas.length === 0
      ? null
      : {
          deltas,
          fromReplica: this.replicaId,
          fromAgent: this.agentId,
        };
  }

  // REPLICA-LEVEL SYNC: Used for intra-agent sync (between replicas of the same agent)
  getDeltaForReplica(replicaId: ReplicaId): PixelDeltaPacket | null {
    // Only allow intra-agent replica sync
    if (!this.replicaTimestamps[replicaId]) {
      this.replicaTimestamps[replicaId] = {};
    }
    const replicaMap = this.replicaTimestamps[replicaId];
    if (!replicaMap) return null;
    const deltas: PixelDelta[] = [];
    for (const [key, [repId, timestamp, value]] of Object.entries(
      this.map.state
    )) {
      const seen = replicaMap[key] || 0;
      if (timestamp > seen) {
        const [x, y] = PixelDataCRDT.getXYfromKey(key);
        deltas.push({
          x,
          y,
          timestamp,
          value,
          replicaId: repId,
          agentId: this.agentId,
        });
      }
    }
    return deltas.length === 0
      ? null
      : {
          deltas,
          fromReplica: this.replicaId,
          fromAgent: this.agentId,
        };
  }

  // AGENT-LEVEL SYNC: Used for inter-agent sync (never tracks other agents' replicas)
  merge(packet: PixelDeltaPacket): MergeResult {
    const applied: PixelDelta[] = [];
    const missing: PixelDelta[] = [];
    for (const delta of packet.deltas) {
      const key = PixelDataCRDT.getKey(delta.x, delta.y);
      const updated = this.map.merge({
        [key]: [delta.replicaId, delta.timestamp, delta.value],
      });
      if (updated.includes(key)) applied.push(delta);
      // Update agent-level clock for the sender
      let agentClock = this.agentTimestamps[packet.fromAgent];
      if (!agentClock) {
        agentClock = {};
        this.agentTimestamps[packet.fromAgent] = agentClock;
      }
      agentClock[key] = Math.max(agentClock[key] || 0, delta.timestamp);
    }
    // Compute missing for the sender
    const senderClock = this.agentTimestamps[packet.fromAgent] || {};
    for (const [key, [replicaId, timestamp, value]] of Object.entries(
      this.map.state
    )) {
      const seen = senderClock[key] || 0;
      if (timestamp > seen) {
        const [x, y] = PixelDataCRDT.getXYfromKey(key);
        missing.push({
          x,
          y,
          timestamp,
          value,
          replicaId,
          agentId: this.agentId,
        });
      }
    }
    return { applied, missing };
  }
  // REPLICA-LEVEL SYNC: Used for intra-agent sync (between replicas of the same agent)
  handleMergeReplicaResult(
    result: MergeResult,
    fromReplica: ReplicaId
  ): PixelDeltaPacket | null {
    // Only for this agent: maintain per-replica clocks
    const replicaEntry = (this.replicaTimestamps[fromReplica] ??= {});
    for (const delta of result.applied.concat(result.missing)) {
      const key = PixelDataCRDT.getKey(delta.x, delta.y);
      replicaEntry[key] = Math.max(replicaEntry[key] || 0, delta.timestamp);
    }
    return this.getDeltaForReplica(fromReplica);
  }
  // AGENT-LEVEL SYNC: Used for inter-agent sync (never tracks other agents' replicas)
  handleMergeAgentResult(
    result: MergeResult,
    fromAgent: AgentId
  ): PixelDeltaPacket | null {
    // Only update agent-level clock for the other agent
    let agentClock = this.agentTimestamps[fromAgent];
    if (!agentClock) {
      agentClock = {};
      this.agentTimestamps[fromAgent] = agentClock;
    }
    for (const delta of result.applied.concat(result.missing)) {
      const key = PixelDataCRDT.getKey(delta.x, delta.y);
      agentClock[key] = Math.max(agentClock[key] || 0, delta.timestamp);
    }
    return this.getDeltaForAgent(fromAgent);
  }

  getAllDeltas(): PixelDeltaPacket {
    const deltas: PixelDelta[] = [];
    for (const [key, [replicaId, timestamp, value]] of Object.entries(
      this.map.state
    )) {
      const [x, y] = PixelDataCRDT.getXYfromKey(key);
      deltas.push({
        x,
        y,
        timestamp,
        value,
        replicaId,
        agentId: this.agentId,
      });
    }
    return {
      deltas,
      fromReplica: this.replicaId,
      fromAgent: this.agentId,
    };
  }

  getInfo(): PixelDataCRDTInfo {
    return { agentId: this.agentId, replicaId: this.replicaId };
  }

  get(key: Key): RGB | null {
    return this.map.get(key);
  }

  get values(): Record<string, RGB> {
    return this.map.values;
  }
}
