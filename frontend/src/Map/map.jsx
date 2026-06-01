import { useEffect, useRef, useState } from "react";
import initMap from "./fetch";
import "maplibre-gl/dist/maplibre-gl.css";
import "./map.css";

import SelectList from "./(ui)/selectList";
import { MapEngine } from "./mapEngine";
import { geocode, route } from "./services";
import getSuggestions from "./geocoding";
import RoutingForm from "./(ui)/routingForm";
import { api } from "../api";
import { installBusLayers, setActiveBuses } from "./busLayer";

export default function MapScreen() {
  const mapContainer = useRef(null);
  const mapRef = useRef(null);
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

  const [busReady, setBusReady] = useState(false);
  const [busRoutes, setBusRoutes] = useState([]);
  const [selectedRoute, setSelectedRoute] = useState("D1");
  const [selectedStop, setSelectedStop] = useState(null);
  const [arrival, setArrival] = useState(null);
  const [busError, setBusError] = useState("");

  // init map
  useEffect(() => {
    const map = initMap(mapContainer.current);
    mapRef.current = map;
    engineRef.current = new MapEngine(map);

    let cleanupBusLayer = null;
    let cancelled = false;

    async function loadBusLayer() {
      try {
        const [stops, routes] = await Promise.all([
          api.busStops(),
          api.busRoutes(),
        ]);
        if (cancelled) return;

        cleanupBusLayer = installBusLayers(map, stops, handleBusStopSelect);
        setBusRoutes(routes);

        const preferredRoute = routes.some((item) => item.code === "D1")
          ? "D1"
          : routes[0]?.code || "";
        if (preferredRoute) {
          setSelectedRoute(preferredRoute);
        }

        if (stops[0]) {
          await handleBusStopSelect({ code: stops[0].code, name: stops[0].name });
        }

        if (!cancelled) {
          setBusReady(true);
        }
      } catch (err) {
        if (!cancelled) {
          setBusError(err.message);
        }
      }
    }

    async function handleBusStopSelect(stop) {
      setSelectedStop(stop);
      setArrival(null);
      setBusError("");
      try {
        const nextArrival = await api.busArrivals(stop.code);
        if (!cancelled) {
          setArrival(nextArrival);
        }
      } catch (err) {
        if (!cancelled) {
          setBusError(err.message);
        }
      }
    }

    map.on("load", loadBusLayer);

    return () => {
      cancelled = true;
      cleanupBusLayer?.();
      mapRef.current = null;
      map.remove();
    };
  }, []);

  useEffect(() => {
    if (!busReady || !selectedRoute || !mapRef.current) {
      return undefined;
    }

    let cancelled = false;
    async function refreshActiveBus() {
      try {
        const active = await api.activeBus(selectedRoute);
        if (!cancelled && mapRef.current) {
          setActiveBuses(mapRef.current, active.vehicles || []);
        }
      } catch (err) {
        if (!cancelled) {
          setBusError(err.message);
        }
      }
    }

    refreshActiveBus();
    const timer = window.setInterval(refreshActiveBus, 15000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [busReady, selectedRoute]);

  
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

      <section className="bus-panel">
        <div className="bus-panel-header">
          <div>
            <p className="bus-kicker">NUS NextBus</p>
            <h2>Campus Bus Layer</h2>
          </div>
          <select
            value={selectedRoute}
            onChange={(event) => setSelectedRoute(event.target.value)}
            aria-label="Select bus route"
          >
            {busRoutes.map((routeItem) => (
              <option key={routeItem.code} value={routeItem.code}>
                {routeItem.code}
              </option>
            ))}
          </select>
        </div>

        {selectedStop ? (
          <div className="bus-stop-card">
            <div>
              <p className="bus-kicker">Selected Stop</p>
              <h3>{selectedStop.name || selectedStop.code}</h3>
            </div>
            <span>{selectedStop.code}</span>
          </div>
        ) : (
          <p className="bus-muted">Loading campus shuttle stops...</p>
        )}

        <div className="bus-arrivals">
          {(arrival?.routes || []).map((routeItem) => (
            <div className="bus-arrival-row" key={routeItem.routeCode}>
              <strong>{routeItem.routeCode}</strong>
              <span>{formatEtas(routeItem.arrivalMinutes)}</span>
              <em className={`crowd crowd-${routeItem.crowdLevel || "live"}`}>
                {routeItem.crowdLevel || "live"}
              </em>
            </div>
          ))}
          {arrival && arrival.routes?.length === 0 && (
            <p className="bus-muted">No live arrivals for this stop yet.</p>
          )}
        </div>

        {busError && <p className="bus-error">{busError}</p>}
        <p className="bus-footer">
          Source: {arrival?.source || "loading"} · active buses refresh every 15s
        </p>
      </section>
    </div>
  );
}

function formatEtas(minutes = []) {
  if (!minutes.length) return "Check app";
  return minutes.map((minute) => (minute === 0 ? "Arr" : `${minute} min`)).join(" / ");
}
