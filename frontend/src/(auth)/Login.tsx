import React, { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View, findNodeHandle } from "react-native";
import { useNavigate } from "react-router-dom";
import { API_BASE } from "../api";

const GOOGLE_SCRIPT_URL = "https://accounts.google.com/gsi/client";
const GOOGLE_SCRIPT_TIMEOUT_MS = 10000;
const GOOGLE_AUTH_TIMEOUT_MS = 12000;
const REMEMBERED_CREDENTIALS_KEY = "atlas_remembered_credentials";
let googleScriptPromise: Promise<void> | null = null;

type GoogleCredentialResponse = {
  credential?: string;
};

type AuthUser = {
  email?: string;
  name?: string;
  picture?: string;
  provider?: string;
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
}: {
  toRegister: () => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [focusedField, setFocusedField] = useState<"email" | "password" | null>(null);
  const [submitState, setSubmitState] = useState<"idle" | "loading" | "success">("idle");
  const [googleHovered, setGoogleHovered] = useState(false);
  const [rememberCredentials, setRememberCredentials] = useState(false);
  const [forgotMode, setForgotMode] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [securityQuestion, setSecurityQuestion] = useState("");
  const [securityAnswer, setSecurityAnswer] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [resetMessage, setResetMessage] = useState("");
  const [resetError, setResetError] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const [loginFailed, setLoginFailed] = useState(false);
  const [googleError, setGoogleError] = useState("");
  const [googleLoading, setGoogleLoading] = useState(false);
  const [googleConfigLoaded, setGoogleConfigLoaded] = useState(Boolean(import.meta.env.VITE_GOOGLE_CLIENT_ID));
  const [googleClientId, setGoogleClientId] = useState(import.meta.env.VITE_GOOGLE_CLIENT_ID || "");
  const googleButtonRef = useRef<unknown>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const remembered = readRememberedCredentials();
    if (!remembered) {
      return;
    }
    setEmail(remembered.email);
    setPassword(remembered.password);
    setRememberCredentials(true);
  }, []);

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
    if (submitState === "loading") {
      return;
    }

    setLoginFailed(false);
    setSubmitState("loading");

    if (!email.trim() || !password) {
      setLoginFailed(true);
      setSubmitState("idle");
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
        setSubmitState("idle");
        return;
      }

      const data = await res.json();
      localStorage.setItem("token", data.token);
      saveAuthenticatedUser(data.user, data.token, email);
      persistRememberedCredentials(rememberCredentials, email, password);
      setSubmitState("success");
      window.setTimeout(() => navigate("/Dashboard"), 420);
    } catch {
      setLoginFailed(true);
      setSubmitState("idle");
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
      saveAuthenticatedUser(data.user, data.token);
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

  async function loadSecurityQuestion() {
    const nextEmail = resetEmail.trim() || email.trim();
    setResetError("");
    setResetMessage("");
    setSecurityQuestion("");

    if (!nextEmail) {
      setResetError("Enter your account email first.");
      return;
    }

    setResetLoading(true);
    try {
      const res = await fetch(`${API_BASE}/password/security-question`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: nextEmail }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.question) {
        throw new Error(data.error || "No security question found for this account.");
      }
      setResetEmail(nextEmail);
      setSecurityQuestion(data.question);
    } catch (error) {
      setResetError(error instanceof Error ? error.message : "Could not load the security question.");
    } finally {
      setResetLoading(false);
    }
  }

  async function resetPassword() {
    setResetError("");
    setResetMessage("");

    if (!resetEmail.trim() || !securityAnswer.trim() || newPassword.length < 6) {
      setResetError("Answer the security question and use a password with at least 6 characters.");
      return;
    }

    setResetLoading(true);
    try {
      const res = await fetch(`${API_BASE}/password/reset`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: resetEmail,
          securityAnswer,
          password: newPassword,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Password reset failed.");
      }
      setEmail(resetEmail);
      setPassword(newPassword);
      persistRememberedCredentials(rememberCredentials, resetEmail, newPassword);
      setSecurityAnswer("");
      setNewPassword("");
      setResetMessage("Password reset. You can sign in now.");
      setForgotMode(false);
    } catch (error) {
      setResetError(error instanceof Error ? error.message : "Password reset failed.");
    } finally {
      setResetLoading(false);
    }
  }

  return (
    <View style={styles.form}>
      {forgotMode ? (
        <View style={styles.resetPanel}>
          <View style={styles.resetHeader}>
            <View>
              <Text style={styles.resetTitle}>Reset password</Text>
              <Text style={styles.resetSubtitle}>Verify your security answer.</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                setForgotMode(false);
                setResetError("");
              }}
              style={styles.linkButton}
            >
              <Text style={styles.linkText}>Back</Text>
            </Pressable>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Account Email</Text>
            <TextInput
              autoCapitalize="none"
              keyboardType="email-address"
              onChangeText={setResetEmail}
              placeholder="you@example.com"
              placeholderTextColor="#72817b"
              style={styles.input}
              value={resetEmail}
            />
          </View>

          {securityQuestion ? (
            <>
              <View style={styles.questionBox}>
                <Text style={styles.questionLabel}>Security question</Text>
                <Text style={styles.questionText}>{securityQuestion}</Text>
              </View>
              <View style={styles.field}>
                <Text style={styles.label}>Answer</Text>
                <TextInput
                  onChangeText={setSecurityAnswer}
                  placeholder="Your answer"
                  placeholderTextColor="#72817b"
                  style={styles.input}
                  value={securityAnswer}
                />
              </View>
              <View style={styles.field}>
                <Text style={styles.label}>New Password</Text>
                <TextInput
                  onChangeText={setNewPassword}
                  placeholder="At least 6 characters"
                  placeholderTextColor="#72817b"
                  secureTextEntry
                  style={styles.input}
                  value={newPassword}
                />
              </View>
              <Pressable
                accessibilityRole="button"
                disabled={resetLoading}
                onPress={resetPassword}
                style={({ pressed }) => [styles.primaryButton, resetLoading && styles.primaryButtonLoading, pressed && styles.pressed]}
              >
                <Text style={styles.primaryButtonText}>{resetLoading ? "Checking..." : "Reset Password"}</Text>
              </Pressable>
            </>
          ) : (
            <Pressable
              accessibilityRole="button"
              disabled={resetLoading}
              onPress={loadSecurityQuestion}
              style={({ pressed }) => [styles.primaryButton, resetLoading && styles.primaryButtonLoading, pressed && styles.pressed]}
            >
              <Text style={styles.primaryButtonText}>{resetLoading ? "Loading..." : "Find Security Question"}</Text>
            </Pressable>
          )}

          {resetError ? <Text style={styles.error}>{resetError}</Text> : null}
          {resetMessage ? <Text style={styles.successMessage}>{resetMessage}</Text> : null}
        </View>
      ) : (
        <>
      <View style={[styles.field, focusedField === "email" && styles.fieldFocused]}>
        <Text style={[styles.label, focusedField === "email" && styles.labelFocused]}>Email</Text>
        <TextInput
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          onChangeText={(value) => {
            setEmail(value);
            setLoginFailed(false);
          }}
          onFocus={() => setFocusedField("email")}
          onBlur={() => setFocusedField((current) => (current === "email" ? null : current))}
          onSubmitEditing={submit}
          placeholder="you@example.com"
          placeholderTextColor="#72817b"
          style={[styles.input, focusedField === "email" && styles.inputFocused]}
          value={email}
        />
      </View>

      <View style={[styles.field, focusedField === "password" && styles.fieldFocused]}>
        <Text style={[styles.label, focusedField === "password" && styles.labelFocused]}>Password</Text>
        <TextInput
          onChangeText={(value) => {
            setPassword(value);
            setLoginFailed(false);
          }}
          onFocus={() => setFocusedField("password")}
          onBlur={() => setFocusedField((current) => (current === "password" ? null : current))}
          onSubmitEditing={submit}
          placeholder="Enter password"
          placeholderTextColor="#72817b"
          secureTextEntry
          style={[styles.input, focusedField === "password" && styles.inputFocused]}
          value={password}
        />
      </View>

      <View style={styles.formMetaRow}>
        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{ checked: rememberCredentials }}
          onPress={() => setRememberCredentials((current) => !current)}
          style={styles.rememberControl}
        >
          <View style={[styles.checkbox, rememberCredentials && styles.checkboxChecked]}>
            {rememberCredentials ? <Text style={styles.checkboxTick}>✓</Text> : null}
          </View>
          <Text style={styles.rememberText}>Remember username & password</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            setForgotMode(true);
            setResetEmail(email);
            setResetError("");
            setResetMessage("");
          }}
          style={styles.linkButton}
        >
          <Text style={styles.linkText}>Forgot password?</Text>
        </Pressable>
      </View>

      {loginFailed ? <Text style={styles.error}>Login failed. Please try again.</Text> : null}

      <Pressable
        accessibilityRole="button"
        disabled={submitState === "loading"}
        onPress={submit}
        style={({ hovered, pressed }) => [
          styles.primaryButton,
          hovered && submitState === "idle" && styles.primaryButtonHover,
          submitState === "loading" && styles.primaryButtonLoading,
          submitState === "success" && styles.primaryButtonSuccess,
          pressed && styles.pressed,
        ]}
      >
        {submitState === "loading" ? (
          <View style={styles.spinner} />
        ) : submitState === "success" ? (
          <Text style={styles.successIcon}>✓</Text>
        ) : (
          <Text style={styles.primaryButtonText}>Sign In</Text>
        )}
      </Pressable>

      {googleClientId ? (
        <View
          style={[styles.googleShell, googleHovered && styles.googleShellHover]}
          aria-busy={googleLoading}
          onMouseEnter={() => setGoogleHovered(true)}
          onMouseLeave={() => setGoogleHovered(false)}
        >
          <View ref={googleButtonRef as never} style={[styles.googleMount, googleHovered && styles.googleMountHover]} />
          {googleLoading ? (
            <View style={styles.googleLoading}>
              <Text style={styles.googleLoadingText}>Signing in...</Text>
            </View>
          ) : null}
        </View>
      ) : (
        <Pressable
          accessibilityRole="button"
          disabled
          onHoverIn={() => setGoogleHovered(true)}
          onHoverOut={() => setGoogleHovered(false)}
          style={[styles.googleFallback, googleHovered && styles.googleShellHover, styles.disabledButton]}
        >
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
      </View>
        </>
      )}
    </View>
  );
}

