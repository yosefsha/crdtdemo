import { SAVE_COMMENT } from "./types";

export function saveComment(comment: string) {
    console.log('saveComment action called: ',comment);
  return {
    type: SAVE_COMMENT,
    payload: comment
  };
}