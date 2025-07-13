import { configureStore } from "@reduxjs/toolkit";
import { authAliceReducer, authBobReducer } from "./slices/authSlice";

const store = configureStore({
  reducer: {
    authAlice: authAliceReducer,
    authBob: authBobReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
export default store;
