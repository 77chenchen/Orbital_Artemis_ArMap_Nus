import { api } from "../api";

const ghpAPI = "40b18627-4387-4e0b-b8e6-00a6e80e01c5";
// graphhopper api free tier limited to 500 credits approx to 500 routing req 

export default async function getShortestRoutes(start, end, mode = "WALK,TRANSIT") {
  try {
    const plan = await api.otpPlan({ from: start, to: end, mode });
    const route = normalizeOtpRoute(plan);
    if (route) return route;
  } catch (err) {
    console.warn("OTP route unavailable, falling back to GraphHopper:", err);
  }

  return graphHopperRoute(start, end, mode);
}

async function graphHopperRoute(start, end, mode = "foot") {
  const profile = mode.toLowerCase().includes("bike") ? "bike" : "foot";
  const url =
    `https://graphhopper.com/api/1/route?` +
    `point=${start[1]},${start[0]}&` +
    `point=${end[1]},${end[0]}&` +
    `profile=${profile}&` +
    `weighting=shortest&` +
    `points_encoded=false&` +
    `key=${ghpAPI}`;

  try {
    const res = await fetch(url);
    const data = await res.json();

    const route = data?.paths?.[0];

    if (!route) throw new Error("No route found");

    return {
      distance: route.distance,
      time: route.time,
      points: route.points.coordinates,
      segments: [{ mode: "WALK", coordinates: route.points.coordinates }],
      source: "graphhopper",
      raw: route
    };
  } catch (err) {
    console.error("GraphHopper error:", err);
    return null;
  }
}

function normalizeOtpRoute(plan) {
  const segments = (plan?.segments || plan?.itineraries?.[0]?.legs || [])
    .map((segment) => ({
      ...segment,
      mode: String(segment.mode || "WALK").toUpperCase(),
      coordinates: normalizeCoordinates(segment.coordinates || segment.geometry?.coordinates || segment.points),
    }))
    .filter((segment) => segment.coordinates.length >= 2);

  const points = normalizeCoordinates(plan?.points);
  const routePoints = points.length >= 2 ? points : segments.flatMap((segment) => segment.coordinates);
  if (routePoints.length < 2 && segments.length === 0) return null;

  return {
    distance: plan.distance,
    time: plan.duration,
    points: routePoints,
    segments: segments.length ? segments : [{ mode: "WALK", coordinates: routePoints }],
    source: plan.source || "otp",
    raw: plan.raw || plan,
  };
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
