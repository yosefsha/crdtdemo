import { CRDT, LWWMap, LWWRegister, State } from "../crdt/CRDTTypes";

describe.skip("CRDT", () => {
  // it("should be able to create a CRDT object", () => {
  //   const crdt = new LWWRegister("aa", ["aa", 1, "bb"]);
  //   expect(crdt).toBeDefined();
  //   console.log("yyeeeehawww");
  // });

  it("should be able to create a CRDT object", () => {
    const crdt1 = new LWWRegister("1", ["aa", 1, "bb"]);
    const crdt2 = new LWWRegister("c", ["aa", 2, "cc"]);
    crdt1.merge(crdt2.state);
    expect(crdt1.value).toEqual("cc");
    console.log("ooooooooooooo");
  });

  // this is a test that creates lwwmap object and merges to anothe lwwmap object
  // test lwwmap merge function

  // test lwwmap merge function
  it("should be able to merge two lwwmap objects", () => {
    const id = "lww1";
    const state1: State<string> = { a: [id, 1, "ab"], b: [id, 2, "bb"] };
    const lwwmap1 = new LWWMap(id, state1);
    const id2 = "lww2";
    const state2: State<string> = { a: [id2, 2, "aa"], c: [id2, 1, "cc"] };
    const lwwmap2 = new LWWMap(id2, state2);
    lwwmap1.merge(lwwmap2.state);
    expect(lwwmap1.value).toEqual({ a: "aa", b: "bb", c: "cc" });
  });
});
