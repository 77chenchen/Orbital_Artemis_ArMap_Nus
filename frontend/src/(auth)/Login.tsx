import React, { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View, findNodeHandle } from "react-native";
import { useNavigate } from "react-router-dom";
import { API_BASE } from "../api";

const GOOGLE_SCRIPT_URL = "https://accounts.google.com/gsi/client";
const GOOGLE_SCRIPT_TIMEOUT_MS = 10000;
const GOOGLE_AUTH_TIMEOUT_MS = 12000;
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
  const googleButtonRef = useRef<unknown>(null);
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;

    if (googleClientId) {
      setGoogleConfigLoaded(true);
      return;
    }

    requestWithTimeout(`${API_BASE}/config`, {}, 8000)
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
        const element = resolveGoogleButtonElement(googleButtonRef.current);
        if (cancelled || !window.google || !element) {
          return;
        }

        const buttonWidth = Math.max(240, Math.round(element.getBoundingClientRect().width || 320));
        element.innerHTML = "";
        window.google.accounts.id.initialize({
          client_id: googleClientId,
          callback: handleGoogleCredential,
        });
        window.google.accounts.id.renderButton(element, {
          theme: "outline",
          size: "large",
          text: "continue_with",
          shape: "rectangular",
          logo_alignment: "left",
          width: buttonWidth,
        });
      })
      .catch((error) => {
        if (!cancelled) {
          setGoogleError(error instanceof Error ? error.message : "Google sign-in could not be loaded.");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [googleClientId]);

  async function submit() {
    setLoginFailed(false);

    if (!email.trim() || !password) {
      setLoginFailed(true);
      return;
    }

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
      const res = await requestWithTimeout(
        `${API_BASE}/auth/google`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ credential: response.credential }),
        },
        GOOGLE_AUTH_TIMEOUT_MS,
      );

      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data.token) {
        throw new Error(data.error || "Google sign-in failed.");
      }

      localStorage.setItem("token", data.token);
      navigate("/Dashboard");
    } catch (error) {
      const message =
        error instanceof DOMException && error.name === "AbortError"
          ? "Google sign-in timed out. Please try again or use demo mode."
          : error instanceof Error
            ? error.message
            : "Google sign-in failed.";
      setGoogleError(message);
    } finally {
      setGoogleLoading(false);
    }
  }

  return (
    <View style={styles.form}>
      <View style={styles.field}>
        <Text style={styles.label}>Email</Text>
        <TextInput
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          onChangeText={(value) => {
            setEmail(value);
            setLoginFailed(false);
          }}
          onSubmitEditing={submit}
          placeholder="you@example.com"
          placeholderTextColor="#72817b"
          style={styles.input}
          value={email}
        />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Password</Text>
        <TextInput
          onChangeText={(value) => {
            setPassword(value);
            setLoginFailed(false);
          }}
          onSubmitEditing={submit}
          placeholder="Enter password"
          placeholderTextColor="#72817b"
          secureTextEntry
          style={styles.input}
          value={password}
        />
      </View>

      {loginFailed ? <Text style={styles.error}>Login failed. Please try again.</Text> : null}

      <Pressable
        accessibilityRole="button"
        onPress={submit}
        style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
      >
        <Text style={styles.primaryButtonText}>Login</Text>
      </Pressable>

      {googleClientId ? (
        <View style={styles.googleShell} aria-busy={googleLoading}>
          <View ref={googleButtonRef as never} style={styles.googleMount} />
          {googleLoading ? (
            <View style={styles.googleLoading}>
              <Text style={styles.googleLoadingText}>Signing in...</Text>
            </View>
          ) : null}
        </View>
      ) : (
        <Pressable accessibilityRole="button" disabled style={[styles.googleFallback, styles.disabledButton]}>
          <Text style={styles.googleBadge}>G</Text>
          <Text style={styles.googleFallbackText}>
            {googleConfigLoaded ? "Google sign-in unavailable" : "Loading Google sign-in..."}
          </Text>
        </Pressable>
      )}

      {googleError ? <Text style={styles.error}>{googleError}</Text> : null}

      <View style={styles.links}>
        <Pressable accessibilityRole="button" onPress={toRegister} style={styles.linkButton}>
          <Text style={styles.linkText}>Sign up</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={onDemoMode} style={styles.linkButton}>
          <Text style={styles.linkText}>Enter demo mode</Text>
        </Pressable>
      </View>
    </View>
  );
}

