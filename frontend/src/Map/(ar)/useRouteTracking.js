import { useEffect, useRef, useState } from "react";
import { DEMO_ROUTE_DATA } from "./demoRoute";
import { nearestProgressOnRoute } from "./routeMath";

// Shape consumed by the HUD and renderer.
const EMPTY_ROUTE_STATE = {
  progress: 0,
  offRouteDistance: 0,
  segmentIndex: 0,
};

// Tracks where the user is along the route.
// In demo mode it fakes a fixed GPS point; in normal mode it watches real GPS.
export function useRouteTracking({ demoMode, routeData, routeModel }) {
  const watchIdRef = useRef(null);
  const [trackingStatus, setTrackingStatus] = useState(demoMode ? "Virtual GPS · Singapore" : "Waiting for GPS");
  const [userCoordinate, setUserCoordinate] = useState(routeData.start?.coords || routeModel.points[0] || null);
  const [routeState, setRouteState] = useState(EMPTY_ROUTE_STATE);

  // Reset derived tracking state when switching route/demo mode.
  useEffect(() => {
    setTrackingStatus(demoMode ? "Virtual GPS · Singapore" : "Waiting for GPS");
    setUserCoordinate(routeData.start?.coords || routeModel.points[0] || null);
    setRouteState(EMPTY_ROUTE_STATE);
  }, [demoMode, routeData, routeModel]);

  useEffect(() => {
    // Demo mode skips browser GPS and pins the user near the sample route.
    if (demoMode) {
      const coordinate = DEMO_ROUTE_DATA.points[1];
      setUserCoordinate(coordinate);
      setRouteState(nearestProgressOnRoute(routeModel, coordinate));
      return undefined;
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
