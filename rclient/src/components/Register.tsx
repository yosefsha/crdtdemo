// This component is now obsolete after migration to AuthPage and Redux Toolkit slices.
// Please use src/components/AuthPage.tsx for authentication UI.

import React, { useRef, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate, useLocation } from "react-router-dom";
import { registerUser } from "../actions";

const Register: React.FC = () => {
  const navigate = useNavigate();
  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const email = (form.elements.namedItem("email") as HTMLInputElement).value;
    const password = (form.elements.namedItem("password") as HTMLInputElement)
      .value;
    // dispatch(register(email, password));
    console.log("Register: onSubmit: email: ", email);
    registerUser({ email, password });
    // Redirect to login page after successful registration
    navigate("/");
  };

  return (
    <div>
      <h2>Register</h2>
      <form>
        <input type="text" name="email" placeholder="email" />
        <input type="password" name="password" placeholder="password" />
        <button type="submit">Register</button>
        <button type="button" onClick={onSubmit}>
          Login
        </button>
      </form>
    </div>
  );
};

export default Register;