function resolveGoogleButtonElement(node: unknown) {
  if (typeof HTMLElement !== "undefined" && node instanceof HTMLElement) {
    return node;
  }

  const hostNode = findNodeHandle(node as never);
  if (typeof HTMLElement !== "undefined" && hostNode instanceof HTMLElement) {
    return hostNode;
  }

  return null;
}

function requestWithTimeout(input: RequestInfo | URL, init: RequestInit = {}, timeoutMs: number) {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);

  return fetch(input, {
    ...init,
    signal: controller.signal,
  }).finally(() => window.clearTimeout(timer));
}

function loadGoogleScript() {
  if (window.google) {
    return Promise.resolve();
  }

  if (!googleScriptPromise) {
    googleScriptPromise = new Promise((resolve, reject) => {
      const existingScript = document.querySelector<HTMLScriptElement>(`script[src="${GOOGLE_SCRIPT_URL}"]`);
      if (existingScript) {
        const timer = window.setTimeout(() => {
          reject(new Error("Google sign-in took too long to load."));
        }, GOOGLE_SCRIPT_TIMEOUT_MS);

        existingScript.addEventListener(
          "load",
          () => {
            window.clearTimeout(timer);
            resolve();
          },
          { once: true },
        );
        existingScript.addEventListener(
          "error",
          () => {
            window.clearTimeout(timer);
            reject(new Error("Google sign-in could not be loaded."));
          },
          { once: true },
        );
        return;
      }

      const script = document.createElement("script");
      const timer = window.setTimeout(() => {
        script.remove();
        googleScriptPromise = null;
        reject(new Error("Google sign-in took too long to load."));
      }, GOOGLE_SCRIPT_TIMEOUT_MS);

      script.src = GOOGLE_SCRIPT_URL;
      script.async = true;
      script.defer = true;
      script.onload = () => {
        window.clearTimeout(timer);
        resolve();
      };
      script.onerror = () => {
        window.clearTimeout(timer);
        googleScriptPromise = null;
        reject(new Error("Google sign-in could not be loaded."));
      };
      document.head.appendChild(script);
    });
  }

  return googleScriptPromise;
}

const styles = StyleSheet.create({
  form: {
    width: "min(400px, 100%)" as never,
    alignSelf: "center",
    gap: 14,
  },
  field: {
    gap: 8,
  },
  label: {
    color: "#16312c",
    fontSize: 14,
    fontWeight: "800",
  },
  input: {
    width: "100%",
    minHeight: 48,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: "#d5e2dd",
    borderRadius: 8,
    outlineStyle: "none" as never,
    color: "#16312c",
    backgroundColor: "#ffffff",
    fontSize: 16,
  },
  error: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "rgba(169, 71, 71, 0.22)",
    borderRadius: 8,
    color: "#a94747",
    backgroundColor: "rgba(169, 71, 71, 0.08)",
    fontSize: 15,
    lineHeight: 20,
  },
  primaryButton: {
    minHeight: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    backgroundImage: "linear-gradient(135deg, #2f7159, #3f70a8)",
    boxShadow: "0 16px 28px rgba(47, 113, 89, 0.18)",
  },
  primaryButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "800",
  },
  pressed: {
    transform: [{ scale: 0.985 }],
  },
  googleShell: {
    position: "relative",
    minHeight: 40,
    width: "100%",
    justifyContent: "center",
    overflow: "hidden",
    borderRadius: 8,
  },
  googleMount: {
    width: "100%",
    minHeight: 40,
    justifyContent: "center",
  },
  googleLoading: {
    ...StyleSheet.absoluteFillObject,
    pointerEvents: "none",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#d5e2dd",
    borderRadius: 8,
    backgroundColor: "rgba(255, 255, 255, 0.86)",
  },
  googleLoadingText: {
    color: "#16312c",
    fontWeight: "800",
  },
  googleFallback: {
    minHeight: 40,
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    borderWidth: 1,
    borderColor: "#d5e2dd",
    borderRadius: 8,
    backgroundColor: "#ffffff",
  },
  disabledButton: {
    opacity: 0.72,
    backgroundColor: "#f4f7f6",
  },
  googleBadge: {
    width: 24,
    height: 24,
    borderRadius: 999,
    color: "#3f70a8",
    backgroundColor: "#eef3fb",
    fontWeight: "900",
    lineHeight: 24,
    textAlign: "center",
  },
  googleFallbackText: {
    color: "#72817b",
    fontWeight: "800",
  },
  links: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
  },
  linkButton: {
    paddingVertical: 4,
  },
  linkText: {
    color: "#2f7159",
    fontWeight: "800",
  },
});
