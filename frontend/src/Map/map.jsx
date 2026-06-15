import { useCallback, useEffect, useRef, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import initMap from "./fetch";
import "maplibre-gl/dist/maplibre-gl.css";

import SelectList from "./(ui)/selectList";
import { MapEngine } from "./mapEngine";
import { route, watchLocation } from "./services";
import getSuggestions from "./geocoding";
import RoutingForm from "./(ui)/routingForm";
import { api } from "../api";
import { installBusLayers, setActiveBuses, setRoutePickupPoints } from "./busLayer";

export default function MapScreen({ embedded = false }) {
  const [mapHostElement, setMapHostElement] = useState(null);
  const mapRef = useRef(null);
  const engineRef = useRef(null);

  const [queryText, setQueryText] = useState("");
  const [startText, setStartText] = useState("");
  const [startPlace, setStartPlace] = useState(null);
  const [endPlace, setEndPlace] = useState(null);
  const [routing, setRouting] = useState(false);
  const [followLocation, setFollowLocation] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [activeField, setActiveField] = useState(null);

  const [busReady, setBusReady] = useState(false);
  const [busRoutes, setBusRoutes] = useState([]);
  const [selectedRoute, setSelectedRoute] = useState("D1");
  const [selectedStop, setSelectedStop] = useState(null);
  const [pickupPoints, setPickupPoints] = useState([]);
  const [arrivalRows, setArrivalRows] = useState([]);
  const [showArrivals, setShowArrivals] = useState(false);
  const [arrivalLoading, setArrivalLoading] = useState(false);
  const [busError, setBusError] = useState("");

  const captureMapContainer = useCallback((node) => {
    if (!node) {
      setMapHostElement(null);
      return;
    }

    setMapHostElement(resolveHostElement(node));
  }, []);

  useEffect(() => {
    const onLoaded = () => {
      console.log("XR8 =", window.XR8);
    };

    if (window.XR8) {
      onLoaded();
      return undefined;
    }

    window.addEventListener("xrloaded", onLoaded, { once: true });
    return () => window.removeEventListener("xrloaded", onLoaded);
  }, []);

  useEffect(() => {
    const element = mapHostElement;
    if (!element) {
      return undefined;
    }

    element.innerHTML = "";
    const mount = document.createElement("div");
    mount.dataset.atlasMapMount = "true";
    Object.assign(mount.style, {
      position: "absolute",
      inset: "0",
      width: "100%",
      height: "100%",
      minHeight: "300px",
    });
    element.appendChild(mount);

    let map;
    try {
      map = initMap(mount);
    } catch (err) {
      mount.remove();
      setBusError(err instanceof Error ? err.message : "Map failed to load.");
      return undefined;
    }

    mapRef.current = map;
    engineRef.current = new MapEngine(map);

    let cleanupBusLayer = null;
    let cancelled = false;

    async function handleBusStopSelect(stop) {
      setSelectedStop(stop);
      setShowArrivals(false);
      setArrivalRows([]);
      setBusError("");
    }

    async function loadBusLayer() {
      try {
        const [stops, routes] = await Promise.all([api.busStops(), api.busRoutes()]);
        if (cancelled) return;

        cleanupBusLayer = installBusLayers(map, stops, handleBusStopSelect);
        setBusRoutes(routes);

        const preferredRoute = routes.some((item) => item.code === "D1") ? "D1" : routes[0]?.code || "";
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

    map.on("load", loadBusLayer);

    const resizeMap = () => {
      if (mapRef.current) {
        mapRef.current.resize();
      }
    };
    const animationFrame = window.requestAnimationFrame(resizeMap);
    const timer = window.setTimeout(resizeMap, 250);
    const resizeObserver = typeof ResizeObserver !== "undefined" ? new ResizeObserver(resizeMap) : null;
    resizeObserver?.observe(element);
    resizeObserver?.observe(mount);

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(animationFrame);
      window.clearTimeout(timer);
      resizeObserver?.disconnect();
      map.off("load", loadBusLayer);
      try {
        cleanupBusLayer?.();
      } catch (err) {
        console.warn("Bus layer cleanup failed", err);
      }
      mapRef.current = null;
      engineRef.current = null;
      try {
        map.remove();
      } catch (err) {
        console.warn("Map cleanup failed", err);
      }
      if (mount.isConnected) {
        mount.remove();
      }
    };
  }, [mapHostElement]);

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

    async function loadPickupPoints() {
      try {
        const points = await api.busPickupPoints(selectedRoute);
        if (!cancelled && mapRef.current) {
          const sortedPoints = [...(points || [])].sort((a, b) => (a.seq || 0) - (b.seq || 0));
          const routeCoordinates = await buildRoadRoute(sortedPoints);
          if (cancelled || !mapRef.current) return;
          setPickupPoints(sortedPoints);
          setRoutePickupPoints(mapRef.current, sortedPoints, routeCoordinates);
        }
      } catch (err) {
        if (!cancelled) {
          setPickupPoints([]);
          setBusError(err.message);
          if (mapRef.current) {
            setRoutePickupPoints(mapRef.current, []);
          }
        }
      }
    }

    loadPickupPoints();
    refreshActiveBus();
    const timer = window.setInterval(refreshActiveBus, 15000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [busReady, selectedRoute]);

  useEffect(() => {
    if (!activeField) return undefined;

    const value = activeField === "start" ? startText : queryText;
    if (!value.trim()) {
      setSuggestions([]);
      setShowDropdown(false);
      return undefined;
    }

    const timer = window.setTimeout(async () => {
      const res = await getSuggestions(value);
      setSuggestions(res || []);
      setShowDropdown(true);
    }, 500);

    return () => window.clearTimeout(timer);
  }, [queryText, startText, activeField]);

  useEffect(() => {
    if (!routing || !startPlace || !endPlace) return;

    const engine = engineRef.current;
    if (!engine) return;

    async function runRoute() {
      const routeResult = await route(startPlace.coords, endPlace.coords, "WALK,TRANSIT");
      const drawableRoute = routeResult?.segments?.length ? routeResult.segments : routeResult?.points;
      if (!drawableRoute) return;

      engine.clear();
      engine.setMarker(startPlace.coords, { fly: true });
      engine.setMarker(endPlace.coords, { fly: false });
      engine.drawRoute(drawableRoute, { mode: "WALK" });
    }

    runRoute();
  }, [startPlace, endPlace, routing]);

  useEffect(() => {
    const engine = engineRef.current;
    if (!followLocation || !engine) return undefined;

    if (!navigator.geolocation) {
      setBusError("Geolocation is not supported in this browser.");
      setFollowLocation(false);
      return undefined;
    }

    const watchId = watchLocation((pos) => {
      engine.track(pos, { fly: true });
    });

    return () => {
      navigator.geolocation.clearWatch(watchId);
      engine.closeLocation();
    };
  }, [followLocation]);

  async function handleSubmit() {
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

    engine?.clear();
    engine?.setMarker(coords, { fly: true });
    setRouting(true);
  }

  function searchPlace(place) {
    const engine = engineRef.current;

    if (!routing && place?.geometry?.coordinates) {
      engine?.clear();
      engine?.setMarker(place.geometry.coordinates, { fly: true });
    }
  }

  async function loadRouteArrivalDashboard() {
    const stopsToCheck =
      pickupPoints.length > 0
        ? pickupPoints
        : selectedStop
          ? [{ stopCode: selectedStop.code, pickupName: selectedStop.name }]
          : [];
    if (stopsToCheck.length === 0) return;

    setArrivalLoading(true);
    setBusError("");
    try {
      const arrivals = await Promise.all(
        stopsToCheck.map(async (point) => {
          const stopCode = point.stopCode || point.code;
          const arrival = await api.busArrivals(stopCode);
          return { point, arrival };
        }),
      );
      const rows = arrivals.flatMap(({ point, arrival }) =>
        (arrival.routes || []).map((routeItem) => ({
          stopCode: arrival.stopCode || point.stopCode || point.code,
          stopName: arrival.stopName || point.pickupName || point.longName || point.name || point.stopCode,
          routeCode: routeItem.routeCode,
          arrivalTime: routeItem.arrivalTime || "",
          nextArrivalTime: routeItem.nextArrivalTime || "",
          arrivalTimeAt: routeItem.arrivalTimeAt || "",
          nextArrivalTimeAt: routeItem.nextArrivalTimeAt || "",
          arrivalMinutes: routeItem.arrivalMinutes || [],
          crowdLevel: routeItem.crowdLevel || "",
          vehiclePlate: routeItem.vehiclePlate || "",
          nextArrivalVehicle: routeItem.nextArrivalVehicle || "",
          source: arrival.source || point.source || "unknown",
          updatedAt: arrival.updatedAt,
        })),
      );
      setArrivalRows(rows);
      setShowArrivals(true);
    } catch (err) {
      setBusError(err.message);
    } finally {
      setArrivalLoading(false);
    }
  }

  const arrivalDisabled = arrivalLoading || (!selectedStop && pickupPoints.length === 0);
  const source = arrivalRows[0]?.source || "no data";

  return (
    <View style={[styles.container, embedded && styles.containerEmbedded]}>
      <View ref={captureMapContainer} style={styles.mapContainer} />
      <View style={styles.routeLegend}>
        <LegendItem color="#2563eb" label="Walk" />
        <LegendItem color="#dc2626" label="Bus" />
        <LegendItem color="#16a34a" label="Rail" />
      </View>

      {!routing ? (
        <View style={styles.searchBox}>
          <View style={styles.inputContainer}>
            <TextInput
              placeholder="Search in Singapore"
              placeholderTextColor="#777777"
              value={queryText}
              onFocus={() => setActiveField("query")}
              onChangeText={(value) => {
                setQueryText(value);
                setActiveField("query");
                setShowDropdown(true);
              }}
              onSubmitEditing={handleSubmit}
              style={styles.searchInput}
            />

            {showDropdown && suggestions.length > 0 ? (
              <SelectList
                items={suggestions}
                onClick={(place) => {
                  const label = place.properties.label;
                  const coords = place.geometry.coordinates;

                  setQueryText(label);
                  setEndPlace({ label, coords });
                  setActiveField(null);
                  setShowDropdown(false);
                  setSuggestions([]);
                  searchPlace(place);
                }}
              />
            ) : null}
          </View>

          <Pressable onPress={handleSubmit} style={({ pressed }) => [styles.goButton, pressed && styles.pressed]}>
            <Text style={styles.goButtonText}>Go</Text>
          </Pressable>
        </View>
      ) : null}

      {routing ? (
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
      ) : null}

      <ScrollView style={styles.busPanel} contentContainerStyle={styles.busPanelContent}>
        <View style={styles.busPanelHeader}>
          <View style={styles.busTitleBlock}>
            <Text style={styles.busKicker}>NUS NextBus</Text>
            <Text style={styles.busTitle}>Campus Bus Layer</Text>
          </View>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.routeChips}>
          {busRoutes.length > 0 ? (
            busRoutes.map((routeItem) => (
              <Pressable
                key={routeItem.code}
                onPress={() => setSelectedRoute(routeItem.code)}
                style={({ pressed }) => [
                  styles.routeChip,
                  selectedRoute === routeItem.code && styles.routeChipActive,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={[styles.routeChipText, selectedRoute === routeItem.code && styles.routeChipTextActive]}>
                  {routeItem.code}
                </Text>
              </Pressable>
            ))
          ) : (
            <Text style={styles.busMuted}>Routes loading...</Text>
          )}
        </ScrollView>

        {selectedStop ? (
          <View style={styles.busStopCard}>
            <View style={styles.busTitleBlock}>
              <Text style={styles.busKicker}>Selected Stop</Text>
              <Text style={styles.busStopTitle}>{selectedStop.name || selectedStop.code}</Text>
            </View>
            <Text style={styles.stopCode}>{selectedStop.code}</Text>
          </View>
        ) : (
          <Text style={styles.busMuted}>Loading campus shuttle stops...</Text>
        )}

        <Pressable
          disabled={arrivalDisabled}
          onPress={loadRouteArrivalDashboard}
          style={({ pressed }) => [
            styles.busArrivalToggle,
            arrivalDisabled && styles.busArrivalToggleDisabled,
            pressed && !arrivalDisabled && styles.pressed,
          ]}
        >
          <Text style={styles.busArrivalToggleText}>
            {arrivalLoading ? "Loading arrival dashboard..." : "View bus arrival dashboard"}
          </Text>
        </Pressable>

        {showArrivals ? (
          <View style={styles.busArrivalDashboard}>
            <View style={styles.busArrivalDashboardHead}>
              <Text style={styles.busKicker}>Arrival Dashboard</Text>
              <Text style={[styles.sourceBadge, sourceBadgeStyle(source)]}>{source}</Text>
            </View>

            {arrivalRows.length > 0 ? (
              <View style={styles.busArrivalTable}>
                <View style={[styles.busArrivalTableRow, styles.busArrivalTableHeader]}>
                  <Text style={styles.headerText}>Location</Text>
                  <Text style={styles.headerText}>Bus</Text>
                  <Text style={styles.headerText}>Arrival</Text>
                </View>
                {arrivalRows.map((row, index) => (
                  <View style={styles.busArrivalTableRow} key={`${row.stopCode}-${row.routeCode}-${index}`}>
                    <View style={styles.tableCellWide}>
                      <Text numberOfLines={1} style={styles.rowStrong}>
                        {row.stopName || row.stopCode}
                      </Text>
                      <Text numberOfLines={1} style={styles.rowSmall}>
                        {row.stopCode}
                      </Text>
                    </View>
                    <View style={styles.tableCellBus}>
                      <Text style={styles.rowStrong}>{row.routeCode}</Text>
                      {row.vehiclePlate ? (
                        <Text numberOfLines={1} style={styles.rowSmall}>
                          Now {row.vehiclePlate}
                        </Text>
                      ) : null}
                      {row.nextArrivalVehicle ? (
                        <Text numberOfLines={1} style={styles.rowSmall}>
                          Next {row.nextArrivalVehicle}
                        </Text>
                      ) : null}
                    </View>
                    <View style={styles.tableCellArrival}>
                      <Text style={styles.rowStrong}>{formatArrivalPair(row)}</Text>
                      <Text style={[styles.crowd, crowdStyle(row.crowdLevel)]}>{row.crowdLevel || "live"}</Text>
                    </View>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={styles.busMuted}>No arrival data returned for this route yet.</Text>
            )}

            {arrivalRows[0]?.source === "demo" ? (
              <Text style={styles.busDemoNote}>
                Demo ETA shown. Configure NUS bus API credentials to display live NUS arrivals.
              </Text>
            ) : null}
          </View>
        ) : null}

        {!showArrivals && selectedStop ? (
          <Text style={styles.busMuted}>
            Click the button to fetch each bus arrival time at each pickup point in the selected route.
          </Text>
        ) : null}

        <View style={styles.busPickupList}>
          <Text style={styles.busKicker}>{selectedRoute || "Route"} Pickup Points</Text>
          {pickupPoints.length > 0 ? (
            <View style={styles.pickupItems}>
              {pickupPoints.slice(0, 6).map((point) => (
                <View style={styles.pickupItem} key={`${point.routeCode}-${point.seq}-${point.stopCode}`}>
                  <Text style={styles.pickupSeq}>{point.seq}</Text>
                  <Text style={styles.pickupName}>{point.pickupName || point.longName || point.stopCode}</Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.busMuted}>No pickup points loaded for this route.</Text>
          )}
        </View>

        {busError ? <Text style={styles.busError}>{busError}</Text> : null}
        <Text style={styles.busFooter}>
          Source: {arrivalRows[0]?.source || pickupPoints[0]?.source || "loading"} - live when NUS bus credentials are
          configured
        </Text>
      </ScrollView>

      <View style={styles.functionalButtons}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={followLocation ? "Stop GPS tracking" : "Start GPS tracking"}
          onPress={() => setFollowLocation((current) => !current)}
          style={({ pressed }) => [
            styles.gpsButton,
            followLocation && styles.gpsButtonActive,
            pressed && styles.pressed,
          ]}
        >
          <Text style={[styles.gpsButtonText, followLocation && styles.gpsButtonTextActive]}>GPS</Text>
        </Pressable>
      </View>
    </View>
  );
}

function LegendItem({ color, label }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={styles.legendText}>{label}</Text>
    </View>
  );
}

function resolveHostElement(node) {
  if (typeof HTMLElement !== "undefined" && node instanceof HTMLElement) {
    return node;
  }

  return null;
}

function sourceBadgeStyle(source) {
  if (source === "nus") return styles.sourceNus;
  if (source === "demo") return styles.sourceDemo;
  return null;
}

function crowdStyle(level) {
  if (level === "low") return styles.crowdLow;
  if (level === "medium") return styles.crowdMedium;
  if (level === "high") return styles.crowdHigh;
  return styles.crowdLive;
}

function formatArrivalPair(row = {}) {
  const first = formatArrival(row.arrivalTime, row.arrivalTimeAt);
  const next = formatArrival(row.nextArrivalTime, row.nextArrivalTimeAt);
  const values = [first, next].filter((item) => item.value !== "-");

  if (values.length > 0) {
    return values.map((item) => `${item.value}${item.unit ? ` ${item.unit}` : ""}`).join(" / ");
  }

  return formatEtas(row.arrivalMinutes);
}

function formatArrival(value, timestamp) {
  if (!value || value === "-") return { value: "-", unit: "" };

  const number = Number(value);
  if (!Number.isNaN(number)) {
    if (number === 0) return { value: "Arr", unit: "" };
    if (number >= 60 && timestamp) return { value: formatClock(timestamp), unit: "" };
    return { value: String(number), unit: "min" };
  }

  return { value, unit: "" };
}

function formatEtas(minutes = []) {
  if (!minutes.length) return "Check app";
  return minutes.map((minute) => (minute === 0 ? "Arr" : `${minute} min`)).join(" / ");
}

function formatClock(timestamp) {
  const match = String(timestamp).match(/(\d{1,2}):(\d{2})/);
  if (!match) return timestamp;

  let hour = Number(match[1]);
  const suffix = hour < 12 ? "am" : "pm";
  hour = hour % 12 || 12;
  return `${hour}:${match[2]}${suffix}`;
}

async function buildRoadRoute(points = []) {
  const sortedPoints = points
    .filter((point) => point.latitude && point.longitude)
    .sort((a, b) => (a.seq || 0) - (b.seq || 0));

  if (sortedPoints.length < 2) {
    return [];
  }

  try {
    const coordinates = sortedPoints.map((point) => `${point.longitude},${point.latitude}`).join(";");
    const response = await fetch(
      `https://router.project-osrm.org/route/v1/driving/${coordinates}?overview=full&geometries=geojson&continue_straight=false`,
    );
    const data = await response.json();
    const routeCoordinates = data?.routes?.[0]?.geometry?.coordinates;
    return Array.isArray(routeCoordinates) ? routeCoordinates : [];
  } catch (err) {
    console.error("OSRM bus route error:", err);
    return [];
  }
}

const styles = StyleSheet.create({
  container: {
    position: "relative",
    width: "100vw",
    height: "100vh",
    overflow: "hidden",
  },
  containerEmbedded: {
    width: "100%",
    height: "100%",
    minHeight: 420,
  },
  mapContainer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
  },
  routeLegend: {
    position: "absolute",
    left: 20,
    bottom: 20,
    zIndex: 9,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "rgba(15, 23, 42, 0.12)",
    borderRadius: 8,
    backgroundColor: "rgba(255, 255, 255, 0.92)",
    boxShadow: "0 10px 26px rgba(15, 23, 42, 0.14)",
    backdropFilter: "blur(10px)",
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  legendDot: {
    width: 20,
    height: 4,
    borderRadius: 999,
  },
  legendText: {
    color: "#0f172a",
    fontSize: 12,
    fontWeight: "800",
  },
  searchBox: {
    position: "absolute",
    top: 20,
    left: 20,
    zIndex: 10,
    width: 400,
    maxWidth: "calc(100vw - 40px)",
    minHeight: 70,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 18,
    paddingHorizontal: 24,
    borderWidth: 1,
    borderColor: "rgba(0, 0, 0, 0.08)",
    borderRadius: 25,
    backgroundColor: "#ffffff",
    backdropFilter: "blur(10px)",
  },
  inputContainer: {
    position: "relative",
    flex: 1,
    zIndex: 20,
  },
  searchInput: {
    width: "100%",
    borderWidth: 0,
    outlineStyle: "none",
    color: "#111111",
    backgroundColor: "transparent",
    fontSize: 17,
  },
  goButton: {
    minWidth: 44,
    minHeight: 38,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
    backgroundColor: "#ae04dd",
  },
  goButtonText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "900",
  },
  pressed: {
    transform: [{ scale: 0.985 }],
  },
  busPanel: {
    position: "absolute",
    top: 20,
    right: 20,
    zIndex: 10,
    width: "min(360px, calc(100vw - 40px))",
    maxHeight: "calc(100vh - 40px)",
    borderWidth: 1,
    borderColor: "rgba(15, 23, 42, 0.12)",
    borderRadius: 8,
    backgroundColor: "rgba(255, 255, 255, 0.94)",
    boxShadow: "0 18px 50px rgba(15, 23, 42, 0.18)",
    backdropFilter: "blur(10px)",
  },
  busPanelContent: {
    gap: 12,
    padding: 16,
  },
  busPanelHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  busTitleBlock: {
    minWidth: 0,
    gap: 3,
  },
  busKicker: {
    color: "#0f766e",
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  busTitle: {
    color: "#111827",
    fontSize: 20,
    fontWeight: "800",
    lineHeight: 26,
  },
  routeChips: {
    gap: 8,
    paddingRight: 4,
  },
  routeChip: {
    minWidth: 52,
    minHeight: 36,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 8,
    backgroundColor: "#ffffff",
  },
  routeChipActive: {
    borderColor: "#0f766e",
    backgroundColor: "#0f766e",
  },
  routeChipText: {
    color: "#0f172a",
    fontSize: 13,
    fontWeight: "900",
  },
  routeChipTextActive: {
    color: "#ffffff",
  },
  busStopCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    borderWidth: 1,
    borderColor: "#dbe6e2",
    borderRadius: 8,
    padding: 12,
    backgroundColor: "#f8fbfa",
  },
  busStopTitle: {
    color: "#0f172a",
    fontSize: 16,
    fontWeight: "800",
    lineHeight: 22,
  },
  stopCode: {
    flexShrink: 0,
    borderRadius: 8,
    paddingVertical: 7,
    paddingHorizontal: 9,
    color: "#ffffff",
    backgroundColor: "#0f766e",
    fontSize: 12,
    fontWeight: "900",
  },
  busArrivalToggle: {
    width: "100%",
    minHeight: 40,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#0f766e",
    borderRadius: 8,
    backgroundColor: "#0f766e",
  },
  busArrivalToggleDisabled: {
    opacity: 0.62,
  },
  busArrivalToggleText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "900",
  },
  busArrivalDashboard: {
    gap: 10,
    borderWidth: 1,
    borderColor: "#dbe6e2",
    borderRadius: 8,
    padding: 12,
    backgroundColor: "#f8fbfa",
  },
  busArrivalDashboardHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  sourceBadge: {
    borderRadius: 999,
    paddingVertical: 5,
    paddingHorizontal: 8,
    color: "#475569",
    backgroundColor: "#e2e8f0",
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  sourceNus: {
    color: "#166534",
    backgroundColor: "#dcfce7",
  },
  sourceDemo: {
    color: "#92400e",
    backgroundColor: "#fef3c7",
  },
  busArrivalTable: {
    gap: 6,
  },
  busArrivalTableRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 8,
    padding: 8,
    backgroundColor: "#ffffff",
  },
  busArrivalTableHeader: {
    backgroundColor: "transparent",
  },
  headerText: {
    flex: 1,
    color: "#64748b",
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  tableCellWide: {
    flex: 1.5,
    minWidth: 0,
    gap: 2,
  },
  tableCellBus: {
    width: 64,
    gap: 2,
  },
  tableCellArrival: {
    flex: 0.9,
    minWidth: 92,
    gap: 4,
  },
  rowStrong: {
    color: "#111827",
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 17,
  },
  rowSmall: {
    color: "#64748b",
    fontSize: 11,
    lineHeight: 14,
  },
  crowd: {
    alignSelf: "flex-start",
    borderRadius: 999,
    paddingVertical: 5,
    paddingHorizontal: 8,
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  crowdLow: {
    color: "#166534",
    backgroundColor: "#dcfce7",
  },
  crowdMedium: {
    color: "#92400e",
    backgroundColor: "#fef3c7",
  },
  crowdHigh: {
    color: "#991b1b",
    backgroundColor: "#fee2e2",
  },
  crowdLive: {
    color: "#475569",
    backgroundColor: "#e2e8f0",
  },
  busDemoNote: {
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    color: "#92400e",
    backgroundColor: "#fffbeb",
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "700",
  },
  busPickupList: {
    gap: 8,
    borderWidth: 1,
    borderColor: "#fed7aa",
    borderRadius: 8,
    padding: 12,
    backgroundColor: "#fff7ed",
  },
  pickupItems: {
    gap: 7,
  },
  pickupItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  pickupSeq: {
    width: 22,
    height: 22,
    borderRadius: 50,
    color: "#ffffff",
    backgroundColor: "#f97316",
    fontSize: 11,
    fontWeight: "900",
    lineHeight: 22,
    textAlign: "center",
  },
  pickupName: {
    flex: 1,
    color: "#7c2d12",
    fontSize: 13,
    lineHeight: 17,
    fontWeight: "700",
  },
  busMuted: {
    color: "#64748b",
    fontSize: 13,
    lineHeight: 18,
  },
  busError: {
    borderRadius: 8,
    padding: 10,
    color: "#991b1b",
    backgroundColor: "#fee2e2",
    fontSize: 13,
    fontWeight: "700",
  },
  busFooter: {
    color: "#64748b",
    fontSize: 11,
    lineHeight: 15,
  },
  functionalButtons: {
    position: "absolute",
    left: 20,
    bottom: 20,
    zIndex: 10,
    flexDirection: "row",
    gap: 10,
  },
  gpsButton: {
    width: 54,
    height: 54,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(15, 118, 110, 0.28)",
    borderRadius: 999,
    backgroundColor: "rgba(255, 255, 255, 0.94)",
    boxShadow: "0 16px 40px rgba(15, 23, 42, 0.18)",
  },
  gpsButtonActive: {
    borderColor: "#0f766e",
    backgroundColor: "#0f766e",
  },
  gpsButtonText: {
    color: "#0f766e",
    fontSize: 12,
    fontWeight: "900",
  },
  gpsButtonTextActive: {
    color: "#ffffff",
  },
});
