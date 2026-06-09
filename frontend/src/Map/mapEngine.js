import maplibregl from "maplibre-gl";

export class MapEngine {
  constructor(map) {
    this.map = map;
    this.markers = [];
    this.location = null;
  }

  setLocation(coord) {
    this.location = new maplibregl.Marker()
      .setLngLat(coord)
      .addTo(this.map);
  }

  track(coord, { fly = true } = {}) {
    if (!this.location) {
      this.setLocation(coord);
      return;
    }
    this.location.setLngLat(coord);
    if (fly) this.flyTo(coord);
  }

  closeLocation() {
    if (!this.location) return;
    this.location.remove();
    this.location = null;
  }

  flyTo(coord) {
    this.map.flyTo({ center: coord, zoom: 17 });
  }

  clear() {
    for (const marker of this.markers) {
      marker.remove();
    }
    this.markers = [];
  }

  setMarker(coord, { fly = true } = {}) {

    let marker = new maplibregl.Marker()
      .setLngLat(coord)
      .addTo(this.map);

    this.markers.push(marker);

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