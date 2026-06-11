import React, { useEffect, useMemo, useState } from "react";
import {
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { useNavigate } from "react-router-dom";
import CampusMap2D from "../CampusMap2D";
import Login from "./Login";
import Register from "./Register";

const assistantMessages = [
  "Your first lecture starts at LT27.",
  "Fastest route found.",
  "You have 12 minutes before class.",
  "Focus session ready after arrival.",
];

const particles = [
  { left: "8%", top: "14%", size: 5, duration: 7200, delay: 100 },
  { left: "18%", top: "78%", size: 4, duration: 8300, delay: 1200 },
  { left: "28%", top: "38%", size: 6, duration: 9100, delay: 600 },
  { left: "42%", top: "10%", size: 3, duration: 7800, delay: 1800 },
  { left: "57%", top: "72%", size: 5, duration: 8800, delay: 400 },
  { left: "66%", top: "24%", size: 4, duration: 9400, delay: 1400 },
  { left: "78%", top: "84%", size: 6, duration: 7600, delay: 800 },
  { left: "89%", top: "18%", size: 4, duration: 8600, delay: 1100 },
];

export default function Auth() {
  const [isRegister, setIsRegister] = useState(false);
  const [messageIndex, setMessageIndex] = useState(0);
  const [notice, setNotice] = useState("");
  const { width } = useWindowDimensions();
  const navigate = useNavigate();
  const compact = width < 980;

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.title = "Atlas | Sign in";
    }

    const timer = window.setInterval(() => {
      setMessageIndex((current) => (current + 1) % assistantMessages.length);
    }, 3200);
    return () => window.clearInterval(timer);
  }, []);

  const activeMessage = useMemo(() => assistantMessages[messageIndex], [messageIndex]);

  function enterDemoMode() {
    localStorage.setItem("token", "demo-mode");
    navigate("/Dashboard");
  }

  return (
    <View style={styles.page}>
      <View style={styles.background}>
        {particles.map((particle, index) => (
          <FloatingParticle key={`${particle.left}-${particle.top}`} particle={particle} index={index} />
        ))}
      </View>

      <View style={[styles.shell, compact && styles.shellCompact]}>
        <View style={[styles.previewPane, compact && styles.previewPaneCompact]}>
          <View style={styles.previewCopy}>
            <Text style={styles.previewKicker}>Atlas AR Preview</Text>
            <Text style={[styles.previewTitle, compact && styles.previewTitleCompact]}>
              Navigate campus before the day starts.
            </Text>
          </View>
          <View style={[styles.previewMap, compact && styles.previewMapCompact]}>
            <CampusMap2D />
          </View>
        </View>

        <View style={styles.loginPane}>
          <View style={styles.loginStack}>
            <View style={styles.brandLockup}>
              <View style={styles.atlasMark} />
              <View style={styles.brandCopy}>
                <Text style={styles.brandName}>Atlas</Text>
                <Text style={styles.brandTagline}>AR Campus Map + Daily Assistant</Text>
              </View>
            </View>

            <View style={styles.assistantBubble}>
              <Text style={styles.assistantKicker}>Atlas Assistant</Text>
              <Text style={styles.assistantMessage}>{activeMessage}</Text>
            </View>

            {notice ? <Text style={styles.notice}>{notice}</Text> : null}

            {isRegister ? (
              <Register
                toLogin={() => setIsRegister(false)}
                onRegistered={() => {
                  setNotice("Account created. You can sign in now.");
                  setIsRegister(false);
                }}
              />
            ) : (
              <Login toRegister={() => setIsRegister(true)} onDemoMode={enterDemoMode} />
            )}
          </View>
        </View>
      </View>
    </View>
  );
}

