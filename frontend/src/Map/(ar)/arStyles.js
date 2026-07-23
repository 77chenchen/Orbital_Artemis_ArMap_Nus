import { StyleSheet } from "react-native";

const AR_SCREEN_Z = 2147480000;
const AR_CANVAS_Z = AR_SCREEN_Z + 1;
const AR_HUD_Z = AR_SCREEN_Z + 1000;

// React Native Web styles for the AR overlay controls.
// These are separate from domStyles because View/Text/Pressable use RN style
// objects, while video/img/canvas need plain DOM style objects.
export const styles = StyleSheet.create({
  // Full-screen AR surface that sits above the rest of the app.
  screen: {
    position: "fixed",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    width: "100vw",
    height: "100vh",
    minHeight: "100vh",
    backgroundColor: "#091513",
    overflow: "hidden",
    zIndex: AR_SCREEN_Z,
  },
  // Status and navigation controls at the top of the AR view.
  topBar: {
    position: "fixed",
    top: "max(14px, env(safe-area-inset-top))",
    left: 16,
    right: 16,
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    zIndex: AR_HUD_Z,
  },
  topBarCompact: {
    top: "max(10px, env(safe-area-inset-top))",
    left: 10,
    right: 10,
    minHeight: 44,
    gap: 7,
  },
  iconButton: {
    width: 46,
    height: 46,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(8, 18, 16, 0.82)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.18)",
  },
  iconButtonCompact: {
    width: 40,
    height: 40,
    borderRadius: 8,
  },
  iconButtonText: {
    color: "#ffffff",
    fontSize: 27,
    fontWeight: "800",
  },
  iconButtonTextCompact: {
    fontSize: 23,
    lineHeight: 26,
  },
  statusCluster: {
    flex: 1,
    minHeight: 52,
    justifyContent: "center",
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: "rgba(8, 18, 16, 0.78)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.16)",
  },
  statusClusterCompact: {
    minHeight: 42,
    paddingHorizontal: 10,
  },
  statusTitle: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "800",
  },
  statusTitleCompact: {
    fontSize: 14,
    lineHeight: 18,
  },
  statusMeta: {
    marginTop: 2,
    color: "#b7d4cb",
    fontSize: 12,
    fontWeight: "700",
  },
  statusMetaCompact: {
    fontSize: 10,
    lineHeight: 14,
  },
  // White instruction card near the bottom of the screen.
  turnCard: {
    position: "fixed",
    left: 16,
    right: 16,
    bottom: "max(92px, calc(env(safe-area-inset-bottom) + 82px))",
    maxWidth: 520,
    maxHeight: "34vh",
    alignSelf: "center",
    padding: 16,
    borderRadius: 8,
    backgroundColor: "rgba(246, 251, 248, 0.94)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.5)",
    overflow: "hidden",
    zIndex: AR_HUD_Z,
  },
  turnCardCompact: {
    left: 10,
    right: 10,
    bottom: "max(82px, calc(env(safe-area-inset-bottom) + 72px))",
    maxHeight: "32vh",
    padding: 12,
  },
  turnKicker: {
    color: "#58736c",
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  turnKickerCompact: {
    fontSize: 10,
    lineHeight: 13,
  },
  turnTitle: {
    marginTop: 4,
    color: "#10231f",
    fontSize: 25,
    fontWeight: "900",
  },
  turnTitleCompact: {
    fontSize: 19,
    lineHeight: 24,
  },
  turnMeta: {
    marginTop: 4,
    color: "#45645c",
    fontSize: 14,
    fontWeight: "800",
  },
  turnMetaCompact: {
    fontSize: 12,
    lineHeight: 16,
  },
  progressTrack: {
    marginTop: 14,
    height: 8,
    overflow: "hidden",
    borderRadius: 8,
    backgroundColor: "#d8e4df",
  },
  progressTrackCompact: {
    marginTop: 10,
    height: 6,
  },
  progressFill: {
    height: "100%",
    minWidth: 6,
    backgroundColor: "#11a87d",
  },
  // Camera button plus GPS/heading metrics.
  bottomBar: {
    position: "fixed",
    left: 16,
    right: 16,
    bottom: "max(18px, env(safe-area-inset-bottom))",
    flexDirection: "row",
    gap: 10,
    zIndex: AR_HUD_Z,
  },
  bottomBarCompact: {
    left: 10,
    right: 10,
    bottom: "max(10px, env(safe-area-inset-bottom))",
    gap: 7,
  },
  actionButton: {
    minWidth: 104,
    height: 54,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    backgroundColor: "#11a87d",
  },
  actionButtonCompact: {
    minWidth: 82,
    height: 46,
  },
  actionButtonText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "900",
  },
  actionButtonTextCompact: {
    fontSize: 12,
  },
  metricPill: {
    flex: 1,
    minWidth: 0,
    height: 54,
    justifyContent: "center",
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: "rgba(8, 18, 16, 0.82)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.16)",
  },
  metricPillCompact: {
    height: 46,
    paddingHorizontal: 9,
  },
  metricLabel: {
    color: "#92aaa3",
    fontSize: 11,
    fontWeight: "800",
  },
  metricLabelCompact: {
    fontSize: 10,
  },
  metricValue: {
    marginTop: 2,
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "900",
  },
  metricValueCompact: {
    fontSize: 14,
  },
  metricWarn: {
    color: "#ffbf69",
  },
  pressed: {
    opacity: 0.82,
  },
  // Fallback screen used when no route points exist.
  emptyState: {
    position: "fixed",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    minHeight: "100vh",
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
    padding: 24,
    backgroundColor: "#eef4f1",
    zIndex: AR_HUD_Z,
  },
  emptyTitle: {
    color: "#143431",
    fontSize: 26,
    fontWeight: "900",
  },
  emptyText: {
    maxWidth: 420,
    color: "#667a74",
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
  },
  primaryButton: {
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
    borderRadius: 8,
    backgroundColor: "#143431",
  },
  primaryButtonText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "900",
  },
});

// Plain browser styles for elements created with createElement().
export const domStyles = {
  // Static image shown only for /ar?demo=1.
  demoBackground: {
    position: "fixed",
    inset: 0,
    width: "100%",
    height: "100%",
    objectFit: "cover",
    zIndex: AR_SCREEN_Z,
  },
  // Live camera preview shown in normal AR mode.
  video: {
    position: "fixed",
    inset: 0,
    width: "100%",
    height: "100%",
    objectFit: "cover",
    backgroundColor: "#0f211d",
    zIndex: AR_SCREEN_Z,
  },
  // Transparent render target where Three.js draws arrows and route ribbons.
  canvas: {
    position: "fixed",
    inset: 0,
    width: "100%",
    height: "100%",
    touchAction: "none",
    pointerEvents: "none",
    zIndex: AR_CANVAS_Z,
  },
};
