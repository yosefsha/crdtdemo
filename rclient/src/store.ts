import { configureStore } from "@reduxjs/toolkit";
import rootReducer from "./reducers";
import reduxPromise from "redux-promise";

const createStore = (preloadedState?: any) => {
  return configureStore({
    reducer: rootReducer,
    preloadedState,
    middleware: (getDefaultMiddleware: any) =>
      getDefaultMiddleware().concat(reduxPromise),
  });
};

export default createStore;
