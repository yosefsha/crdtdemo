"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CRDTDatabase = void 0;
exports.createTestDatabase = createTestDatabase;
/**
 * Basic stub for CRDTDatabase - just for testing compilation
 */
class CRDTDatabase {
    constructor(agentId, replicaId) {
        this.agentId = agentId;
        this.replicaId = replicaId;
    }
    /**
     * Test method to verify compilation works
     */
    getInfo() {
        return {
            agentId: this.agentId,
            replicaId: this.replicaId,
        };
    }
}
exports.CRDTDatabase = CRDTDatabase;
/**
 * Utility function for testing
 */
function createTestDatabase(agentId, replicaId) {
    return new CRDTDatabase(agentId, replicaId);
}
