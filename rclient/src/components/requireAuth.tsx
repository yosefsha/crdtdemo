import React, { Component } from "react";
import { connect } from "react-redux";
import { Navigate } from "react-router-dom";

interface WithAuthProps {
  auth: boolean;
}

const withAuth = (ChildComponent: React.ComponentType<any>) => {
  class WithAuth extends Component<WithAuthProps> {
    render() {
      if (!this.props.auth) {
        return <Navigate to="/login" />;
      }
      return <ChildComponent {...this.props} />;
    }
  }
  const mapStateToProps = (state: any) => {
    return { auth: state.auth };
  };
  return connect(mapStateToProps)(WithAuth);
};

export default withAuth;
