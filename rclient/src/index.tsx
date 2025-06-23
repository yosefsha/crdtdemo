import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import App from "./components/App";
import Root from "./root";
import config from "./config";

console.log("running react client with config: ", config);

const root = ReactDOM.createRoot(
  document.getElementById("root") as HTMLElement
);

root.render(
  <Root>
    <BrowserRouter>
      <Routes>
        <Route path="*" element={<App currentUser={null} />} />
      </Routes>
    </BrowserRouter>
  </Root>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals

/**
 * TODO: 0. create time line for the project
 * 1. remove redundant components such as comment box, and the like, they are here to demonstrate redux
 * 2. remove the redux store and the provider
 * 3. add docker file to server
 * 4. figure out how to modify env variables in docker for client and seerver
 * 4. add docker kubernetes to server and client
 * 5. add tests to server
 * 6. add tests to client
 * 7. add tests to crdt on server side
 * 8. add ci/cd to server
 * 9. add ci/cd to client
 * 10. add tests to ci/cd pipeline
 * 11. add persistent storage to server implenentation
 *
 */
