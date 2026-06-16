#!/usr/bin/env sh
set -eu

OTP_DIR="${OTP_DIR:-otp}"
OSM_URL="${OSM_URL:-https://download.geofabrik.de/asia/malaysia-singapore-brunei-latest.osm.pbf}"
GTFS_URL="${GTFS_URL:-}"

mkdir -p "$OTP_DIR"

if [ ! -f "$OTP_DIR/osm.pbf" ]; then
  echo "Downloading OSM data to $OTP_DIR/osm.pbf"
  curl -L "$OSM_URL" -o "$OTP_DIR/osm.pbf"
else
  echo "Using existing $OTP_DIR/osm.pbf"
fi

if ! ls "$OTP_DIR"/*.zip >/dev/null 2>&1; then
  if [ -n "$GTFS_URL" ]; then
    echo "Downloading GTFS data to $OTP_DIR/gtfs.zip"
    curl -L -C - --retry 3 --retry-delay 5 "$GTFS_URL" -o "$OTP_DIR/gtfs.zip"
  else
    echo "No GTFS .zip found in $OTP_DIR."
    echo "Set GTFS_URL or add a real Singapore/NUS GTFS zip before building OTP if you need transit routes."
  fi
fi

echo "Building OTP graph"
docker compose run --rm otp --build --save

echo "Starting stack"
docker compose up -d --build
