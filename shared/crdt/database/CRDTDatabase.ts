// Basic types for testing compilation
export type AgentId = string;
export type ReplicaId = string;
export type DocumentId = string;
export type CollectionId = string;

/**
 * Basic stub for CRDTDatabase - just for testing compilation
 */
export class CRDTDatabase {
  private agentId: AgentId;
  private replicaId: ReplicaId;

  constructor(agentId: AgentId, replicaId: ReplicaId) {
    this.agentId = agentId;
    this.replicaId = replicaId;
  }

  /**
   * Test method to verify compilation works
   */
  getInfo(): { agentId: AgentId; replicaId: ReplicaId } {
    return {
      agentId: this.agentId,
      replicaId: this.replicaId,
    };
  }
}

/**
 * Utility function for testing
 */
export function createTestDatabase(
  agentId: string,
  replicaId: string
): CRDTDatabase {
  return new CRDTDatabase(agentId, replicaId);
}
