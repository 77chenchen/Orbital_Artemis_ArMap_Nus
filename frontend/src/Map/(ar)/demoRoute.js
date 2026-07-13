// Hardcoded data for /ar?demo=1.
// Coordinates are [longitude, latitude], matching GeoJSON/map APIs.
export const DEMO_ROUTE_DATA = {
  start: { label: "COM 2", coords: [103.77388, 1.29486] },
  end: { label: "Central Library", coords: [103.77234, 1.29661] },
  mode: "WALK",
  points: [
    [103.77388, 1.29486],
    [103.77374, 1.29502],
    [103.77355, 1.29522],
    [103.77331, 1.29547],
    [103.77302, 1.29573],
    [103.77272, 1.29602],
    [103.77249, 1.29633],
    [103.77234, 1.29661],
  ],
};

// This image fakes the camera background in demo mode.
export const DEMO_CAMERA_BACKGROUND = "/output/ar_demo/nus-virtual-camera-background.png";
