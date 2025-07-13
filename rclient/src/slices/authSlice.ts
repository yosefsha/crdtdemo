import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import config from "../config";

// Factory for per-user JWT key
const tokenKey = (sliceKey: string) => `jwtToken_${sliceKey}`;

// Async thunk for registration (does not expect a token)
const register = createAsyncThunk<
  { message: string },
  { user: any; sliceKey: string },
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
  { user: any; sliceKey: string },
  { rejectValue: string }
>("auth/login", async ({ user, sliceKey }, thunkAPI) => {
  const url = `${config.apiDomain}/login`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user }),
  });
  const data = await response.json();
  if (response.ok && data.token) {
    console.info(
      `Login successful for slice: ${sliceKey} with token:`,
      data.token,
      `Storing in localStorage`
    );
    // Store the JWT token in localStorage with a unique key per slice
    localStorage.setItem(tokenKey(sliceKey), data.token);
    return { user: data.user, token: data.token };
  } else {
    return thunkAPI.rejectWithValue(data.error || "Login failed");
  }
});

// Async thunk for logging out (removes JWT)
const logout = createAsyncThunk<{ sliceKey: string }, { sliceKey: string }>(
  "auth/logout",
  async ({ sliceKey }) => {
    const itemToRemove = localStorage.getItem(tokenKey(sliceKey));
    if (itemToRemove) {
      console.info(`Removing token ${itemToRemove} \n for slice: ${sliceKey}`);
      localStorage.removeItem(tokenKey(sliceKey));
    } else {
      console.warn(`No token found for slice: ${sliceKey}`);
    }
    return { sliceKey };
  }
);

// Factory to create initial state per slice

// Auth state type for type safety
interface AuthState {
  user: any | null;
  token: string | null;
  status: string;
  error: string | null;
}

const makeInitialState = (sliceKey: string): AuthState => {
  // Always start logged out: remove any old token
  localStorage.removeItem(tokenKey(sliceKey));
  return {
    user: null,
    token: null,
    status: "idle",
    error: null,
  };
};

// Thunk to validate token and fetch user profile
export const validateTokenAndFetchUser = createAsyncThunk<
  { user: any; token: string },
  { sliceKey: string; token: string },
  { rejectValue: string }
>("auth/validateTokenAndFetchUser", async ({ sliceKey, token }, thunkAPI) => {
  const url = `${config.apiDomain}/me`;
  const response = await fetch(url, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await response.json();
  if (response.ok && data.user) {
    return { user: data.user, token };
  } else {
    // Remove invalid/old token
    localStorage.removeItem(tokenKey(sliceKey));
    return thunkAPI.rejectWithValue("Invalid or expired token");
  }
});
// Factory to create a slice per user
function makeAuthSlice(sliceKey: string) {
  return createSlice({
    name: `auth_${sliceKey}`,
    initialState: makeInitialState(sliceKey),
    reducers: {},
    extraReducers: (builder) => {
      // Validate token and fetch user profile on app load
      builder
        .addCase(validateTokenAndFetchUser.pending, (state, action) => {
          if (action.meta.arg.sliceKey !== sliceKey) return;
          state.status = "validating";
          state.error = null;
        })
        .addCase(validateTokenAndFetchUser.fulfilled, (state, action) => {
          if (action.meta.arg.sliceKey !== sliceKey) return;
          state.status = "succeeded";
          state.user = action.payload.user;
          state.token = action.payload.token;
          state.error = null;
        })
        .addCase(validateTokenAndFetchUser.rejected, (state, action) => {
          if (action.meta.arg.sliceKey !== sliceKey) return;
          state.status = "idle";
          state.user = null;
          state.token = null;
          state.error = (action.payload as string) ?? null;
        });
      builder
        // Registration
        .addCase(register.pending, (state, action) => {
          if (action.meta.arg.sliceKey !== sliceKey) return;
          console.log(`[authSlice:${sliceKey}] register.pending`);
          state.status = "loading";
          state.error = null;
        })
        .addCase(register.fulfilled, (state, action) => {
          if (action.meta.arg.sliceKey !== sliceKey) return;
          console.log(`[authSlice:${sliceKey}] register.fulfilled`);
          state.status = "succeeded";
          state.error = null;
        })
        .addCase(register.rejected, (state, action) => {
          if (action.meta.arg.sliceKey !== sliceKey) return;
          console.log(
            `[authSlice:${sliceKey}] register.rejected`,
            action.payload
          );
          state.status = "failed";
          state.error = (action.payload as string) ?? null;
        })
        // Login
        .addCase(login.pending, (state, action) => {
          if (action.meta.arg.sliceKey !== sliceKey) return;
          console.log(`[authSlice:${sliceKey}] login.pending`);
          state.status = "loading";
          state.error = null;
        })
        .addCase(login.fulfilled, (state, action) => {
          if (action.meta.arg.sliceKey !== sliceKey) return;
          console.log(
            `[authSlice:${sliceKey}] login.fulfilled`,
            action.payload
          );
          state.status = "succeeded";
          state.user = action.payload.user;
          state.token = action.payload.token;
          state.error = null;
        })
        .addCase(login.rejected, (state, action) => {
          if (action.meta.arg.sliceKey !== sliceKey) return;
          console.log(`[authSlice:${sliceKey}] login.rejected`, action.payload);
          state.status = "failed";
          state.error = (action.payload as string) ?? null;
        })
        // Logout
        .addCase(logout.fulfilled, (state, action) => {
          if (action.meta.arg.sliceKey !== sliceKey) return;
          console.log(`[authSlice:${sliceKey}] logout.fulfilled`);
          state.user = null;
          state.token = null;
          state.status = "idle";
          state.error = null;
        });
    },
  });
}

// Export two slices for Alice and Bob
const authAliceSlice = makeAuthSlice("authAlice");
const authBobSlice = makeAuthSlice("authBob");

export const authAliceReducer = authAliceSlice.reducer;
export const authBobReducer = authBobSlice.reducer;
export { register, login, logout };
