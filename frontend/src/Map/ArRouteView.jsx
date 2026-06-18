import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import * as THREE from "three";

const XR8_SCRIPT_BASE = "https://apps.8thwall.com/xrweb";
const AR_ARROW_SPACING = 0.78;
const AR_ROUTE_MAX_EXTENT = 5.8;
const AR_GROUND_Y = -0.18;
const AR_LOOKAHEAD_METERS = 85;
const AR_METERS_TO_WORLD = 0.08;
const AR_MIN_POINT_SPACING_METERS = 2.5;
const AR_TURN_THRESHOLD_DEGREES = 32;
const AR_ARRIVAL_THRESHOLD_METERS = 18;
const GPS_OFF_ROUTE_METERS = 35;
const GPS_MAX_ACCEPTED_ACCURACY_METERS = 120;
const GPS_REROUTE_COOLDOWN_MS = 15000;
const GPS_INITIAL_ROUTE_COOLDOWN_MS = 3000;
const FORWARD_VECTOR = new THREE.Vector3(0, 0, 1);
const UP_VECTOR = new THREE.Vector3(0, 1, 0);

export default function ArRouteView({ routeResult, startPlace, endPlace, onRequestRoute, onClose }) {
  const canvasRef = useRef(null);
  const videoRef = useRef(null);
  const sessionRef = useRef(null);
  const gpsWatchRef = useRef(null);
  const smoothedPositionRef = useRef(null);
  const routeRequestRef = useRef({ inFlight: false, lastAt: 0 });
  const [runtimeState, setRuntimeState] = useState("idle");
  const [runtimeMessage, setRuntimeMessage] = useState("Ready to initialize Three.js AR.");
  const [cameraPreviewActive, setCameraPreviewActive] = useState(false);
  const [currentPosition, setCurrentPosition] = useState(null);
  const [gpsState, setGpsState] = useState({ status: "idle", message: "GPS idle." });
  const [routeRefreshState, setRouteRefreshState] = useState({ status: "idle", message: "" });
  const [xr8Available, setXr8Available] = useState(() => hasXr8Runtime());
  const routePoints = useMemo(() => extractRoutePoints(routeResult), [routeResult]);
  const routeModel = useMemo(() => buildRouteModel(routePoints, currentPosition, gpsState.heading), [currentPosition, gpsState.heading, routePoints]);
  const canUseXr8 = xr8Available && isMobileArBrowser();
  const primaryInstruction = navigationInstructionText(routeModel, gpsState, endPlace);
  const routeProgressPercent = Math.round((routeModel.progressRatio || 0) * 100);

  useEffect(() => {
    if (hasXr8Runtime()) {
      setXr8Available(true);
      return undefined;
    }

    const appKey = import.meta.env.VITE_8TH_WALL_APP_KEY;
    if (!appKey) {
      setRuntimeMessage("8th Wall runtime not loaded. Local Three.js preview is available.");
      return undefined;
    }

    let cancelled = false;
    const script = document.createElement("script");
    script.async = true;
    script.src = `${XR8_SCRIPT_BASE}?appKey=${encodeURIComponent(appKey)}`;
    script.onload = () => {
      if (!cancelled) {
        setXr8Available(hasXr8Runtime());
        setRuntimeMessage(hasXr8Runtime() ? "8th Wall runtime loaded." : "8th Wall script loaded without XR8.");
      }
    };
    script.onerror = () => {
      if (!cancelled) setRuntimeMessage("8th Wall runtime failed to load. Using Three.js preview.");
    };
    document.head.appendChild(script);

    return () => {
      cancelled = true;
      script.remove();
    };
  }, []);

  useEffect(
    () => () => {
      stopGpsTracking(gpsWatchRef.current);
      stopSession(sessionRef.current);
      stopCameraPreview(videoRef.current);
      gpsWatchRef.current = null;
      sessionRef.current = null;
      smoothedPositionRef.current = null;
    },
    [],
  );

  useEffect(() => {
    if (runtimeState !== "running") return;
    sessionRef.current?.updateRoute?.(routeModel.points, { startPlace, endPlace });
  }, [endPlace, routeModel.points, runtimeState, startPlace]);

  useEffect(() => {
    if (runtimeState !== "running" || gpsState.status !== "tracking" || !currentPosition || !onRequestRoute) return;
    if (!endPlace?.coords) return;

    const missingRoute = routeModel.source === "empty" || routePoints.length < 2;
    const needsReroute = routeModel.offRoute;
    if (!missingRoute && !needsReroute) return;

    const now = Date.now();
    const cooldown = missingRoute ? GPS_INITIAL_ROUTE_COOLDOWN_MS : GPS_REROUTE_COOLDOWN_MS;
    if (routeRequestRef.current.inFlight || now - routeRequestRef.current.lastAt < cooldown) return;

    routeRequestRef.current = { inFlight: true, lastAt: now };
    const reason = missingRoute ? "initial" : "off-route";
    setRouteRefreshState({ status: "loading", message: reason === "off-route" ? "Re-routing from GPS..." : "Calculating route from GPS..." });

    Promise.resolve(onRequestRoute(currentPosition, { reason, distanceToRouteMeters: routeModel.distanceToRouteMeters }))
      .then(() => {
        routeRequestRef.current.inFlight = false;
        setRouteRefreshState({ status: "ready", message: reason === "off-route" ? "Route refreshed after drift." : "Route calculated from GPS." });
      })
      .catch((err) => {
        routeRequestRef.current.inFlight = false;
        setRouteRefreshState({
          status: "error",
          message: err instanceof Error ? err.message : "Route refresh failed.",
        });
      });
  }, [currentPosition, endPlace, gpsState.status, onRequestRoute, routeModel.distanceToRouteMeters, routeModel.offRoute, routeModel.source, routePoints.length, runtimeState]);

  const startGpsTracking = useCallback(() => {
    if (gpsWatchRef.current || typeof navigator === "undefined") return;
    if (!navigator.geolocation) {
      setGpsState({ status: "error", message: "GPS is not supported in this browser." });
      return;
    }

    setGpsState({ status: "locating", message: "GPS locating..." });
    gpsWatchRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const rawPosition = [position.coords.longitude, position.coords.latitude];
        const previousPosition = smoothedPositionRef.current;
        const nextPosition = smoothGpsPosition(previousPosition, rawPosition, position.coords.accuracy);
        const heading = normalizeHeading(position.coords.heading) ?? bearingDegrees(previousPosition, nextPosition);
        smoothedPositionRef.current = nextPosition;
        setGpsState({
          status: position.coords.accuracy > GPS_MAX_ACCEPTED_ACCURACY_METERS ? "weak" : "tracking",
          accuracy: position.coords.accuracy,
          heading,
          speed: position.coords.speed,
          updatedAt: Date.now(),
          message: position.coords.accuracy > GPS_MAX_ACCEPTED_ACCURACY_METERS ? "GPS signal is weak." : "GPS tracking.",
        });
        setCurrentPosition(nextPosition);
      },
      (err) => {
        setGpsState({ status: "error", message: err.message || "GPS location failed." });
      },
      {
        enableHighAccuracy: true,
        maximumAge: 1000,
        timeout: 12000,
      },
    );
  }, []);

  const startAr = useCallback(async () => {
    if (!canvasRef.current || runtimeState === "running" || runtimeState === "starting") return;

    setRuntimeState("starting");
    setRuntimeMessage("Requesting camera and preparing AR scene...");

    try {
      const stream = await requestCamera();
      startGpsTracking();
      if (!canUseXr8) {
        await playCameraPreview(videoRef.current, stream);
        setCameraPreviewActive(true);
      }
      const session = canUseXr8
        ? await startXr8Session(canvasRef.current, routeModel.points, { startPlace, endPlace })
        : startThreePreview(canvasRef.current, routeModel.points, { startPlace, endPlace });
      sessionRef.current = { ...session, stream };
      setRuntimeState("running");
      setRuntimeMessage(canUseXr8 ? "8th Wall camera pipeline is running." : "Camera preview is running with Three.js route arrows.");
    } catch (err) {
      setRuntimeState("error");
      setRuntimeMessage(err instanceof Error ? err.message : "AR session failed to start.");
    }
  }, [canUseXr8, endPlace, routeModel.points, runtimeState, startGpsTracking, startPlace]);

  const stopAr = useCallback(() => {
    stopGpsTracking(gpsWatchRef.current);
    stopSession(sessionRef.current);
    gpsWatchRef.current = null;
    sessionRef.current = null;
    stopCameraPreview(videoRef.current);
    setCameraPreviewActive(false);
    setCurrentPosition(null);
    smoothedPositionRef.current = null;
    routeRequestRef.current = { inFlight: false, lastAt: 0 };
    setGpsState({ status: "idle", message: "GPS idle." });
    setRouteRefreshState({ status: "idle", message: "" });
    setRuntimeState("idle");
    setRuntimeMessage("AR session stopped.");
  }, []);

  return (
    <View testID="atlas-ar-overlay" style={styles.overlay}>
      <video
        ref={videoRef}
        data-testid="atlas-ar-camera"
        autoPlay
        muted
        playsInline
        style={{ ...cameraElementStyle, opacity: cameraPreviewActive ? 1 : 0 }}
      />
      <canvas ref={canvasRef} data-testid="atlas-ar-canvas" style={canvasElementStyle} />
      <View style={styles.topBar}>
        <View style={styles.titleBlock}>
          <Text style={styles.kicker}>Atlas AR</Text>
          <Text style={styles.title}>Live Route Guidance</Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Close AR route view" onPress={onClose} style={styles.iconButton}>
          <Text style={styles.iconText}>x</Text>
        </Pressable>
      </View>

      <View style={styles.guidanceCard}>
        <View style={styles.instructionRow}>
          <View style={[styles.turnGlyph, routeModel.offRoute && styles.turnGlyphWarning]}>
            <Text style={styles.turnGlyphText}>{routeModel.offRoute ? "!" : turnGlyph(routeModel.nextStep?.direction)}</Text>
          </View>
          <View style={styles.instructionTextBlock}>
            <Text style={styles.guidanceKicker}>{routeModel.offRoute ? "Route drift" : "Next guidance"}</Text>
            <Text style={styles.guidanceTitle}>{primaryInstruction}</Text>
          </View>
        </View>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${routeProgressPercent}%` }]} />
        </View>
        <View style={styles.metricGrid}>
          <Metric label="Remaining" value={formatMeters(routeModel.remainingMeters)} />
          <Metric label="Next turn" value={formatMeters(routeModel.nextStep?.distanceMeters)} />
          <Metric label="Accuracy" value={formatAccuracy(gpsState.accuracy)} />
        </View>
      </View>

      <View style={styles.reticleWrap} pointerEvents="none">
        <View style={styles.reticleRing}>
          <View style={styles.reticleDot} />
        </View>
        <Text style={styles.reticleText}>
          {routeModel.hasGps ? `${routeProgressPercent}%` : "Preview"}
        </Text>
      </View>

      <View style={styles.statusPanel}>
        <View style={styles.statusRow}>
          <Text style={[styles.badge, xr8Available ? styles.badgeReady : styles.badgePreview]}>
            {canUseXr8 ? "XR8 ready" : xr8Available ? "Desktop preview" : "Preview"}
          </Text>
          <Text style={[styles.badge, runtimeState === "running" ? styles.badgeReady : styles.badgeIdle]}>
            {runtimeState}
          </Text>
        </View>
        <Text style={styles.statusText}>{runtimeMessage}</Text>
        <Text style={styles.routeText}>
          {routeSummaryText(routeModel, endPlace)}
        </Text>
        <Text style={[styles.gpsText, routeModel.offRoute && styles.gpsWarning]}>
          {navigationStatusText(routeModel, gpsState)}
        </Text>
        <View style={styles.routeMetaRow}>
          <Text style={styles.routeMetaText}>{routeModel.source === "gps" ? "GPS aligned" : routeModel.source === "route" ? "Route preview" : "No route"}</Text>
          <Text style={styles.routeMetaText}>{routeModel.pointCount || 0} pts</Text>
          <Text style={styles.routeMetaText}>{routeModel.arrowCount || 0} arrows</Text>
        </View>
        {routeRefreshState.message ? (
          <Text style={[styles.routeRefreshText, routeRefreshState.status === "error" && styles.gpsWarning]}>
            {routeRefreshState.message}
          </Text>
        ) : null}
        <View style={styles.actions}>
          {runtimeState === "running" ? (
            <Pressable accessibilityRole="button" onPress={stopAr} style={({ pressed }) => [styles.actionButton, styles.stopButton, pressed && styles.pressed]}>
              <Text style={styles.actionText}>Stop AR</Text>
            </Pressable>
          ) : (
            <Pressable accessibilityRole="button" onPress={startAr} style={({ pressed }) => [styles.actionButton, pressed && styles.pressed]}>
              <Text style={styles.actionText}>Start AR</Text>
            </Pressable>
          )}
        </View>
      </View>
    </View>
  );
}

function Metric({ label, value }) {
  return (
    <View style={styles.metricItem}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value || "-"}</Text>
    </View>
  );
}

function hasXr8Runtime() {
  return typeof window !== "undefined" && Boolean(window.XR8?.addCameraPipelineModules && window.XR8?.run);
}

function isMobileArBrowser() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  const mobileSignal = /Android|iPhone|iPad|iPod/i.test(ua);
  const coarsePointer = typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)")?.matches;
  return mobileSignal && coarsePointer;
}

async function requestCamera() {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("Camera access is not available in this browser.");
  }
  return navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
}

async function playCameraPreview(video, stream) {
  if (!video) throw new Error("Camera preview surface is not available.");
  video.srcObject = stream;
  await video.play();
}

function stopCameraPreview(video) {
  if (!video) return;
  video.pause?.();
  video.srcObject = null;
}

function stopGpsTracking(watchId) {
  if (watchId !== null && watchId !== undefined && navigator.geolocation) {
    navigator.geolocation.clearWatch(watchId);
  }
}

async function startXr8Session(canvas, localPoints, places) {
  const xr8 = window.XR8;
  window.THREE = THREE;
  const routePipeline = createRoutePipelineModule(localPoints, places);

  const pipelineModules = [
    window.XRExtras?.Loading?.pipelineModule?.(),
    window.XRExtras?.RuntimeError?.pipelineModule?.(),
    xr8.GlTextureRenderer?.pipelineModule?.(),
    xr8.Threejs?.pipelineModule?.(),
    xr8.XrController?.pipelineModule?.(),
    routePipeline,
  ].filter(Boolean);

  xr8.addCameraPipelineModules(pipelineModules);
  xr8.run({ canvas });

  return {
    updateRoute(nextLocalPoints, nextPlaces) {
      routePipeline.updateRoute(nextLocalPoints, nextPlaces);
    },
    stop() {
      xr8.stop?.();
    },
  };
}

function createRoutePipelineModule(localPoints, places) {
  let routeScene = null;
  let xrSceneObject = null;
  let latestPoints = localPoints;
  let latestPlaces = places;

  return {
    name: "atlas-three-route-foundation",
    onStart() {
      const xrScene = window.XR8.Threejs.xrScene();
      xrSceneObject = xrScene.scene;
      routeScene = addRouteScene(xrSceneObject, latestPoints, latestPlaces);
      xrScene.camera.position.set(0, 1.6, 0);
    },
    onUpdate() {
      routeScene?.update?.(performance.now() / 1000);
    },
    updateRoute(nextLocalPoints, nextPlaces = latestPlaces) {
      latestPoints = nextLocalPoints;
      latestPlaces = nextPlaces;
      if (routeScene && xrSceneObject) {
        routeScene.cleanup();
        routeScene = addRouteScene(xrSceneObject, latestPoints, latestPlaces);
      }
    },
    onDetach() {
      routeScene?.cleanup?.();
    },
  };
}

function startThreePreview(canvas, localPoints, places) {
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 0);
  const scene = new THREE.Scene();
  scene.background = null;
  const camera = new THREE.PerspectiveCamera(62, 1, 0.01, 200);
  camera.position.set(0, 2.4, 5.2);
  camera.lookAt(0, 0.7, 0);
  let routeScene = addRouteScene(scene, localPoints, places);

  let frameId = 0;
  const resize = () => {
    const rect = canvas.getBoundingClientRect();
    const width = Math.max(1, rect.width || canvas.parentElement?.clientWidth || window.innerWidth);
    const height = Math.max(1, rect.height || canvas.parentElement?.clientHeight || window.innerHeight);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  };

  const render = () => {
    resize();
    routeScene.update(performance.now() / 1000);
    renderer.render(scene, camera);
    frameId = window.requestAnimationFrame(render);
  };

  render();

  return {
    updateRoute(nextLocalPoints, nextPlaces = places) {
      routeScene.cleanup();
      routeScene = addRouteScene(scene, nextLocalPoints, nextPlaces);
    },
    stop() {
      window.cancelAnimationFrame(frameId);
      routeScene.cleanup();
      renderer.dispose();
    },
  };
}

function addRouteScene(scene, localPoints, places) {
  const group = new THREE.Group();
  group.name = "atlas-ar-route";
  const renderablePoints = Array.isArray(localPoints) ? localPoints.filter(Boolean) : [];

  const ambient = new THREE.HemisphereLight(0xffffff, 0x355f55, 1.5);
  const directional = new THREE.DirectionalLight(0xffffff, 1.8);
  directional.position.set(2, 4, 3);
  group.add(ambient, directional);

  const routeMaterial = new THREE.MeshStandardMaterial({
    color: 0x1d7a6b,
    roughness: 0.38,
    metalness: 0.12,
    transparent: true,
    opacity: 0.74,
  });
  const arrowMaterial = new THREE.MeshStandardMaterial({ color: 0xffb84d, roughness: 0.32, metalness: 0.18 });
  const arrowGlowMaterial = new THREE.MeshBasicMaterial({
    color: 0xfff1b8,
    transparent: true,
    opacity: 0.32,
    depthWrite: false,
  });
  const anchorMaterial = new THREE.MeshStandardMaterial({ color: 0x2f6bff, roughness: 0.42 });
  const arrowMarkers = [];

  for (let index = 0; index < renderablePoints.length - 1; index += 1) {
    addRouteSegment(group, renderablePoints[index], renderablePoints[index + 1], routeMaterial);
    arrowMarkers.push(...addDirectionalArrows(group, renderablePoints[index], renderablePoints[index + 1], arrowMaterial, arrowGlowMaterial));
  }

  if (renderablePoints.length >= 2) {
    addAnchor(group, renderablePoints[0], anchorMaterial, places.startPlace?.label || "Start");
    addAnchor(group, renderablePoints[renderablePoints.length - 1], anchorMaterial, places.endPlace?.label || "Target");
  }

  scene.add(group);

  return {
    arrowCount: arrowMarkers.length,
    update(time = 0) {
      arrowMarkers.forEach((marker, index) => {
        const pulse = Math.sin(time * 3.2 + index * 0.72) * 0.5 + 0.5;
        marker.position.y = AR_GROUND_Y + 0.16 + pulse * 0.055;
        marker.scale.setScalar(0.92 + pulse * 0.1);
      });
    },
    cleanup() {
      scene.remove(group);
      group.traverse((object) => {
        object.geometry?.dispose?.();
        if (Array.isArray(object.material)) object.material.forEach((item) => item.dispose?.());
        else object.material?.dispose?.();
      });
    },
  };
}

function addRouteSegment(group, start, end, material) {
  const midpoint = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
  const direction = new THREE.Vector3().subVectors(end, start);
  const length = Math.max(direction.length(), 0.001);
  const geometry = new THREE.CylinderGeometry(0.035, 0.035, length, 12);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.copy(midpoint);
  mesh.position.y = AR_GROUND_Y + 0.035;
  mesh.quaternion.setFromUnitVectors(UP_VECTOR, direction.normalize());
  group.add(mesh);
}

function addDirectionalArrows(group, start, end, material, glowMaterial) {
  const segment = new THREE.Vector3().subVectors(end, start);
  const length = segment.length();
  if (length < 0.2) return [];

  const direction = segment.clone().normalize();
  const arrowCount = Math.max(1, Math.floor(length / AR_ARROW_SPACING));
  const arrows = [];

  for (let index = 0; index < arrowCount; index += 1) {
    const t = (index + 1) / (arrowCount + 1);
    const position = new THREE.Vector3().lerpVectors(start, end, t);
    const arrow = createArrowMarker(material, glowMaterial);
    arrow.position.set(position.x, AR_GROUND_Y + 0.16, position.z);
    arrow.quaternion.setFromUnitVectors(FORWARD_VECTOR, direction);
    group.add(arrow);
    arrows.push(arrow);
  }

  return arrows;
}

function createArrowMarker(material, glowMaterial) {
  const marker = new THREE.Group();
  marker.name = "atlas-ar-direction-arrow";

  const shaft = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.08, 0.34), material);
  shaft.position.z = -0.06;
  const head = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.34, 24), material);
  head.rotation.x = Math.PI / 2;
  head.position.z = 0.22;
  const glow = new THREE.Mesh(new THREE.RingGeometry(0.2, 0.31, 32), glowMaterial);
  glow.rotation.x = -Math.PI / 2;
  glow.position.y = -0.055;

  marker.add(glow, shaft, head);
  return marker;
}

function addAnchor(group, point, material) {
  const base = new THREE.Mesh(new THREE.SphereGeometry(0.14, 24, 16), material);
  base.position.copy(point);
  base.position.y = AR_GROUND_Y + 0.12;
  group.add(base);
}

function extractRoutePoints(routeResult) {
  const segmentPoints = (routeResult?.segments || []).flatMap((segment) => segment.coordinates || []);
  const directPoints = routeResult?.points || [];
  return normalizeLngLatPoints(segmentPoints.length >= 2 ? segmentPoints : directPoints);
}

function buildRouteModel(routePoints, currentPosition, headingDegrees) {
  const sourcePoints = routePoints.length >= 2 ? simplifyLngLatRoute(normalizeLngLatPoints(routePoints), AR_MIN_POINT_SPACING_METERS) : [];
  if (sourcePoints.length >= 2 && currentPosition) {
    return buildGpsRouteModel(sourcePoints, currentPosition, headingDegrees);
  }

  const localPoints = sourcePoints.length >= 2 ? projectRoutePoints(sourcePoints) : [];
  const totalMeters = sourcePoints.length >= 2 ? lngLatRouteLength(sourcePoints) : 0;
  const previewStep = sourcePoints.length >= 2 ? nextStepFromPolyline(sourcePoints.map((point) => lngLatToMeters(point, sourcePoints[0]))) : null;
  return {
    points: localPoints,
    arrowCount: countRouteArrows(localPoints),
    source: sourcePoints.length >= 2 ? "route" : "empty",
    hasGps: false,
    pointCount: sourcePoints.length,
    remainingMeters: totalMeters,
    progressRatio: 0,
    nextStep: previewStep,
  };
}

function normalizeLngLatPoints(points) {
  return points
    .map((point) => {
      if (!Array.isArray(point) || point.length < 2) return null;
      const lng = Number(point[0]);
      const lat = Number(point[1]);
      if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null;
      return [lng, lat];
    })
    .filter(Boolean);
}

function simplifyLngLatRoute(points, minSpacingMeters) {
  if (points.length <= 2) return points;
  const result = [points[0]];
  let lastKept = points[0];

  for (let index = 1; index < points.length - 1; index += 1) {
    const point = points[index];
    if (haversineDistanceMeters(lastKept, point) >= minSpacingMeters) {
      result.push(point);
      lastKept = point;
    }
  }

  const end = points[points.length - 1];
  const previous = result[result.length - 1];
  if (!previous || haversineDistanceMeters(previous, end) > 0.2) {
    result.push(end);
  }

  return result.length >= 2 ? result : points.slice(0, 2);
}

function projectRoutePoints(points) {
  const origin = points[0];
  const metersPerLat = 111320;
  const metersPerLng = 111320 * Math.cos((origin[1] * Math.PI) / 180);

  const projected = points.map(([lng, lat]) => new THREE.Vector3((lng - origin[0]) * metersPerLng, 0, -(lat - origin[1]) * metersPerLat));
  const bounds = projected.reduce(
    (acc, point) => ({
      minX: Math.min(acc.minX, point.x),
      maxX: Math.max(acc.maxX, point.x),
      minZ: Math.min(acc.minZ, point.z),
      maxZ: Math.max(acc.maxZ, point.z),
    }),
    { minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity },
  );
  const extent = Math.max(bounds.maxX - bounds.minX, bounds.maxZ - bounds.minZ, 1);
  const scale = Math.min(0.045, AR_ROUTE_MAX_EXTENT / extent);
  const center = new THREE.Vector3((bounds.minX + bounds.maxX) / 2, 0, (bounds.minZ + bounds.maxZ) / 2);

  return projected.map((point) => point.sub(center).multiplyScalar(scale));
}

function buildGpsRouteModel(points, currentPosition, headingDegrees) {
  const routeMeters = simplifyMeterPolyline(points.map((point) => lngLatToMeters(point, currentPosition)), AR_MIN_POINT_SPACING_METERS);
  const userMeters = new THREE.Vector3(0, 0, 0);
  const snap = closestPointOnPolyline(routeMeters, userMeters);
  const forwardMeters = buildForwardMeterPath(routeMeters, snap);
  const nextStep = nextStepFromPolyline(forwardMeters);
  const headingAlignedMeters = orientMetersForHeading(forwardMeters, headingDegrees);
  const localPoints = headingAlignedMeters.map((point) => point.clone().multiplyScalar(AR_METERS_TO_WORLD));
  const renderPoints = localPoints.length >= 2 ? localPoints : [];
  const distanceToRouteMeters = snap.distance;

  return {
    points: renderPoints,
    arrowCount: countRouteArrows(renderPoints),
    source: "gps",
    hasGps: true,
    distanceToRouteMeters,
    remainingMeters: snap.remainingMeters,
    progressRatio: snap.progressRatio,
    pointCount: points.length,
    nextStep,
    offRoute: distanceToRouteMeters > GPS_OFF_ROUTE_METERS,
    headingDegrees,
  };
}

function smoothGpsPosition(previous, next, accuracy) {
  if (!previous) return next;
  const distance = haversineDistanceMeters(previous, next);
  if (distance < 0.8) return previous;
  const noisy = Number.isFinite(accuracy) && accuracy > 35;
  const alpha = distance > 25 ? 0.72 : noisy ? 0.24 : 0.45;
  return [
    previous[0] + (next[0] - previous[0]) * alpha,
    previous[1] + (next[1] - previous[1]) * alpha,
  ];
}

function normalizeHeading(value) {
  const heading = Number(value);
  if (!Number.isFinite(heading)) return null;
  return ((heading % 360) + 360) % 360;
}

function bearingDegrees(from, to) {
  if (!from || !to || haversineDistanceMeters(from, to) < 1.2) return null;
  const fromLat = degreesToRadians(from[1]);
  const toLat = degreesToRadians(to[1]);
  const deltaLng = degreesToRadians(to[0] - from[0]);
  const y = Math.sin(deltaLng) * Math.cos(toLat);
  const x = Math.cos(fromLat) * Math.sin(toLat) - Math.sin(fromLat) * Math.cos(toLat) * Math.cos(deltaLng);
  return normalizeHeading((Math.atan2(y, x) * 180) / Math.PI);
}

function orientMetersForHeading(points, headingDegrees) {
  const heading = normalizeHeading(headingDegrees);
  if (heading === null) return points.map((point) => point.clone());
  const radians = degreesToRadians(heading);
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);

  return points.map((point) => {
    const east = point.x;
    const north = -point.z;
    const right = east * cos - north * sin;
    const forward = east * sin + north * cos;
    return new THREE.Vector3(right, 0, -forward);
  });
}

function simplifyMeterPolyline(points, minSpacingMeters) {
  if (points.length <= 2) return points.map((point) => point.clone());
  const result = [points[0].clone()];
  let lastKept = points[0];

  for (let index = 1; index < points.length - 1; index += 1) {
    if (lastKept.distanceTo(points[index]) >= minSpacingMeters) {
      result.push(points[index].clone());
      lastKept = points[index];
    }
  }

  const end = points[points.length - 1];
  if (result[result.length - 1].distanceTo(end) > 0.2) {
    result.push(end.clone());
  }

  return result.length >= 2 ? result : points.slice(0, 2).map((point) => point.clone());
}

function nextStepFromPolyline(points) {
  if (!Array.isArray(points) || points.length < 2) return null;
  const totalMeters = polylineLength(points);
  if (totalMeters <= AR_ARRIVAL_THRESHOLD_METERS) {
    return { direction: "arrive", angleDegrees: 0, distanceMeters: totalMeters };
  }

  let traveled = 0;
  for (let index = 1; index < points.length - 1; index += 1) {
    const incoming = new THREE.Vector3().subVectors(points[index], points[index - 1]);
    const outgoing = new THREE.Vector3().subVectors(points[index + 1], points[index]);
    const incomingLength = incoming.length();
    const outgoingLength = outgoing.length();
    if (incomingLength < 1 || outgoingLength < 1) {
      traveled += incomingLength;
      continue;
    }

    const angle = signedTurnDegrees(incoming, outgoing);
    if (Math.abs(angle) >= AR_TURN_THRESHOLD_DEGREES) {
      return {
        direction: angle > 0 ? "left" : "right",
        angleDegrees: angle,
        distanceMeters: traveled + incomingLength,
      };
    }

    traveled += incomingLength;
  }

  return { direction: "straight", angleDegrees: 0, distanceMeters: Math.min(totalMeters, AR_LOOKAHEAD_METERS) };
}

function signedTurnDegrees(incoming, outgoing) {
  const a = incoming.clone().setY(0).normalize();
  const b = outgoing.clone().setY(0).normalize();
  const dot = clamp(a.dot(b), -1, 1);
  const angle = Math.acos(dot);
  const crossY = new THREE.Vector3().crossVectors(a, b).y;
  return (crossY >= 0 ? 1 : -1) * ((angle * 180) / Math.PI);
}

function haversineDistanceMeters(a, b) {
  if (!a || !b) return 0;
  const radius = 6371000;
  const lat1 = degreesToRadians(a[1]);
  const lat2 = degreesToRadians(b[1]);
  const deltaLat = degreesToRadians(b[1] - a[1]);
  const deltaLng = degreesToRadians(b[0] - a[0]);
  const h =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) * Math.sin(deltaLng / 2);
  return 2 * radius * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function degreesToRadians(value) {
  return (value * Math.PI) / 180;
}

function lngLatToMeters(point, origin) {
  const metersPerLat = 111320;
  const metersPerLng = 111320 * Math.cos((origin[1] * Math.PI) / 180);
  return new THREE.Vector3((point[0] - origin[0]) * metersPerLng, 0, -(point[1] - origin[1]) * metersPerLat);
}

function closestPointOnPolyline(points, target) {
  let best = {
    point: points[0]?.clone() || new THREE.Vector3(),
    distance: Infinity,
    segmentIndex: 0,
    cumulativeMeters: 0,
    remainingMeters: 0,
    progressRatio: 0,
  };
  const totalMeters = polylineLength(points);
  let cumulativeMeters = 0;

  for (let index = 0; index < points.length - 1; index += 1) {
    const start = points[index];
    const end = points[index + 1];
    const segment = new THREE.Vector3().subVectors(end, start);
    const lengthSq = segment.lengthSq();
    if (lengthSq === 0) continue;

    const t = clamp01(new THREE.Vector3().subVectors(target, start).dot(segment) / lengthSq);
    const projected = start.clone().add(segment.multiplyScalar(t));
    const distance = projected.distanceTo(target);
    const segmentLength = Math.sqrt(lengthSq);
    const projectedCumulative = cumulativeMeters + segmentLength * t;

    if (distance < best.distance) {
      best = {
        point: projected,
        distance,
        segmentIndex: index,
        cumulativeMeters: projectedCumulative,
        remainingMeters: Math.max(0, totalMeters - projectedCumulative),
        progressRatio: totalMeters > 0 ? clamp01(projectedCumulative / totalMeters) : 0,
      };
    }

    cumulativeMeters += segmentLength;
  }

  return best;
}

function buildForwardMeterPath(routeMeters, snap) {
  const forward = [snap.point.clone()];
  if (snap.distance > 4) {
    forward.unshift(new THREE.Vector3(0, 0, 0));
  }

  for (let index = snap.segmentIndex + 1; index < routeMeters.length; index += 1) {
    forward.push(routeMeters[index].clone());
  }

  return trimPolyline(forward, AR_LOOKAHEAD_METERS);
}

function trimPolyline(points, maxMeters) {
  if (points.length <= 2) return points;
  const trimmed = [points[0].clone()];
  let traveled = 0;

  for (let index = 0; index < points.length - 1; index += 1) {
    const start = points[index];
    const end = points[index + 1];
    const segmentLength = start.distanceTo(end);
    if (segmentLength === 0) continue;

    if (traveled + segmentLength >= maxMeters) {
      const t = clamp01((maxMeters - traveled) / segmentLength);
      trimmed.push(start.clone().lerp(end, t));
      break;
    }

    trimmed.push(end.clone());
    traveled += segmentLength;
  }

  return trimmed.length >= 2 ? trimmed : points.slice(0, 2).map((point) => point.clone());
}

function polylineLength(points) {
  return points.slice(0, -1).reduce((total, point, index) => total + point.distanceTo(points[index + 1]), 0);
}

function lngLatRouteLength(points) {
  return points.slice(0, -1).reduce((total, point, index) => total + haversineDistanceMeters(point, points[index + 1]), 0);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

function countRouteArrows(points) {
  return points.slice(0, -1).reduce((total, point, index) => {
    const length = new THREE.Vector3().subVectors(points[index + 1], point).length();
    return total + (length < 0.2 ? 0 : Math.max(1, Math.floor(length / AR_ARROW_SPACING)));
  }, 0);
}

function navigationStatusText(routeModel, gpsState) {
  if (gpsState.status === "error") return `GPS unavailable - ${gpsState.message}`;
  if (gpsState.status === "locating") return "GPS locating...";
  if (gpsState.status === "weak") {
    const accuracy = Number.isFinite(gpsState.accuracy) ? `GPS weak (+/- ${Math.round(gpsState.accuracy)} m)` : "GPS weak";
    return routeModel.hasGps ? `${accuracy} - holding current route.` : `${accuracy} - waiting for stronger signal.`;
  }
  if (gpsState.status !== "tracking") {
    return routeModel.source === "empty" ? "No route selected - choose a destination first." : "GPS idle - start AR to align route.";
  }

  const accuracy = Number.isFinite(gpsState.accuracy) ? `GPS +/- ${Math.round(gpsState.accuracy)} m` : "GPS tracking";
  if (!routeModel.hasGps) return routeModel.source === "empty" ? `${accuracy} - waiting for a destination route.` : `${accuracy} - waiting for route geometry.`;

  const remaining = Number.isFinite(routeModel.remainingMeters) ? `${formatMeters(routeModel.remainingMeters)} left` : "";
  const offRoute = routeModel.offRoute ? `off route by ${formatMeters(routeModel.distanceToRouteMeters)}` : "on route";
  return [accuracy, offRoute, remaining].filter(Boolean).join(" - ");
}

function routeSummaryText(routeModel, endPlace) {
  if (routeModel.arrowCount > 0) {
    return `${endPlace?.label || "Route target"} - ${routeModel.arrowCount} AR arrows`;
  }
  if (endPlace?.coords) {
    return `${endPlace.label || "Route target"} - calculating GPS route`;
  }
  return "Choose a destination to draw AR route";
}

function navigationInstructionText(routeModel, gpsState, endPlace) {
  if (gpsState.status === "locating") return "Finding your campus position";
  if (gpsState.status === "error") return "Camera preview available; GPS is offline";
  if (routeModel.source === "empty") return "Choose a destination to begin";
  if (routeModel.offRoute) return `Move back toward the highlighted route (${formatMeters(routeModel.distanceToRouteMeters)} away)`;
  if (routeModel.nextStep?.direction === "arrive") return `Arrive at ${endPlace?.label || "destination"} soon`;
  if (routeModel.nextStep?.direction === "left") return `Turn left in ${formatMeters(routeModel.nextStep.distanceMeters)}`;
  if (routeModel.nextStep?.direction === "right") return `Turn right in ${formatMeters(routeModel.nextStep.distanceMeters)}`;
  if (routeModel.hasGps) return `Continue ahead for ${formatMeters(routeModel.nextStep?.distanceMeters || routeModel.remainingMeters)}`;
  return "Preview the route, then start AR to align with GPS";
}

function turnGlyph(direction) {
  if (direction === "left") return "L";
  if (direction === "right") return "R";
  if (direction === "arrive") return "✓";
  return "↑";
}

function formatAccuracy(value) {
  const accuracy = Number(value);
  if (!Number.isFinite(accuracy)) return "-";
  return `±${Math.round(accuracy)} m`;
}

function formatMeters(value) {
  const meters = Number(value);
  if (!Number.isFinite(meters)) return "-";
  if (meters >= 1000) return `${(meters / 1000).toFixed(1)} km`;
  return `${Math.round(meters)} m`;
}

function stopSession(session) {
  session?.stop?.();
  session?.stream?.getTracks?.().forEach((track) => track.stop());
}

const styles = StyleSheet.create({
  overlay: {
    position: "absolute",
    inset: 0,
    zIndex: 30,
    overflow: "hidden",
    backgroundColor: "#0f1f1c",
  },
  topBar: {
    position: "absolute",
    top: 18,
    left: 18,
    right: 18,
    zIndex: 2,
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    pointerEvents: "box-none",
  },
  titleBlock: {
    gap: 2,
  },
  kicker: {
    color: "#8de8d6",
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  title: {
    color: "#ffffff",
    fontSize: 22,
    fontWeight: "900",
    lineHeight: 28,
  },
  iconButton: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.28)",
    borderRadius: 999,
    backgroundColor: "rgba(8, 18, 16, 0.62)",
    pointerEvents: "auto",
  },
  iconText: {
    color: "#ffffff",
    fontSize: 20,
    fontWeight: "900",
    lineHeight: 22,
  },
  guidanceCard: {
    position: "absolute",
    top: 86,
    left: 18,
    right: 18,
    zIndex: 2,
    gap: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.18)",
    borderRadius: 8,
    padding: 14,
    backgroundColor: "rgba(8, 18, 16, 0.72)",
    boxShadow: "0 18px 48px rgba(0, 0, 0, 0.28)",
    backdropFilter: "blur(14px)",
    pointerEvents: "none",
  },
  instructionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  turnGlyph: {
    flexShrink: 0,
    width: 54,
    height: 54,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(141, 232, 214, 0.5)",
    borderRadius: 8,
    backgroundColor: "#8de8d6",
  },
  turnGlyphWarning: {
    borderColor: "rgba(255, 207, 122, 0.7)",
    backgroundColor: "#ffcf7a",
  },
  turnGlyphText: {
    color: "#07352d",
    fontSize: 24,
    lineHeight: 28,
    fontWeight: "900",
  },
  instructionTextBlock: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  guidanceKicker: {
    color: "#8de8d6",
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  guidanceTitle: {
    color: "#ffffff",
    fontSize: 21,
    lineHeight: 27,
    fontWeight: "900",
  },
  progressTrack: {
    height: 7,
    overflow: "hidden",
    borderRadius: 999,
    backgroundColor: "rgba(255, 255, 255, 0.16)",
  },
  progressFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: "#8de8d6",
  },
  metricGrid: {
    flexDirection: "row",
    gap: 8,
  },
  metricItem: {
    flex: 1,
    minWidth: 0,
    gap: 2,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 9,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
  },
  metricLabel: {
    color: "#a8c9c2",
    fontSize: 10,
    lineHeight: 13,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  metricValue: {
    color: "#ffffff",
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "900",
  },
  reticleWrap: {
    position: "absolute",
    top: "48%",
    left: "50%",
    zIndex: 2,
    alignItems: "center",
    gap: 8,
    transform: [{ translateX: -36 }, { translateY: -36 }],
  },
  reticleRing: {
    width: 72,
    height: 72,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "rgba(141, 232, 214, 0.78)",
    borderRadius: 999,
    backgroundColor: "rgba(8, 18, 16, 0.14)",
  },
  reticleDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
    backgroundColor: "#ffcf7a",
  },
  reticleText: {
    minWidth: 64,
    borderRadius: 999,
    paddingVertical: 5,
    paddingHorizontal: 8,
    color: "#ffffff",
    backgroundColor: "rgba(8, 18, 16, 0.64)",
    fontSize: 11,
    lineHeight: 14,
    textAlign: "center",
    fontWeight: "900",
  },
  statusPanel: {
    position: "absolute",
    left: 18,
    bottom: 18,
    width: 330,
    maxWidth: "calc(100vw - 36px)",
    gap: 9,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.18)",
    borderRadius: 8,
    padding: 13,
    backgroundColor: "rgba(8, 18, 16, 0.78)",
  },
  statusRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  badge: {
    borderRadius: 999,
    paddingVertical: 5,
    paddingHorizontal: 9,
    color: "#d8eee9",
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  badgeReady: {
    color: "#07352d",
    backgroundColor: "#8de8d6",
  },
  badgePreview: {
    color: "#3b2500",
    backgroundColor: "#ffcf7a",
  },
  badgeIdle: {
    color: "#d8eee9",
    backgroundColor: "rgba(255, 255, 255, 0.16)",
  },
  statusText: {
    color: "#ffffff",
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "700",
  },
  routeText: {
    color: "#a8c9c2",
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "700",
  },
  gpsText: {
    color: "#d8eee9",
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "800",
  },
  gpsWarning: {
    color: "#ffcf7a",
  },
  routeMetaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7,
  },
  routeMetaText: {
    borderRadius: 999,
    paddingVertical: 4,
    paddingHorizontal: 8,
    color: "#a8c9c2",
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    fontSize: 10,
    lineHeight: 13,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  routeRefreshText: {
    color: "#8de8d6",
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "900",
  },
  actions: {
    flexDirection: "row",
    gap: 8,
  },
  actionButton: {
    minHeight: 38,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    paddingHorizontal: 14,
    backgroundColor: "#0f766e",
  },
  stopButton: {
    backgroundColor: "#b42318",
  },
  actionText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "900",
  },
  pressed: {
    opacity: 0.86,
  },
});

const canvasElementStyle = {
  position: "absolute",
  inset: 0,
  zIndex: 1,
  width: "100%",
  height: "100%",
  display: "block",
  pointerEvents: "none",
};

const cameraElementStyle = {
  position: "absolute",
  inset: 0,
  zIndex: 0,
  width: "100%",
  height: "100%",
  objectFit: "cover",
  background: "#071512",
  transition: "opacity 180ms ease",
};
