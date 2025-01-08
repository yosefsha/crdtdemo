import { Provider } from "react-redux";
import createStore from "./store";
import React from "react";

interface Props {
  children: React.ReactNode;
  preloadedState?: any;
}

const Root: React.FC<Props> = ({ children, preloadedState }) => {
  const store = createStore(preloadedState);
  return <Provider store={store}>{children}</Provider>;
};

export default Root;
