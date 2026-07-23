import * as THREE from "three";
import { routeWindow, toLocalMeters } from "./routeMath";

// Converts route/GPS state into the actual Three.js scene drawn on the canvas.
const SCENE_SCALE = 0.72;
const GROUND_Y = 0;
const ROUTE_Y = GROUND_Y + 0.018;
const LOOK_BEHIND_METERS = 8;
const LOOK_AHEAD_METERS = 90;
const ROUTE_WIDTH = 0.34;

// Set up the renderer, camera, lights, ground grid, route group, and user marker.
// Returns a cleanup function that must be called when the AR screen unmounts.
export function setupScene({
  canvas,
  model,
  getUserCoordinate,
  getProgress,
  getHeading,
  routeGroupRef,
  userMarkerRef,
}) {
  if (!canvas) return () => {};

  // alpha: true lets the camera/video layer show through the canvas.
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x10231f, 70, 260);
  const camera = new THREE.PerspectiveCamera(58, 1, 0.1, 900);
  camera.position.set(0, 1.7, 4.2);
  camera.lookAt(0, 0, -9);

  const hemisphere = new THREE.HemisphereLight(0xe8fff7, 0x1f3f35, 2.4);
  const sun = new THREE.DirectionalLight(0xffffff, 1.6);
  sun.position.set(4, 8, 5);
  scene.add(hemisphere, sun);

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(260, 260, 20, 20),
    new THREE.MeshBasicMaterial({ color: 0x143431, transparent: true, opacity: 0.18, wireframe: true }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = GROUND_Y - 0.018;
  scene.add(ground);

  // routeGroup is redrawn as progress changes. userMarker stays at local origin.
  const routeGroup = new THREE.Group();
  const userMarker = new THREE.Mesh(
    new THREE.RingGeometry(0.32, 0.42, 32),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.95, side: THREE.DoubleSide }),
  );
  userMarker.rotation.x = -Math.PI / 2;
  userMarker.position.set(0, GROUND_Y + 0.06, 0);
  scene.add(routeGroup, userMarker);

  routeGroupRef.current = routeGroup;
  userMarkerRef.current = userMarker;

  // Keep WebGL size matched to the visible canvas size.
  const resize = () => {
    const rect = canvas.getBoundingClientRect();
    const width = Math.max(1, Math.floor(rect.width));
    const height = Math.max(1, Math.floor(rect.height));
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  };

  let frameId = 0;
  // The loop reads latest values through getter functions supplied by ui.jsx.
  const render = () => {
    resize();
    updateRouteGroup({
      model,
      routeGroup,
      userMarker,
      userCoordinate: getUserCoordinate(),
      progress: getProgress(),
      heading: getHeading(),
    });
    renderer.render(scene, camera);
    frameId = window.requestAnimationFrame(render);
  };
  render();

  window.addEventListener("resize", resize);
  return () => {
    window.cancelAnimationFrame(frameId);
    window.removeEventListener("resize", resize);
    disposeGroup(routeGroup);
    ground.geometry.dispose();
    ground.material.dispose();
    userMarker.geometry.dispose();
    userMarker.material.dispose();
    renderer.dispose();
    routeGroupRef.current = null;
    userMarkerRef.current = null;
  };
}

// Rebuild the visible route segment around the user's current progress.
export function updateRouteGroup({ model, routeGroup, userMarker, userCoordinate, progress, heading }) {
  if (!model?.points?.length || !routeGroup) return;

  // Use the user as local origin so nearby route coordinates stay numerically
  // stable and visually centered around the camera.
  const origin = userCoordinate || model.origin || model.points[0];
  const visiblePoints = routeWindow(model, progress, LOOK_BEHIND_METERS, LOOK_AHEAD_METERS);
  const localPoints = visiblePoints.map((point) => toScenePoint(point, origin));
  const destinationPoint = toScenePoint(model.points[model.points.length - 1], origin, GROUND_Y + 0.075);

  disposeGroup(routeGroup);
  routeGroup.clear();

  if (localPoints.length >= 2) {
    addRouteLine(routeGroup, localPoints);
    addRouteArrows(routeGroup, localPoints);
    addStepTarget(routeGroup, localPoints[localPoints.length - 1]);
  }
  addDestinationMarker(routeGroup, destinationPoint);

  if (userMarker) {
    userMarker.visible = Boolean(userCoordinate);
  }

  routeGroup.rotation.y = (Number(heading) * Math.PI) / 180;
}

function toScenePoint(coordinate, origin, y = ROUTE_Y) {
  const local = toLocalMeters(coordinate, origin);
  return new THREE.Vector3(local.x * SCENE_SCALE, y, -local.z * SCENE_SCALE);
}

// Draw the route as a flat ribbon on the ground.
function addRouteLine(routeGroup, localPoints) {
  const routeRibbon = new THREE.Mesh(
    groundRibbonGeometry(localPoints, ROUTE_WIDTH),
    new THREE.MeshBasicMaterial({ color: 0x35f6bd, transparent: true, opacity: 0.92, side: THREE.DoubleSide }),
  );
  const routeCenter = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(localPoints.map((point) => point.clone().setY(ROUTE_Y + 0.004))),
    new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.78 }),
  );
  routeGroup.add(routeRibbon, routeCenter);
}

