import { SAVE_COMMENT, FETCH_COMMENTS, CHANGE_AUTH } from "./types";

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

export function setAuth(inLoggedIn: boolean) {
  console.log("setAuth action called: ", inLoggedIn);
  return {
    type: CHANGE_AUTH,
    payload: inLoggedIn,
  };
}

export const login =
  (email: string, password: string) => async (dispatch: any) => {
    try {
      const response = await fetch("/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        throw new Error("Login failed");
      }

      const data = await response.json();
      localStorage.setItem("token", data.token);
      dispatch(setAuth(true));
    } catch (error) {
      console.error("Login failed:", error);
      dispatch(setAuth(false));
    }
  };

export const signup =
  (name: string, email: string, password: string) => async (dispatch: any) => {
    try {
      const response = await fetch("/auth/signup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name, email, password }),
      });

      if (!response.ok) {
        throw new Error("Sign-up failed");
      }

      const data = await response.json();
      localStorage.setItem("token", data.token);
      dispatch(setAuth(true));
    } catch (error) {
      console.error("Sign-up failed:", error);
      dispatch(setAuth(false));
    }
  };

export const logout = () => {
  localStorage.removeItem("token");
  return setAuth(false);
};
