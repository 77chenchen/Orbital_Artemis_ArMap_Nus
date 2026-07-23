import { useCallback, useEffect, useState } from "react";
import { bearingBetween } from "./routeMath";

// Tracks compass heading used to rotate the route overlay.
export function useDeviceHeading(routeModel) {
  const [heading, setHeading] = useState(() => initialHeading(routeModel));

  // When the route changes, face the first route segment by default.
  useEffect(() => {
    setHeading(initialHeading(routeModel));
  }, [routeModel]);

  // Listen to browser/device orientation events when available.
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

  // Manual fallback: align heading to the currently active route segment.
  const calibrateHeading = useCallback((segmentIndex = 0) => {
    const index = Math.min(segmentIndex || 0, Math.max(0, routeModel.points.length - 2));
    setHeading(bearingBetween(routeModel.points[index], routeModel.points[index + 1]));
  }, [routeModel]);

  return {
    heading,
    calibrateHeading,
  };
}

function initialHeading(model) {
  if (!model?.points || model.points.length < 2) return 0;
  return bearingBetween(model.points[0], model.points[1]);
}

// Smooth across the 0/360 boundary, so the route does not spin the long way.
function smoothHeading(current, next) {
  const delta = ((next - current + 540) % 360) - 180;
  return (current + delta * 0.18 + 360) % 360;
}
