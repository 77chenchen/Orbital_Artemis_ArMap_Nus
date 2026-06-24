import React, { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { API_BASE } from "../api";

const securityQuestions = [
  "What was your first campus building?",
  "What is your favorite study spot?",
  "What nickname did your project team use?",
];

export default function Register({
  toLogin,
  onRegistered,
}: {
  toLogin: () => void;
  onRegistered: () => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [securityQuestion, setSecurityQuestion] = useState(securityQuestions[0]);
  const [customQuestion, setCustomQuestion] = useState("");
  const [securityAnswer, setSecurityAnswer] = useState("");
  const [error, setError] = useState("");

  async function submit() {
    setError("");
    const question = (securityQuestion === "custom" ? customQuestion : securityQuestion).trim();

    if (!email.trim() || password.length < 6 || !question || !securityAnswer.trim()) {
      setError("Registration failed. Add a valid email, password, security question, and answer.");
      return;
    }

    const res = await fetch(`${API_BASE}/register`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        password,
        securityQuestion: question,
        securityAnswer,
      }),
    });

    if (!res.ok) {
      setError("Registration failed. The email may already exist or the credentials are invalid.");
      return;
    }

    setEmail("");
    setPassword("");
    setSecurityQuestion(securityQuestions[0]);
    setCustomQuestion("");
    setSecurityAnswer("");
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

      <View style={styles.field}>
        <Text style={styles.label}>Security Question</Text>
        <View style={styles.questionChoices}>
          {securityQuestions.map((question) => (
            <Pressable
              accessibilityRole="button"
              key={question}
              onPress={() => setSecurityQuestion(question)}
              style={[styles.choiceButton, securityQuestion === question && styles.choiceButtonActive]}
            >
              <Text style={[styles.choiceText, securityQuestion === question && styles.choiceTextActive]}>{question}</Text>
            </Pressable>
          ))}
          <Pressable
            accessibilityRole="button"
            onPress={() => setSecurityQuestion("custom")}
            style={[styles.choiceButton, securityQuestion === "custom" && styles.choiceButtonActive]}
          >
            <Text style={[styles.choiceText, securityQuestion === "custom" && styles.choiceTextActive]}>Custom</Text>
          </Pressable>
        </View>
      </View>

      {securityQuestion === "custom" ? (
        <View style={styles.field}>
          <Text style={styles.label}>Custom Question</Text>
          <TextInput
            onChangeText={setCustomQuestion}
            placeholder="Write your own question"
            placeholderTextColor="#72817b"
            style={styles.input}
            value={customQuestion}
          />
        </View>
      ) : null}

      <View style={styles.field}>
        <Text style={styles.label}>Security Answer</Text>
        <TextInput
          onChangeText={setSecurityAnswer}
          onSubmitEditing={submit}
          placeholder="Used to recover your password"
          placeholderTextColor="#72817b"
          style={styles.input}
          value={securityAnswer}
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
    width: "100%",
    alignSelf: "center",
    gap: 16,
  },
  field: {
    gap: 7,
  },
  label: {
    color: "#40504a",
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 0.6,
    textTransform: "uppercase",
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
  },
  questionChoices: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  choiceButton: {
    minHeight: 34,
    justifyContent: "center",
    paddingHorizontal: 11,
    borderWidth: 1,
    borderColor: "rgba(22, 72, 65, 0.12)",
    borderRadius: 999,
    backgroundColor: "rgba(255, 253, 247, 0.62)",
  },
  choiceButtonActive: {
    borderColor: "rgba(20, 86, 76, 0.3)",
    backgroundColor: "rgba(20, 86, 76, 0.1)",
  },
  choiceText: {
    color: "#52635b",
    fontSize: 12,
    fontWeight: "800",
  },
  choiceTextActive: {
    color: "#123f38",
    fontWeight: "900",
  },
  error: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "rgba(180, 35, 24, 0.24)",
    borderRadius: 14,
    color: "#a94747",
    backgroundColor: "rgba(169, 71, 71, 0.09)",
    fontSize: 15,
    lineHeight: 20,
  },
  primaryButton: {
    minHeight: 52,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    backgroundImage: "linear-gradient(135deg, #d99b68 0%, #c97654 48%, #a94f3d 100%)",
    boxShadow: "0 16px 34px rgba(169, 79, 61, 0.24)",
  },
  primaryButtonText: {
    color: "#fff8e6",
    fontSize: 16,
    fontWeight: "900",
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
    color: "#155753",
    fontSize: 14,
    fontWeight: "900",
  },
});
