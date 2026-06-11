import React, { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { API_BASE } from "../api";

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

  async function submit() {
    setError("");

    if (!email.trim() || password.length < 6) {
      setError("Registration failed. The email may already exist or the credentials are invalid.");
      return;
    }

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
    <View style={styles.form}>
      <View style={styles.field}>
        <Text style={styles.label}>Email</Text>
        <TextInput
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          onChangeText={setEmail}
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
          onChangeText={setPassword}
          onSubmitEditing={submit}
          placeholder="At least 6 characters"
          placeholderTextColor="#72817b"
          secureTextEntry
          style={styles.input}
          value={password}
        />
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Pressable
        accessibilityRole="button"
        onPress={submit}
        style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
      >
        <Text style={styles.primaryButtonText}>Create account</Text>
      </Pressable>

      <View style={styles.links}>
        <Pressable accessibilityRole="button" onPress={toLogin} style={styles.linkButton}>
          <Text style={styles.linkText}>Back to login</Text>
        </Pressable>
      </View>
    </View>
  );
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
  links: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
    gap: 12,
  },
  linkButton: {
    paddingVertical: 4,
  },
  linkText: {
    color: "#2f7159",
    fontWeight: "800",
  },
});
