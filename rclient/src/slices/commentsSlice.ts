import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { RootState } from "../store";

const commentsUrl = "http://jsonplaceholder.typicode.com/comments";

const fetchComments = createAsyncThunk(
  "comments/fetchComments",
  async (_, thunkAPI) => {
    const state = thunkAPI.getState() as RootState;
    const token = state.auth.token || localStorage.getItem("jwtToken");
    const response = await fetch(commentsUrl, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    return await response.json();
  }
);

const postComment = createAsyncThunk(
  "comments/postComment",
  async (comment: any, thunkAPI) => {
    const state = thunkAPI.getState() as RootState;
    const token = state.auth.token || localStorage.getItem("jwtToken");
    const response = await fetch(commentsUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ comment }),
    });
    return await response.json();
  }
);

interface CommentState {
  items: any[];
  status: string;
  error: string | null;
}

const initialState: CommentState = {
  items: [],
  status: "idle",
  error: null,
};

const commentsSlice = createSlice({
  name: "comments",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchComments.pending, (state) => {
        state.status = "loading";
      })
      .addCase(fetchComments.fulfilled, (state, action) => {
        state.status = "succeeded";
        state.items = action.payload;
      })
      .addCase(fetchComments.rejected, (state, action) => {
        state.status = "failed";
        state.error = action.error.message || null;
      })
      .addCase(postComment.fulfilled, (state, action) => {
        state.items.push(action.payload);
      });
  },
});

export default commentsSlice.reducer;
export { fetchComments, postComment };
