import React from "react";
import CommentsList from "./CommentsList";
import { connect } from "react-redux";
import CommentBox from "./CommentBox";
import { Routes, Route, Link } from "react-router-dom";
import "../styles/App.css";
import CRDTDemo from "./CRDTDemo";
import * as actions from "../actions";
import LineDmo from "./LineDemo";

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
  renderLginButton() {
    const buttonText = this.props.auth ? "Logout" : "Login";
    return (
      <button
        onClick={() => {
          console.log("login button clicked");
          this.props.setAuth(!this.props.auth);
        }}
      >
        {buttonText}
      </button>
    );
  }
  renderHeader() {
    return (
      <div>
        <h1>React App</h1>
        <nav>
          <ul>
            <li>
              <Link to="/">Home</Link>
            </li>
            <li>
              <Link to="/comment">Comment</Link>
            </li>
            <li>
              <Link to="/crdtdemo">Comment</Link>
            </li>
            <li>{this.renderLginButton()}</li>
          </ul>
        </nav>
      </div>
    );
  }

  render() {
    return (
      <div>
        {this.renderHeader()}
        <Routes>
          <Route path="/" element={<CommentsList />} />
          <Route path="/comment" element={<CommentBox />} />
          <Route path="/crdtdemo" element={<CRDTDemo />} />
          <Route path="/line" element={<LineDmo />} />
        </Routes>
      </div>
    );
  }
}

function mapStateToProps(state: { auth: boolean }) {
  return { auth: state.auth };
}

export default connect(mapStateToProps, actions)(App);
