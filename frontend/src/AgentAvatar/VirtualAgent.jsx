import React, { useEffect, useMemo, useRef, useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import agentModelUrl from "../assets/agent/atlas_agent_model.svg";
import agentModules from "../assets/agent/atlas_agent_modules.json";

function chooseReply(action) {
  if (!action?.replies?.length) return "I'm here whenever you need me.";
  return action.replies[Math.floor(Math.random() * action.replies.length)];
}

async function safeCall(task, fallback) {
  try {
    return await task();
  } catch {
    return fallback;
  }
}

function compactReply(text = "") {
  return text.replace(/\n{2,}/g, "\n").trim();
}

function formatTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function buildAssistantContext(data) {
  return {
    currentTime: new Date().toISOString(),
    schedule: data.schedule.map((item) => ({
      title: item.title,
      moduleCode: item.moduleCode,
      location: item.location,
      startAt: item.startAt,
      endAt: item.endAt,
    })),
    recommendations: data.recommendations.slice(0, 5),
    syncStatus: data.syncStatus?.status || "never_run",
    campusSignal: {
      buildings: data.buildings.length,
      facilityMatches: data.facilities.length,
      busRoutes: data.busRoutes.length,
    },
  };
}

export default function VirtualAgent() {
  const [isAwake, setIsAwake] = useState(false);
  const [activeAction, setActiveAction] = useState("docked");
  const [message, setMessage] = useState("Standing by in the corner.");
  const [result, setResult] = useState(null);
  const [isWorking, setIsWorking] = useState(false);
  const actionTimerRef = useRef(null);
  const navigate = useNavigate();
  const { width } = useWindowDimensions();
  const compact = width < 540;

  const actions = agentModules.actions;
  const actionById = useMemo(
    () => Object.fromEntries(actions.map((action) => [action.id, action])),
    [actions],
  );
  const quickActions = actions.filter((action) => action.id !== "wake");

  useEffect(
    () => () => {
      if (actionTimerRef.current) window.clearTimeout(actionTimerRef.current);
    },
    [],
  );

  function openDashboardSection(section) {
    navigate("/Dashboard");
    window.setTimeout(() => {
      window.dispatchEvent(new CustomEvent("atlas:dashboard-section", { detail: { section } }));
    }, 80);
  }

  async function loadAgentContext() {
    const [health, buildings, schedule, recommendations, facilities, syncStatus, busRoutes, pickupPoints] =
      await Promise.all([
        safeCall(api.health, null),
        safeCall(api.buildings, []),
        safeCall(api.schedule, []),
        safeCall(api.recommendations, []),
        safeCall(() => api.facilities({}), []),
        safeCall(api.syncStatus, null),
        safeCall(api.busRoutes, []),
        safeCall(() => api.busPickupPoints("D1"), []),
      ]);

    const firstPickup = pickupPoints[0]?.stopCode || pickupPoints[0]?.code || "CLB";
    const arrival = await safeCall(() => api.busArrivals(firstPickup), null);

    return {
      health,
      buildings,
      schedule,
      recommendations,
      facilities,
      syncStatus,
      busRoutes,
      pickupPoints,
      arrival,
    };
  }

  async function runCheckIn() {
    const data = await loadAgentContext();
    const nextItem = data.schedule
      .slice()
      .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime())
      .find((item) => new Date(item.endAt).getTime() >= Date.now());
    const topRecommendation = data.recommendations[0];

    setMessage(
      nextItem
        ? `Next: ${nextItem.moduleCode || "TASK"} at ${nextItem.location}, ${formatTime(nextItem.startAt)}.`
        : "No upcoming schedule item found. You can ask me to plan a focus block.",
    );
    setResult({
      title: "Campus check-in",
      body:
        topRecommendation?.description ||
        "Schedule, facility, sync, and bus context loaded. Daily Assistant can now plan from this state.",
      meta: [
        `${data.buildings.length} buildings`,
        `${data.facilities.length} facilities`,
        `${data.busRoutes.length} bus routes`,
      ],
      actionLabel: "Open Daily Assistant",
      actionSection: "recommendations",
    });
  }

  async function runPlan() {
    const data = await loadAgentContext();
    const response = await api.dailyAssistant({
      mode: "daily_plan",
      message: "Create a concise campus plan from the latest schedule, recommendations, facilities, and bus context.",
      context: buildAssistantContext(data),
    });

    setMessage(response.success ? "Daily Assistant returned a live plan." : "Daily Assistant used a fallback response.");
    setResult({
      title: response.success ? "AI plan" : "Plan fallback",
      body: compactReply(response.reply),
      meta: [response.provider, response.model].filter(Boolean),
      actionLabel: "Open Daily Assistant",
      actionSection: "recommendations",
    });
  }

  async function runRoute() {
    const data = await loadAgentContext();
    const nextRecommendation = data.recommendations.find((item) => item.kind === "route") || data.recommendations[0];
    const firstArrival = data.arrival?.routes?.[0];
    const eta = firstArrival?.arrivalMinutes?.[0] || firstArrival?.arrivalTime;

    openDashboardSection("map");
    setMessage(
      nextRecommendation
        ? `Map opened. Best next move: ${nextRecommendation.title}.`
        : "Map opened. Search a destination and I will keep the bus context nearby.",
    );
    setResult({
      title: "Route assist",
      body:
        nextRecommendation?.description ||
        "Map view is open. Bus route context is loaded and ready for the campus layer.",
      meta: [
        nextRecommendation?.location ? `Target ${nextRecommendation.location}` : "",
        eta ? `Next bus ${eta} min` : "",
        data.arrival?.source ? `Source ${data.arrival.source}` : "",
      ].filter(Boolean),
      actionLabel: "Stay on map",
      actionSection: "map",
    });
  }

  async function runWrapUp() {
    const data = await loadAgentContext();
    const response = await api.dailyAssistant({
      mode: "task_summary",
      message: "Summarise the current campus plan, next action, and any schedule or route risk in four concise lines.",
      context: buildAssistantContext(data),
    });

    setMessage(response.success ? "Summary is ready." : "Summary fallback is ready.");
    setResult({
      title: response.success ? "Wrap-up summary" : "Wrap-up fallback",
      body: compactReply(response.reply),
      meta: [response.provider, response.model].filter(Boolean),
      actionLabel: "Open Schedule",
      actionSection: "schedule",
    });
  }

  async function playAction(actionId) {
    const action = actionById[actionId] || actionById.wake;
    if (!action || isWorking) return;

    if (actionTimerRef.current) window.clearTimeout(actionTimerRef.current);

    setIsAwake(true);
    setActiveAction(action.id);
    setMessage(chooseReply(action));
    setResult(null);

    if (action.id === "wake") return;

    setIsWorking(true);
    try {
      if (action.id === "wave") await runCheckIn();
      if (action.id === "think") await runPlan();
      if (action.id === "route") await runRoute();
      if (action.id === "celebrate") await runWrapUp();
    } catch (err) {
      setMessage("I could not complete that module yet.");
      setResult({
        title: "Module failed",
        body: err instanceof Error ? err.message : "Unexpected agent module error.",
        meta: ["Check backend/API configuration"],
      });
    } finally {
      setIsWorking(false);
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
    setResult(null);
    setMessage("Standing by in the corner.");
  }

  return (
    <View
      testID="atlas-agent-shell"
      dataSet={{ awake: isAwake ? "true" : "false" }}
      style={[
        styles.agent,
        isAwake ? styles.agentAwake : styles.agentDocked,
        compact && isAwake && styles.agentAwakeCompact,
      ]}
    >
      {isAwake ? (
        <View testID="atlas-agent-panel" style={[styles.panel, styles.panelAnimated, compact && styles.panelCompact]}>
          <View style={styles.panelHead}>
            <View style={styles.panelTitle}>
              <Text style={styles.panelKicker}>{agentModules.agent.name}</Text>
              <Text numberOfLines={1} style={styles.panelMood}>
                {isWorking ? "working" : actionById[activeAction]?.mood || "ready"}
              </Text>
            </View>
            <Pressable onPress={dockAgent} style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}>
              <Text style={styles.iconButtonText}>x</Text>
            </Pressable>
          </View>

          <Text style={styles.message}>{message}</Text>

          {result ? (
            <View style={styles.resultCard}>
              <Text style={styles.resultTitle}>{result.title}</Text>
              <ScrollView style={styles.resultScroll}>
                <Text style={styles.resultBody}>{result.body}</Text>
              </ScrollView>
              {result.meta?.length ? (
                <View style={styles.metaRow}>
                  {result.meta.map((item) => (
                    <Text key={item} numberOfLines={1} style={styles.metaPill}>
                      {item}
                    </Text>
                  ))}
                </View>
              ) : null}
              {result.actionSection ? (
                <Pressable
                  onPress={() => openDashboardSection(result.actionSection)}
                  style={({ pressed }) => [styles.resultAction, pressed && styles.pressed]}
                >
                  <Text style={styles.resultActionText}>{result.actionLabel}</Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}

          <View style={styles.actions}>
            {quickActions.map((action) => (
              <Pressable
                key={action.id}
                disabled={isWorking}
                onPress={() => playAction(action.id)}
                style={({ pressed }) => [
                  styles.actionButton,
                  activeAction === action.id && styles.actionButtonActive,
                  isWorking && styles.actionButtonDisabled,
                  pressed && !isWorking && styles.actionButtonPressed,
                ]}
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
        testID="atlas-agent-body"
        dataSet={{ action: activeAction, awake: isAwake ? "true" : "false" }}
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
        <View testID="atlas-agent-ring-one" style={[styles.ring, styles.ringOne]} />
        <View testID="atlas-agent-ring-two" style={[styles.ring, styles.ringTwo]} />
        <View style={styles.glow} />
        <Image
          testID="atlas-agent-art"
          source={{ uri: agentModelUrl }}
          resizeMode="contain"
          style={[
            styles.art,
            isAwake && styles.artFloat,
            activeAction === "wave" && styles.artWave,
            activeAction === "think" && styles.artThink,
            activeAction === "route" && styles.artRoute,
            activeAction === "celebrate" && styles.artCelebrate,
          ]}
        />
        {!isAwake ? <Text style={styles.dockLabel}>AI</Text> : null}
        {isWorking ? <View testID="atlas-agent-work-dot" style={styles.workDot} /> : null}
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
    width: 352,
    maxWidth: "calc(100vw - 132px)",
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(20, 52, 49, 0.16)",
    borderRadius: 8,
    backgroundColor: "rgba(248, 255, 251, 0.96)",
    boxShadow: "0 18px 44px rgba(18, 50, 46, 0.22)",
    pointerEvents: "auto",
  },
  panelAnimated: {
    animationName: "atlasAgentPanelIn",
    animationDuration: "220ms",
    animationTimingFunction: "ease-out",
    animationFillMode: "both",
  },
  panelCompact: {
    width: "min(100%, 340px)",
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
  resultCard: {
    gap: 9,
    marginBottom: 12,
    padding: 11,
    borderWidth: 1,
    borderColor: "rgba(20, 52, 49, 0.12)",
    borderRadius: 8,
    backgroundColor: "#ffffff",
  },
  resultTitle: {
    color: "#143431",
    fontSize: 13,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  resultScroll: {
    maxHeight: 132,
  },
  resultBody: {
    color: "#39534d",
    fontSize: 13,
    lineHeight: 19,
    whiteSpace: "pre-wrap",
  },
  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  metaPill: {
    maxWidth: "100%",
    borderRadius: 999,
    paddingVertical: 5,
    paddingHorizontal: 8,
    color: "#287166",
    backgroundColor: "#eef8f4",
    fontSize: 11,
    fontWeight: "800",
  },
  resultAction: {
    minHeight: 34,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 7,
    backgroundColor: "#143431",
  },
  resultActionText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "900",
  },
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  actionButton: {
    flexBasis: "calc(50% - 4px)",
    flexGrow: 1,
    minHeight: 36,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: "rgba(20, 52, 49, 0.14)",
    borderRadius: 7,
    backgroundColor: "#ffffff",
  },
  actionButtonActive: {
    borderColor: "rgba(40, 113, 102, 0.42)",
    backgroundColor: "#edf8f4",
  },
  actionButtonDisabled: {
    opacity: 0.62,
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
    width: 98,
    height: 98,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 0,
    borderBottomRightRadius: 0,
    borderBottomLeftRadius: 0,
    transform: [{ translateX: 50 }, { translateY: 34 }, { scale: 0.98 }],
    animationName: "atlasAgentPeek",
    animationDuration: "4.8s",
    animationTimingFunction: "ease-in-out",
    animationIterationCount: "infinite",
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
  ring: {
    position: "absolute",
    inset: -8,
    borderWidth: 1,
    borderColor: "rgba(40, 113, 102, 0.18)",
    borderRadius: 999,
    pointerEvents: "none",
  },
  ringOne: {
    animationName: "atlasAgentRing",
    animationDuration: "2.4s",
    animationTimingFunction: "ease-out",
    animationIterationCount: "infinite",
  },
  ringTwo: {
    animationName: "atlasAgentRing",
    animationDuration: "2.4s",
    animationTimingFunction: "ease-out",
    animationDelay: "1.2s",
    animationIterationCount: "infinite",
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
  artFloat: {
    animationName: "atlasAgentFloat",
    animationDuration: "3.2s",
    animationTimingFunction: "ease-in-out",
    animationIterationCount: "infinite",
  },
  artWave: {
    animationDuration: "1.6s",
  },
  artThink: {
    animationName: "atlasAgentThink",
    animationDuration: "920ms",
  },
  artRoute: {
    animationName: "atlasAgentRoute",
    animationDuration: "980ms",
  },
  artCelebrate: {
    animationName: "atlasAgentCelebrate",
    animationDuration: "780ms",
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
  workDot: {
    position: "absolute",
    top: 8,
    right: 9,
    width: 12,
    height: 12,
    borderRadius: 999,
    backgroundColor: "#ffb84d",
    boxShadow: "0 0 0 4px rgba(255, 184, 77, 0.2)",
    animationName: "atlasAgentWorkDot",
    animationDuration: "880ms",
    animationTimingFunction: "ease-in-out",
    animationIterationCount: "infinite",
  },
  pressed: {
    transform: [{ scale: 0.96 }],
  },
});
