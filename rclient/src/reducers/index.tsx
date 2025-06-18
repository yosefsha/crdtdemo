// This root reducer is now obsolete after migration to Redux Toolkit slices.
// Please use src/store.ts for the new store configuration.

import { combineReducers } from "redux";
import commentsReducer from "./comments";
import auth from "./auth";

const rootReducer = combineReducers({
  comments: commentsReducer,
  auth: auth,
});

export default rootReducer;
