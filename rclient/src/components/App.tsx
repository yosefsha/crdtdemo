import React from "react";
import Welcome from "./Welcome";
import { Routes, Route, Link } from "react-router-dom";
import "../styles/App.css";
import CRDTDemo from "./CRDTDemo";
import AuthPage from "./AuthPage";

const App: React.FC = () => {
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
          {/* <li>
            <Link to="/comment">Comment</Link>
          </li> */}
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
          {/* <Route path="/comment" element={<CommentBox />} /> */}
          <Route path="/crdtdemo" element={<CRDTDemo />} />
          <Route path="/auth" element={<AuthPage />} />
        </Routes>
      </div>
    </div>
  );
};

export default App;
