import React, { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useNavigate } from "react-router-dom";
import { API_BASE } from "./api";
import { colors, shadows } from "./theme";

export default function Login({ toRegister }: { toRegister: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginFailed, setLoginFailed] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();

  async function submit() {
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

  function fillDemoAccount() {
    setEmail("test1@gmail.com");
    setPassword("cp2106");
    setLoginFailed(false);
  }

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.kicker}>Welcome back</Text>
        <Text style={styles.title}>Sign in to Atlas</Text>
        <Text style={styles.caption}>Use your account to continue to the campus dashboard.</Text>
      </View>

      <FieldLabel label="Email" />
      <TextInput
        autoCapitalize="none"
        keyboardType="email-address"
        placeholder="you@example.com"
        placeholderTextColor="#7a8782"
        value={email}
        onChangeText={(value) => {
          setEmail(value);
          setLoginFailed(false);
        }}
        style={styles.input}
      />

      <FieldLabel label="Password" />
      <View style={styles.passwordRow}>
        <TextInput
          secureTextEntry={!showPassword}
          placeholder="Enter password"
          placeholderTextColor="#7a8782"
          value={password}
          onChangeText={(value) => {
            setPassword(value);
            setLoginFailed(false);
          }}
          onSubmitEditing={submit}
          style={[styles.input, styles.passwordInput]}
        />
        <Pressable onPress={() => setShowPassword((current) => !current)} style={styles.peekButton}>
          <Text style={styles.peekLabel}>{showPassword ? "Hide" : "Show"}</Text>
        </Pressable>
      </View>

      <View style={styles.metaRow}>
        <View style={styles.rememberRow}>
          <View style={styles.checkbox} />
          <Text style={styles.metaText}>Remember me</Text>
        </View>
        <Pressable onPress={fillDemoAccount}>
          <Text style={styles.linkText}>Fill demo account</Text>
        </Pressable>
      </View>

      {loginFailed ? <Text style={styles.error}>Login failed. Please try again.</Text> : null}

      <Pressable onPress={submit} style={styles.primaryButton}>
        <Text style={styles.primaryButtonLabel}>Login</Text>
      </Pressable>

      <View style={styles.switchRow}>
        <Text style={styles.metaText}>New user?</Text>
        <Pressable onPress={toRegister}>
          <Text style={styles.linkText}>Register now</Text>
        </Pressable>
      </View>
    </View>
  );
}

function FieldLabel({ label }: { label: string }) {
  return <Text style={styles.fieldLabel}>{label}</Text>;
}

const styles = StyleSheet.create({
  card: {
    alignSelf: "center",
    width: "100%",
    maxWidth: 430,
    gap: 12,
    padding: 24,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 8,
    backgroundColor: "#ffffff",
    ...shadows.panel,
  },
  header: {
    gap: 5,
    marginBottom: 4,
  },
  kicker: {
    color: colors.green,
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  title: {
    color: colors.ink,
    fontSize: 30,
    lineHeight: 34,
    fontWeight: "900",
  },
  caption: {
    color: colors.muted,
    fontSize: 15,
    lineHeight: 22,
  },
  fieldLabel: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: "800",
    marginTop: 4,
  },
  input: {
    minHeight: 48,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 8,
    color: colors.ink,
    backgroundColor: "#f9fbfa",
    fontSize: 15,
  },
  passwordRow: {
    position: "relative",
    justifyContent: "center",
  },
  passwordInput: {
    paddingRight: 74,
  },
  peekButton: {
    position: "absolute",
    right: 8,
    minWidth: 54,
    minHeight: 34,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 6,
    backgroundColor: "rgba(46,112,88,0.1)",
  },
  peekLabel: {
    color: colors.green,
    fontSize: 13,
    fontWeight: "800",
  },
  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginTop: 4,
  },
  rememberRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  checkbox: {
    width: 16,
    height: 16,
    borderWidth: 1,
    borderColor: "#899690",
    borderRadius: 4,
    backgroundColor: "#ffffff",
  },
  metaText: {
    color: colors.muted,
    fontSize: 14,
  },
  linkText: {
    color: colors.green,
    fontSize: 14,
    fontWeight: "800",
  },
  error: {
    padding: 10,
    borderWidth: 1,
    borderColor: "rgba(169,71,71,0.22)",
    borderRadius: 8,
    color: colors.danger,
    backgroundColor: "rgba(169,71,71,0.08)",
    fontSize: 14,
    fontWeight: "700",
  },
  primaryButton: {
    minHeight: 50,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    backgroundColor: colors.green,
  },
  primaryButtonLabel: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "900",
  },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
});
