// This reducer is now obsolete after migration to Redux Toolkit slices.
// Please use src/slices/authSlice.ts for authentication state management.

import { CHANGE_AUTH } from "../actions/types";

const d = (state = false, action: any) => {
  switch (action.type) {
    case CHANGE_AUTH:
      console.log("auth reducer: ", action.payload);
      return action.payload;
    default:
      return state;
  }
};

export default d;
