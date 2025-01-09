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
