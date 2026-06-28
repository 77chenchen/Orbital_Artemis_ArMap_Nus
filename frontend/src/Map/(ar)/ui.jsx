import { createElement, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useLocation, useNavigate } from "react-router-dom";
import * as THREE from "three";
import {
  bearingBetween,
  buildRouteModel,
  formatDistance,
  nearestProgressOnRoute,
  nextManeuver,
  routeWindow,
  toLocalMeters,
} from "./routeMath";
import { readRouteData, saveRouteData } from "./routeStorage";
const SCENE_SCALE = 0.72;
const GROUND_Y = 0;
const DEMO_ROUTE_DATA = {
  start: { label: "COM 2", coords: [103.77388, 1.29486] },
  end: { label: "Central Library", coords: [103.77234, 1.29661] },
  mode: "WALK",
  points: [
    [103.77388, 1.29486],
    [103.77374, 1.29502],
    [103.77355, 1.29522],
    [103.77331, 1.29547],
    [103.77302, 1.29573],
    [103.77272, 1.29602],
    [103.77249, 1.29633],
    [103.77234, 1.29661],
  ],
};
const DEMO_CAMERA_BACKGROUND = "/output/ar_demo/nus-virtual-camera-background.png";

export default function ARScene() {
  const location = useLocation();
  const navigate = useNavigate();
  const demoMode = useMemo(() => new URLSearchParams(location.search).get("demo") === "1", [location.search]);
  const routeData = useMemo(
    () => (demoMode ? DEMO_ROUTE_DATA : readRouteData(location.state?.routeData)),
    [demoMode, location.state],
  );
  const routeModel = useMemo(() => buildRouteModel(routeData), [routeData]);

  const canvasRef = useRef(null);
  const videoRef = useRef(null);
  const sceneRef = useRef(null);
  const routeGroupRef = useRef(null);
  const userMarkerRef = useRef(null);
  const cleanupRendererRef = useRef(null);
  const watchIdRef = useRef(null);
  const streamRef = useRef(null);

  const [cameraStatus, setCameraStatus] = useState(demoMode ? "virtual camera" : "preview");
  const [trackingStatus, setTrackingStatus] = useState(demoMode ? "Virtual GPS · Singapore" : "Waiting for GPS");
  const [userCoordinate, setUserCoordinate] = useState(routeData.start?.coords || routeModel.points[0] || null);
  const [routeState, setRouteState] = useState(() => ({
    progress: 0,
    offRouteDistance: 0,
    segmentIndex: 0,
  }));
  const [heading, setHeading] = useState(() => initialHeading(routeModel));

  const remainingDistance = Math.max(0, (routeModel.totalDistance || 0) - routeState.progress);
  const maneuver = nextManeuver(routeModel, routeState.progress);
  const maneuverDistance = maneuver ? Math.max(0, maneuver.distance - routeState.progress) : remainingDistance;
  const progressPercent = routeModel.totalDistance ? Math.min(100, (routeState.progress / routeModel.totalDistance) * 100) : 0;
  const offRoute = routeState.offRouteDistance > 35;

  useEffect(() => {
    if (!routeData?.points?.length && routeModel.points.length >= 2) {
      saveRouteData({ ...routeData, points: routeModel.points });
    }
  }, [routeData, routeModel.points]);

  useEffect(() => {
    const cleanup = setupScene({
      canvas: canvasRef.current,
      model: routeModel,
      getUserCoordinate: () => userCoordinate,
      getProgress: () => routeState.progress,
      getHeading: () => heading,
      sceneRef,
      routeGroupRef,
      userMarkerRef,
    });
    cleanupRendererRef.current = cleanup;
    return () => {
      cleanupRendererRef.current?.();
      cleanupRendererRef.current = null;
    };
  }, [routeModel]);

  useEffect(() => {
    updateRouteGroup({
      model: routeModel,
      routeGroup: routeGroupRef.current,
      userMarker: userMarkerRef.current,
      userCoordinate,
      progress: routeState.progress,
      heading,
    });
  }, [routeModel, routeState.progress, userCoordinate, heading]);

  useEffect(() => {
    if (demoMode) {
      const coordinate = DEMO_ROUTE_DATA.points[1];
      setUserCoordinate(coordinate);
      setRouteState(nearestProgressOnRoute(routeModel, coordinate));
      return undefined;
    }

    if (!navigator.geolocation || routeModel.points.length < 2) {
      setTrackingStatus("GPS unavailable");
      return undefined;
    }

    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const coordinate = [position.coords.longitude, position.coords.latitude];
        const nearest = nearestProgressOnRoute(routeModel, coordinate);
        setUserCoordinate(coordinate);
        setRouteState(nearest);
        setTrackingStatus(
          position.coords.accuracy
            ? `GPS ${Math.round(position.coords.accuracy)} m`
            : "GPS tracking",
        );
      },
      (error) => {
        setTrackingStatus(error.message || "GPS permission needed");
      },
      {
        enableHighAccuracy: true,
        maximumAge: 1000,
        timeout: 12000,
      },
    );

    return () => {
      if (watchIdRef.current != null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [demoMode, routeModel]);

  useEffect(() => {
    const onOrientation = (event) => {
      const nextHeading = Number.isFinite(event.webkitCompassHeading)
        ? event.webkitCompassHeading
        : Number.isFinite(event.alpha)
          ? 360 - event.alpha
          : null;
      if (nextHeading == null) return;
      setHeading((current) => smoothHeading(current, nextHeading));
    };

    window.addEventListener("deviceorientationabsolute", onOrientation, true);
    window.addEventListener("deviceorientation", onOrientation, true);
    return () => {
      window.removeEventListener("deviceorientationabsolute", onOrientation, true);
      window.removeEventListener("deviceorientation", onOrientation, true);
    };
  }, []);

  useEffect(() => {
    return () => {
      stopCamera(streamRef, videoRef);
    };
  }, []);

  async function startCamera() {
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraStatus("camera unavailable");
      return;
    }

    try {
      setCameraStatus("starting camera");
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraStatus(window.XR8 ? "8th Wall ready" : "camera overlay");
    } catch (error) {
      setCameraStatus(error?.message || "camera permission needed");
    }
  }

  function calibrateHeading() {
    const index = Math.min(routeState.segmentIndex || 0, Math.max(0, routeModel.points.length - 2));
    const nextHeading = bearingBetween(routeModel.points[index], routeModel.points[index + 1]);
    setHeading(nextHeading);
  }

  if (routeModel.points.length < 2) {
    return (
      <View style={styles.emptyState}>
        <Text style={styles.emptyTitle}>No route loaded</Text>
        <Text style={styles.emptyText}>Create a route on the map first, then open AR guidance.</Text>
        <Pressable onPress={() => navigate("/map")} style={styles.primaryButton}>
          <Text style={styles.primaryButtonText}>Back to map</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      {demoMode
        ? createElement("img", {
            src: DEMO_CAMERA_BACKGROUND,
            alt: "Synthetic NUS campus camera preview",
            style: domStyles.demoBackground,
          })
        : null}
      {!demoMode
        ? createElement("video", {
            ref: videoRef,
            muted: true,
            playsInline: true,
            style: domStyles.video,
          })
        : null}
      {createElement("canvas", {
        ref: canvasRef,
        style: domStyles.canvas,
      })}

      <View style={styles.topBar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back to map"
          onPress={() => navigate("/map")}
          style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
        >
          <Text style={styles.iconButtonText}>‹</Text>
        </Pressable>
        <View style={styles.statusCluster}>
          <Text style={styles.statusTitle}>{offRoute ? "Off route" : "AR Guidance"}</Text>
          <Text style={styles.statusMeta}>{trackingStatus} · {cameraStatus}</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Calibrate heading"
          onPress={calibrateHeading}
          style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
        >
          <Text style={styles.iconButtonText}>⌖</Text>
        </Pressable>
      </View>

      <View style={styles.turnCard}>
        <Text style={styles.turnKicker}>Next</Text>
        <Text style={styles.turnTitle}>{maneuver?.text || "Continue"}</Text>
        <Text style={styles.turnMeta}>
          {formatDistance(maneuverDistance)} · {formatDistance(remainingDistance)} left
        </Text>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progressPercent}%` }]} />
        </View>
      </View>

      <View style={styles.bottomBar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Start camera"
          onPress={startCamera}
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
    </View>
  );
}

function setupScene({
  canvas,
  model,
  getUserCoordinate,
  getProgress,
  getHeading,
  sceneRef,
  routeGroupRef,
  userMarkerRef,
}) {
  if (!canvas) return () => {};

  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x10231f, 70, 260);
  const camera = new THREE.PerspectiveCamera(58, 1, 0.1, 900);
  camera.position.set(0, 1.7, 4.2);
  camera.lookAt(0, 0, -9);

  const hemisphere = new THREE.HemisphereLight(0xe8fff7, 0x1f3f35, 2.4);
  const sun = new THREE.DirectionalLight(0xffffff, 1.6);
  sun.position.set(4, 8, 5);
  scene.add(hemisphere, sun);

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(260, 260, 20, 20),
    new THREE.MeshBasicMaterial({ color: 0x143431, transparent: true, opacity: 0.18, wireframe: true }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = GROUND_Y - 0.018;
  scene.add(ground);

  const routeGroup = new THREE.Group();
  const userMarker = new THREE.Mesh(
    new THREE.RingGeometry(0.32, 0.42, 32),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.95, side: THREE.DoubleSide }),
  );
  userMarker.rotation.x = -Math.PI / 2;
  userMarker.position.set(0, GROUND_Y + 0.06, 0);
  scene.add(routeGroup, userMarker);

  sceneRef.current = scene;
  routeGroupRef.current = routeGroup;
  userMarkerRef.current = userMarker;

  const resize = () => {
    const rect = canvas.getBoundingClientRect();
    const width = Math.max(1, Math.floor(rect.width));
    const height = Math.max(1, Math.floor(rect.height));
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  };

  let frameId = 0;
  const render = () => {
    resize();
    updateRouteGroup({
      model,
      routeGroup,
      userMarker,
      userCoordinate: getUserCoordinate(),
      progress: getProgress(),
      heading: getHeading(),
    });
    renderer.render(scene, camera);
    frameId = window.requestAnimationFrame(render);
  };
  render();

  window.addEventListener("resize", resize);
  return () => {
    window.cancelAnimationFrame(frameId);
    window.removeEventListener("resize", resize);
    disposeGroup(routeGroup);
    ground.geometry.dispose();
    ground.material.dispose();
    userMarker.geometry.dispose();
    userMarker.material.dispose();
    renderer.dispose();
    sceneRef.current = null;
    routeGroupRef.current = null;
    userMarkerRef.current = null;
  };
}

function updateRouteGroup({ model, routeGroup, userMarker, userCoordinate, progress, heading }) {
  if (!model?.points?.length || !routeGroup) return;

  const origin = userCoordinate || model.origin || model.points[0];
  const visiblePoints = routeWindow(model, progress, 22, 210);
  const localPoints = visiblePoints.map((point) => {
    const local = toLocalMeters(point, origin);
    return new THREE.Vector3(local.x * SCENE_SCALE, GROUND_Y + 0.045, -local.z * SCENE_SCALE);
  });

  disposeGroup(routeGroup);
  routeGroup.clear();

  if (localPoints.length >= 2) {
    const routeCurve = new THREE.CatmullRomCurve3(localPoints, false, "centripetal");
    const routeRibbon = new THREE.Mesh(
      new THREE.TubeGeometry(routeCurve, Math.max(24, localPoints.length * 5), 0.085, 8, false),
      new THREE.MeshBasicMaterial({ color: 0x35f6bd, transparent: true, opacity: 0.92 }),
    );
    const line = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(localPoints),
      new THREE.LineBasicMaterial({ color: 0x35f6bd, linewidth: 4, transparent: true, opacity: 0.98 }),
    );
    routeGroup.add(routeRibbon, line);

    for (let index = 1; index < localPoints.length; index += Math.max(2, Math.floor(localPoints.length / 8))) {
      const current = localPoints[index];
      const previous = localPoints[index - 1];
      const direction = current.clone().sub(previous);
      if (direction.length() < 0.1) continue;
      direction.normalize();
      const arrow = new THREE.ArrowHelper(direction, previous.clone().lerp(current, 0.58), 1.8, 0xffffff, 0.55, 0.34);
      routeGroup.add(arrow);
    }
  }

  if (userMarker) {
    userMarker.visible = Boolean(userCoordinate);
  }

  routeGroup.rotation.y = (Number(heading) * Math.PI) / 180;
}

function disposeGroup(group) {
  if (!group) return;
  group.traverse((child) => {
    child.geometry?.dispose?.();
    if (Array.isArray(child.material)) {
      child.material.forEach((material) => material.dispose?.());
    } else {
      child.material?.dispose?.();
    }
  });
}

function initialHeading(model) {
  if (!model?.points || model.points.length < 2) return 0;
  return bearingBetween(model.points[0], model.points[1]);
}

function smoothHeading(current, next) {
  const delta = ((next - current + 540) % 360) - 180;
  return (current + delta * 0.18 + 360) % 360;
}

function stopCamera(streamRef, videoRef) {
  const stream = streamRef.current;
  if (stream) {
    stream.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }
  if (videoRef.current) {
    videoRef.current.srcObject = null;
  }
}

const styles = StyleSheet.create({
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
    zIndex: 10000,
  },
  topBar: {
    position: "fixed",
    top: 14,
    left: 16,
    right: 16,
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    zIndex: 10030,
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
  iconButtonText: {
    color: "#ffffff",
    fontSize: 27,
    fontWeight: "800",
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
  statusTitle: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "800",
  },
  statusMeta: {
    marginTop: 2,
    color: "#b7d4cb",
    fontSize: 12,
    fontWeight: "700",
  },
  turnCard: {
    position: "fixed",
    left: 16,
    right: 16,
    bottom: 92,
    maxWidth: 520,
    maxHeight: "34vh",
    alignSelf: "center",
    padding: 16,
    borderRadius: 8,
    backgroundColor: "rgba(246, 251, 248, 0.94)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.5)",
    overflow: "hidden",
    zIndex: 10020,
  },
  turnKicker: {
    color: "#58736c",
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  turnTitle: {
    marginTop: 4,
    color: "#10231f",
    fontSize: 25,
    fontWeight: "900",
  },
  turnMeta: {
    marginTop: 4,
    color: "#45645c",
    fontSize: 14,
    fontWeight: "800",
  },
  progressTrack: {
    marginTop: 14,
    height: 8,
    overflow: "hidden",
    borderRadius: 8,
    backgroundColor: "#d8e4df",
  },
  progressFill: {
    height: "100%",
    minWidth: 6,
    backgroundColor: "#11a87d",
  },
  bottomBar: {
    position: "fixed",
    left: 16,
    right: 16,
    bottom: 18,
    flexDirection: "row",
    gap: 10,
    zIndex: 10030,
  },
  actionButton: {
    minWidth: 104,
    height: 54,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    backgroundColor: "#11a87d",
  },
  actionButtonText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "900",
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
  metricLabel: {
    color: "#92aaa3",
    fontSize: 11,
    fontWeight: "800",
  },
  metricValue: {
    marginTop: 2,
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "900",
  },
  metricWarn: {
    color: "#ffbf69",
  },
  pressed: {
    opacity: 0.82,
  },
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
    zIndex: 10000,
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

const domStyles = {
  demoBackground: {
    position: "fixed",
    inset: 0,
    width: "100%",
    height: "100%",
    objectFit: "cover",
  },
  video: {
    position: "fixed",
    inset: 0,
    width: "100%",
    height: "100%",
    objectFit: "cover",
    backgroundColor: "#0f211d",
    zIndex: 10000,
  },
  canvas: {
    position: "fixed",
    inset: 0,
    width: "100%",
    height: "100%",
    touchAction: "none",
    pointerEvents: "none",
    zIndex: 10010,
  },
};
