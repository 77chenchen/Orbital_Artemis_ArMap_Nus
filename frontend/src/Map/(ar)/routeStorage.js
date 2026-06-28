const ROUTE_SESSION_KEY = "atlas.arRouteData";

export function saveRouteData(routeData) {
  try {
    window.sessionStorage.setItem(ROUTE_SESSION_KEY, JSON.stringify(routeData));
  } catch (error) {
    console.warn("Unable to save AR route data", error);
  }
}

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
