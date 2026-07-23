import { createElement } from "react";
import { domStyles } from "./arStyles";
import { DEMO_CAMERA_BACKGROUND } from "./demoRoute";

// Owns the stacked visual layers behind the HUD:
// 1. demo background image or live camera preview,
// 2. transparent Three.js canvas for route graphics.
export function ARCameraLayers({ demoMode, videoRef, canvasRef }) {
  return (
    <>
      {/* Demo mode fakes the camera feed with a static campus image. */}
      {demoMode
        ? createElement("img", {
            src: DEMO_CAMERA_BACKGROUND,
            alt: "Synthetic NUS campus camera preview",
            style: domStyles.demoBackground,
          })
        : null}

      {/* Three.js draws the route on this transparent canvas. */}
      {createElement("canvas", {
        ref: canvasRef,
        style: domStyles.canvas,
      })}
    </>
  );
}
