import maplibregl from "maplibre-gl";

export class MapEngine {
  constructor(map) {
    this.map = map;
    this.marker = null;
  }

  flyTo(coord) {
    this.map.flyTo({ center: coord, zoom: 17 });
  }

  setMarker(coord, { fly = true, removeOld = true } = {}) {
    if (this.marker && removeOld) {
      this.marker.remove();
    }

    this.marker = new maplibregl.Marker()
      .setLngLat(coord)
      .addTo(this.map);

    if (fly) this.flyTo(coord);
  }

  drawRoute(coordinates) {
    const map = this.map;

    const data = {
      type: "Feature",
      geometry: {
        type: "LineString",
        coordinates,
      },
    };

    const source = map.getSource("route");

    if (source) {
      source.setData(data);
      return;
    }

    map.addSource("route", {
      type: "geojson",
      data,
    });

    map.addLayer({
      id: "route-line",
      type: "line",
      source: "route",
      paint: {
        "line-color": "#007aff",
        "line-width": 4,
      },
    });
  }
}