import { Provider } from "react-redux";
import store from "./store";
import React from "react";

interface Props {
  children: React.ReactNode;
}

const Root: React.FC<Props> = ({ children }) => {
  return <Provider store={store}>{children}</Provider>;
};

export default Root;
