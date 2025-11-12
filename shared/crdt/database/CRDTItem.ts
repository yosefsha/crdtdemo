// CRDTItem: Individual CRDT element with Last-Write-Wins semantics

export type AgentId = string;
export type ReplicaId = string;
export type ItemId = string;

export interface CRDTMetadata {
  timestamp: number;
  replicaId: ReplicaId;
  agentId: AgentId;
}

export class CRDTItem<T> {
  private value: T | null;
  private metadata: CRDTMetadata;

  constructor(
    value: T | null,
    timestamp: number,
    replicaId: ReplicaId,
    agentId: AgentId
  ) {
    this.value = value;
    this.metadata = { timestamp, replicaId, agentId };
  }

  getValue(): T | null {
    return this.value;
  }

  getMetadata(): CRDTMetadata {
    return { ...this.metadata };
  }

  getTimestamp(): number {
    return this.metadata.timestamp;
  }

  getReplicaId(): ReplicaId {
    return this.metadata.replicaId;
  }

  getAgentId(): AgentId {
    return this.metadata.agentId;
  }

  update(
    newValue: T | null,
    timestamp: number,
    replicaId: ReplicaId,
    agentId: AgentId
  ): boolean {
    if (timestamp > this.metadata.timestamp) {
      this.value = newValue;
      this.metadata = { timestamp, replicaId, agentId };
      return true;
    }

    if (
      timestamp === this.metadata.timestamp &&
      replicaId > this.metadata.replicaId
    ) {
      this.value = newValue;
      this.metadata = { timestamp, replicaId, agentId };
      return true;
    }

    return false;
  }

  merge(other: CRDTItem<T>): boolean {
    const otherMetadata = other.getMetadata();
    return this.update(
      other.getValue(),
      otherMetadata.timestamp,
      otherMetadata.replicaId,
      otherMetadata.agentId
    );
  }

  clone(): CRDTItem<T> {
    return new CRDTItem<T>(
      this.value,
      this.metadata.timestamp,
      this.metadata.replicaId,
      this.metadata.agentId
    );
  }

  toJSON(): {
    value: T | null;
    timestamp: number;
    replicaId: ReplicaId;
    agentId: AgentId;
  } {
    return {
      value: this.value,
      timestamp: this.metadata.timestamp,
      replicaId: this.metadata.replicaId,
      agentId: this.metadata.agentId,
    };
  }

  static fromJSON<T>(json: {
    value: T | null;
    timestamp: number;
    replicaId: ReplicaId;
    agentId: AgentId;
  }): CRDTItem<T> {
    return new CRDTItem<T>(
      json.value,
      json.timestamp,
      json.replicaId,
      json.agentId
    );
  }
}
