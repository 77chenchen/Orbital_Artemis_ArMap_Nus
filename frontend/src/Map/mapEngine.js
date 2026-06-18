import maplibregl from "maplibre-gl";

const ROUTE_MODE_COLORS = {
  WALK: "#2563eb",
  FOOT: "#2563eb",
  BUS: "#dc2626",
  CAR: "#7c3aed",
  BICYCLE: "#ea580c",
  RAIL: "#16a34a",
  METRO: "#16a34a",
  SUBWAY: "#16a34a",
  TRAM: "#16a34a",
  COACH: "#dc2626",
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
    this.clearRoute();
  }

  clearRoute() {
    const source = this.map.getSource("route");
    if (source) {
      source.setData({
        type: "FeatureCollection",
        features: [],
      });
    }
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
      layout: {
        "line-cap": "round",
        "line-join": "round",
      },
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
          "CAR",
          ROUTE_MODE_COLORS.CAR,
          "BICYCLE",
          ROUTE_MODE_COLORS.BICYCLE,
          "RAIL",
          ROUTE_MODE_COLORS.RAIL,
          "METRO",
          ROUTE_MODE_COLORS.METRO,
          "SUBWAY",
          ROUTE_MODE_COLORS.SUBWAY,
          "TRAM",
          ROUTE_MODE_COLORS.TRAM,
          "COACH",
          ROUTE_MODE_COLORS.COACH,
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
          "CAR",
          5,
          "BICYCLE",
          4,
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
