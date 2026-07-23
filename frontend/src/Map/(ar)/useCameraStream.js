import { useCallback, useEffect, useRef, useState } from "react";

// Starts/stops the browser camera stream used as the AR background.
export function useCameraStream(demoMode) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [cameraStatus, setCameraStatus] = useState(demoMode ? "virtual camera" : "preview");

  useEffect(() => {
    setCameraStatus(demoMode ? "virtual camera" : "preview");
  }, [demoMode]);

  // Stop camera tracks when leaving AR so the browser releases the camera.
  useEffect(() => () => {
    stopCamera(streamRef, videoRef);
  }, []);

  // Triggered by the HUD "Camera" button. Browsers require this to happen from
  // a user gesture before getUserMedia can open the camera.
  const startCamera = useCallback(async () => {
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
  }, []);

  return {
    videoRef,
    cameraStatus,
    startCamera,
  };
}

// Shared cleanup for unmounts and future camera resets.
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
