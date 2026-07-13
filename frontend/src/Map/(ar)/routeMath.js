// Pure route math helpers for AR guidance.
// Coordinate arrays are always [longitude, latitude].
// Distances/progress values are meters along the route.
const EARTH_RADIUS_METERS = 6378137;
const MIN_TURN_ANGLE = 28;
const STEP_ADVANCE_METERS = 7;

// Converts raw route data into the model used by tracking, rendering, and HUD.
export function buildRouteModel(routeData = {}) {
  const flattened = flattenSegmentsWithRanges(routeData.segments);
  const points = normalizeRoutePoints(flattened.points.length ? flattened.points : routeData.points);
  if (points.length < 2) {
    return {
      points,
      cumulative: points.map(() => 0),
      totalDistance: 0,
      maneuvers: [],
      steps: [],
    };
  }

  const origin = points[0];
  const cumulative = [0];
  for (let index = 1; index < points.length; index += 1) {
    cumulative[index] = cumulative[index - 1] + haversineDistance(points[index - 1], points[index]);
  }

  const totalDistance = cumulative[cumulative.length - 1];
  const instructionManeuvers = buildInstructionManeuvers({
    routeData,
    ranges: flattened.ranges,
    points,
    cumulative,
  });
  const maneuvers = instructionManeuvers.length
    ? instructionManeuvers
    : buildManeuvers(points, cumulative, routeData.end?.label);

  return {
    points,
    origin,
    cumulative,
    totalDistance,
    maneuvers,
    steps: buildNavigationSteps(maneuvers, totalDistance),
  };
}

// Keep only valid coordinates and remove tiny duplicate steps.
export function normalizeRoutePoints(points = []) {
  const result = [];
  for (const point of points) {
    if (!Array.isArray(point) || point.length < 2) continue;
    const lng = Number(point[0]);
    const lat = Number(point[1]);
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) continue;
    if (Math.abs(lng) > 180 || Math.abs(lat) > 90) continue;
    const previous = result[result.length - 1];
    if (previous && haversineDistance(previous, [lng, lat]) < 1.5) continue;
    result.push([lng, lat]);
  }
  return result;
}

// Route APIs may return multiple segments. AR wants one continuous point list.
export function flattenSegments(segments = []) {
  return flattenSegmentsWithRanges(segments).points;
}

function flattenSegmentsWithRanges(segments = []) {
  const result = [];
  const ranges = [];
  for (const segment of segments || []) {
    const coordinates = segment?.coordinates || [];
    let startIndex = result.length;
    for (const coordinate of coordinates) {
      const previous = result[result.length - 1];
      if (previous && coordinate?.[0] === previous[0] && coordinate?.[1] === previous[1]) {
        if (result.length === startIndex) startIndex = Math.max(0, result.length - 1);
        continue;
      }
      result.push(coordinate);
    }
    const endIndex = Math.max(startIndex, result.length - 1);
    ranges.push({ segment, startIndex, endIndex });
  }
  return { points: result, ranges };
}

// Pick only the active instruction step near the user's current progress.
// This keeps AR clean: old step geometry is disposed and the full route is not
// rendered at once.
export function routeWindow(model, progressMeters = 0, lookBehind = 20, lookAhead = 180) {
  if (!model?.points?.length || model.points.length < 2) return [];
  if (isRouteComplete(model, progressMeters)) return [];

  const activeStep = activeNavigationStep(model, progressMeters);
  const stepStart = activeStep?.startDistance ?? 0;
  const stepEnd = activeStep?.endDistance ?? model.totalDistance;
  const start = Math.max(stepStart, progressMeters - lookBehind);
  const end = Math.min(stepEnd, progressMeters + lookAhead);
  if (end - start < 1.5) return [];

  const windowPoints = [coordinateAtProgress(model, start)];
  for (let index = 1; index < model.points.length - 1; index += 1) {
    const distance = model.cumulative[index] || 0;
    if (distance > start && distance < end) {
      windowPoints.push(model.points[index]);
    }
  }
  windowPoints.push(coordinateAtProgress(model, end));

  return normalizeRoutePoints(windowPoints);
}

// Finds the closest point on the route to the user's GPS coordinate.
// The result powers off-route warnings and the active route segment.
export function nearestProgressOnRoute(model, userCoordinate) {
  if (!model?.points || model.points.length < 2 || !isCoordinate(userCoordinate)) {
    return {
      progress: 0,
      offRouteDistance: Infinity,
      segmentIndex: 0,
      snappedCoordinate: model?.points?.[0] || null,
    };
  }

  const origin = userCoordinate;
  const user = toLocalMeters(userCoordinate, origin);
  let best = null;

  // Test each route segment and keep the shortest perpendicular distance.
  for (let index = 0; index < model.points.length - 1; index += 1) {
    const start = toLocalMeters(model.points[index], origin);
    const end = toLocalMeters(model.points[index + 1], origin);
    const dx = end.x - start.x;
    const dz = end.z - start.z;
    const lengthSq = dx * dx + dz * dz;
    if (lengthSq <= 0.0001) continue;

    const t = clamp(((user.x - start.x) * dx + (user.z - start.z) * dz) / lengthSq, 0, 1);
    const closest = {
      x: start.x + dx * t,
      z: start.z + dz * t,
    };
    const distance = Math.hypot(user.x - closest.x, user.z - closest.z);
    const segmentMeters = haversineDistance(model.points[index], model.points[index + 1]);
    const progress = (model.cumulative[index] || 0) + segmentMeters * t;

    if (!best || distance < best.offRouteDistance) {
      best = {
        progress,
        offRouteDistance: distance,
        segmentIndex: index,
        snappedCoordinate: interpolateCoordinate(model.points[index], model.points[index + 1], t),
      };
    }
  }

  return best || {
    progress: 0,
    offRouteDistance: Infinity,
    segmentIndex: 0,
    snappedCoordinate: model.points[0],
  };
}

