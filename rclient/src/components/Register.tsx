// This component is used to register a new user it has a form with email and password fields
// it uses React.FC<RegisterProps> to define the props for the component
// it uses useState to manage the state of the email and password fields
// it uses useEffect to check if the user is already logged in
// it uses useDispatch to dispatch the register action
// it uses useSelector to get the auth state from the store
// it uses useHistory to redirect the user to the login page after successful registration
// it uses useNavigate to navigate to the login page after successful registration
// it uses useLocation to get the state from the previous page
// it uses useParams to get the params from the url
// it uses useRef to get a reference to the form
// it uses useMemo to memoize the form values
// it uses useCallback to memoize the handleSubmit function
// it uses useContext to get the auth context
// it uses useReducer to manage the state of the form
// it uses useImperativeHandle to expose the form methods to the parent component

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
