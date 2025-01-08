import { SAVE_COMMENT } from "../actions/types";

const initialState = [];
// {
//     // define initial state here
//     comments: []
//   };
const d = (state = [], action: any) => {
  console.log(`action type ${action.type} payload ${action.payload}`);
  switch (action.type) {
    case SAVE_COMMENT:
      return [...state, action.payload];
    case "FETCH_COMMENTS":
      const comments = action.payload.map((comment: any) => comment.name);
      return [...state, ...comments];
    default:
      return state;
  }
};

export default d;
