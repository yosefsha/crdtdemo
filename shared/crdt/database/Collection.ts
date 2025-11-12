// Collection: A CRDT-aware collection of items

import { CRDTItem, AgentId, ReplicaId, ItemId } from "./CRDTItem";

export interface CollectionDelta<T> {
  itemId: ItemId;
  value: T | null;
  timestamp: number;
  replicaId: ReplicaId;
  agentId: AgentId;
}

export class Collection<T> {
  private items: Map<ItemId, CRDTItem<T>>;
  private collectionId: string;

  constructor(collectionId: string) {
    this.collectionId = collectionId;
    this.items = new Map();
  }

  getCollectionId(): string {
    return this.collectionId;
  }

  setItem(
    itemId: ItemId,
    value: T | null,
    timestamp: number,
    replicaId: ReplicaId,
    agentId: AgentId
  ): CollectionDelta<T> | null {
    const existingItem = this.items.get(itemId);

    if (existingItem) {
      const updated = existingItem.update(value, timestamp, replicaId, agentId);
      if (updated) {
        return { itemId, value, timestamp, replicaId, agentId };
      }
      return null;
    } else {
      const newItem = new CRDTItem<T>(value, timestamp, replicaId, agentId);
      this.items.set(itemId, newItem);
      return { itemId, value, timestamp, replicaId, agentId };
    }
  }

  getItem(itemId: ItemId): T | null {
    const item = this.items.get(itemId);
    return item ? item.getValue() : null;
  }

  getCRDTItem(itemId: ItemId): CRDTItem<T> | undefined {
    return this.items.get(itemId);
  }

  hasItem(itemId: ItemId): boolean {
    return this.items.has(itemId);
  }

  getAllItemIds(): ItemId[] {
    return Array.from(this.items.keys());
  }

  getAllItems(): Map<ItemId, T | null> {
    const result = new Map<ItemId, T | null>();
    this.items.forEach((item, itemId) => {
      result.set(itemId, item.getValue());
    });
    return result;
  }

  size(): number {
    return this.items.size;
  }

  applyDelta(delta: CollectionDelta<T>): boolean {
    const result = this.setItem(
      delta.itemId,
      delta.value,
      delta.timestamp,
      delta.replicaId,
      delta.agentId
    );
    return result !== null;
  }

  applyDeltas(deltas: CollectionDelta<T>[]): CollectionDelta<T>[] {
    const applied: CollectionDelta<T>[] = [];
    for (const delta of deltas) {
      if (this.applyDelta(delta)) {
        applied.push(delta);
      }
    }
    return applied;
  }

  getDeltasSince(timestamps: Map<ItemId, number>): CollectionDelta<T>[] {
    const deltas: CollectionDelta<T>[] = [];

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

  getAllDeltas(): CollectionDelta<T>[] {
    return this.getDeltasSince(new Map());
  }

  clear(): void {
    this.items.clear();
  }

  toJSON(): {
    collectionId: string;
    items: Record<ItemId, ReturnType<CRDTItem<T>["toJSON"]>>;
  } {
    const itemsObj: Record<ItemId, ReturnType<CRDTItem<T>["toJSON"]>> = {};
    this.items.forEach((item, itemId) => {
      itemsObj[itemId] = item.toJSON();
    });

    return {
      collectionId: this.collectionId,
      items: itemsObj,
    };
  }

  static fromJSON<T>(json: {
    collectionId: string;
    items: Record<ItemId, any>;
  }): Collection<T> {
    const collection = new Collection<T>(json.collectionId);

    Object.entries(json.items).forEach(([itemId, itemData]) => {
      const item = CRDTItem.fromJSON<T>(itemData);
      collection.items.set(itemId, item);
    });

    return collection;
  }
}
