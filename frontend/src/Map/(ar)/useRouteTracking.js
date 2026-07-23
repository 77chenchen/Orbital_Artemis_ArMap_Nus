import { useEffect, useRef, useState } from "react";
import { DEMO_ROUTE_DATA } from "./demoRoute";
import { coordinateAtProgress, nearestProgressOnRoute } from "./routeMath";

// Shape consumed by the HUD and renderer.
const EMPTY_ROUTE_STATE = {
  progress: 0,
  offRouteDistance: 0,
  segmentIndex: 0,
};
const DEMO_TRACKING_STATUS = "Virtual GPS · Changchun";

// Tracks where the user is along the route.
// In demo mode it animates a virtual GPS point; in normal mode it watches real GPS.
export function useRouteTracking({ demoMode, routeData, routeModel }) {
  const watchIdRef = useRef(null);
  const [trackingStatus, setTrackingStatus] = useState(demoMode ? DEMO_TRACKING_STATUS : "Waiting for GPS");
  const [userCoordinate, setUserCoordinate] = useState(routeData.start?.coords || routeModel.points[0] || null);
  const [routeState, setRouteState] = useState(EMPTY_ROUTE_STATE);

  // Reset derived tracking state when switching route/demo mode.
  useEffect(() => {
    setTrackingStatus(demoMode ? DEMO_TRACKING_STATUS : "Waiting for GPS");
    setUserCoordinate(routeData.start?.coords || routeModel.points[0] || null);
    setRouteState(EMPTY_ROUTE_STATE);
  }, [demoMode, routeData, routeModel]);

  useEffect(() => {
    // Demo mode skips browser GPS and moves a virtual user along the route.
    if (demoMode) {
      let cancelled = false;
      const startedAt = performance.now();
      const cycleMs = 70000;

      function tick(now) {
        if (cancelled) return;
        const ratio = ((now - startedAt) % cycleMs) / cycleMs;
        const progress = ratio * (routeModel.totalDistance || 0);
        const coordinate = coordinateAtProgress(routeModel, progress) || DEMO_ROUTE_DATA.points[0];
        setUserCoordinate(coordinate);
        setRouteState(nearestProgressOnRoute(routeModel, coordinate));
        window.requestAnimationFrame(tick);
      }

      const frameId = window.requestAnimationFrame(tick);
      return () => {
        cancelled = true;
        window.cancelAnimationFrame(frameId);
      };
    }

    // Normal mode asks the browser for live position updates.
    if (!navigator.geolocation || routeModel.points.length < 2) {
      setTrackingStatus("GPS unavailable");
      return undefined;
    }

    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const coordinate = [position.coords.longitude, position.coords.latitude];
        // Snap the raw GPS coordinate to the nearest route segment to calculate
        // progress, active segment, and off-route distance.
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

  return {
    trackingStatus,
    userCoordinate,
    routeState,
  };
}
