import React, { useState } from "react";
import { connect } from "react-redux";
import { login, logout, signup } from "../actions";

interface LoginProps {
  auth: boolean;
  login: (email: string, password: string) => void;
  signup: (name: string, email: string, password: string) => void;
  logout: () => void;
}

const Login: React.FC<LoginProps> = ({ auth, login, signup, logout }) => {
  const isLoggedIn = auth;
  const [isSignUp, setIsSignUp] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (isSignUp) {
      signup(name, email, password);
    } else {
      login(email, password);
    }
  };

  return (
    <div>
      <h2>{isSignUp ? "Sign Up" : "Login"}</h2>
      <form onSubmit={handleSubmit}>
        {isSignUp && (
          <div>
            <label>Name:</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
        )}
        <div>
          <label>Email:</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div>
          <label>Password:</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        <button type="submit">{isSignUp ? "Sign Up" : "Login"}</button>
      </form>
      <button onClick={() => setIsSignUp(!isSignUp)}>
        {isSignUp
          ? "Already have an account? Login"
          : "Don't have an account? Sign Up"}
      </button>
    </div>
  );

  //   else {
  //     return (
  //       <div>
  //         <h2>Logout</h2>
  //         <button onClick={() => logout()}>Logout</button>
  //       </div>
  //     );
  //   }
};

function mapStateToProps(state: { auth: boolean }) {
  return { auth: state.auth };
}

export default connect(mapStateToProps, { login, signup, logout })(Login);
