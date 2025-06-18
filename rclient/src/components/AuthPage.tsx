import React, { useState, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { registerOrLogin, logout } from "../slices/authSlice";
import { RootState } from "../store";

const AuthPage: React.FC = () => {
  const dispatch = useDispatch();
  const { user, token, status, error } = useSelector(
    (state: RootState) => state.auth
  );
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === "register") {
      dispatch(
        registerOrLogin({
          user: { email, password, full_name: fullName },
          mode,
        }) as any
      );
    } else {
      dispatch(registerOrLogin({ user: { email, password }, mode }) as any);
    }
  };

  useEffect(() => {
    console.log("Auth was rendered (mounted)");
  }, []);
  const handleLogout = () => {
    dispatch(logout() as any);
  };

  if (token) {
    return (
      <div>
        <h2>Welcome, {user?.email || "User"}!</h2>
        <button onClick={handleLogout}>Logout</button>
      </div>
    );
  }

  return (
    <div>
      <h2>{mode === "login" ? "Login TT" : "Register GG"}</h2>
      <form onSubmit={handleSubmit}>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        {mode === "register" && (
          <input
            type="text"
            placeholder="Full Name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
          />
        )}
        <button type="submit" disabled={status === "loading"}>
          {mode === "login" ? "Login" : "Register"}
        </button>
      </form>
      <button onClick={() => setMode(mode === "login" ? "register" : "login")}>
        Switch to {mode === "login" ? "Register" : "Login"}
      </button>
      {status === "failed" && <div style={{ color: "red" }}>{error}</div>}
    </div>
  );
};

export default AuthPage;
