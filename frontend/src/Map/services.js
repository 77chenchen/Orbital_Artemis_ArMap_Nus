import getSuggestions from "./geocoding";
import getShortestRoutes from "./routing";

export async function geocode(query, size = 1) {
  const res = await getSuggestions(query, size);
  return res?.[0]?.geometry?.coordinates;
}

export async function route(start, end, mode = "foot") {
  if (!start || !end) return null;

  const r = await getShortestRoutes(start, end, mode);
  return r?.points || null;
}


export function watchLocation(onUpdate) {
  const watchId = navigator.geolocation.watchPosition(
    (pos) => {
      const lat = pos.coords.latitude;
      const lon = pos.coords.longitude;

      onUpdate([lon, lat]);
    },
    (err) => console.error(err),
    {
      enableHighAccuracy: true,
      maximumAge: 0,
    }
  );

  return watchId;
}