function readRememberedCredentials() {
  try {
    const parsed = JSON.parse(localStorage.getItem(REMEMBERED_CREDENTIALS_KEY) || "null");
    if (parsed && typeof parsed.email === "string" && typeof parsed.password === "string") {
      return parsed;
    }
  } catch {
    return null;
  }
  return null;
}

function persistRememberedCredentials(remember: boolean, email: string, password: string) {
  if (!remember) {
    localStorage.removeItem(REMEMBERED_CREDENTIALS_KEY);
    return;
  }
  localStorage.setItem(
    REMEMBERED_CREDENTIALS_KEY,
    JSON.stringify({
      email: email.trim(),
      password,
    }),
  );
}

function saveAuthenticatedUser(user: AuthUser | undefined, token: string, fallbackEmail = "") {
  const tokenProfile = readJwtPayload(token);
  const email = user?.email || asString(tokenProfile?.email) || fallbackEmail.trim();
  const name = user?.name || asString(tokenProfile?.name) || displayNameFromEmail(email);
  const profile = {
    email,
    name,
    picture: user?.picture || asString(tokenProfile?.picture) || "",
    provider: user?.provider || asString(tokenProfile?.auth_provider) || "password",
  };
  localStorage.setItem("atlas_user", JSON.stringify(profile));
}

