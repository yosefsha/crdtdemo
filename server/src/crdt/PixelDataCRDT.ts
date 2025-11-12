// Replica-aware CRDT with peer tracking, agent awareness, and delta filtering
// This CRDT is designed for pixel data, allowing multiple agents to modify pixel colors
// while tracking changes across replicas and agents.

import { getTimestamp } from "../services/helpers";
import { LWWMap } from "./CRDTTypes";
import type { RGB, ReplicaId, AgentId, Key } from "./CRDTTypes";
// TEST: Import from shared to verify compilation
import { CRDTDatabase } from "@crdtdemo/shared";

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

  static fromJSON(
    data: PixelDataCRDTInfo & {
      state: Record<Key, [ReplicaId, number, RGB | null]>;
      agentTimestamps: Record<AgentId, Record<Key, number>>;
      replicaTimestamps: Record<ReplicaId, Record<Key, number>>;
    }
  ): PixelDataCRDT {
    const crdt = new PixelDataCRDT(data.agentId, data.replicaId);
    crdt.map.merge(data.state || {});
    crdt.agentTimestamps = data.agentTimestamps || {};
    crdt.replicaTimestamps = data.replicaTimestamps || {};
    return crdt;
  }
  toJSON() {
    return {
      agentId: this.agentId,
      replicaId: this.replicaId,
      state: this.map.state,
      agentTimestamps: this.agentTimestamps,
      replicaTimestamps: this.replicaTimestamps,
    };
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
      console.info(
        `[${getTimestamp()}] [INFO][PixelDataCRDT] getDeltaForReplica: Created new replica timestamp record for replicaId:`,
        replicaId
      );
    }
    const replicaMap = this.replicaTimestamps[replicaId];

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
    const res =
      deltas.length === 0
        ? null
        : {
            deltas,
            fromReplica: this.replicaId,
            fromAgent: this.agentId,
          };
    console.info(
      `[${getTimestamp()}] [INFO][PixelDataCRDT] getDeltaForReplica: Fetched deltas for replicaId:`,
      replicaId
    );
    return res;
  }

  /*
   * Merges a PixelDeltaPacket into the CRDT state.
   * Applies deltas to the LWWMap and updates agent-level clocks.
   * Returns a MergeResult containing applied and missing deltas.
   * This method is used for syncing between different agents.
   * It applies the deltas from the packet to the local state and computes
   * which deltas were applied and which are missing for the sender.
        };
  }

  /*
   * Merges a PixelDeltaPacket into the CRDT state.
   * Applies deltas to the LWWMap and updates agent-level clocks.
   * Returns a MergeResult containing applied and missing deltas.
   * This method is used for syncing between different agents.
   * It applies the deltas from the packet to the local state and computes
   * which deltas were applied and which are missing for the sender.
   * @param packet - The PixelDeltaPacket containing deltas to merge.
   * @returns MergeResult containing applied and missing deltas.
   */
  merge(packet: PixelDeltaPacket): MergeResult {
    if (!packet || !packet.deltas || packet.deltas.length === 0) {
      return { applied: [], missing: [] };
    }
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
  get id(): string {
    return `${this.agentId}:${this.replicaId}`;
  }
}
