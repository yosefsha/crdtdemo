import React, { useState, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { register, login, logout } from "../slices/authSlice";
import { RootState } from "../store";
import { useUserAuthContext } from "./UserAuthContext";

const AuthPage: React.FC = () => {
  const { sliceKey } = useUserAuthContext();
  const dispatch = useDispatch();
  // Select the correct auth state from Redux using sliceKey (with type assertion)
  const { user, token, status, error } = useSelector(
    (state: RootState) => (state as any)[sliceKey]
  );
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [registrationSuccess, setRegistrationSuccess] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === "register") {
      dispatch(
        register({
          user: { email, password, full_name: fullName },
          sliceKey,
        }) as any
      );
    } else {
      dispatch(login({ user: { email, password }, sliceKey }) as any);
    }
  };

  useEffect(() => {
    console.log(`Auth was rendered (mounted) for slice: ${sliceKey}`);
  }, []);

  useEffect(() => {
    if (status === "succeeded" && mode === "register") {
      setRegistrationSuccess(true);
      setMode("login");
      setEmail("");
      setPassword("");
      setFullName("");
    }
  }, [status, mode]);

  const handleLogout = () => {
    dispatch(logout({ sliceKey }) as any);
  };

  if (token) {
    return (
      <div>
        <h4>Welcome, {user?.email || "Unknown user"}!</h4>
        <button onClick={handleLogout}>Logout</button>
      </div>
    );
  }

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: 12,
          marginBottom: 8,
        }}
      >
        <h4 style={{ margin: 0 }}>{mode === "login" ? "Login" : "Register"}</h4>
        <button
          style={{ fontSize: 12, padding: "2px 8px", height: 28 }}
          onClick={() => setMode(mode === "login" ? "register" : "login")}
        >
          Switch to {mode === "login" ? "Register" : "Login"}
        </button>
      </div>
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
      {status === "failed" && <div style={{ color: "red" }}>{error}</div>}
      {registrationSuccess && (
        <div style={{ color: "green" }}>
          Registration successful! Please log in.
        </div>
      )}
    </div>
  );
};

export default AuthPage;
