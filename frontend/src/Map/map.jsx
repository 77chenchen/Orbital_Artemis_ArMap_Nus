import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { fetchBuildings, fetchRoute } from "./fetch";

export default function MapScreen() {
  const mapContainer = useRef(null);

  
  // INIT MAP
  
  useEffect(() => {
    const map = new maplibregl.Map({
      container: mapContainer.current,

      style:
        "https://tiles.stadiamaps.com/styles/osm_bright.json",

      center: [103.7764, 1.2966], // nus
      zoom: 16,
    });

    map.on("load", async () => {
      
      // FETCH BUILDINGS
      
      const bounds = {
        s: 1.280,
        w: 103.760,
        n: 1.320,
        e: 103.800,
      }; 

      const buildings = await fetchBuildings(bounds);

      
      // BUILDING POLYGONS
      
      const polygonGeojson = {
        type: "FeatureCollection",

        features: buildings
          .filter((b) => b.geometry)

          .map((b) => ({
            type: "Feature",

            properties: {
              name: b.tags?.name || "",
            },

            geometry: {
              type: "Polygon",

              coordinates: [
                b.geometry.map((p) => [
                  p.lon,
                  p.lat,
                ]),
              ],
            },
          })),
      };

      
      // BUILDING CENTERS
      
      const centerGeojson = {
        type: "FeatureCollection",

        features: buildings
          .filter((b) => b.center )

          .map((b) => ({
            type: "Feature",

            properties: {
              name: b.tags?.name || "",
            },

            geometry: {
              type: "Point",

              coordinates: [
                b.center.lon,
                b.center.lat,
              ],
            },
          })),
      };

      
      // ADD BUILDING SOURCE
      
      map.addSource("building-polygons", {
        type: "geojson",
        data: polygonGeojson,
      });

      
      // DRAW BUILDINGS
      
      map.addLayer({
        id: "building-fill",

        type: "fill",

        source: "building-polygons",

        paint: {
          "fill-color": "#888",
          "fill-opacity": 0.4,
        },
      });

      
      // BUILDING OUTLINES
      
      map.addLayer({
        id: "building-outline",

        type: "line",

        source: "building-polygons",

        paint: {
          "line-color": "#333",
          "line-width": 1,
        },
      });

      
      // ADD CENTER SOURCE
      
      map.addSource("building-centers", {
        type: "geojson",
        data: centerGeojson,
      });

      
      // BUILDING LABELS
      
      map.addLayer({
        id: "building-labels",

        type: "symbol",

        source: "building-centers",

        layout: {
          "text-field": ["get", "name"],
          "text-size": 12,
          "text-anchor": "center",
        },

        paint: {
          "text-color": "#000",
          "text-halo-color": "#fff",
          "text-halo-width": 2,
        },
      });

      
      // FETCH ROUTE
      
      const route = await fetchRoute(
        [103.7764, 1.2966],
        [103.773, 1.300]
      );

      
      // ROUTE SOURCE
      
      map.addSource("route", {
        type: "geojson",

        data: {
          type: "Feature",
          geometry: route,
        },
      });

      
      // DRAW ROUTE
      
      map.addLayer({
        id: "route-line",

        type: "line",

        source: "route",

        paint: {
          "line-color": "#007AFF",
          "line-width": 4,
        },
      });
    });

    return () => map.remove();
  }, []);

  return (
    <div
      ref={mapContainer}
      style={{
        width: "100vw",
        height: "100vh",
      }}
    />
  );
}