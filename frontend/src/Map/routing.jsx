import { api } from "../api";

export default async function getShortestRoutes(start, end, mode = "WALK,TRANSIT") {
  const plan = await api.otpPlan({ from: start, to: end, mode });
  const route = normalizeOtpRoute(plan);
  if (!route) throw new Error("OTP did not return a drawable route");
  return route;
}

function normalizeOtpRoute(plan) {
  const segments = (plan?.segments || plan?.itineraries?.[0]?.legs || [])
    .map((segment) => ({
      ...segment,
      mode: String(segment.mode || "WALK").toUpperCase(),
      routeCode: segment.routeCode || segment.route_code || segment.routeShortName || "",
      routeName: segment.routeName || segment.route_name || segment.routeLongName || "",
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
