"use strict";
// Collection: A CRDT-aware collection of items
Object.defineProperty(exports, "__esModule", { value: true });
exports.Collection = void 0;
const CRDTItem_1 = require("./CRDTItem");
class Collection {
    constructor(collectionId) {
        this.collectionId = collectionId;
        this.items = new Map();
    }
    getCollectionId() {
        return this.collectionId;
    }
    setItem(itemId, value, timestamp, replicaId, agentId) {
        const existingItem = this.items.get(itemId);
        if (existingItem) {
            const updated = existingItem.update(value, timestamp, replicaId, agentId);
            if (updated) {
                return { itemId, value, timestamp, replicaId, agentId };
            }
            return null;
        }
        else {
            const newItem = new CRDTItem_1.CRDTItem(value, timestamp, replicaId, agentId);
            this.items.set(itemId, newItem);
            return { itemId, value, timestamp, replicaId, agentId };
        }
    }
    getItem(itemId) {
        const item = this.items.get(itemId);
        return item ? item.getValue() : null;
    }
    getCRDTItem(itemId) {
        return this.items.get(itemId);
    }
    hasItem(itemId) {
        return this.items.has(itemId);
    }
    getAllItemIds() {
        return Array.from(this.items.keys());
    }
    getAllItems() {
        const result = new Map();
        this.items.forEach((item, itemId) => {
            result.set(itemId, item.getValue());
        });
        return result;
    }
    size() {
        return this.items.size;
    }
    applyDelta(delta) {
        const result = this.setItem(delta.itemId, delta.value, delta.timestamp, delta.replicaId, delta.agentId);
        return result !== null;
    }
    applyDeltas(deltas) {
        const applied = [];
        for (const delta of deltas) {
            if (this.applyDelta(delta)) {
                applied.push(delta);
            }
        }
        return applied;
    }
    getDeltasSince(timestamps) {
        const deltas = [];
        this.items.forEach((item, itemId) => {
            const lastKnownTimestamp = timestamps.get(itemId) || 0;
            if (item.getTimestamp() > lastKnownTimestamp) {
                const metadata = item.getMetadata();
                deltas.push({
                    itemId,
                    value: item.getValue(),
                    timestamp: metadata.timestamp,
                    replicaId: metadata.replicaId,
                    agentId: metadata.agentId,
                });
            }
        });
        return deltas;
    }
    getAllDeltas() {
        return this.getDeltasSince(new Map());
    }
    clear() {
        this.items.clear();
    }
    toJSON() {
        const itemsObj = {};
        this.items.forEach((item, itemId) => {
            itemsObj[itemId] = item.toJSON();
        });
        return {
            collectionId: this.collectionId,
            items: itemsObj,
        };
    }
    static fromJSON(json) {
        const collection = new Collection(json.collectionId);
        Object.entries(json.items).forEach(([itemId, itemData]) => {
            const item = CRDTItem_1.CRDTItem.fromJSON(itemData);
            collection.items.set(itemId, item);
        });
        return collection;
    }
}
exports.Collection = Collection;
