import maplibregl from "maplibre-gl";

export default function initMap(container) {
  return new maplibregl.Map({
    container,

    style: {
      version: 8,
      sources: {
        osm: {
          type: "raster",
          tiles: [
            "https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          ],
          tileSize: 256
        }
      },
      layers: [
        {
          id: "osm",
          type: "raster",
          source: "osm"
        }
      ]
    },

    center: [103.7764, 1.2966], // center to be nus
    zoom: 16
  });
}

