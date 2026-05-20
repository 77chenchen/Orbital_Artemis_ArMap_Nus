import { useEffect, useRef } from "react";
import initMap from "./fetch";
import "maplibre-gl/dist/maplibre-gl.css";

export default function MapScreen() {
  const mapContainer = useRef(null);
  const mapRef = useRef(null);

  useEffect(() => {
    if (!mapContainer.current) return;
    if (mapRef.current) return;

    const map = initMap(mapContainer.current);
    mapRef.current = map;

    map.on("load", () => {
      console.log("Map fully loaded");
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
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