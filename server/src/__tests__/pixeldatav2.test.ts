import e from "express";
import { PixelDataCRDT, PixelDeltaPacket } from "../crdt/PixelDataCRDT";

describe("PixelDataCRDT - Multi-Agent, Multi-Replica Sync", () => {
  const wait = (ms: number) => new Promise((res) => setTimeout(res, ms));

  it("should sync correctly between two agents, one with one replica and one with two", async () => {
    const agentA = new PixelDataCRDT("A", "A:device1");
    const agentB_tab1 = new PixelDataCRDT("B", "B:tab1");
    const agentB_tab2 = new PixelDataCRDT("B", "B:tab2");

    // A writes a pixel
    const d1 = agentA.set("0,0", [255, 0, 0]);
    await wait(5);
    // B:tab1 writes another pixel
    const d2 = agentB_tab1.set("1,1", [0, 255, 0]);
    await wait(5);
    // B:tab2 writes yet another pixel
    const d3 = agentB_tab2.set("2,2", [0, 0, 255]);

    // --- AGENT LEVEL SYNC BETWEEN AGENTS ---
    // Sync A → B:tab1 (agent-level)
    const packetAtoB1: PixelDeltaPacket | null = agentA.getDeltaForAgent("B");
    expect(packetAtoB1).not.toBeNull();
    const resultB1 = agentB_tab1.merge(packetAtoB1!);
    // Only use agent-level handle for inter-agent
    const p = agentA.handleMergeAgentResult(resultB1, "B");
    expect(p).toBeNull(); // After first sync, p may not be null/empty because agent-level clock is only updated per agent, not per replica

    // --- REPLICA LEVEL SYNC WITHIN AGENT B ---
    // Sync B:tab1 → B:tab2 (replica-level)
    const deltasB1toB2_rep = agentB_tab1.getDeltaForReplica("B:tab2");
    expect(deltasB1toB2_rep).not.toBeNull();
    const resultB2_rep = agentB_tab2.merge(deltasB1toB2_rep!);
    agentB_tab1.handleMergeReplicaResult(resultB2_rep, "B:tab2");

    // Sync B:tab1 → B:tab2 (should now be up-to-date, so no deltas)
    const deltasB1toB2 = agentB_tab1.getDeltaForReplica("B:tab2");
    expect(deltasB1toB2).toBeNull();

    // Sync B:tab2 → A
    const deltasB2toA = agentB_tab2.getDeltaForAgent("A");
    expect(deltasB2toA).not.toBeNull();
    const resultA = agentA.merge(deltasB2toA!);
    agentB_tab2.handleMergeAgentResult(resultA, "A");

    const d = agentA.getDeltaForAgent("B");
    const bbb = agentB_tab2.getDeltaForReplica("B:tab1");

    expect(bbb).not.toBeNull();
    const resultB1_final = agentB_tab1.merge(bbb!);
    agentB_tab2.handleMergeReplicaResult(resultB1_final, "B:tab1");

    const keys = ["0,0", "1,1", "2,2"];
    for (const key of keys) {
      expect(agentA.get(key)).not.toBeNull();
      expect(agentB_tab1.get(key)).not.toBeNull();
      expect(agentB_tab2.get(key)).not.toBeNull();
      expect(agentA.get(key)).toEqual(agentB_tab1.get(key));
      expect(agentB_tab1.get(key)).toEqual(agentB_tab2.get(key));
    }

    // After the first sync, there should be no more deltas for B:tab2
    expect(deltasB1toB2).toBeNull();
  });
});
