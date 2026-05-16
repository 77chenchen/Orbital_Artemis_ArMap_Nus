import React, { useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { API_BASE } from "./api";

export default function Login({
  toRegister,
  onDemoMode,
}: {
  toRegister: () => void;
  onDemoMode: () => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginFailed, setLoginFailed] = useState(false);
  const navigate = useNavigate();

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const res = await fetch(`${API_BASE}/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password }),
    });

    if (!res.ok) {
      setLoginFailed(true);
      return;
    }

    const data = await res.json();
    localStorage.setItem("token", data.token);
    navigate("/Dashboard");
  }

  return (
    <form className="auth-form" onSubmit={submit}>
      <label className="field">
        <span>Email</span>
        <input
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(event) => {
            setEmail(event.target.value);
            setLoginFailed(false);
          }}
        />
      </label>

      <label className="field">
        <span>Password</span>
        <input
          type="password"
          placeholder="Enter password"
          value={password}
          onChange={(event) => {
            setPassword(event.target.value);
            setLoginFailed(false);
          }}
        />
      </label>

      {loginFailed ? <p className="form-error">Login failed. Please try again.</p> : null}

      <motion.button
        type="submit"
        className="login-button"
        whileHover={{ y: -2, scale: 1.01 }}
        whileTap={{ scale: 0.985 }}
      >
        Login
      </motion.button>

      <button className="google-button" type="button">
        <span>G</span>
        Continue with Google
      </button>

      <div className="form-links">
        <button type="button" onClick={toRegister}>
          Sign up
        </button>
        <button type="button" onClick={onDemoMode}>
          Enter demo mode
        </button>
      </div>
    </form>
  );
}
