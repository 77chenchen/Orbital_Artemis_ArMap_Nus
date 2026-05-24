import { useEffect, useRef, useState } from "react";
import initMap from "./fetch";
import "maplibre-gl/dist/maplibre-gl.css";
import "./map.css";

import { MapEngine } from "./mapEngine";
import { geocode, route } from "./services";

export default function MapScreen() {
  const mapContainer = useRef(null);
  const engineRef = useRef(null);

  const [query, setQuery] = useState("");
  const [start, setStart] = useState("");
  const [routing, setRouting] = useState(false);

  useEffect(() => {
    const map = initMap(mapContainer.current);
    engineRef.current = new MapEngine(map);

    return () => map.remove();
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();

    const engine = engineRef.current;

    if (!routing) {
      const end = await geocode(query);
      if (!end) return;

      engine.setMarker(end);
      return setRouting(true);
    }

    const [startCoord, endCoord] = await Promise.all([
      geocode(start),
      geocode(query),
    ]);

    const points = await route(startCoord, endCoord);

    if (!points) return;

    engine.setMarker(endCoord, { fly: false, removeOld: true });
    engine.setMarker(startCoord, { fly: true, removeOld: false });
    engine.drawRoute(points);
  }

  return (
    <div className="container">
      <div ref={mapContainer} className="map-container" />

      <form className="search-box" onSubmit={handleSubmit}>
        <div className="input-container">
          {routing && (
            <input
              className="search-input"
              placeholder="Start from..."
              value={start}
              onChange={(e) => setStart(e.target.value)}
            />
          )}

          <input
            className="search-input"
            placeholder="Go to..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        {routing && <button className="go-button" />}
      </form>
    </div>
  );
}