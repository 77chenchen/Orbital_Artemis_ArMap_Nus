// Changchun route used for real mobile AR testing when no route is passed from
// the map page. Coordinates are [longitude, latitude], matching GeoJSON/map APIs.
export const CHANGCHUN_ROUTE_DATA = {
  start: { label: "Changchun People's Square", coords: [125.32386, 43.8869] },
  end: { label: "Changchun Railway Station South Square", coords: [125.32505, 43.9091] },
  mode: "WALK",
  points: [
    [125.32386, 43.8869],
    [125.32378, 43.8896],
    [125.32376, 43.8924],
    [125.32384, 43.8952],
    [125.32402, 43.8982],
    [125.32428, 43.9013],
    [125.32456, 43.9042],
    [125.32482, 43.9068],
    [125.32505, 43.9091],
  ],
};

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
