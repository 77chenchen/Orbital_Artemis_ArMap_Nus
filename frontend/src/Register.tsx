import React, { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { API_BASE } from "./api";
import { colors, shadows } from "./theme";

export default function Register({
  toLogin,
  onRegistered,
}: {
  toLogin: () => void;
  onRegistered: () => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
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
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.kicker}>Start fresh</Text>
        <Text style={styles.title}>Create account</Text>
        <Text style={styles.caption}>Set up an Atlas login for the campus assistant demo.</Text>
      </View>

      <FieldLabel label="Email" />
      <TextInput
        autoCapitalize="none"
        keyboardType="email-address"
        placeholder="you@example.com"
        placeholderTextColor="#7a8782"
        value={email}
        onChangeText={setEmail}
        style={styles.input}
      />

      <FieldLabel label="Password" />
      <View style={styles.passwordRow}>
        <TextInput
          secureTextEntry={!showPassword}
          placeholder="At least 6 characters"
          placeholderTextColor="#7a8782"
          value={password}
          onChangeText={setPassword}
          onSubmitEditing={submit}
          style={[styles.input, styles.passwordInput]}
        />
        <Pressable onPress={() => setShowPassword((current) => !current)} style={styles.peekButton}>
          <Text style={styles.peekLabel}>{showPassword ? "Hide" : "Show"}</Text>
        </Pressable>
      </View>

      <View style={styles.meter}>
        <View style={[styles.meterBar, password.length >= 1 && styles.meterBarOn]} />
        <View style={[styles.meterBar, password.length >= 6 && styles.meterBarOn]} />
        <View style={[styles.meterBar, password.length >= 10 && styles.meterBarOn]} />
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Pressable onPress={submit} style={styles.primaryButton}>
        <Text style={styles.primaryButtonLabel}>Register</Text>
      </Pressable>

      <View style={styles.switchRow}>
        <Text style={styles.metaText}>Already have an account?</Text>
        <Pressable onPress={toLogin}>
          <Text style={styles.linkText}>Login</Text>
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
  meter: {
    flexDirection: "row",
    gap: 6,
  },
  meterBar: {
    flex: 1,
    height: 6,
    borderRadius: 99,
    backgroundColor: "rgba(23,49,43,0.12)",
  },
  meterBarOn: {
    backgroundColor: colors.green,
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
  metaText: {
    color: colors.muted,
    fontSize: 14,
  },
  linkText: {
    color: colors.green,
    fontSize: 14,
    fontWeight: "800",
  },
});
