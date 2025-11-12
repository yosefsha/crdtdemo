export type AgentId = string;
export type ReplicaId = string;
export type ItemId = string;
export interface CRDTMetadata {
    timestamp: number;
    replicaId: ReplicaId;
    agentId: AgentId;
}
export declare class CRDTItem<T> {
    private value;
    private metadata;
    constructor(value: T | null, timestamp: number, replicaId: ReplicaId, agentId: AgentId);
    getValue(): T | null;
    getMetadata(): CRDTMetadata;
    getTimestamp(): number;
    getReplicaId(): ReplicaId;
    getAgentId(): AgentId;
    update(newValue: T | null, timestamp: number, replicaId: ReplicaId, agentId: AgentId): boolean;
    merge(other: CRDTItem<T>): boolean;
    clone(): CRDTItem<T>;
    toJSON(): {
        value: T | null;
        timestamp: number;
        replicaId: ReplicaId;
        agentId: AgentId;
    };
    static fromJSON<T>(json: {
        value: T | null;
        timestamp: number;
        replicaId: ReplicaId;
        agentId: AgentId;
    }): CRDTItem<T>;
}
//# sourceMappingURL=CRDTItem.d.ts.map