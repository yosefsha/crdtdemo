export type AgentId = string;
export type ReplicaId = string;
export type DocumentId = string;
export type CollectionId = string;
/**
 * Basic stub for CRDTDatabase - just for testing compilation
 */
export declare class CRDTDatabase {
    private agentId;
    private replicaId;
    constructor(agentId: AgentId, replicaId: ReplicaId);
    /**
     * Test method to verify compilation works
     */
    getInfo(): {
        agentId: AgentId;
        replicaId: ReplicaId;
    };
}
/**
 * Utility function for testing
 */
export declare function createTestDatabase(agentId: string, replicaId: string): CRDTDatabase;
//# sourceMappingURL=CRDTDatabase.d.ts.map