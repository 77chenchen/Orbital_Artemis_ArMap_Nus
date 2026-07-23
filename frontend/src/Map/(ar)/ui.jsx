import { useEffect, useMemo, useRef, useState } from "react";
import { View } from "react-native";
import { useLocation, useNavigate } from "react-router-dom";
import { ARCameraLayers } from "./ARCameraLayers";
import { EmptyRouteState, ARHud } from "./ARHud";
import { styles } from "./arStyles";
import { CHANGCHUN_ROUTE_DATA, DEMO_ROUTE_DATA } from "./demoRoute";
import { setupScene, updateRouteGroup } from "./sceneRenderer";
import { activeNavigationStep, buildRouteModel, nextManeuver } from "./routeMath";
import { readRouteData, saveRouteData } from "./routeStorage";
import { useCameraStream } from "./useCameraStream";
import { useDeviceHeading } from "./useDeviceHeading";
import { useRouteTracking } from "./useRouteTracking";
import { startXR8Pipeline, stopXR8Pipeline } from "./XR8Pipeline";
import { createXR8RouteNavigationModule } from "./xr8RouteNavigation";

// Main AR screen.
// This file stays thin: it wires route data, GPS/camera hooks, the Three.js
// scene, and the visible HUD together.
export default function ARScene() {
  const location = useLocation();
  const navigate = useNavigate();

  // Demo mode only turns on for /ar?demo=1. Normal map navigation goes to /ar.
  const demoMode = useMemo(() => new URLSearchParams(location.search).get("demo") === "1", [location.search]);

  // In demo mode we use the built-in sample route. Otherwise we read the route
  // passed from the map page, falling back to sessionStorage if the page reloads.
  const routeData = useMemo(() => {
    if (demoMode) return DEMO_ROUTE_DATA;
    const storedRoute = readRouteData(location.state?.routeData);
    if (storedRoute?.points?.length || storedRoute?.segments?.length) return storedRoute;
    return CHANGCHUN_ROUTE_DATA;
  }, [demoMode, location.state]);

  // routeModel enriches raw coordinates with distances, progress markers, and
  // turn instructions used by both the HUD and the 3D renderer.
  const routeModel = useMemo(() => buildRouteModel(routeData), [routeData]);

  const canvasRef = useRef(null);
  const routeGroupRef = useRef(null);
  const userMarkerRef = useRef(null);
  const routeModelRef = useRef(routeModel);

  // The render loop is created once per route model, so it reads live values
  // from this ref instead of closing over stale React state.
  const sceneStateRef = useRef({ userCoordinate: null, progress: 0, heading: 0 });
  const [xrStatus, setXrStatus] = useState(demoMode ? "virtual camera" : "tap camera");

  const { videoRef, cameraStatus, startCamera } = useCameraStream(demoMode);
  const { heading, calibrateHeading } = useDeviceHeading(routeModel);
  const { trackingStatus, userCoordinate, routeState } = useRouteTracking({
    demoMode,
    routeData,
    routeModel,
  });

  const remainingDistance = Math.max(0, (routeModel.totalDistance || 0) - routeState.progress);
  const activeStep = activeNavigationStep(routeModel, routeState.progress);
  const maneuver = nextManeuver(routeModel, routeState.progress);
  const maneuverDistance = maneuver ? Math.max(0, maneuver.distance - routeState.progress) : remainingDistance;
  const progressPercent = routeModel.totalDistance
    ? Math.min(100, (routeState.progress / routeModel.totalDistance) * 100)
    : 0;
  const offRoute = routeState.offRouteDistance > 35;

  // Keep the Three.js render loop synchronized with the latest React state.
  useEffect(() => {
    routeModelRef.current = routeModel;
    sceneStateRef.current = {
      userCoordinate,
      progress: routeState.progress,
      heading,
    };
  }, [heading, routeModel, routeState.progress, userCoordinate]);

  useEffect(() => {
    setXrStatus(demoMode ? "virtual camera" : "tap camera");
  }, [demoMode]);

  // Release the 8th Wall pipeline when leaving the AR screen.
  useEffect(() => () => stopXR8Pipeline(), []);

  // If the route was rebuilt from segments, store its flattened points so AR
  // can survive refreshes or route-state loss.
  useEffect(() => {
    if (!routeData?.points?.length && routeModel.points.length >= 2) {
      saveRouteData({ ...routeData, points: routeModel.points });
    }
  }, [routeData, routeModel.points]);

  // Demo mode uses a local renderer over a static image. Real mode lets XR8 own
  // the canvas and scene.
  useEffect(() => {
    if (!demoMode) return undefined;
    return setupScene({
      canvas: canvasRef.current,
      model: routeModel,
      getUserCoordinate: () => sceneStateRef.current.userCoordinate,
      getProgress: () => sceneStateRef.current.progress,
      getHeading: () => sceneStateRef.current.heading,
      routeGroupRef,
      userMarkerRef,
    });
  }, [demoMode, routeModel]);

  // Also update the route immediately after React state changes, instead of
  // waiting for the next animation frame.
  useEffect(() => {
    if (!demoMode) return;
    updateRouteGroup({
      model: routeModel,
      routeGroup: routeGroupRef.current,
      userMarker: userMarkerRef.current,
      userCoordinate,
      progress: routeState.progress,
      heading,
    });
  }, [demoMode, heading, routeModel, routeState.progress, userCoordinate]);

  async function startARCamera() {
    try {
      setXrStatus("starting AR");
      await startXR8Pipeline(canvasRef, {
        pipelineModules: [
          createXR8RouteNavigationModule({
            getModel: () => routeModelRef.current,
            getUserCoordinate: () => sceneStateRef.current.userCoordinate,
            getProgress: () => sceneStateRef.current.progress,
            getHeading: () => sceneStateRef.current.heading,
          }),
        ],
      });
      setXrStatus("AR running");
    } catch (error) {
      setXrStatus(error?.message || "AR failed");
    }
  }

  // The AR view needs at least two coordinates to draw a path.
  if (routeModel.points.length < 2) {
    return <EmptyRouteState onBackToMap={() => navigate("/map")} />;
  }

  return (
    <View dataSet={{ atlasArScreen: true }} style={styles.screen}>
      <ARCameraLayers demoMode={demoMode} videoRef={videoRef} canvasRef={canvasRef} />
      <ARHud
        offRoute={offRoute}
        trackingStatus={trackingStatus}
        cameraStatus={demoMode ? cameraStatus : xrStatus}
        activeStep={activeStep}
        maneuver={maneuver}
        maneuverDistance={maneuverDistance}
        remainingDistance={remainingDistance}
        progressPercent={progressPercent}
        routeState={routeState}
        heading={heading}
        onBack={() => navigate("/map")}
        onCalibrate={() => calibrateHeading(routeState.segmentIndex)}
        onStartCamera={!demoMode ? startARCamera : startCamera}
      />
    </View>
  );
}
