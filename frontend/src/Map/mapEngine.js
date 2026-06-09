import maplibregl from "maplibre-gl";

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

  drawRoute(coordinates) {
    const data = {
      type: "Feature",
      geometry: {
        type: "LineString",
        coordinates,
      },
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
        "line-color": "#007aff",
        "line-width": 4,
      },
    });
  }
}