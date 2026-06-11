import React, { useEffect, useMemo, useRef, useState } from "react";
import { Image, Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import agentModelUrl from "../assets/agent/atlas_agent_model.svg";
import agentModules from "../assets/agent/atlas_agent_modules.json";

function chooseReply(action) {
  if (!action?.replies?.length) return "I'm here whenever you need me.";
  return action.replies[Math.floor(Math.random() * action.replies.length)];
}

export default function VirtualAgent() {
  const [isAwake, setIsAwake] = useState(false);
  const [activeAction, setActiveAction] = useState("docked");
  const [message, setMessage] = useState("Standing by in the corner.");
  const actionTimerRef = useRef(null);
  const { width } = useWindowDimensions();
  const compact = width < 540;

  const actions = agentModules.actions;
  const actionById = useMemo(
    () => Object.fromEntries(actions.map((action) => [action.id, action])),
    [actions],
  );

  useEffect(
    () => () => {
      if (actionTimerRef.current) window.clearTimeout(actionTimerRef.current);
    },
    [],
  );

  function playAction(actionId) {
    const action = actionById[actionId] || actionById.wake;
    if (!action) return;

    if (actionTimerRef.current) window.clearTimeout(actionTimerRef.current);

    setIsAwake(true);
    setActiveAction(action.id);
    setMessage(chooseReply(action));

    if (action.id !== "wake") {
      actionTimerRef.current = window.setTimeout(() => {
        setActiveAction("idle");
      }, action.durationMs);
    }
  }

  function wakeAgent() {
    if (!isAwake) {
      playAction("wake");
    }
  }

  function dockAgent() {
    if (actionTimerRef.current) window.clearTimeout(actionTimerRef.current);
    setIsAwake(false);
    setActiveAction("docked");
    setMessage("Standing by in the corner.");
  }

  const quickActions = actions.filter((action) => action.id !== "wake");

  return (
    <View
      style={[
        styles.agent,
        isAwake ? styles.agentAwake : styles.agentDocked,
        compact && isAwake && styles.agentAwakeCompact,
      ]}
    >
      {isAwake ? (
        <View style={[styles.panel, compact && styles.panelCompact]}>
          <View style={styles.panelHead}>
            <View style={styles.panelTitle}>
              <Text style={styles.panelKicker}>{agentModules.agent.name}</Text>
              <Text numberOfLines={1} style={styles.panelMood}>
                {actionById[activeAction]?.mood || "ready"}
              </Text>
            </View>
            <Pressable onPress={dockAgent} style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}>
              <Text style={styles.iconButtonText}>x</Text>
            </Pressable>
          </View>

          <Text style={styles.message}>{message}</Text>

          <View style={styles.actions}>
            {quickActions.map((action) => (
              <Pressable
                key={action.id}
                onPress={() => playAction(action.id)}
                style={({ pressed }) => [styles.actionButton, pressed && styles.actionButtonPressed]}
              >
                <Text numberOfLines={1} style={styles.actionButtonText}>
                  {action.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}

      <Pressable
        accessibilityRole="button"
        onPress={wakeAgent}
        accessibilityLabel={isAwake ? "Artemis is awake" : "Wake Artemis"}
        accessibilityState={{ expanded: isAwake }}
        style={({ pressed }) => [
          styles.bodyButton,
          !isAwake && styles.bodyButtonDocked,
          activeAction === "think" && styles.bodyButtonThinking,
          activeAction === "celebrate" && styles.bodyButtonCelebrate,
          pressed && styles.bodyButtonPressed,
        ]}
      >
        <View style={styles.glow} />
        <Image source={{ uri: agentModelUrl }} resizeMode="contain" style={styles.art} />
        {!isAwake ? <Text style={styles.dockLabel}>AI</Text> : null}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  agent: {
    position: "fixed",
    right: "max(18px, env(safe-area-inset-right))",
    bottom: "max(18px, env(safe-area-inset-bottom))",
    zIndex: 80,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 12,
    pointerEvents: "none",
  },
  agentAwake: {
    right: "max(18px, env(safe-area-inset-right))",
    bottom: "max(18px, env(safe-area-inset-bottom))",
  },
  agentDocked: {
    right: 0,
    bottom: 0,
  },
  agentAwakeCompact: {
    left: 10,
    right: 10,
    bottom: "max(12px, env(safe-area-inset-bottom))",
    flexDirection: "column",
    gap: 10,
  },
  panel: {
    width: 322,
    maxWidth: "calc(100vw - 132px)",
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(20, 52, 49, 0.16)",
    borderRadius: 8,
    backgroundColor: "rgba(248, 255, 251, 0.96)",
    boxShadow: "0 18px 44px rgba(18, 50, 46, 0.22)",
    pointerEvents: "auto",
  },
  panelCompact: {
    width: "min(100%, 320px)",
    maxWidth: "100%",
  },
  panelHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 10,
  },
  panelTitle: {
    minWidth: 0,
    gap: 2,
  },
  panelKicker: {
    color: "#287166",
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  panelMood: {
    color: "#143431",
    fontSize: 16,
    fontWeight: "800",
    lineHeight: 20,
  },
  iconButton: {
    width: 32,
    height: 32,
    flexShrink: 0,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(20, 52, 49, 0.16)",
    borderRadius: 999,
    backgroundColor: "#f4faf6",
  },
  iconButtonText: {
    color: "#143431",
    fontSize: 18,
    fontWeight: "800",
    lineHeight: 20,
  },
  message: {
    marginBottom: 12,
    color: "#143431",
    fontSize: 15,
    lineHeight: 22,
  },
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  actionButton: {
    flexBasis: "calc(50% - 4px)",
    flexGrow: 1,
    minHeight: 34,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 7,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: "rgba(20, 52, 49, 0.14)",
    borderRadius: 7,
    backgroundColor: "#ffffff",
  },
  actionButtonPressed: {
    borderColor: "rgba(255, 184, 77, 0.9)",
    backgroundColor: "#fff8df",
  },
  actionButtonText: {
    color: "#143431",
    fontSize: 12,
    fontWeight: "800",
  },
  bodyButton: {
    position: "relative",
    width: 94,
    height: 94,
    alignItems: "center",
    justifyContent: "center",
    overflow: "visible",
    padding: 5,
    borderWidth: 1,
    borderColor: "rgba(24, 88, 79, 0.18)",
    borderRadius: 28,
    backgroundImage: "linear-gradient(145deg, rgba(255, 255, 255, 0.92), rgba(202, 244, 232, 0.82))",
    boxShadow: "0 18px 44px rgba(18, 50, 46, 0.22)",
    pointerEvents: "auto",
  },
  bodyButtonDocked: {
    width: 86,
    height: 86,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 0,
    borderBottomRightRadius: 0,
    borderBottomLeftRadius: 0,
    transform: [{ translateX: 28 }, { translateY: 28 }, { scale: 0.92 }],
  },
  bodyButtonThinking: {
    borderColor: "rgba(53, 199, 177, 0.54)",
  },
  bodyButtonCelebrate: {
    borderColor: "rgba(255, 122, 89, 0.54)",
  },
  bodyButtonPressed: {
    opacity: 0.9,
  },
  glow: {
    position: "absolute",
    pointerEvents: "none",
    inset: -10,
    borderRadius: 999,
    opacity: 0.75,
    backgroundImage:
      "radial-gradient(circle at 50% 42%, rgba(255, 217, 102, 0.42), transparent 44%), radial-gradient(circle at 52% 68%, rgba(53, 199, 177, 0.3), transparent 58%)",
  },
  art: {
    position: "relative",
    width: 104,
    height: 104,
  },
  dockLabel: {
    position: "absolute",
    right: 13,
    bottom: 10,
    width: 28,
    height: 28,
    borderWidth: 2,
    borderColor: "rgba(255, 255, 255, 0.78)",
    borderRadius: 999,
    color: "#ffffff",
    backgroundColor: "#143431",
    fontSize: 11,
    fontWeight: "800",
    lineHeight: 24,
    textAlign: "center",
  },
  pressed: {
    transform: [{ scale: 0.96 }],
  },
});
