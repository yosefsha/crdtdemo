"use strict";
// CRDTItem: Individual CRDT element with Last-Write-Wins semantics
Object.defineProperty(exports, "__esModule", { value: true });
exports.CRDTItem = void 0;
class CRDTItem {
    constructor(value, timestamp, replicaId, agentId) {
        this.value = value;
        this.metadata = { timestamp, replicaId, agentId };
    }
    getValue() {
        return this.value;
    }
    getMetadata() {
        return { ...this.metadata };
    }
    getTimestamp() {
        return this.metadata.timestamp;
    }
    getReplicaId() {
        return this.metadata.replicaId;
    }
    getAgentId() {
        return this.metadata.agentId;
    }
    update(newValue, timestamp, replicaId, agentId) {
        if (timestamp > this.metadata.timestamp) {
            this.value = newValue;
            this.metadata = { timestamp, replicaId, agentId };
            return true;
        }
        if (timestamp === this.metadata.timestamp &&
            replicaId > this.metadata.replicaId) {
            this.value = newValue;
            this.metadata = { timestamp, replicaId, agentId };
            return true;
        }
        return false;
    }
    merge(other) {
        const otherMetadata = other.getMetadata();
        return this.update(other.getValue(), otherMetadata.timestamp, otherMetadata.replicaId, otherMetadata.agentId);
    }
    clone() {
        return new CRDTItem(this.value, this.metadata.timestamp, this.metadata.replicaId, this.metadata.agentId);
    }
    toJSON() {
        return {
            value: this.value,
            timestamp: this.metadata.timestamp,
            replicaId: this.metadata.replicaId,
            agentId: this.metadata.agentId,
        };
    }
    static fromJSON(json) {
        return new CRDTItem(json.value, json.timestamp, json.replicaId, json.agentId);
    }
}
exports.CRDTItem = CRDTItem;
