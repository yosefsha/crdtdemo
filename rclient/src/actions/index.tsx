import { SAVE_COMMENT } from "./types";

export function saveComment(comment: string) {
  console.log("saveComment action called: ", comment);
  return {
    type: SAVE_COMMENT,
    payload: comment,
  };
}

export function fetchComments() {
  console.log("fetchComments action called");
  return async (dispatch: any) => {
    try {
      const response = await fetch(
        "http://jsonplaceholder.typicode.com/comments"
      );
      const data = await response.json();
      dispatch({
        type: "FETCH_COMMENTS",
        payload: data,
      });
    } catch (error) {
      console.error("Error fetching comments:", error);
    }
  };
}
