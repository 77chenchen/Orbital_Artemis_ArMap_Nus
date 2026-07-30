const DEFAULT_GRAPHHOPPER_API_KEY = "40b18627-4387-4e0b-b8e6-00a6e80e01c5";
const GRAPHHOPPER_ROUTE_URL = "https://graphhopper.com/api/1/route";

export default async function getShortestRoutes(start, end, mode = "foot") {
  if (!isCoordinate(start) || !isCoordinate(end)) {
    throw new Error("Start and end coordinates are required.");
  }

  const profile = graphhopperProfile(mode);
  const apiKey = import.meta.env.VITE_GRAPHHOPPER_API_KEY || DEFAULT_GRAPHHOPPER_API_KEY;
  const params = new URLSearchParams({
    point: `${start[1]},${start[0]}`,
    profile,
    points_encoded: "false",
    locale: "en",
    instructions: "true",
    key: apiKey,
  });
  params.append("point", `${end[1]},${end[0]}`);

  const response = await fetch(`${GRAPHHOPPER_ROUTE_URL}?${params.toString()}`);
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data?.message || `GraphHopper returned ${response.status}`);
  }

  const route = data?.paths?.[0];
  const coordinates = normalizeCoordinates(route?.points?.coordinates);
  const instructions = normalizeInstructions(route?.instructions, coordinates);
  if (!route || coordinates.length < 2) {
    throw new Error("GraphHopper did not return a drawable route.");
  }

  const segment = {
    mode: displayModeForProfile(profile),
    distance: Number(route.distance) || 0,
    duration: Number(route.time) ? Number(route.time) / 1000 : 0,
    coordinates,
    instructions,
  };

  const routeResult = {
    id: "graphhopper-1",
    label: "GraphHopper",
    source: `graphhopper-${profile}`,
    mode: segment.mode,
    distance: segment.distance,
    time: segment.duration,
    duration: segment.duration,
    points: coordinates,
    instructions,
    segments: [segment],
    raw: route,
  };

  return {
    ...routeResult,
    alternatives: [routeResult],
  };
}

function graphhopperProfile(mode) {
  const text = String(mode || "foot").toUpperCase();
  if (text.includes("CAR") || text.includes("DRIVE")) return "car";
  if (text.includes("BICYCLE") || text.includes("BIKE")) return "bike";
  return "foot";
}

function displayModeForProfile(profile) {
  if (profile === "car") return "CAR";
  if (profile === "bike") return "BICYCLE";
  return "WALK";
}

function isCoordinate(value) {
  return Array.isArray(value) && value.length >= 2 && Number.isFinite(Number(value[0])) && Number.isFinite(Number(value[1]));
}

function normalizeCoordinates(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((coord) => {
      if (!Array.isArray(coord) || coord.length < 2) return null;
      const lng = Number(coord[0]);
      const lat = Number(coord[1]);
      if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null;
      return [lng, lat];
    })
    .filter(Boolean);
}

function normalizeInstructions(value, coordinates) {
  if (!Array.isArray(value)) return [];
  return value
    .map((instruction, index) => {
      const interval = Array.isArray(instruction.interval) ? instruction.interval.map((item) => Number(item)) : [];
      const from = Number.isFinite(interval[0]) ? interval[0] : 0;
      const to = Number.isFinite(interval[1]) ? interval[1] : from;
      const coordinate = coordinates[Math.min(Math.max(from, 0), Math.max(0, coordinates.length - 1))] || null;
      return {
        id: `graphhopper-step-${index}`,
        text: String(instruction.text || "").trim() || instructionTextForSign(instruction.sign),
        sign: Number(instruction.sign) || 0,
        interval: [from, to],
        distance: Number(instruction.distance) || 0,
        duration: Number(instruction.time) ? Number(instruction.time) / 1000 : 0,
        streetName: instruction.street_name || "",
        coordinate,
      };
    })
    .filter((instruction) => instruction.text);
}

function instructionTextForSign(sign) {
  const value = Number(sign);
  if (value === 4) return "Arrive";
  if (value === 2) return "Turn right";
  if (value === -2) return "Turn left";
  if (value === 1) return "Keep right";
  if (value === -1) return "Keep left";
  return "Continue";
}
