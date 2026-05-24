import React from "react";

const ghpAPI = "40b18627-4387-4e0b-b8e6-00a6e80e01c5";
// graphhopper api free tier limited to 500 credits approx to 500 routing req 

export default async function getShortestRoutes(start, end, mode = "foot") {
  const url =
    `https://graphhopper.com/api/1/route?` +
    `point=${start[1]},${start[0]}&` +
    `point=${end[1]},${end[0]}&` +
    `profile=${mode}&` +
    `points_encoded=false&` +
    `key=${ghpAPI}`;

  try {
    const res = await fetch(url);
    const data = await res.json();

    const route = data?.paths?.[0];

    if (!route) throw new Error("No route found");

    return {
      distance: route.distance,
      time: route.time,
      points: route.points.coordinates,
      raw: route
    };
  } catch (err) {
    console.error("GraphHopper error:", err);
    return null;
  }
}