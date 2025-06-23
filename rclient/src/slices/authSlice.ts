import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import config from "../config";

// Key for storing JWT in localStorage
const tokenKey = "jwtToken";

// Payload type for authentication actions
interface AuthPayload {
  user: any;
  mode: "register" | "login";
}

// Async thunk for registration (does not expect a token)
const register = createAsyncThunk<
  { message: string },
  { user: any },
  { rejectValue: string }
>("auth/register", async ({ user }, thunkAPI) => {
  const url = `${config.apiDomain}/register`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user }),
  });
  const data = await response.json();
  if (response.ok && data.message) {
    return { message: data.message };
  } else {
    return thunkAPI.rejectWithValue(data.error || "Registration failed");
  }
});

// Async thunk for login (expects a token)
const login = createAsyncThunk<
  { user: any; token: string },
  { user: any },
  { rejectValue: string }
>("auth/login", async ({ user }, thunkAPI) => {
  const url = `${config.apiDomain}/login`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user }),
  });
  const data = await response.json();
  if (response.ok && data.token) {
    localStorage.setItem(tokenKey, data.token);
    return { user: data.user, token: data.token };
  } else {
    return thunkAPI.rejectWithValue(data.error || "Login failed");
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
  reducers: {},
  extraReducers: (builder) => {
    builder
      // Registration
      .addCase(register.pending, (state) => {
        state.status = "loading";
        state.error = null;
      })
      .addCase(register.fulfilled, (state, action) => {
        state.status = "succeeded";
        state.error = null;
      })
      .addCase(register.rejected, (state, action) => {
        state.status = "failed";
        state.error = action.payload ?? null;
      })
      // Login
      .addCase(login.pending, (state) => {
        state.status = "loading";
        state.error = null;
      })
      .addCase(login.fulfilled, (state, action) => {
        state.status = "succeeded";
        state.user = action.payload.user;
        state.token = action.payload.token;
        state.error = null;
      })
      .addCase(login.rejected, (state, action) => {
        state.status = "failed";
        state.error = action.payload ?? null;
      })
      // Logout
      .addCase(logout.fulfilled, (state) => {
        state.user = null;
        state.token = null;
        state.status = "idle";
        state.error = null;
      });
  },
});

export default authSlice.reducer;
export { register, login, logout };
