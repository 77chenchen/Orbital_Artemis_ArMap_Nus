import React from "react";
import "./ui.css";
import SelectList from "./selectList";

export default function RoutingForm({
  start,
  end,
  setStart,
  setEnd,
  startPlace,
  endPlace,
  suggestions,
  showDropdown,
  activeField,
  setActiveField,
  setShowDropdown,
  setSuggestions,
  setStartPlace,
  setEndPlace,
}) {
  
  return (
    <div className="routing-container">
      <div className="input-wrapper">
        <div className="rout-card">

          <div className="route-markers">
            <div className="dot start" />
            <div className="line" />
            <div className="dot end" />
          </div>

          <div className="route-inputs">
            <input
              className="route-input"
              value={start}
              placeholder="Starting point"
              onFocus={() => setActiveField("start")}
              onChange={(e) => {
                setStart(e.target.value);
                setActiveField("start");
                setShowDropdown(true);
              }}
            />

            <input
              className="route-input"
              value={end}
              placeholder="Destination"
              onFocus={() => setActiveField("query")}
              onChange={(e) => {
                setEnd(e.target.value);
                setActiveField("query");
                setShowDropdown(true);
              }}
            />
          </div>

          <button
            className="swap-button"
            type="button"
            onClick={() => {
              const temp = start;
              setStart(end);
              setEnd(temp);
              const temp2 = startPlace;
              setStartPlace(endPlace);
              setEndPlace(temp2);
            }}
          >
            ⇅
          </button>
        </div>

        
        {showDropdown && suggestions?.length > 0 && (
          <SelectList
            items={suggestions}
            onClick={(d) => {
              const label = d.properties.label;
              const coords = d.geometry.coordinates;

              if (activeField === "start") {
                setStart(label);
                setStartPlace({ label, coords });
              }

              if (activeField === "query") {
                setEnd(label);
                setEndPlace({ label, coords });
              }

              setActiveField(null);
              setShowDropdown(false);
              setSuggestions([]);
            }}
          />
        )}
      </div>
    </div>
  );
}