import React from "react";
import CommentsList from "./CommentsList";
import { connect } from "react-redux";
import CommentBox from "./CommentBox";
import { Routes, Route, Link } from "react-router-dom";
import "../styles/App.css";
import CRDTDemo from "./CRDTDemo";
import * as actions from "../actions";
import Login from "./Login"; // Import the Login component

interface AppProps {
  auth: boolean;
  setAuth: (auth: boolean) => void;
}

class App extends React.Component<AppProps, {}> {
  componentDidUpdate(prevProps: AppProps) {
    if (prevProps.auth !== this.props.auth) {
      console.log("Auth state changed:", this.props.auth);
    }
  }

  renderLoginButton() {
    const buttonText = this.props.auth ? "Logout" : "Login";
    return (
      <button
        onClick={() => {
          console.log("login button clicked");
          this.props.setAuth(!this.props.auth);
        }}
        className="login-button"
      >
        {buttonText}
      </button>
    );
  }

  renderHeader() {
    const loginText = this.props.auth ? "Logout" : "Login";

    return (
      <div>
        <nav>
          <ul>
            {/* <li>
              <Link to="/">Home</Link>
            </li>
            <li>
              <Link to="/login">{loginText}</Link>
            </li>
            <li>
              <Link to="/comment">Comment</Link>
            </li> */}
            <li>
              <Link to="/crdtdemo">CRDT</Link>
            </li>
          </ul>
        </nav>
      </div>
    );
  }

  render() {
    return (
      <div>
        {this.renderHeader()}
        <div className="main-content">
          <Routes>
            <Route path="/" element={<CRDTDemo />} />
            {/* <Route path="/comment" element={<CommentBox />} /> */}
            <Route path="/crdtdemo" element={<CRDTDemo />} />
            {/* <Route path="/login" element={<Login />} />{" "} */}
            {/* Add the login route */}
          </Routes>
        </div>
      </div>
    );
  }
}

function mapStateToProps(state: { auth: boolean }) {
  return { auth: state.auth };
}

export default connect(mapStateToProps, actions)(App);