function readJwtPayload(token: string) {
  try {
    const [, payload] = token.split(".");
    if (!payload) return null;
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const decoded = window.atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, "="));
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

function asString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function displayNameFromEmail(email: string) {
  const localPart = email.split("@")[0] || "Atlas User";
  return localPart
    .replace(/[._-]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ") || "Atlas User";
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
    width: "100%",
    alignSelf: "center",
    gap: 16,
  },
  field: {
    gap: 7,
    transitionProperty: "transform",
    transitionDuration: "180ms",
    transitionTimingFunction: "ease",
  },
  fieldFocused: {
    transform: [{ translateY: -1 }, { scale: 1.01 }],
  },
  label: {
    color: "#40504a",
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    transitionProperty: "color",
    transitionDuration: "180ms",
  },
  labelFocused: {
    color: "#123f38",
  },
  input: {
    width: "100%",
    minHeight: 52,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: "rgba(22, 72, 65, 0.14)",
    borderRadius: 14,
    outlineStyle: "none" as never,
    color: "#112621",
    backgroundColor: "rgba(255, 253, 247, 0.92)",
    boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.86), 0 1px 2px rgba(35, 30, 23, 0.04)",
    fontSize: 16,
    transitionProperty: "border-color, box-shadow, transform",
    transitionDuration: "180ms",
    transitionTimingFunction: "ease",
  },
  inputFocused: {
    borderColor: "#14564c",
    boxShadow: "0 0 0 4px rgba(20, 86, 76, 0.12), 0 13px 28px rgba(20, 64, 56, 0.12)",
  },
  error: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "rgba(169, 71, 71, 0.22)",
    borderRadius: 14,
    color: "#a94747",
    backgroundColor: "rgba(169, 71, 71, 0.09)",
    fontSize: 15,
    lineHeight: 20,
  },
  successMessage: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "rgba(20, 86, 76, 0.2)",
    borderRadius: 14,
    color: "#14564c",
    backgroundColor: "rgba(20, 86, 76, 0.08)",
    fontSize: 15,
    fontWeight: "800",
  },
  formMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
    marginTop: -2,
  },
  rememberControl: {
    minHeight: 30,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  checkbox: {
    width: 18,
    height: 18,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(22, 72, 65, 0.28)",
    borderRadius: 5,
    backgroundColor: "rgba(255, 253, 247, 0.76)",
  },
  checkboxChecked: {
    borderColor: "#14564c",
    backgroundColor: "#14564c",
  },
  checkboxTick: {
    color: "#fff8e6",
    fontSize: 12,
    fontWeight: "900",
    lineHeight: 15,
  },
  rememberText: {
    color: "#52635b",
    fontSize: 12,
    fontWeight: "800",
  },
  resetPanel: {
    gap: 14,
  },
  resetHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 14,
  },
  resetTitle: {
    color: "#112621",
    fontSize: 20,
    fontWeight: "900",
  },
  resetSubtitle: {
    color: "#65766e",
    marginTop: 4,
    fontSize: 13,
    fontWeight: "700",
  },
  questionBox: {
    gap: 5,
    padding: 13,
    borderWidth: 1,
    borderColor: "rgba(20, 86, 76, 0.12)",
    borderRadius: 14,
    backgroundColor: "rgba(20, 86, 76, 0.06)",
  },
  questionLabel: {
    color: "#52635b",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  questionText: {
    color: "#123f38",
    fontSize: 14,
    fontWeight: "900",
    lineHeight: 20,
  },
  primaryButton: {
    minHeight: 52,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    backgroundImage: "linear-gradient(135deg, #d99b68 0%, #c97654 48%, #a94f3d 100%)",
    backgroundSize: "140% 140%",
    backgroundPosition: "0%",
    boxShadow: "0 16px 34px rgba(169, 79, 61, 0.24)",
    transitionProperty: "background-position, background-image, box-shadow, transform",
    transitionDuration: "220ms",
    transitionTimingFunction: "ease",
  },
  primaryButtonHover: {
    backgroundPosition: "100%",
    boxShadow: "0 20px 42px rgba(169, 79, 61, 0.3)",
    transform: [{ translateY: -2 }],
  },
  primaryButtonLoading: {
    opacity: 0.94,
    backgroundPosition: "72%",
  },
  primaryButtonSuccess: {
    backgroundImage: "linear-gradient(135deg, #10483f 0%, #176454 100%)",
    boxShadow: "0 18px 38px rgba(16, 72, 63, 0.28)",
  },
  primaryButtonText: {
    color: "#fff8e6",
    fontSize: 16,
    fontWeight: "900",
    opacity: 1,
  },
  pressed: {
    transform: [{ scale: 0.98 }],
  },
  spinner: {
    width: 19,
    height: 19,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: "rgba(255, 248, 230, 0.45)",
    borderTopColor: "#fff8e6",
    animationKeyframes: {
      "0%": { transform: "rotate(0deg)" },
      "100%": { transform: "rotate(360deg)" },
    },
    animationDuration: "760ms",
    animationTimingFunction: "linear",
    animationIterationCount: "infinite",
  } as never,
  successIcon: {
    color: "#fff8e6",
    fontSize: 21,
    fontWeight: "900",
    lineHeight: 24,
  },
  googleShell: {
    position: "relative",
    minHeight: 54,
    width: "100%",
    justifyContent: "center",
    overflow: "visible",
    borderRadius: 14,
    transitionProperty: "transform",
    transitionDuration: "180ms",
  },
  googleShellHover: {
    transform: [{ translateY: -1 }],
  },
  googleMount: {
    width: "100%",
    minHeight: 54,
    justifyContent: "center",
    transform: [{ translateX: 0 }],
    transitionProperty: "transform",
    transitionDuration: "180ms",
  },
  googleMountHover: {
    transform: [{ translateX: 2 }],
  },
  googleLoading: {
    ...StyleSheet.absoluteFillObject,
    pointerEvents: "none",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(22, 72, 65, 0.14)",
    borderRadius: 14,
    backgroundColor: "rgba(255, 253, 247, 0.9)",
  },
  googleLoadingText: {
    color: "#17251f",
    fontWeight: "900",
  },
  googleFallback: {
    minHeight: 54,
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    borderWidth: 1,
    borderColor: "rgba(22, 72, 65, 0.16)",
    borderRadius: 14,
    backgroundColor: "rgba(255, 253, 247, 0.74)",
    boxShadow: "0 8px 20px rgba(35, 30, 23, 0.05)",
  },
  disabledButton: {
    opacity: 0.72,
    backgroundColor: "rgba(240, 235, 220, 0.72)",
  },
  googleBadge: {
    width: 24,
    height: 24,
    borderRadius: 999,
    color: "#155753",
    backgroundColor: "rgba(21, 87, 83, 0.08)",
    fontWeight: "900",
    lineHeight: 24,
    textAlign: "center",
  },
  googleFallbackText: {
    color: "#4f5f58",
    fontWeight: "900",
  },
  links: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
    paddingTop: 2,
  },
  linkButton: {
    paddingVertical: 6,
  },
  linkText: {
    color: "#155753",
    fontSize: 14,
    fontWeight: "900",
  },
});
