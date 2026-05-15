import React, { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import CampusMap2D from "./CampusMap2D";
import Login from "./Login";
import Register from "./Register";
import { colors } from "./theme";

const showcaseBuildings = [
  { code: "COM1", name: "Computing 1", supportedIndoor: true },
  { code: "CLB", name: "Central Library", supportedIndoor: true },
  { code: "UTOWN", name: "University Town", supportedIndoor: false },
];

export default function Auth() {
  const [isRegister, setIsRegister] = useState(false);
  const [selectedCode, setSelectedCode] = useState("COM1");
  const [notice, setNotice] = useState("");
  const { width } = useWindowDimensions();
  const compact = width < 960;

  useEffect(() => {
    document.title = "Atlas | Sign in";
  }, []);

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <View style={[styles.shell, compact && styles.shellCompact]}>
        <View style={[styles.showcase, compact && styles.showcaseCompact]}>
          <View style={styles.brandRow}>
            <View style={styles.logoMark}>
              <View style={styles.logoCore} />
            </View>
            <View>
              <Text style={styles.brandName}>Atlas</Text>
              <Text style={styles.brandCaption}>NUS daily campus agent</Text>
            </View>
          </View>

          <View style={styles.copy}>
            <Text style={styles.kicker}>Campus intelligence</Text>
            <Text style={[styles.heroTitle, compact && styles.heroTitleCompact]}>ATLAS</Text>
            <Text style={styles.heroBadge}>AR MAP NUS</Text>
            <Text style={styles.heroBody}>
              A responsive campus assistant for schedules, indoor routes, facilities, and fast class handoffs.
            </Text>
          </View>

          <CampusMap2D
            buildings={showcaseBuildings}
            selectedCode={selectedCode}
            onSelect={setSelectedCode}
          />

          <View style={styles.featureRow}>
            {[
              ["2D Map", "Mouse-reactive route"],
              ["Daily Agent", "Tasks and focus"],
              ["Indoor Support", "Quick handoffs"],
            ].map(([title, detail]) => (
              <View key={title} style={styles.featureCell}>
                <Text style={styles.featureTitle}>{title}</Text>
                <Text style={styles.featureText}>{detail}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={[styles.authPanel, compact && styles.authPanelCompact]}>
          <View style={styles.modeSwitch}>
            <Pressable
              onPress={() => {
                setNotice("");
                setIsRegister(false);
              }}
              style={[styles.modeButton, !isRegister && styles.modeButtonActive]}
            >
              <Text style={[styles.modeLabel, !isRegister && styles.modeLabelActive]}>Login</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                setNotice("");
                setIsRegister(true);
              }}
              style={[styles.modeButton, isRegister && styles.modeButtonActive]}
            >
              <Text style={[styles.modeLabel, isRegister && styles.modeLabelActive]}>Register</Text>
            </Pressable>
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
            <Login toRegister={() => setIsRegister(true)} />
          )}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: {
    minHeight: "100vh",
    justifyContent: "center",
    padding: 28,
    backgroundColor: colors.canvas,
  },
  shell: {
    alignSelf: "center",
    flexDirection: "row",
    width: "100%",
    maxWidth: 1160,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.72)",
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.62)",
    boxShadow: "0 30px 80px rgba(35,60,54,0.16)",
  },
  shellCompact: {
    flexDirection: "column",
  },
  showcase: {
    flex: 1.1,
    gap: 22,
    padding: 32,
    backgroundImage:
      "linear-gradient(140deg, rgba(21,70,60,0.96), rgba(38,92,130,0.9) 58%, rgba(216,119,63,0.82))",
  },
  showcaseCompact: {
    padding: 22,
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  logoMark: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.4)",
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  logoCore: {
    width: 15,
    height: 15,
    borderRadius: 99,
    backgroundColor: colors.gold,
  },
  brandName: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "800",
  },
  brandCaption: {
    color: "rgba(255,255,255,0.72)",
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  copy: {
    gap: 8,
  },
  kicker: {
    color: "#dfefe8",
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  heroTitle: {
    color: "#eaf8f1",
    fontSize: 72,
    lineHeight: 78,
    fontWeight: "900",
  },
  heroTitleCompact: {
    fontSize: 48,
    lineHeight: 54,
  },
  heroBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.26)",
    borderRadius: 8,
    color: "#ffffff",
    backgroundColor: "rgba(255,255,255,0.12)",
    fontSize: 12,
    fontWeight: "800",
  },
  heroBody: {
    maxWidth: 430,
    color: "rgba(255,255,255,0.82)",
    fontSize: 16,
    lineHeight: 25,
  },
  featureRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  featureCell: {
    flexGrow: 1,
    minWidth: 140,
    gap: 4,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.24)",
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  featureTitle: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "800",
  },
  featureText: {
    color: "rgba(255,255,255,0.74)",
    fontSize: 13,
  },
  authPanel: {
    flex: 0.82,
    justifyContent: "center",
    gap: 18,
    padding: 34,
    backgroundColor: "rgba(255,255,255,0.8)",
  },
  authPanelCompact: {
    padding: 18,
  },
  modeSwitch: {
    flexDirection: "row",
    gap: 6,
    alignSelf: "center",
    width: "100%",
    maxWidth: 380,
    padding: 6,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 8,
    backgroundColor: "#ffffff",
  },
  modeButton: {
    flex: 1,
    minHeight: 42,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 6,
  },
  modeButtonActive: {
    backgroundColor: colors.green,
  },
  modeLabel: {
    color: colors.muted,
    fontWeight: "800",
  },
  modeLabelActive: {
    color: "#ffffff",
  },
  notice: {
    alignSelf: "center",
    width: "100%",
    maxWidth: 430,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(46,112,88,0.18)",
    borderRadius: 8,
    color: colors.green,
    backgroundColor: "rgba(152,223,198,0.18)",
    fontWeight: "700",
  },
});
