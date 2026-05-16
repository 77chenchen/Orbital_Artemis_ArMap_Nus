import React, { useState } from "react";
import { motion } from "framer-motion";
import { API_BASE } from "./api";

export default function Register({
  toLogin,
  onRegistered,
}: {
  toLogin: () => void;
  onRegistered: () => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const res = await fetch(`${API_BASE}/register`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password }),
    });

    if (!res.ok) {
      setError("Registration failed. The email may already exist or the credentials are invalid.");
      return;
    }

    setEmail("");
    setPassword("");
    onRegistered();
  }

  return (
    <form className="auth-form" onSubmit={submit}>
      <label className="field">
        <span>Email</span>
        <input
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
      </label>

      <label className="field">
        <span>Password</span>
        <input
          type="password"
          placeholder="At least 6 characters"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </label>

      {error ? <p className="form-error">{error}</p> : null}

      <motion.button
        type="submit"
        className="login-button"
        whileHover={{ y: -2, scale: 1.01 }}
        whileTap={{ scale: 0.985 }}
      >
        Create account
      </motion.button>

      <div className="form-links single">
        <button type="button" onClick={toLogin}>
          Back to login
        </button>
      </div>
    </form>
  );
}
