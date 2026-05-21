import React from "react";
import Openrouteservice from 'openrouteservice-js';
const ORSapi = "eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6IjRmOWQ2MGZkNzdhYjQzMmU5NjY4MWYzY2M1NzljNDBkIiwiaCI6Im11cm11cjY0In0=";


// 1. Initialize the Geocode service with your Openrouteservice API Key
const OrsGeocode = new Openrouteservice.Geocode({ 
  api_key: "eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6IjRmOWQ2MGZkNzdhYjQzMmU5NjY4MWYzY2M1NzljNDBkIiwiaCI6Im11cm11cjY0In0=",
});

export default async function getSuggestions(inputString) {
  try {
    // FIX: Use .geocode() instead of .autocomplete()
    const response = await OrsGeocode.geocode({
      text: inputString, // This triggers the Pelias type-ahead logic
      size: 5,
      boundary_country: "SG",
    });

    const features = response.features;
    /*features.forEach(feature => {
      console.log("Label:", feature.properties.label);
      console.log("Coordinates:", feature.geometry.coordinates);
    }); */ //for debugging
    return features || [];
  } catch (err) {
    console.error("Autocomplete failed:", err);
    return [];
  }
}