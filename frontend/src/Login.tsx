import React, { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { API_BASE } from "./api";

const GOOGLE_SCRIPT_URL = "https://accounts.google.com/gsi/client";
let googleScriptPromise: Promise<void> | null = null;

type GoogleCredentialResponse = {
  credential?: string;
};

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (options: {
            client_id: string;
            callback: (response: GoogleCredentialResponse) => void;
          }) => void;
          renderButton: (
            element: HTMLElement,
            options: {
              theme: "outline";
              size: "large";
              text: "continue_with";
              shape: "rectangular";
              logo_alignment: "left";
              width: number;
            },
          ) => void;
        };
      };
    };
  }
}

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
  const [googleError, setGoogleError] = useState("");
  const [googleLoading, setGoogleLoading] = useState(false);
  const [googleConfigLoaded, setGoogleConfigLoaded] = useState(Boolean(import.meta.env.VITE_GOOGLE_CLIENT_ID));
  const [googleClientId, setGoogleClientId] = useState(import.meta.env.VITE_GOOGLE_CLIENT_ID || "");
  const googleButtonRef = useRef<HTMLDivElement | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;

    if (googleClientId) {
      setGoogleConfigLoaded(true);
      return;
    }

    fetch(`${API_BASE}/config`)
      .then((response) => (response.ok ? response.json() : {}))
      .then((config) => {
        if (!cancelled && typeof config.googleClientId === "string") {
          setGoogleClientId(config.googleClientId);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setGoogleError("Google sign-in configuration could not be loaded.");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setGoogleConfigLoaded(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [googleClientId]);

  useEffect(() => {
    let cancelled = false;

    if (!googleClientId) {
      return;
    }

    loadGoogleScript()
      .then(() => {
        if (cancelled || !window.google || !googleButtonRef.current) {
          return;
        }

        const buttonWidth = Math.max(240, Math.round(googleButtonRef.current.getBoundingClientRect().width));
        googleButtonRef.current.innerHTML = "";
        window.google.accounts.id.initialize({
          client_id: googleClientId,
          callback: handleGoogleCredential,
        });
        window.google.accounts.id.renderButton(googleButtonRef.current, {
          theme: "outline",
          size: "large",
          text: "continue_with",
          shape: "rectangular",
          logo_alignment: "left",
          width: buttonWidth,
        });
      })
      .catch(() => {
        if (!cancelled) {
          setGoogleError("Google sign-in could not be loaded.");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [googleClientId]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoginFailed(false);

    try {
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
    } catch {
      setLoginFailed(true);
    }
  }

  async function handleGoogleCredential(response: GoogleCredentialResponse) {
    if (!response.credential) {
      setGoogleError("Google did not return a sign-in credential.");
      return;
    }

    setGoogleLoading(true);
    setGoogleError("");

    try {
      const res = await fetch(`${API_BASE}/auth/google`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ credential: response.credential }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data.token) {
        throw new Error(data.error || "Google sign-in failed.");
      }

      localStorage.setItem("token", data.token);
      navigate("/Dashboard");
    } catch (error) {
      setGoogleError(error instanceof Error ? error.message : "Google sign-in failed.");
    } finally {
      setGoogleLoading(false);
    }
  }

  return (
    <form className="auth-form" onSubmit={submit}>
      <label className="field">
        <span>Email</span>
        <input
          type="email"
          placeholder="you@example.com"
          value={email}
          required
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
          required
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

      {googleClientId ? (
        <div className="google-button-shell" aria-busy={googleLoading}>
          <div ref={googleButtonRef} />
          {googleLoading ? <span className="google-loading">Signing in...</span> : null}
        </div>
      ) : (
        <button className="google-button" type="button" disabled>
          <span>G</span>
          {googleConfigLoaded ? "Google sign-in unavailable" : "Loading Google sign-in..."}
        </button>
      )}

      {googleError ? <p className="form-error">{googleError}</p> : null}

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

function loadGoogleScript() {
  if (window.google) {
    return Promise.resolve();
  }

  if (!googleScriptPromise) {
    googleScriptPromise = new Promise((resolve, reject) => {
      const existingScript = document.querySelector<HTMLScriptElement>(`script[src="${GOOGLE_SCRIPT_URL}"]`);
      if (existingScript) {
        existingScript.addEventListener("load", () => resolve(), { once: true });
        existingScript.addEventListener("error", () => reject(), { once: true });
        return;
      }

      const script = document.createElement("script");
      script.src = GOOGLE_SCRIPT_URL;
      script.async = true;
      script.defer = true;
      script.onload = () => resolve();
      script.onerror = () => reject();
      document.head.appendChild(script);
    });
  }

  return googleScriptPromise;
}
