import * as THREE from "three";

// 8th Wall loads from script tags, so XR8/XRExtras appear on window after this
// module may already be imported. Always wait for the globals at runtime.
const DEFAULT_8TH_WALL_TIMEOUT_MS = 10000;
const AR_CANVAS_Z_INDEX = 2147480001;

function waitForWindowGlobal(globalName, eventName, timeoutMs, timeoutMessage) {
  if (typeof window === "undefined") {
    return Promise.reject(new Error(`${globalName} can only run in a browser`));
  }

  if (window[globalName]) {
    return Promise.resolve(window[globalName]);
  }

  return new Promise((resolve, reject) => {
    let intervalId = null;

    const cleanup = () => {
      window.clearTimeout(timer);
      if (intervalId != null) {
        window.clearInterval(intervalId);
      }
      window.removeEventListener(eventName, handleLoaded);
    };

    const timer = window.setTimeout(() => {
      cleanup();
      reject(new Error(timeoutMessage));
    }, timeoutMs);

    function handleLoaded() {
      if (!window[globalName]) return;
      cleanup();
      resolve(window[globalName]);
    }

    intervalId = window.setInterval(handleLoaded, 50);
    window.addEventListener(eventName, handleLoaded);
  });
}

export function waitForXR8(timeoutMs = DEFAULT_8TH_WALL_TIMEOUT_MS) {
  return waitForWindowGlobal("XR8", "xrloaded", timeoutMs, "XR8 failed to load within timeout");
}

export function waitforXtras(timeoutMs = DEFAULT_8TH_WALL_TIMEOUT_MS) {
  return waitForWindowGlobal("XRExtras", "xrextrasloaded", timeoutMs, "XRExtras failed to load within timeout");
}

export const waitForXtras = waitforXtras;

function ensureThreeGlobal() {
  window.THREE = window.THREE || THREE;
  window.three = window.three || THREE;
}

function viewportSize() {
  const screen = document.querySelector("[data-atlas-ar-screen]");
  const rect = screen?.getBoundingClientRect();
  return {
    width: Math.max(1, Math.round(rect?.width || window.innerWidth || 1)),
    height: Math.max(1, Math.round(rect?.height || window.innerHeight || 1)),
  };
}

function keepCanvasBehindHud(canvas) {
  const { width, height } = viewportSize();
  canvas.width = width;
  canvas.height = height;
  Object.assign(canvas.style, {
    position: "fixed",
    top: "0px",
    left: "0px",
    width: `${width}px`,
    height: `${height}px`,
    maxWidth: "none",
    maxHeight: "none",
    display: "block",
    zIndex: String(AR_CANVAS_Z_INDEX),
    pointerEvents: "none",
    touchAction: "none",
  });
}

function keepCanvasFullScreen(canvas) {
  const resize = () => keepCanvasBehindHud(canvas);
  resize();
  window.addEventListener("resize", resize);
  return () => {
    window.removeEventListener("resize", resize);
  };
}

function pipelineModule(owner, name, { required = false } = {}) {
  const module = owner?.[name];
  if (!module?.pipelineModule) {
    if (required) {
      throw new Error(`${name} pipeline module is unavailable`);
    }
    console.warn(`${name} pipeline module is unavailable; skipping it`);
    return null;
  }
  return module.pipelineModule();
}

function firstPipelineModule(candidates, { required = false } = {}) {
  for (const [owner, name] of candidates) {
    const module = pipelineModule(owner, name);
    if (module) return module;
  }
  if (required) {
    throw new Error(`${candidates.map(([, name]) => name).join(" or ")} pipeline module is unavailable`);
  }
  return null;
}

export async function startXR8Pipeline(canvasRef, options = {}) {
  const extraPipelineModules = options.pipelineModules || [];
  const [XR8, XRExtras] = await Promise.all([
    waitForXR8(options.timeoutMs),
    waitforXtras(options.timeoutMs),
  ]);
  const canvas = canvasRef?.current || canvasRef;

  if (!canvas) {
    throw new Error("AR canvas is not ready");
  }

  XR8.stop?.();
  XR8.clearCameraPipelineModules?.();
  ensureThreeGlobal();
  const stopCanvasResize = keepCanvasFullScreen(canvas);

  const modules = [
    firstPipelineModule([[XR8, "GlTextureRenderer"], [XR8, "CameraRelay"]], { required: true }), // Draws the device camera feed behind AR.
    pipelineModule(XR8, "Threejs", { required: true }), // Connects XR8 tracking to the Three.js scene.
    pipelineModule(XR8, "XrController", { required: true }), // Starts world tracking and camera pose updates.
    ...extraPipelineModules, // App modules that draw route/navigation objects into XR8's scene.
    pipelineModule(XR8, "CanvasScreenshot"), // Allows screenshots from the active AR canvas.
    pipelineModule(XRExtras, "AlmostThere"), // Shows XRExtras coaching before tracking is ready.
    pipelineModule(XRExtras, "Loading"), // Shows XRExtras loading UI while XR8 starts.
    pipelineModule(XRExtras, "RuntimeError"), // Displays XRExtras runtime errors in the browser.
  ].filter(Boolean);

  XR8.addCameraPipelineModules(modules);
  
  await XR8.run({
    canvas,
    allowedDevices: XR8.XrConfig.device().ANY,
    sessionParameters: {
      defaultEnvironment: {
        disableDefaultEnvironment: true,
      },
    },
  });
  keepCanvasBehindHud(canvas);
  window.requestAnimationFrame(() => keepCanvasBehindHud(canvas));

  return () => {
    stopCanvasResize();
    stopXR8Pipeline();
  };
}

export const XR8Pipeline = startXR8Pipeline;

export function stopXR8Pipeline() {
  const XR8 = typeof window !== "undefined" ? window.XR8 : null;
  if (!XR8) return;

  XR8.stop?.();
  XR8.clearCameraPipelineModules?.();
}
