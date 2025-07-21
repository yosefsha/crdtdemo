import {
  PixelDataCRDTMinified,
  PixelDeltaMinified,
  RGB,
} from "../crdt/PixelCRDTMinified";

describe("PixelDataCRDTMinified", () => {
  const wait = (ms: number) => new Promise((res) => setTimeout(res, ms));

  it("should apply a pixel and retrieve it", () => {
    const crdt = new PixelDataCRDTMinified("replica1");
    const key = "1,2";
    const color: RGB = [100, 150, 200];
    crdt.set(key, color);
    expect(crdt.get(key)).toEqual(color);
  });

  it("should merge conflicting updates deterministically", async () => {
    const crdt1 = new PixelDataCRDTMinified("replicaA");
    const crdt2 = new PixelDataCRDTMinified("replicaB");

    const key = "5,5";
    const delta1 = crdt1.set(key, [50, 50, 50])!;
    await wait(10);
    const delta2 = crdt2.set(key, [200, 200, 200])!;

    // Apply crdt2's update to crdt1
    crdt1.merge({ deltas: [delta2] });
    expect(crdt1.get(key)).toEqual([200, 200, 200]);

    // Apply crdt1's earlier update to crdt2 (should be ignored)
    crdt2.merge({ deltas: [delta1] });
    expect(crdt2.get(key)).toEqual([200, 200, 200]);
  });

  it("should allow syncing between two replicas of same agent", async () => {
    const tab1 = new PixelDataCRDTMinified("agentX:tab1");
    const tab2 = new PixelDataCRDTMinified("agentX:tab2");

    const delta1 = tab1.set("2,3", [10, 20, 30])!;
    await wait(10);
    const delta2 = tab2.set("2,3", [40, 50, 60])!;

    // Merge each other's updates
    const appliedTo2 = tab2.merge({ deltas: [delta1] });
    const appliedTo1 = tab1.merge({ deltas: [delta2] });

    // Later delta should win in both
    expect(tab1.get("2,3")).toEqual([40, 50, 60]);
    expect(tab2.get("2,3")).toEqual([40, 50, 60]);

    expect(appliedTo1.applied.length).toBe(1);
    expect(appliedTo2.applied.length).toBe(0);
  });

  it("should return all current deltas", () => {
    const crdt = new PixelDataCRDTMinified("replicaZ");
    crdt.set("1,1", [1, 1, 1]);
    crdt.set("2,2", [2, 2, 2]);

    const deltas = crdt.getAllDeltas();
    expect(deltas.length).toBe(2);
    expect(deltas.map((d) => `${d.x},${d.y}`)).toEqual(
      expect.arrayContaining(["1,1", "2,2"])
    );
  });

  it("should avoid setting identical pixel values", () => {
    const crdt = new PixelDataCRDTMinified("replicaQ");
    const key = "4,4";
    crdt.set(key, [100, 100, 100]);
    const result = crdt.set(key, [100, 100, 100]);
    expect(result).toBeNull();
  });
});