function FloatingParticle({
  particle,
  index,
}: {
  particle: { left: string; top: string; size: number; duration: number; delay: number };
  index: number;
}) {
  return (
    <View
      style={[
        styles.particle,
        {
          left: particle.left,
          top: particle.top,
          width: particle.size,
          height: particle.size,
          opacity: 0.22 + (index % 3) * 0.12,
        },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  page: {
    position: "relative",
    minHeight: "100vh" as never,
    overflow: "hidden",
    padding: 28,
    color: "#eef7f4",
    backgroundImage:
      "radial-gradient(circle at 12% 18%, rgba(89, 232, 201, 0.16), transparent 26%), radial-gradient(circle at 88% 14%, rgba(124, 198, 255, 0.16), transparent 22%), linear-gradient(135deg, #061418 0%, #0b1f27 42%, #11283a 100%)",
  },
  background: {
    ...StyleSheet.absoluteFillObject,
    pointerEvents: "none",
  },
  particle: {
    position: "absolute",
    borderRadius: 999,
    backgroundColor: "rgba(166, 248, 228, 0.8)",
    boxShadow: "0 0 18px rgba(166, 248, 228, 0.52)",
  },
  shell: {
    position: "relative",
    zIndex: 1,
    flexDirection: "row",
    width: "min(1240px, 100%)" as never,
    minHeight: "calc(100vh - 56px)" as never,
    marginHorizontal: "auto" as never,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.14)",
    borderRadius: 8,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    boxShadow: "0 28px 80px rgba(0, 0, 0, 0.34)",
    backdropFilter: "blur(20px)",
  },
  shellCompact: {
    flexDirection: "column",
    minHeight: "calc(100vh - 32px)" as never,
  },
  previewPane: {
    flex: 1.1,
    justifyContent: "center",
    gap: 24,
    minWidth: 0,
    padding: 46,
    backgroundColor: "rgba(6, 19, 24, 0.26)",
  },
  previewPaneCompact: {
    padding: 22,
  },
  previewCopy: {
    gap: 8,
  },
  previewKicker: {
    color: "rgba(166, 248, 228, 0.84)",
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  previewTitle: {
    maxWidth: 520,
    color: "#f4fbf9",
    fontSize: 48,
    fontWeight: "800",
    lineHeight: 50,
  },
  previewTitleCompact: {
    fontSize: 29,
    lineHeight: 34,
  },
  previewMap: {
    height: "min(520px, 56vh)" as never,
    minHeight: 420,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.18)",
    borderRadius: 8,
  },
  previewMapCompact: {
    minHeight: 320,
  },
  loginPane: {
    flex: 0.78,
    justifyContent: "center",
    minWidth: 0,
    padding: 42,
    color: "#16312c",
    backgroundColor: "rgba(250, 253, 252, 0.96)",
  },
  loginStack: {
    gap: 18,
    width: "min(430px, 100%)" as never,
    marginHorizontal: "auto" as never,
  },
  brandLockup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  atlasMark: {
    width: 42,
    height: 42,
    borderRadius: 8,
    backgroundImage:
      "radial-gradient(circle at 50% 45%, #f5d27b 0 16%, transparent 17%), linear-gradient(135deg, #154c46, #3f70a8)",
  },
  brandCopy: {
    gap: 2,
  },
  brandName: {
    color: "#16312c",
    fontSize: 18,
    fontWeight: "800",
  },
  brandTagline: {
    color: "#65756f",
    fontSize: 14,
  },
  assistantBubble: {
    gap: 5,
    minHeight: 80,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(22, 49, 44, 0.1)",
    borderRadius: 8,
    backgroundColor: "#f1f7f5",
  },
  assistantKicker: {
    color: "#2f7159",
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  assistantMessage: {
    color: "#16312c",
    fontSize: 16,
    fontWeight: "800",
    lineHeight: 22,
  },
  notice: {
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(47, 113, 89, 0.18)",
    borderRadius: 8,
    color: "#2f7159",
    backgroundColor: "rgba(159, 246, 221, 0.18)",
    fontWeight: "700",
  },
});
