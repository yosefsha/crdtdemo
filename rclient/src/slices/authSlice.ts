import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import config from "../config";

// Key for storing JWT in localStorage
const tokenKey = "jwtToken";

// Payload type for authentication actions
interface AuthPayload {
  user: any;
  mode: "register" | "login";
}

// Async thunk for both registration and login
// Dispatches an API call to the appropriate endpoint based on mode
const registerOrLogin = createAsyncThunk<
  { user: any; token: string },
  AuthPayload,
  { rejectValue: string }
>("auth/registerOrLogin", async ({ user, mode }, thunkAPI) => {
  // Use config.apiDomain for endpoint
  const url =
    mode === "register"
      ? `${config.apiDomain}/register`
      : `${config.apiDomain}/login`;
  // Make API request
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user }),
  });
  const data = await response.json();
  if (response.ok && data.token) {
    // Store JWT on success
    localStorage.setItem(tokenKey, data.token);
    return { user: data.user, token: data.token };
  } else {
    // Return error message on failure
    return thunkAPI.rejectWithValue(data.error || "Auth failed");
  }
});

// Async thunk for logging out (removes JWT)
const logout = createAsyncThunk("auth/logout", async () => {
  localStorage.removeItem(tokenKey);
});

// Initial state for authentication slice
const initialState: {
  user: any | null;
  token: string | null;
  status: string;
  error: string | null;
} = {
  user: null,
  token: localStorage.getItem(tokenKey) || null, // Load JWT from storage if present
  status: "idle",
  error: null,
};

// Create the authentication slice
const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {}, // No synchronous reducers needed
  extraReducers: (builder) => {
    builder
      // Handle pending state for async login/register
      .addCase(registerOrLogin.pending, (state) => {
        state.status = "loading";
        state.error = null;
      })
      // Handle fulfilled state (success)
      .addCase(registerOrLogin.fulfilled, (state, action) => {
        state.status = "succeeded";
        state.user = action.payload.user;
        state.token = action.payload.token;
        state.error = null;
      })
      // Handle rejected state (error)
      .addCase(registerOrLogin.rejected, (state, action) => {
        state.status = "failed";
        state.error = action.payload ?? null;
      })
      // Handle logout
      .addCase(logout.fulfilled, (state) => {
        state.user = null;
        state.token = null;
        state.status = "idle";
        state.error = null;
      });
  },
});

export default authSlice.reducer;
export { registerOrLogin, logout };
