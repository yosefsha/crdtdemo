import { saveComment } from "..";
import { SAVE_COMMENT } from "../types";

describe.skip("saveComment", () => {
  it("has the correct type", () => {
    const action = saveComment("comment 111");
    expect(action.type).toEqual(SAVE_COMMENT);
  });

  it("has the correct payload", () => {
    const newComment = "New Comment";
    const action = saveComment(newComment);
    expect(action.payload).toEqual(newComment);
  });
});
