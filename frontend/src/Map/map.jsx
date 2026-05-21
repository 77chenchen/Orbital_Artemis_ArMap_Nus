import { useEffect, useRef, useState } from "react";
import initMap from "./fetch";
import "maplibre-gl/dist/maplibre-gl.css";
import "./map.css";
import getSuggestions from "./geocoding";
import maplibregl from "maplibre-gl";

function flyTo(mapRef, coord) {
  mapRef.current.flyTo({ center: coord, zoom: 17 });
}

function markerAt(markerRef, mapRef, coordinates, fly=true) {
  if (markerRef.current) {
    markerRef.current.remove();
  }
  markerRef.current = new maplibregl.Marker()
  .setLngLat(coordinates)
  .addTo(mapRef.current);

  if (fly) {
    flyTo(mapRef, coordinates);
  }
}

export default function MapScreen() {
  const mapContainer = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const [query, setQuery] = useState("");
  

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


  //minimal set up first, ui ltr
  // TAKE NOTE:
  /* this map is using open route service api that has a rate limit of 40 req / min and 2000-3000 req/month 
  DO NOT SURPASS IT else would be banned from using!!
  */
  return (
    <div className="container">
      <div ref={mapContainer} className="map-container" />

      <form className="search-box"
        onSubmit={(e) => {
          e.preventDefault();
          getSuggestions(query)
          .then(res => {
            res.forEach(r => console.log(r?.properties?.label)); 
            const cood = res?.[0]?.geometry?.coordinates; // for now i only take the top choice, cuz i lazy to do select :p
            markerAt(markerRef, mapRef, cood);
          });
        }}>
        <input
          className="search-input"
          placeholder="Search in Singapore"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </form>
    </div>
  );
}