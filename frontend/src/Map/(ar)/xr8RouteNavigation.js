import * as THREE from "three";
import { disposeGroup, updateRouteGroup } from "./sceneRenderer";

const CAMERA_TO_GROUND_METERS = 1.45;

export function createXR8RouteNavigationModule({
  getModel,
  getUserCoordinate,
  getProgress,
  getHeading,
}) {
  let anchorGroup = null;
  let routeGroup = null;
  let userMarker = null;
  let xrScene = null;

  function ensureSceneObjects() {
    xrScene = window.XR8?.Threejs?.xrScene?.();
    const scene = xrScene?.scene;
    if (!scene || anchorGroup) return;

    anchorGroup = new THREE.Group();
    routeGroup = new THREE.Group();
    userMarker = new THREE.Mesh(
      new THREE.RingGeometry(0.32, 0.42, 32),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.95, side: THREE.DoubleSide }),
    );
    userMarker.rotation.x = -Math.PI / 2;
    userMarker.position.y = 0.06;

    anchorGroup.add(routeGroup, userMarker);
    scene.add(anchorGroup);
  }

  function syncAnchorToCameraGround() {
    const camera = xrScene?.camera;
    if (!camera || !anchorGroup) return;
    anchorGroup.position.set(camera.position.x, camera.position.y - CAMERA_TO_GROUND_METERS, camera.position.z);
  }

  function cleanup() {
    if (!anchorGroup) return;
    disposeGroup(anchorGroup);
    anchorGroup.removeFromParent();
    anchorGroup = null;
    routeGroup = null;
    userMarker = null;
    xrScene = null;
  }

  return {
    name: "atlas-route-navigation",
    onStart: ensureSceneObjects,
    onUpdate: () => {
      ensureSceneObjects();
      syncAnchorToCameraGround();
      updateRouteGroup({
        model: getModel?.(),
        routeGroup,
        userMarker,
        userCoordinate: getUserCoordinate?.(),
        progress: getProgress?.() || 0,
        heading: getHeading?.() || 0,
      });
    },
    onDetach: cleanup,
  };
}
