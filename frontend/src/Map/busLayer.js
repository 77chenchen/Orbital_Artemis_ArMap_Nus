export function installBusLayers(map, stops, onStopClick) {
  map.addSource("bus-stops", {
    type: "geojson",
    data: busStopsGeoJSON(stops),
  });

  map.addLayer({
    id: "bus-stop-dots",
    type: "circle",
    source: "bus-stops",
    paint: {
      "circle-color": "#0f766e",
      "circle-radius": 6,
      "circle-stroke-color": "#ffffff",
      "circle-stroke-width": 2,
    },
  });

  map.addLayer({
    id: "bus-stop-labels",
    type: "symbol",
    source: "bus-stops",
    layout: {
      "text-field": ["get", "code"],
      "text-size": 11,
      "text-offset": [0, 1.2],
      "text-anchor": "top",
    },
    paint: {
      "text-color": "#083f3a",
      "text-halo-color": "#ffffff",
      "text-halo-width": 1.5,
    },
  });

  map.addSource("active-buses", {
    type: "geojson",
    data: activeBusGeoJSON([]),
  });

  map.addLayer({
    id: "active-bus-dots",
    type: "circle",
    source: "active-buses",
    paint: {
      "circle-color": [
        "match",
        ["get", "crowdLevel"],
        "high",
        "#dc2626",
        "medium",
        "#d97706",
        "low",
        "#16a34a",
        "#2563eb",
      ],
      "circle-radius": 8,
      "circle-stroke-color": "#ffffff",
      "circle-stroke-width": 2,
    },
  });

  map.addLayer({
    id: "active-bus-labels",
    type: "symbol",
    source: "active-buses",
    layout: {
      "text-field": ["get", "plate"],
      "text-size": 10,
      "text-offset": [0, -1.4],
      "text-anchor": "bottom",
    },
    paint: {
      "text-color": "#111827",
      "text-halo-color": "#ffffff",
      "text-halo-width": 1.5,
    },
  });

  const handleClick = (event) => {
    const feature = event.features?.[0];
    if (!feature) return;
    onStopClick({
      code: feature.properties.code,
      name: feature.properties.name,
    });
  };
  const showPointer = () => {
    map.getCanvas().style.cursor = "pointer";
  };
  const clearPointer = () => {
    map.getCanvas().style.cursor = "";
  };

  map.on("click", "bus-stop-dots", handleClick);
  map.on("mouseenter", "bus-stop-dots", showPointer);
  map.on("mouseleave", "bus-stop-dots", clearPointer);

  return () => {
    map.off("click", "bus-stop-dots", handleClick);
    map.off("mouseenter", "bus-stop-dots", showPointer);
    map.off("mouseleave", "bus-stop-dots", clearPointer);
  };
}

export function setActiveBuses(map, vehicles) {
  const source = map.getSource("active-buses");
  if (source) {
    source.setData(activeBusGeoJSON(vehicles));
  }
}

function busStopsGeoJSON(stops) {
  return {
    type: "FeatureCollection",
    features: stops
      .filter((stop) => stop.latitude && stop.longitude)
      .map((stop) => ({
        type: "Feature",
        properties: {
          code: stop.code,
          name: stop.name,
        },
        geometry: {
          type: "Point",
          coordinates: [stop.longitude, stop.latitude],
        },
      })),
  };
}

function activeBusGeoJSON(vehicles) {
  return {
    type: "FeatureCollection",
    features: vehicles
      .filter((vehicle) => vehicle.latitude && vehicle.longitude)
      .map((vehicle) => ({
        type: "Feature",
        properties: {
          plate: vehicle.plate,
          crowdLevel: vehicle.crowdLevel || "",
        },
        geometry: {
          type: "Point",
          coordinates: [vehicle.longitude, vehicle.latitude],
        },
      })),
  };
}
