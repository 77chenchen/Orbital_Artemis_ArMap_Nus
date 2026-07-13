import { Pressable, Text, View } from "react-native";
import { styles } from "./arStyles";
import { formatNavigationInstruction } from "./navigationInstructions";
import { formatDistance } from "./routeMath";

// Shown when the AR page opens without a usable route.
export function EmptyRouteState({ onBackToMap }) {
  return (
    <View style={styles.emptyState}>
      <Text style={styles.emptyTitle}>No route loaded</Text>
      <Text style={styles.emptyText}>Create a route on the map first, then open AR guidance.</Text>
      <Pressable onPress={onBackToMap} style={styles.primaryButton}>
        <Text style={styles.primaryButtonText}>Back to map</Text>
      </Pressable>
    </View>
  );
}

// Heads-up display layered on top of the camera/canvas.
// It does not calculate route state itself; ui.jsx passes already-derived
// values down so this file can focus on layout and labels.
export function ARHud({
  offRoute,
  trackingStatus,
  cameraStatus,
  activeStep,
  maneuver,
  maneuverDistance,
  remainingDistance,
  progressPercent,
  routeState,
  heading,
  onBack,
  onCalibrate,
  onStartCamera,
}) {
  const stepLabel = activeStep ? `Step ${activeStep.index + 1}/${activeStep.totalSteps}` : "Next";
  const instructionText = formatNavigationInstruction({
    activeStep,
    maneuver,
    maneuverDistance,
    progress: routeState.progress,
  });

  return (
    <>
      {/* Top status bar: exit, GPS/camera state, and heading calibration. */}
      <View style={styles.topBar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back to map"
          onPress={onBack}
          style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
        >
          <Text style={styles.iconButtonText}>‹</Text>
        </Pressable>
        <View style={styles.statusCluster}>
          <Text style={styles.statusTitle}>{offRoute ? "Off route" : "AR Guidance"}</Text>
          <Text style={styles.statusMeta}>
            {trackingStatus} · {cameraStatus}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Calibrate heading"
          onPress={onCalibrate}
          style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
        >
          <Text style={styles.iconButtonText}>⌖</Text>
        </Pressable>
      </View>

      {/* Main route instruction card. */}
      <View style={styles.turnCard}>
        <Text style={styles.turnKicker}>{stepLabel}</Text>
        <Text style={styles.turnTitle}>{instructionText}</Text>
        <Text style={styles.turnMeta}>
          {formatDistance(maneuverDistance)} · {formatDistance(remainingDistance)} left
        </Text>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progressPercent}%` }]} />
        </View>
      </View>

      {/* Bottom controls and quick metrics. */}
      <View style={styles.bottomBar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Start camera"
          onPress={onStartCamera}
          style={({ pressed }) => [styles.actionButton, pressed && styles.pressed]}
        >
          <Text style={styles.actionButtonText}>Camera</Text>
        </Pressable>
        <View style={styles.metricPill}>
          <Text style={styles.metricLabel}>Off route</Text>
          <Text style={[styles.metricValue, offRoute && styles.metricWarn]}>
            {Number.isFinite(routeState.offRouteDistance) ? formatDistance(routeState.offRouteDistance) : "-"}
          </Text>
        </View>
        <View style={styles.metricPill}>
          <Text style={styles.metricLabel}>Heading</Text>
          <Text style={styles.metricValue}>{Math.round(heading)}°</Text>
        </View>
      </View>
    </>
  );
}
