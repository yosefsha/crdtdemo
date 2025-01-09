import { combineReducers } from "redux";
import commentsReducer from "./comments";
import auth from "./auth";

const rootReducer = combineReducers({
  comments: commentsReducer,
  auth: auth,
});

export default rootReducer;
