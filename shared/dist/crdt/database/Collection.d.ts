import { CRDTItem, AgentId, ReplicaId, ItemId } from "./CRDTItem";
export interface CollectionDelta<T> {
    itemId: ItemId;
    value: T | null;
    timestamp: number;
    replicaId: ReplicaId;
    agentId: AgentId;
}
export declare class Collection<T> {
    private items;
    private collectionId;
    constructor(collectionId: string);
    getCollectionId(): string;
    setItem(itemId: ItemId, value: T | null, timestamp: number, replicaId: ReplicaId, agentId: AgentId): CollectionDelta<T> | null;
    getItem(itemId: ItemId): T | null;
    getCRDTItem(itemId: ItemId): CRDTItem<T> | undefined;
    hasItem(itemId: ItemId): boolean;
    getAllItemIds(): ItemId[];
    getAllItems(): Map<ItemId, T | null>;
    size(): number;
    applyDelta(delta: CollectionDelta<T>): boolean;
    applyDeltas(deltas: CollectionDelta<T>[]): CollectionDelta<T>[];
    getDeltasSince(timestamps: Map<ItemId, number>): CollectionDelta<T>[];
    getAllDeltas(): CollectionDelta<T>[];
    clear(): void;
    toJSON(): {
        collectionId: string;
        items: Record<ItemId, ReturnType<CRDTItem<T>["toJSON"]>>;
    };
    static fromJSON<T>(json: {
        collectionId: string;
        items: Record<ItemId, any>;
    }): Collection<T>;
}
//# sourceMappingURL=Collection.d.ts.map