// This file is now obsolete after migration to Redux Toolkit slices.
// All authentication and comment logic is handled in src/slices/.
// This file is kept for reference and should be deleted if no longer needed.

import { SAVE_COMMENT, FETCH_COMMENTS, CHANGE_AUTH } from "./types";
import { User, UserCredentioals } from "../types/app";

export function saveComment(comment: string) {
  console.log("saveComment action called: ", comment);
  return {
    type: SAVE_COMMENT,
    payload: comment,
  };
}

export function registerUser(user: UserCredentioals) {
  console.log("registerUser action called: ", user);
  return async (dispatch: any) => {
    try {
      const response = await fetch("http://localhost:5000/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ user }),
      });
      const data = await response.json();
      console.log("registerUser response: ", data);
      dispatch({
        type: CHANGE_AUTH,
        payload: data,
      });
    } catch (error) {
      console.error("Error registering user:", error);
    }
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
        type: FETCH_COMMENTS,
        payload: data,
      });
    } catch (error) {
      console.error("Error fetching comments:", error);
    }
  };
}

export function setAuth(inLoggedIn: boolean) {
  console.log("setAuth action called: ", inLoggedIn);
  return {
    type: CHANGE_AUTH,
    payload: inLoggedIn,
  };
}

export function setCurrentUser(user: User | null) {
  console.log("setCurrentUser action called: ", user);
  return {
    type: CHANGE_AUTH,
    payload: user,
  };
}
