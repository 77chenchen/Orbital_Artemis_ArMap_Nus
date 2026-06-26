import maplibregl from "maplibre-gl";

const DEFAULT_MAP_STYLE = "https://tiles.openfreemap.org/styles/liberty";
const SG_MY_BOUNDS = [
  [99.35, 0.65],
  [119.55, 7.75],
];

export default function initMap(container) {
  const map = new maplibregl.Map({
    container,
    style: import.meta.env.VITE_MAP_STYLE_URL || DEFAULT_MAP_STYLE,
    center: [103.7764, 1.2966],
    zoom: 16.5,
    minZoom: 6,
    maxZoom: 24,
    attributionControl: true,
  });

  map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "bottom-right");
  map.addControl(new maplibregl.ScaleControl({ maxWidth: 120, unit: "metric" }), "bottom-left");
  map.addControl(
  new maplibregl.GeolocateControl({
    positionOptions: {
      enableHighAccuracy: true,
    },
    trackUserLocation: true,
    showUserHeading: true,
  }),
  "bottom-right"
);

  return map;
}
