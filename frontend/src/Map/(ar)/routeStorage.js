const ROUTE_SESSION_KEY = "atlas.arRouteData";

// Save the latest route so /ar can recover if React Router state disappears,
// for example after a browser refresh.
export function saveRouteData(routeData) {
  try {
    window.sessionStorage.setItem(ROUTE_SESSION_KEY, JSON.stringify(routeData));
  } catch (error) {
    console.warn("Unable to save AR route data", error);
  }
}

// Prefer fresh route data passed from the map page. If none exists, read the
// last route from sessionStorage.
export function readRouteData(routeData) {
  if (routeData?.points?.length || routeData?.segments?.length) {
    saveRouteData(routeData);
    return routeData;
  }

  try {
    const stored = window.sessionStorage.getItem(ROUTE_SESSION_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch (error) {
    console.warn("Unable to read AR route data", error);
    return {};
  }
}
