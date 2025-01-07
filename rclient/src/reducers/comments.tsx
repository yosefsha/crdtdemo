import { SAVE_COMMENT } from "../actions/types";

const initialState = [];
// {
//     // define initial state here
//     comments: []
//   };
const d = (state = [], action:any) => {
    switch ( action.type) {
        case SAVE_COMMENT:
            return [...state,action.payload];
        default:
            return state;
    }
};

export default d;