// Return the next maneuver a few meters ahead of current progress.
export function nextManeuver(model, progressMeters = 0) {
  return activeNavigationStep(model, progressMeters)?.target || null;
}

export function activeNavigationStep(model, progressMeters = 0) {
  const steps = model?.steps || [];
  if (!steps.length) return null;
  return steps.find((step) => progressMeters < step.endDistance - STEP_ADVANCE_METERS) || steps[steps.length - 1];
}

export function isRouteComplete(model, progressMeters = 0) {
  return Boolean(model?.totalDistance) && progressMeters >= model.totalDistance - STEP_ADVANCE_METERS;
}

// Approximate local meter coordinates around an origin.
// x is east/west, z is north/south; sceneRenderer maps z forward/back.
export function toLocalMeters(coordinate, origin) {
  if (!isCoordinate(coordinate) || !isCoordinate(origin)) return { x: 0, z: 0 };
  const lng = degToRad(Number(coordinate[0]));
  const lat = degToRad(Number(coordinate[1]));
  const originLng = degToRad(Number(origin[0]));
  const originLat = degToRad(Number(origin[1]));
  return {
    x: (lng - originLng) * EARTH_RADIUS_METERS * Math.cos(originLat),
    z: (lat - originLat) * EARTH_RADIUS_METERS,
  };
}

