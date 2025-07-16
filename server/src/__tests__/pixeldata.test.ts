import { PixelDataCRDT } from "../crdt/PixelDataCRDT";

describe("PixelDataCRDT", () => {
  it("should initialize with correct id and empty state", () => {
    const crdt = new PixelDataCRDT("test-user");
    expect(crdt.getId()).toBe("test-user");
    expect(Object.keys(crdt.getState()).length).toBe(0);
  });

  it("should apply deltas and update state", () => {
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
    crdt.merge(deltas);
    expect(crdt.getState().get("1,2")).toEqual([255, 0, 0]);
    expect(crdt.getState().get("3,4")).toEqual([0, 255, 0]);
  });

  it("should serialize and deserialize correctly", () => {
    const crdt = new PixelDataCRDT("user2");
    crdt.merge({
      deltas: [
        {
          x: 5,
          y: 6,
          timestamp: Date.now(),
          value: [0, 0, 255] as [number, number, number],
        },
      ],
      agentId: "user2",
    });
    const json = crdt.toJSON();
    const restored = PixelDataCRDT.fromJSON(json);
    expect(restored.getId()).toBe("user2");
    expect(restored.getState().get("5,6")).toEqual([0, 0, 255]);
  });
});
