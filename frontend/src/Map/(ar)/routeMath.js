const EARTH_RADIUS_METERS = 6378137;
const MIN_TURN_ANGLE = 28;

export function buildRouteModel(routeData = {}) {
  const points = normalizeRoutePoints(routeData.points || flattenSegments(routeData.segments));
  if (points.length < 2) {
    return {
      points,
      cumulative: points.map(() => 0),
      totalDistance: 0,
      maneuvers: [],
    };
  }

  const origin = points[0];
  const cumulative = [0];
  for (let index = 1; index < points.length; index += 1) {
    cumulative[index] = cumulative[index - 1] + haversineDistance(points[index - 1], points[index]);
  }

  return {
    points,
    origin,
    cumulative,
    totalDistance: cumulative[cumulative.length - 1],
    maneuvers: buildManeuvers(points, cumulative, routeData.end?.label),
  };
}

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

export function flattenSegments(segments = []) {
  const result = [];
  for (const segment of segments || []) {
    const coordinates = segment?.coordinates || [];
    for (const coordinate of coordinates) {
      const previous = result[result.length - 1];
      if (previous && coordinate?.[0] === previous[0] && coordinate?.[1] === previous[1]) continue;
      result.push(coordinate);
    }
  }
  return result;
}

export function routeWindow(model, progressMeters = 0, lookBehind = 20, lookAhead = 180) {
  if (!model?.points?.length) return [];
  const start = Math.max(0, progressMeters - lookBehind);
  const end = Math.min(model.totalDistance || 0, progressMeters + lookAhead);
  const windowPoints = [];

  for (let index = 0; index < model.points.length; index += 1) {
    const distance = model.cumulative[index] || 0;
    if (distance >= start && distance <= end) {
      windowPoints.push(model.points[index]);
    }
  }

  if (windowPoints.length < 2) {
    return model.points.slice(0, Math.min(model.points.length, 12));
  }

  return windowPoints;
}

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

export function nextManeuver(model, progressMeters = 0) {
  const maneuvers = model?.maneuvers || [];
  return maneuvers.find((maneuver) => maneuver.distance >= progressMeters + 6) || maneuvers[maneuvers.length - 1] || null;
}

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

export function bearingBetween(start, end) {
  if (!isCoordinate(start) || !isCoordinate(end)) return 0;
  const lat1 = degToRad(start[1]);
  const lat2 = degToRad(end[1]);
  const deltaLng = degToRad(end[0] - start[0]);
  const y = Math.sin(deltaLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(deltaLng);
  return normalizeBearing(radToDeg(Math.atan2(y, x)));
}

export function bearingDelta(from, to) {
  return ((to - from + 540) % 360) - 180;
}

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

export function formatDistance(meters) {
  const value = Number(meters);
  if (!Number.isFinite(value)) return "-";
  if (value >= 1000) return `${(value / 1000).toFixed(1)} km`;
  return `${Math.max(0, Math.round(value))} m`;
}

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
