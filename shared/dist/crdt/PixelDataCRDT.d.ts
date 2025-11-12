import { AgentId, ReplicaId, DocumentDeltaPacket, DocumentMergeResult } from "../crdt/database/CRDTDatabase";
export type RGB = [number, number, number];
export type Key = string;
export type { AgentId, ReplicaId };
export type { DocumentDeltaPacket as PixelDeltaPacket, DocumentMergeResult as MergeResult, };
export declare class PixelDataCRDT {
    private db;
    constructor(agentId: AgentId, replicaId: ReplicaId);
    get id(): string;
    static getKey(x: number, y: number): string;
    set(key: Key, color: RGB | null): import("./database/Collection").CollectionDelta<RGB> | null;
    get(key: Key): RGB | null;
    getDeltasForAgent(agentId: AgentId): DocumentDeltaPacket<any> | null;
    getDeltaForAgent(agentId: AgentId): DocumentDeltaPacket<any> | null;
    getDeltasForReplica(replicaId: ReplicaId): DocumentDeltaPacket<any> | null;
    getDeltaForReplica(replicaId: ReplicaId): DocumentDeltaPacket<any> | null;
    merge(packet: any): DocumentMergeResult<any>;
    acknowledgeMerge(agentId: AgentId, mergeResult: any): void;
    handleMergeAgentResult(result: any, fromAgent: AgentId): DocumentDeltaPacket<any> | null;
    handleMergeReplicaResult(result: any, fromReplica: ReplicaId): DocumentDeltaPacket<any> | null;
    getAllDeltas(): DocumentDeltaPacket<any> | null;
    getInfo(): {
        agentId: AgentId;
        replicaId: ReplicaId;
    };
    get values(): Record<string, RGB>;
    toJSON(): {
        agentId: AgentId;
        replicaId: ReplicaId;
        documents: Record<import("./database/Document").DocumentId, ReturnType<import("./database/Document").Document<any>["toJSON"]>>;
    };
    static fromJSON(json: any): PixelDataCRDT;
}
//# sourceMappingURL=PixelDataCRDT.d.ts.map