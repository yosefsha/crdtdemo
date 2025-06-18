// This reducer is now obsolete after migration to Redux Toolkit slices.
// Please use src/slices/commentsSlice.ts for comment state management.

import { SAVE_COMMENT, FETCH_COMMENTS } from "../actions/types";

const d = (state = [], action: any) => {
  console.log(`action type ${action.type} payload ${action.payload}`);
  switch (action.type) {
    case SAVE_COMMENT:
      return [...state, action.payload];
    case FETCH_COMMENTS:
      const comments = action.payload.map((comment: any) => comment.name);
      return [...state, ...comments];
    default:
      console.log("Comments reducer; default state: ", state);
      return state;
  }
};

export default d;
