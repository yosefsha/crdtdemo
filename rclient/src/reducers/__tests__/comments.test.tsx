import commeentsReducer from "../comments";
import { SAVE_COMMENT } from "../../actions/types";

describe.skip("comments reducer", () => {
  it("handles actions of type SAVE_COMMENT", () => {
    const newComment = "New Comment";
    const action = {
      type: SAVE_COMMENT,
      payload: newComment,
    };
    const newState = commeentsReducer([], action);
    expect(newState).toEqual([newComment]);
  });
});
