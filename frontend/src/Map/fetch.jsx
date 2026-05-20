import React from "react";

// FETCH BUILDINGS
async function fetchBuildings(bounds) {
    const query = `
      [out:json][timeout:25];
      (
        way["building"](${bounds.s},${bounds.w},${bounds.n},${bounds.e});
        way["residential"](${bounds.s},${bounds.w},${bounds.n},${bounds.e});
        way["amenities"](${bounds.s},${bounds.w},${bounds.n},${bounds.e});
        way["landuse"](${bounds.s},${bounds.w},${bounds.n},${bounds.e});
      );
      out geom center;
    `;

    const res = await fetch(
      "https://overpass-api.de/api/interpreter",
      {
        method: "POST",
        body: query,
      }
    );

    const data = await res.json();

    return data.elements;
}

//  FETCH SAMPLE ROUTE
async function fetchRoute(start, end) {
    const url = `
      https://router.project-osrm.org/route/v1/walking/
      ${start[0]},${start[1]};
      ${end[0]},${end[1]}
      ?overview=full&geometries=geojson
    `.replace(/\s+/g, "");

    const res = await fetch(url);

    const data = await res.json();

    return data.routes[0].geometry;
}

export { fetchBuildings, fetchRoute };