// Small flat direction arrows placed along the rendered route.
function addRouteArrows(routeGroup, localPoints) {
  const stride = Math.max(2, Math.floor(localPoints.length / 8));
  for (let index = 1; index < localPoints.length; index += stride) {
    const current = localPoints[index];
    const previous = localPoints[index - 1];
    const direction = current.clone().sub(previous);
    if (direction.length() < 0.1) continue;
    direction.normalize();
    routeGroup.add(flatArrowMesh(previous.clone().lerp(current, 0.58), direction));
  }
}

function groundRibbonGeometry(points, width) {
  const positions = [];
  const indices = [];
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index];
    const previous = points[Math.max(0, index - 1)];
    const next = points[Math.min(points.length - 1, index + 1)];
    const direction = next.clone().sub(previous);
    if (direction.length() < 0.001) direction.set(0, 0, -1);
    direction.normalize();
    const normal = new THREE.Vector3(-direction.z, 0, direction.x).multiplyScalar(width / 2);
    const left = current.clone().add(normal).setY(ROUTE_Y);
    const right = current.clone().sub(normal).setY(ROUTE_Y);
    positions.push(left.x, left.y, left.z, right.x, right.y, right.z);

    if (index < points.length - 1) {
      const base = index * 2;
      indices.push(base, base + 1, base + 2, base + 1, base + 3, base + 2);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function flatArrowMesh(center, direction) {
  const forward = direction.clone().setY(0).normalize();
  const side = new THREE.Vector3(-forward.z, 0, forward.x);
  const tip = center.clone().add(forward.clone().multiplyScalar(0.72)).setY(ROUTE_Y + 0.012);
  const left = center.clone().sub(forward.clone().multiplyScalar(0.42)).add(side.clone().multiplyScalar(0.34)).setY(ROUTE_Y + 0.012);
  const right = center.clone().sub(forward.clone().multiplyScalar(0.42)).sub(side.clone().multiplyScalar(0.34)).setY(ROUTE_Y + 0.012);

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute([
      tip.x, tip.y, tip.z,
      left.x, left.y, left.z,
      right.x, right.y, right.z,
    ], 3),
  );
  geometry.setIndex([0, 1, 2]);
  geometry.computeVertexNormals();

  return new THREE.Mesh(
    geometry,
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.92, side: THREE.DoubleSide }),
  );
}

// Marks the next instruction point; it disappears when that step is reached.
function addStepTarget(routeGroup, point) {
  const target = new THREE.Mesh(
    new THREE.RingGeometry(0.38, 0.5, 32),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.95, side: THREE.DoubleSide }),
  );
  target.rotation.x = -Math.PI / 2;
  target.position.copy(point);
  target.position.y = GROUND_Y + 0.075;
  routeGroup.add(target);
}

// Persistent red final-destination pin, separate from the white next-step ring.
function addDestinationMarker(routeGroup, point) {
  const marker = new THREE.Group();
  marker.position.copy(point);

  const groundRing = new THREE.Mesh(
    new THREE.RingGeometry(0.82, 1.16, 48),
    new THREE.MeshBasicMaterial({ color: 0xff2d2d, transparent: true, opacity: 0.92, side: THREE.DoubleSide }),
  );
  groundRing.rotation.x = -Math.PI / 2;

  const outerRing = new THREE.Mesh(
    new THREE.RingGeometry(1.32, 1.42, 56),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.72, side: THREE.DoubleSide }),
  );
  outerRing.rotation.x = -Math.PI / 2;

  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.05, 0.16, 2.4, 20),
    new THREE.MeshBasicMaterial({ color: 0xff2d2d, transparent: true, opacity: 0.48 }),
  );
  beam.position.y = 1.24;

  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.46, 36, 24),
    new THREE.MeshBasicMaterial({ color: 0xe53935, transparent: true, opacity: 0.96 }),
  );
  head.position.y = 1.42;

  const center = new THREE.Mesh(
    new THREE.SphereGeometry(0.18, 24, 16),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.98 }),
  );
  center.position.y = 1.43;

  const pointer = new THREE.Mesh(
    new THREE.ConeGeometry(0.32, 0.9, 32),
    new THREE.MeshBasicMaterial({ color: 0xe53935, transparent: true, opacity: 0.96 }),
  );
  pointer.rotation.x = Math.PI;
  pointer.position.y = 0.82;

  marker.add(outerRing, groundRing, beam, pointer, head, center);
  routeGroup.add(marker);
}

// Three.js objects keep GPU resources, so they need explicit disposal.
export function disposeGroup(group) {
  if (!group) return;
  group.traverse((child) => {
    child.geometry?.dispose?.();
    if (Array.isArray(child.material)) {
      child.material.forEach((material) => material.dispose?.());
    } else {
      child.material?.dispose?.();
    }
  });
}
