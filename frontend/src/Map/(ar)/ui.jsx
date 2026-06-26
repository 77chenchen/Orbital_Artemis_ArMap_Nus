import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import * as THREE from "three";
import { watchLocation } from "../services";

export default function ARScene() {
  const canvasRef = useRef(null);
  const sceneRef = useRef(null);
  const startedRef = useRef(false);

  const gpsRef = useRef(null);
  const originRef = useRef(null);

  const userMarkerRef = useRef(null);
  const routeGroupRef = useRef(null);

  const location = useLocation();
  const routeData = location.state?.routeData;
  const routeCoord = routeData?.points || [];

  useEffect(() => {
    const resizeCanvas = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    const normalizeRoutePoint = (point) => {
      if (Array.isArray(point) && point.length >= 2) {
        return { lon: Number(point[0]), lat: Number(point[1]) };
      }

      if (point && typeof point === "object") {
        const lon = point.lon ?? point.lng ?? point.longitude;
        const lat = point.lat ?? point.latitude;

        if (Number.isFinite(lon) && Number.isFinite(lat)) {
          return { lon: Number(lon), lat: Number(lat) };
        }
      }

      return null;
    };

    const latLngToLocal = (lon, lat, origin) => {
      const R = 6378137;
      const dLat = THREE.MathUtils.degToRad(lat - origin.lat);
      const dLng = THREE.MathUtils.degToRad(lon - origin.lon);

      const x = dLng * R * Math.cos(THREE.MathUtils.degToRad(origin.lat));
      const z = -dLat * R;

      return new THREE.Vector3(x, 0.05, z);
    };

    const clearRoute = (scene) => {
      if (!routeGroupRef.current) return;

      scene.remove(routeGroupRef.current);

      routeGroupRef.current.traverse((obj) => {
        if (obj.geometry) obj.geometry.dispose();

        if (obj.material) {
          if (Array.isArray(obj.material)) {
            obj.material.forEach((m) => m.dispose());
          } else {
            obj.material.dispose();
          }
        }
      });

      routeGroupRef.current = null;
    };

    const drawRoute = (scene, origin, coords) => {
      const points = (coords || [])
        .map(normalizeRoutePoint)
        .filter(Boolean)
        .map((p) => latLngToLocal(p.lon, p.lat, origin));

      if (points.length < 2) return;

      clearRoute(scene);

      const group = new THREE.Group();

      const lineGeometry = new THREE.BufferGeometry().setFromPoints(points);
      const lineMaterial = new THREE.LineBasicMaterial({
        color: 0x2563eb,
      });

      const line = new THREE.Line(lineGeometry, lineMaterial);
      group.add(line);

      for (let i = 0; i < points.length - 1; i++) {
        const a = points[i];
        const b = points[i + 1];

        const dir = new THREE.Vector3().subVectors(b, a).normalize();
        const mid = new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5);

        const segmentLength = a.distanceTo(b);
        const arrowLength = Math.max(Math.min(segmentLength * 0.5, 1.5), 0.35);

        const arrow = new THREE.ArrowHelper(
          dir,
          mid,
          arrowLength,
          0x2563eb,
          0.3,
          0.18
        );

        group.add(arrow);
      }

      scene.add(group);
      routeGroupRef.current = group;
    };

    const ensureUserMarker = (scene) => {
      if (userMarkerRef.current) return userMarkerRef.current;

      const marker = new THREE.Mesh(
        new THREE.SphereGeometry(0.12, 16, 16),
        new THREE.MeshBasicMaterial({
          color: 0xef4444,
        })
      );

      marker.position.set(0, 0.12, 0);
      scene.add(marker);
      userMarkerRef.current = marker;

      return marker;
    };

    const syncScene = () => {
      const scene = sceneRef.current;
      if (!scene) return;

      const gps = gpsRef.current;
      if (!gps) return;

      if (!originRef.current) {
        originRef.current = {
          lon: gps[0],
          lat: gps[1],
        };
      }

      const origin = originRef.current;

      if (origin && Array.isArray(routeCoord) && routeCoord.length > 1) {
        drawRoute(scene, origin, routeCoord);
      }

      const userPos = latLngToLocal(gps[0], gps[1], origin);
      const marker = ensureUserMarker(scene);
      marker.position.copy(userPos);
    };

    const onXRLoaded = () => {
      if (startedRef.current) return;
      startedRef.current = true;

      window.THREE = THREE;
      resizeCanvas();

      try {
        XR8.XrController?.configure?.({
          enableLighting: true,
          enableWorldPoints: true,
        });
      } catch (err) {
        console.warn("XR8 configure failed:", err);
      }

      XR8.addCameraPipelineModules([
        XR8.GlTextureRenderer.pipelineModule(),
        XR8.XrController.pipelineModule(),
        XR8.Threejs.pipelineModule(),
      ]);

      XR8.addCameraPipelineModule({
        name: "app-scene",

        onStart: () => {
          const { scene } = XR8.Threejs.xrScene();
          sceneRef.current = scene;
          syncScene();
        },

        onUpdate: () => {
          // route is drawn from GPS, so no cube animation needed here
        },
      });

      XR8.run({
        canvas: canvasRef.current,
        allowedDevices: XR8.XrConfig.device().MOBILE,
        cameraConfig: {
          direction: XR8.XrConfig.camera().BACK,
        },
      });
    };

    window.addEventListener("resize", resizeCanvas);

    if (window.XR8) {
      onXRLoaded();
    } else {
      window.addEventListener("xrloaded", onXRLoaded, { once: true });
    }

    const watchId = watchLocation((coords) => {
      gpsRef.current = coords;
      syncScene();
    });

    return () => {
      window.removeEventListener("resize", resizeCanvas);
      window.navigator?.geolocation?.clearWatch?.(watchId);

      try {
        const scene = sceneRef.current;
        if (scene && userMarkerRef.current) {
          scene.remove(userMarkerRef.current);
          userMarkerRef.current.geometry?.dispose?.();
          userMarkerRef.current.material?.dispose?.();
        }
        if (scene && routeGroupRef.current) {
          clearRoute(scene);
        }
        XR8.stop?.();
      } catch {}

      startedRef.current = false;
      sceneRef.current = null;
      userMarkerRef.current = null;
      routeGroupRef.current = null;
      gpsRef.current = null;
      originRef.current = null;
    };
  }, [routeCoord]);

  return (
    <div style={{ width: "100vw", height: "100vh", overflow: "hidden" }}>
      <canvas
        ref={canvasRef}
        style={{
          position: "fixed",
          inset: 0,
          width: "100vw",
          height: "100vh",
          display: "block",
        }}
      />
    </div>
  );
}