import { useEffect, useRef, useState } from "react";
import initMap from "./fetch";
import "maplibre-gl/dist/maplibre-gl.css";
import "./map.css";

import SelectList from "./(ui)/selectList";
import { MapEngine } from "./mapEngine";
import { geocode, route } from "./services";
import getSuggestions from "./geocoding";
import RoutingForm from "./(ui)/routingForm";

export default function MapScreen() {
  const mapContainer = useRef(null);
  const engineRef = useRef(null);

  // text (ui only)
  const [queryText, setQueryText] = useState("");
  const [startText, setStartText] = useState("");

  // real routing data (IMPORTANT)
  const [startPlace, setStartPlace] = useState(null);
  const [endPlace, setEndPlace] = useState(null);

  // mode
  const [routing, setRouting] = useState(false);

  // dropdown system
  const [suggestions, setSuggestions] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [activeField, setActiveField] = useState(null);

  // init map
  useEffect(() => {
    const map = initMap(mapContainer.current);
    engineRef.current = new MapEngine(map);
    return () => map.remove();
  }, []);

  
  useEffect(() => {
    if (!activeField) return;

    const value = activeField === "start" ? startText : queryText;

    if (!value.trim()) {
      setSuggestions([]);
      setShowDropdown(false);
      return;
    }

    const timer = setTimeout(async () => {
      const res = await getSuggestions(value);
      setSuggestions(res || []);
      setShowDropdown(true);
    }, 500);

    return () => clearTimeout(timer);
  }, [queryText, startText, activeField]);

  
  useEffect(() => {
    if (!routing) return;
    if (!startPlace || !endPlace) return;

    const engine = engineRef.current;

    const runRoute = async () => {
      const points = await route(
        startPlace.coords,
        endPlace.coords
      );

      if (!points) return;

      engine.clear();
      engine.setMarker(startPlace.coords, { fly: true });
      engine.setMarker(endPlace.coords, { fly: false });
      engine.drawRoute(points);
    };

    runRoute();
  }, [startPlace, endPlace, routing]);

  
  async function handleSubmit(e) {
    e.preventDefault();

    const engine = engineRef.current;

    const result = await getSuggestions(queryText, { opts: 1 });
    const place = result?.[0];
    if (!place) return;

    const label = place.properties.label;
    const coords = place.geometry.coordinates;

    setQueryText(label);
    setEndPlace({ label, coords }); 

    setSuggestions([]);
    setShowDropdown(false);

    engine.clear();
    engine.setMarker(coords, { fly: true });

    setRouting(true); // optional but makes UX consistent
  }

  
  function searchPlace(place) {
    const engine = engineRef.current;

    if (!routing && place?.geometry?.coordinates) {
      engine.clear();
      engine.setMarker(place.geometry.coordinates, { fly: true });
    }
  }

  return (
    <div className="container">
      <div ref={mapContainer} className="map-container" />

      
      {!routing && (
        <form className="search-box" onSubmit={handleSubmit}>
          <div className="input-container">
            <input
              className="search-input"
              placeholder="Search in Singapore"
              value={queryText}
              onFocus={() => setActiveField("query")}
              onChange={(e) => {
                setQueryText(e.target.value);
                setActiveField("query");
                setShowDropdown(true);
              }}
            />

            {showDropdown && suggestions.length > 0 && (
              <SelectList
                items={suggestions}
                onClick={(d) => {
                  const label = d.properties.label;
                  const coords = d.geometry.coordinates;

                  setQueryText(label);
                  setEndPlace({ label, coords });

                  setActiveField(null);
                  setShowDropdown(false);
                  setSuggestions([]);

                  searchPlace(d);
                }}
              />
            )}
          </div>

          <button
            className="go-button"
            type="button"
            onClick={() => setRouting(true)}
          />
        </form>
      )}

      
      {routing && (
        <RoutingForm
          start={startText}
          end={queryText}
          setStart={setStartText}
          setEnd={setQueryText}
          startPlace={startPlace}
          endPlace={endPlace}
          suggestions={suggestions}
          showDropdown={showDropdown}
          activeField={activeField}
          setActiveField={setActiveField}
          setShowDropdown={setShowDropdown}
          setSuggestions={setSuggestions}
          setStartPlace={setStartPlace}
          setEndPlace={setEndPlace}
        />
      )}
    </div>
  );
}