// Compass bearing in degrees from one coordinate to another.
export function bearingBetween(start, end) {
  if (!isCoordinate(start) || !isCoordinate(end)) return 0;
  const lat1 = degToRad(start[1]);
  const lat2 = degToRad(end[1]);
  const deltaLng = degToRad(end[0] - start[0]);
  const y = Math.sin(deltaLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(deltaLng);
  return normalizeBearing(radToDeg(Math.atan2(y, x)));
}

// Signed shortest turn from one bearing to another. Negative means left.
export function bearingDelta(from, to) {
  return ((to - from + 540) % 360) - 180;
}

// Great-circle distance between two lon/lat points.
export function haversineDistance(start, end) {
  if (!isCoordinate(start) || !isCoordinate(end)) return 0;
  const lat1 = degToRad(start[1]);
  const lat2 = degToRad(end[1]);
  const dLat = degToRad(end[1] - start[1]);
  const dLng = degToRad(end[0] - start[0]);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return 2 * EARTH_RADIUS_METERS * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// User-facing distance label for the HUD.
export function formatDistance(meters) {
  const value = Number(meters);
  if (!Number.isFinite(value)) return "-";
  if (value >= 1000) return `${(value / 1000).toFixed(1)} km`;
  return `${Math.max(0, Math.round(value))} m`;
}

// Build simple turn instructions from changes in route bearing.
function buildManeuvers(points, cumulative, destinationLabel) {
  const maneuvers = [
    {
      type: "start",
      text: "Start",
      distance: 0,
      coordinate: points[0],
    },
  ];

  let previousBearing = bearingBetween(points[0], points[1]);
  let lastAddedDistance = 0;
  for (let index = 2; index < points.length; index += 1) {
    const currentBearing = bearingBetween(points[index - 1], points[index]);
    const delta = bearingDelta(previousBearing, currentBearing);
    const distance = cumulative[index - 1] || 0;
    if (Math.abs(delta) >= MIN_TURN_ANGLE && distance - lastAddedDistance > 18) {
      maneuvers.push({
        type: turnType(delta),
        text: turnText(delta),
        distance,
        coordinate: points[index - 1],
        delta,
      });
      lastAddedDistance = distance;
      previousBearing = currentBearing;
    } else if (haversineDistance(points[index - 1], points[index]) > 8) {
      previousBearing = currentBearing;
    }
  }

  maneuvers.push({
    type: "arrive",
    text: destinationLabel ? `Arrive at ${destinationLabel}` : "Arrive",
    distance: cumulative[cumulative.length - 1] || 0,
    coordinate: points[points.length - 1],
  });

  return maneuvers;
}

function buildInstructionManeuvers({ routeData, ranges, points, cumulative }) {
  const rangedInstructions = (ranges || []).flatMap((range) => {
    const instructions = range.segment?.instructions || range.segment?.steps || [];
    return instructions.map((instruction) => ({
      instruction,
      globalIndex: instructionIndexForRange(instruction, range),
    }));
  });
  const source = rangedInstructions.length
    ? rangedInstructions
    : (routeData.instructions || []).map((instruction) => ({
        instruction,
        globalIndex: Array.isArray(instruction.interval) ? Number(instruction.interval[0]) || 0 : 0,
      }));

  const maneuvers = source
    .map(({ instruction, globalIndex }, index) => {
      const pointIndex = clamp(Math.round(globalIndex), 0, points.length - 1);
      const isArrival = Number(instruction.sign) === 4 || /arrive/i.test(instruction.text || "");
      const distance = isArrival ? cumulative[cumulative.length - 1] : cumulative[pointIndex] || 0;
      return {
        type: instructionType(instruction),
        text: String(instruction.text || "").trim() || "Continue",
        distance,
        coordinate: points[pointIndex],
        sign: instruction.sign,
        sourceIndex: index,
      };
    })
    .filter((maneuver) => maneuver.text && Number.isFinite(maneuver.distance))
    .sort((a, b) => a.distance - b.distance);

  return normalizeManeuverList(maneuvers, points, cumulative, routeData.end?.label);
}

function normalizeManeuverList(maneuvers, points, cumulative, destinationLabel) {
  const result = [];
  if (!maneuvers[0] || maneuvers[0].distance > 1) {
    result.push({
      type: "start",
      text: "Start",
      distance: 0,
      coordinate: points[0],
    });
  }

  for (const maneuver of maneuvers) {
    const previous = result[result.length - 1];
    if (previous && Math.abs(previous.distance - maneuver.distance) < 1 && previous.text === maneuver.text) continue;
    result.push(maneuver);
  }

  const totalDistance = cumulative[cumulative.length - 1] || 0;
  const last = result[result.length - 1];
  if (!last || last.type !== "arrive") {
    result.push({
      type: "arrive",
      text: destinationLabel ? `Arrive at ${destinationLabel}` : "Arrive",
      distance: totalDistance,
      coordinate: points[points.length - 1],
    });
  }

  return result;
}

function buildNavigationSteps(maneuvers, totalDistance) {
  const steps = [];
  for (let index = 0; index < maneuvers.length - 1; index += 1) {
    const startDistance = clamp(maneuvers[index].distance || 0, 0, totalDistance);
    const endDistance = clamp(maneuvers[index + 1].distance || totalDistance, startDistance, totalDistance);
    if (endDistance - startDistance < 1.5) continue;
    steps.push({
      index: steps.length,
      startDistance,
      endDistance,
      start: maneuvers[index],
      target: {
        ...maneuvers[index + 1],
        distance: endDistance,
        stepIndex: steps.length,
      },
    });
  }
  return steps.map((step) => ({ ...step, totalSteps: steps.length }));
}

function instructionIndexForRange(instruction, range) {
  const interval = Array.isArray(instruction.interval) ? instruction.interval : [];
  const localIndex = Number.isFinite(Number(interval[0])) ? Number(interval[0]) : 0;
  return clamp(range.startIndex + localIndex, range.startIndex, range.endIndex);
}

function instructionType(instruction) {
  const sign = Number(instruction.sign);
  if (sign === 4) return "arrive";
  if (sign === 2) return "right";
  if (sign === -2) return "left";
  if (sign === 1) return "slight-right";
  if (sign === -1) return "slight-left";
  return "continue";
}

function coordinateAtProgress(model, progressMeters) {
  const progress = clamp(progressMeters, 0, model.totalDistance || 0);
  for (let index = 0; index < model.points.length - 1; index += 1) {
    const startDistance = model.cumulative[index] || 0;
    const endDistance = model.cumulative[index + 1] || startDistance;
    if (progress >= startDistance && progress <= endDistance) {
      const segmentLength = Math.max(0.0001, endDistance - startDistance);
      return interpolateCoordinate(model.points[index], model.points[index + 1], (progress - startDistance) / segmentLength);
    }
  }
  return model.points[model.points.length - 1];
}

function turnType(delta) {
  const abs = Math.abs(delta);
  if (abs >= 135) return "uturn";
  if (abs >= 70) return delta > 0 ? "right" : "left";
  return delta > 0 ? "slight-right" : "slight-left";
}

function turnText(delta) {
  const type = turnType(delta);
  if (type === "uturn") return "Turn around";
  if (type === "right") return "Turn right";
  if (type === "left") return "Turn left";
  if (type === "slight-right") return "Keep right";
  return "Keep left";
}

function interpolateCoordinate(start, end, t) {
  return [
    Number(start[0]) + (Number(end[0]) - Number(start[0])) * t,
    Number(start[1]) + (Number(end[1]) - Number(start[1])) * t,
  ];
}

function isCoordinate(value) {
  return Array.isArray(value) && value.length >= 2 && Number.isFinite(Number(value[0])) && Number.isFinite(Number(value[1]));
}

function normalizeBearing(value) {
  return ((value % 360) + 360) % 360;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function degToRad(value) {
  return (Number(value) * Math.PI) / 180;
}

function radToDeg(value) {
  return (Number(value) * 180) / Math.PI;
}
