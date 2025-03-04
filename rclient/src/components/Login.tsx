import React from "react";
import { connect } from "react-redux";
import * as actions from "../actions";

interface LoginProps {
  auth: boolean;
  setAuth: (auth: boolean) => void;
}

class Login extends React.Component<LoginProps> {
  handleLogin = () => {
    this.props.setAuth(true);
  };

  handleLogout = () => {
    this.props.setAuth(false);
  };

  render() {
    const loginLogoutText = this.props.auth ? "Logout" : "Login";
    return (
      <div>
        <h2>{loginLogoutText}</h2>
        {this.props.auth ? (
          <button onClick={this.handleLogout}>Logout</button>
        ) : (
          <button onClick={this.handleLogin}>Login</button>
        )}
      </div>
    );
  }
}

function mapStateToProps(state: { auth: boolean }) {
  return { auth: state.auth };
}

export default connect(mapStateToProps, actions)(Login);
