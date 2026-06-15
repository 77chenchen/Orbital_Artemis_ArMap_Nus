import maplibregl from "maplibre-gl";

const ROUTE_MODE_COLORS = {
  WALK: "#2563eb",
  FOOT: "#2563eb",
  BUS: "#dc2626",
  RAIL: "#16a34a",
  SUBWAY: "#16a34a",
  DEFAULT: "#2563eb",
};

export class MapEngine {
  constructor(map) {
    this.map = map;
    this.markers = [];
    this.locationMarker = null;
  }

  setLocation(coord) {
    this.locationMarker = new maplibregl.Marker()
      .setLngLat(coord)
      .addTo(this.map);
  }

  track(coord, { fly = true } = {}) {
    if (!this.locationMarker) {
      this.setLocation(coord);
      if (fly) this.flyTo(coord); // only the first time gps is on then it flies to the coord
      return;
    }
    this.locationMarker.setLngLat(coord);
  }

  closeLocation() {
    if (!this.locationMarker) return;
    this.locationMarker.remove();
    this.locationMarker = null;
  }

  flyTo(coord) {
    this.map.flyTo({ center: coord, zoom: 17 });
  }

  clear() {
    for (const marker of this.markers) {
      marker.remove();
    }
    this.markers = [];
    this.closeLocation();
  }

  setMarker(coord, { fly = true } = {}) {
    const marker = new maplibregl.Marker()
      .setLngLat(coord)
      .addTo(this.map);

    this.markers.push(marker);

    if (fly) this.flyTo(coord);
  }

  drawRoute(routeInput, { mode = "WALK" } = {}) {
    const features = normalizeRouteFeatures(routeInput, mode);
    const data = {
      type: "FeatureCollection",
      features,
    };

    const source = this.map.getSource("route");

    if (source) {
      source.setData(data);
      return;
    }

    this.map.addSource("route", {
      type: "geojson",
      data,
    });

    this.map.addLayer({
      id: "route-line",
      type: "line",
      source: "route",
      paint: {
        "line-color": [
          "match",
          ["get", "mode"],
          "WALK",
          ROUTE_MODE_COLORS.WALK,
          "FOOT",
          ROUTE_MODE_COLORS.FOOT,
          "BUS",
          ROUTE_MODE_COLORS.BUS,
          "RAIL",
          ROUTE_MODE_COLORS.RAIL,
          "SUBWAY",
          ROUTE_MODE_COLORS.SUBWAY,
          ROUTE_MODE_COLORS.DEFAULT,
        ],
        "line-width": [
          "match",
          ["get", "mode"],
          "WALK",
          4,
          "FOOT",
          4,
          "BUS",
          5,
          "RAIL",
          5,
          4,
        ],
        "line-opacity": 0.9,
      },
    });
  }
}

function normalizeRouteFeatures(routeInput, fallbackMode) {
  if (!Array.isArray(routeInput)) return [];

  const looksLikeCoordinates = Array.isArray(routeInput[0]) && typeof routeInput[0]?.[0] === "number";
  if (looksLikeCoordinates) {
    return routeFeature(routeInput, fallbackMode);
  }

  return routeInput.flatMap((segment) => {
    const coordinates = segment.coordinates || segment.points || segment.geometry?.coordinates || [];
    return routeFeature(coordinates, segment.mode || fallbackMode);
  });
}

function routeFeature(coordinates, mode) {
  if (!Array.isArray(coordinates) || coordinates.length < 2) return [];
  return [
    {
      type: "Feature",
      properties: {
        mode: String(mode || "WALK").toUpperCase(),
      },
      geometry: {
        type: "LineString",
        coordinates,
      },
    },
  ];
}
