import { api } from "../api";

export default async function getShortestRoutes(start, end, mode = "WALK,TRANSIT") {
  const plan = await api.otpPlan({ from: start, to: end, mode });
  const route = normalizeOtpRoute(plan);
  if (!route) throw new Error("OTP did not return a drawable route");
  return route;
}

function normalizeOtpRoute(plan) {
  const source = plan?.source || "otp";
  const itineraryOptions = (plan?.itineraries || [])
    .map((itinerary, index) => normalizeItinerary(itinerary, { index, source }))
    .filter(Boolean);
  const fallbackOption = normalizePlanSegments(plan, source);
  const alternatives = itineraryOptions.length ? itineraryOptions : fallbackOption ? [fallbackOption] : [];

  if (alternatives.length === 0) return null;

  return {
    ...alternatives[0],
    alternatives,
    raw: plan?.raw || plan,
  };
}

function normalizePlanSegments(plan, source) {
  const segments = normalizeSegments(plan?.segments || []);
  const points = normalizeCoordinates(plan?.points);
  const routePoints = points.length >= 2 ? points : flattenSegmentCoordinates(segments);
  if (routePoints.length < 2 && segments.length === 0) return null;

  return routeOption({
    id: "route-1",
    index: 0,
    distance: plan.distance,
    time: plan.duration,
    points: routePoints,
    segments: segments.length ? segments : [{ mode: "WALK", coordinates: routePoints }],
    source,
  });
}

function normalizeItinerary(itinerary, { index, source }) {
  const segments = normalizeSegments(itinerary?.legs || itinerary?.segments || []);
  const routePoints = flattenSegmentCoordinates(segments);
  if (routePoints.length < 2 && segments.length === 0) return null;

  return routeOption({
    id: `route-${index + 1}`,
    index,
    distance: sumNumbers(segments.map((segment) => segment.distance)),
    time: itinerary?.duration,
    walkTime: itinerary?.walkTime,
    transit: Boolean(itinerary?.transit),
    points: routePoints,
    segments,
    source,
  });
}

function routeOption(option) {
  const time = Number(option.time);
  return {
    ...option,
    label: `Route ${option.index + 1}`,
    time: Number.isFinite(time) ? time : sumNumbers((option.segments || []).map((segment) => segment.duration)),
    distance: Number.isFinite(Number(option.distance)) ? Number(option.distance) : 0,
    segments: option.segments || [],
    points: option.points || [],
  };
}

function normalizeSegments(segments) {
  return segments
    .map((segment) => ({
      ...segment,
      mode: String(segment.mode || "WALK").toUpperCase(),
      routeCode: segment.routeCode || segment.route_code || segment.routeShortName || "",
      routeName: segment.routeName || segment.route_name || segment.routeLongName || "",
      coordinates: normalizeCoordinates(segment.coordinates || segment.geometry?.coordinates || segment.points),
    }))
    .filter((segment) => segment.coordinates.length >= 2);
}

function flattenSegmentCoordinates(segments) {
  const coordinates = [];
  for (const segment of segments) {
    const segmentCoordinates = segment.coordinates || [];
    if (coordinates.length && segmentCoordinates.length) {
      coordinates.push(...segmentCoordinates.slice(1));
    } else {
      coordinates.push(...segmentCoordinates);
    }
  }
  return coordinates;
}

function sumNumbers(values) {
  return values.reduce((total, value) => {
    const number = Number(value);
    return Number.isFinite(number) ? total + number : total;
  }, 0);
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
