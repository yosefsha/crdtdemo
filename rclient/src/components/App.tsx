import React, { useEffect } from "react";
import Welcome from "./Welcome";
import { Routes, Route, Link } from "react-router-dom";
import "../styles/App.css";
import CRDTDemoPage from "./CRDTDemoPage";
import Users from "./Users";
import store from "../store";
import { validateTokenAndFetchUser } from "../slices/authSlice";

const tokenKey = (sliceKey: string) => `jwtToken_${sliceKey}`;

const useRestoreJWT = () => {
  useEffect(() => {
    const aliceToken = localStorage.getItem(tokenKey("authAlice"));
    const bobToken = localStorage.getItem(tokenKey("authBob"));
    if (aliceToken) {
      store.dispatch(
        validateTokenAndFetchUser({
          sliceKey: "authAlice",
          token: aliceToken,
        }) as any
      );
    }
    if (bobToken) {
      store.dispatch(
        validateTokenAndFetchUser({
          sliceKey: "authBob",
          token: bobToken,
        }) as any
      );
    }
  }, []);
};

const App: React.FC = () => {
  useRestoreJWT();

  const renderHeader = () => (
    <div>
      <nav>
        <ul>
          <li>
            <Link to="/">Home</Link>
          </li>
          <li>
            <Link to="/auth">Auth</Link>
          </li>
          <li>
            <Link to="/crdtdemo">CRDT Demo</Link>
          </li>
        </ul>
      </nav>
    </div>
  );

  return (
    <div>
      {renderHeader()}
      <div className="main-content">
        <Routes>
          <Route path="/" element={<Welcome />} />
          <Route path="/crdtdemo" element={<CRDTDemoPage />} />
          <Route path="/auth" element={<Users />} />
        </Routes>
      </div>
    </div>
  );
};

export default App;
