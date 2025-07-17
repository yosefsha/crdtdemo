import e from "express";
import { PixelDataCRDT, RGB } from "../crdt/PixelDataCRDT";

describe("PixelDataCRDT", () => {
  it("should initialize with correct id and empty values", () => {
    // Given: a new PixelDataCRDT instance
    const crdt = new PixelDataCRDT("test-user");
    // Then: it should have the correct id and no pixel values
    expect(crdt.getId()).toBe("test-user");
    expect(Object.keys(crdt.getState().values)).toHaveLength(0);
  });

  it("should set and get a pixel value", () => {
    // Given: a new PixelDataCRDT and a pixel key/color
    const crdt = new PixelDataCRDT("user1");
    const key = "1,2";
    const color: RGB = [100, 150, 200];
    // When: setting the pixel value
    crdt.set(key, color);
    // Then: getting the pixel should return the set color
    expect(crdt.get(key)).toEqual(color);
  });

  it("should merge deltas from another PixelDataCRDT", () => {
    // Given: two PixelDataCRDTs with the same pixel but different values
    const crdt1 = new PixelDataCRDT("user1");
    const crdt2 = new PixelDataCRDT("user2");
    crdt1.set("1,1", [10, 20, 30]);
    crdt2.set("1,1", [200, 100, 50]);
    // When: merging deltas from crdt2 into crdt1
    const deltas = crdt2.getAllDeltas();
    crdt1.merge(deltas);
    // Then: crdt1 should have the value from crdt2 (since its timestamp is newer)
    expect(crdt1.get("1,1")).toEqual([200, 100, 50]);
  });

  it("should return empty delta after merge ", () => {
    // Given: two PixelDataCRDTs with the same pixel but different values
    const crdt1 = new PixelDataCRDT("user1");
    const crdt2 = new PixelDataCRDT("user2");
    crdt1.set("1,1", [10, 20, 30]);
    crdt2.set("1,1", [200, 100, 50]);
    // When: merging deltas from crdt2 into crdt1
    const deltas = crdt2.getAllDeltas();
    const d = crdt1.merge(deltas);

    expect(d.deltas).toHaveLength(0);
  });

  it("should not change state if the same pixel is set to the same value", () => {
    // Given: a PixelDataCRDT with a pixel set
    const crdt = new PixelDataCRDT("user3");
    const key = "2,2";
    const color: RGB = [255, 255, 255];
    crdt.set(key, color);
    // When: setting the same pixel to the same value
    const result = crdt.set(key, color);
    // Then: it should return null (no change)
    expect(result).toBeNull();
    // And: the pixel value should remain unchanged
    expect(crdt.get(key)).toEqual(color);
  });

  it("should return deltas since a given timestamp", () => {
    // Given: a PixelDataCRDT with multiple pixels set
    const crdt = new PixelDataCRDT("user4");
    crdt.set("3,3", [255, 0, 0]);
    const timestamp = Date.now();
    crdt.set("4,4", [0, 255, 0]);
    // When: getting deltas since the first pixel's timestamp
    const deltas = crdt.getDeltaSince(timestamp);
    // Then: it should return the second pixel only
    expect(deltas.deltas).toHaveLength(1);
    expect(deltas.deltas[0].value).toEqual([0, 255, 0]);
  });

  it("should apply deltas and update state", () => {
    // Given: a PixelDataCRDT and a set of deltas
    const crdt = new PixelDataCRDT("user1");
    const deltas = {
      deltas: [
        {
          x: 1,
          y: 2,
          color: [255, 0, 0],
          timestamp: Date.now(),
          value: [255, 0, 0] as [number, number, number],
        },
        {
          x: 3,
          y: 4,
          color: [0, 255, 0],
          timestamp: Date.now(),
          value: [0, 255, 0] as [number, number, number],
        },
      ],
      agentId: "user1",
    };
    // When: merging the deltas
    crdt.merge(deltas);
    // Then: the state should reflect the new pixel values
    expect(crdt.getState().get("1,2")).toEqual([255, 0, 0]);
    expect(crdt.getState().get("3,4")).toEqual([0, 255, 0]);
  });

  // Removed duplicate serialize and deserialize test for user2
});
