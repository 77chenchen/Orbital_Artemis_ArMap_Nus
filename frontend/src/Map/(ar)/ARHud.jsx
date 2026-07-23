import { Pressable, Text, View, useWindowDimensions } from "react-native";
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
  const { width, height } = useWindowDimensions();
  const compact = width < 540 || height < 700;
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
      <View style={[styles.topBar, compact && styles.topBarCompact]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back to map"
          onPress={onBack}
          style={({ pressed }) => [styles.iconButton, compact && styles.iconButtonCompact, pressed && styles.pressed]}
        >
          <Text style={[styles.iconButtonText, compact && styles.iconButtonTextCompact]}>‹</Text>
        </Pressable>
        <View style={[styles.statusCluster, compact && styles.statusClusterCompact]}>
          <Text numberOfLines={1} style={[styles.statusTitle, compact && styles.statusTitleCompact]}>
            {offRoute ? "Off route" : "AR Guidance"}
          </Text>
          <Text numberOfLines={1} style={[styles.statusMeta, compact && styles.statusMetaCompact]}>
            {trackingStatus} · {cameraStatus}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Calibrate heading"
          onPress={onCalibrate}
          style={({ pressed }) => [styles.iconButton, compact && styles.iconButtonCompact, pressed && styles.pressed]}
        >
          <Text style={[styles.iconButtonText, compact && styles.iconButtonTextCompact]}>⌖</Text>
        </Pressable>
      </View>

      {/* Main route instruction card. */}
      <View style={[styles.turnCard, compact && styles.turnCardCompact]}>
        <Text style={[styles.turnKicker, compact && styles.turnKickerCompact]}>{stepLabel}</Text>
        <Text numberOfLines={compact ? 3 : 4} style={[styles.turnTitle, compact && styles.turnTitleCompact]}>
          {instructionText}
        </Text>
        <Text numberOfLines={1} style={[styles.turnMeta, compact && styles.turnMetaCompact]}>
          {formatDistance(maneuverDistance)} · {formatDistance(remainingDistance)} left
        </Text>
        <View style={[styles.progressTrack, compact && styles.progressTrackCompact]}>
          <View style={[styles.progressFill, { width: `${progressPercent}%` }]} />
        </View>
      </View>

      {/* Bottom controls and quick metrics. */}
      <View style={[styles.bottomBar, compact && styles.bottomBarCompact]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Start camera"
          onPress={onStartCamera}
          style={({ pressed }) => [styles.actionButton, compact && styles.actionButtonCompact, pressed && styles.pressed]}
        >
          <Text style={[styles.actionButtonText, compact && styles.actionButtonTextCompact]}>Camera</Text>
        </Pressable>
        <View style={[styles.metricPill, compact && styles.metricPillCompact]}>
          <Text numberOfLines={1} style={[styles.metricLabel, compact && styles.metricLabelCompact]}>Off route</Text>
          <Text numberOfLines={1} style={[styles.metricValue, compact && styles.metricValueCompact, offRoute && styles.metricWarn]}>
            {Number.isFinite(routeState.offRouteDistance) ? formatDistance(routeState.offRouteDistance) : "-"}
          </Text>
        </View>
        <View style={[styles.metricPill, compact && styles.metricPillCompact]}>
          <Text numberOfLines={1} style={[styles.metricLabel, compact && styles.metricLabelCompact]}>Heading</Text>
          <Text numberOfLines={1} style={[styles.metricValue, compact && styles.metricValueCompact]}>{Math.round(heading)}°</Text>
        </View>
      </View>
    </>
  );
}
