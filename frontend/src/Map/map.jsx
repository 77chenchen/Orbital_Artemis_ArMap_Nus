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
import { installBusLayers } from "./busLayer";

const TRAVEL_MODES = [
  { id: "WALK", label: "Walk", otpMode: "WALK" },
  { id: "TRANSIT", label: "Transit", otpMode: "WALK,TRANSIT" },
  { id: "CAR", label: "Drive", otpMode: "CAR" },
  { id: "BICYCLE", label: "Bike", otpMode: "BICYCLE" },
];

export default function MapScreen({ embedded = false }) {
  const [mapHostElement, setMapHostElement] = useState(null);
  const mapRef = useRef(null);
  const engineRef = useRef(null);

  const [queryText, setQueryText] = useState("");
  const [startText, setStartText] = useState("");
  const [startPlace, setStartPlace] = useState(null);
  const [endPlace, setEndPlace] = useState(null);
  const [routing, setRouting] = useState(false);
  const [routeResult, setRouteResult] = useState(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [routeError, setRouteError] = useState("");
  const [travelMode, setTravelMode] = useState(TRAVEL_MODES[1].id);
  const [followLocation, setFollowLocation] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [activeField, setActiveField] = useState(null);

  const [busReady, setBusReady] = useState(false);
  const [selectedStop, setSelectedStop] = useState(null);
  const [trainAlerts, setTrainAlerts] = useState([]);
  const [arrivalRows, setArrivalRows] = useState([]);
  const [showArrivals, setShowArrivals] = useState(false);
  const [arrivalLoading, setArrivalLoading] = useState(false);
  const [busError, setBusError] = useState("");
  const [showBusPanel, setShowBusPanel] = useState(false);

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
        const [nearbyStops, alerts] = await Promise.all([
          api.sgNearbyBusStops({ lat: 1.2966, lng: 103.7764, limit: 18 }),
          api.sgTrainAlerts(),
        ]);
        if (cancelled) return;

        const stops = (nearbyStops || []).map((item) => ({
          ...(item.busStop || item),
          distanceM: item.distanceM,
        }));
        cleanupBusLayer = installBusLayers(map, stops, handleBusStopSelect);
        setTrainAlerts(alerts || []);

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
      setRouteLoading(true);
      setRouteError("");
      try {
        const selectedMode = TRAVEL_MODES.find((item) => item.id === travelMode) || TRAVEL_MODES[1];
        const nextRoute = await route(startPlace.coords, endPlace.coords, selectedMode.otpMode);
        const displayPlan = await routeForDisplay(nextRoute, selectedMode, startPlace.coords, endPlace.coords);
        const drawableRoute = displayPlan?.drawableRoute;
        if (!drawableRoute) {
          throw new Error("No drawable OTP route returned.");
        }

        setRouteResult(displayPlan.routeResult);
        engine.clear();
        engine.setMarker(startPlace.coords, { fly: true });
        engine.setMarker(endPlace.coords, { fly: false });
        engine.drawRoute(drawableRoute, { mode: selectedMode.id });
      } catch (err) {
        setRouteResult(null);
        setRouteError(err instanceof Error ? err.message : "OTP route failed.");
      } finally {
        setRouteLoading(false);
      }
    }

    runRoute();
  }, [startPlace, endPlace, routing, travelMode]);

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
    setRouteResult(null);
    setRouteError("");
    setRouting(true);
  }

  function closeRouting() {
    const engine = engineRef.current;
    setRouting(false);
    setRouteResult(null);
    setRouteError("");
    setRouteLoading(false);
    setActiveField(null);
    setSuggestions([]);
    setShowDropdown(false);
    engine?.clear();
  }

  function searchPlace(place) {
    const engine = engineRef.current;

    if (!routing && place?.geometry?.coordinates) {
      engine?.clear();
      engine?.setMarker(place.geometry.coordinates, { fly: true });
    }
  }

  async function loadRouteArrivalDashboard() {
    const stopsToCheck = selectedStop ? [{ stopCode: selectedStop.code, pickupName: selectedStop.name }] : [];
    if (stopsToCheck.length === 0) return;

    setArrivalLoading(true);
    setBusError("");
    try {
      const arrivals = await Promise.all(
        stopsToCheck.map(async (point) => {
          const stopCode = point.stopCode || point.code;
          const arrival = await api.sgBusArrivals(stopCode);
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

  const arrivalDisabled = arrivalLoading || !selectedStop;
  const source = arrivalRows[0]?.source || "no data";

  return (
    <View style={[styles.container, embedded && styles.containerEmbedded]}>
      <View ref={captureMapContainer} style={styles.mapContainer} />
      <View style={styles.routeLegend}>
        <LegendItem color="#2563eb" label="Walk" />
        <LegendItem color="#dc2626" label="Bus" />
        <LegendItem color="#16a34a" label="Rail" />
        <LegendItem color="#7c3aed" label="Drive" />
        <LegendItem color="#ea580c" label="Bike" />
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
        <View style={styles.routingPanel}>
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
            travelModes={TRAVEL_MODES}
            travelMode={travelMode}
            setTravelMode={setTravelMode}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close route search"
            onPress={closeRouting}
            style={({ pressed }) => [styles.routeCloseButton, pressed && styles.pressed]}
          >
            <Text style={styles.routeCloseText}>×</Text>
          </Pressable>
          <RouteSummary routeResult={routeResult} loading={routeLoading} error={routeError} travelMode={travelMode} />
        </View>
      ) : null}

      {!showBusPanel ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open NUS bus dashboard"
          onPress={() => setShowBusPanel(true)}
          style={({ pressed }) => [styles.busLayerButton, pressed && styles.pressed]}
        >
          <Text style={styles.busLayerButtonIcon}>Bus</Text>
          <View style={styles.busLayerButtonTextBlock}>
            <Text style={styles.busLayerButtonTitle}>SG Transit</Text>
            <Text style={styles.busLayerButtonMeta}>{selectedStop?.code || "Stops"} · {busReady ? "ready" : "loading"}</Text>
          </View>
        </Pressable>
      ) : (
        <ScrollView style={styles.busPanel} contentContainerStyle={styles.busPanelContent}>
          <View style={styles.busPanelHeader}>
            <View style={styles.busTitleBlock}>
              <Text style={styles.busKicker}>LTA DataMall</Text>
              <Text style={styles.busTitle}>Singapore Transit</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close Singapore transit dashboard"
              onPress={() => setShowBusPanel(false)}
              style={({ pressed }) => [styles.panelCloseButton, pressed && styles.pressed]}
            >
              <Text style={styles.panelCloseText}>×</Text>
            </Pressable>
          </View>

          {selectedStop ? (
            <View style={styles.busStopCard}>
              <View style={styles.busTitleBlock}>
                <Text style={styles.busKicker}>Selected Singapore Bus Stop</Text>
                <Text style={styles.busStopTitle}>{selectedStop.name || selectedStop.code}</Text>
              </View>
              <Text style={styles.stopCode}>{selectedStop.code}</Text>
            </View>
          ) : (
            <Text style={styles.busMuted}>Loading nearby Singapore bus stops...</Text>
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
              {arrivalLoading ? "Loading arrivals..." : "Show arrivals"}
            </Text>
          </Pressable>

          {showArrivals ? (
            <View style={styles.busArrivalDashboard}>
              <View style={styles.busArrivalDashboardHead}>
                <Text style={styles.busKicker}>Arrivals</Text>
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
                <Text style={styles.busMuted}>No real-time arrivals returned for this stop yet.</Text>
              )}

              {arrivalRows[0]?.source === "demo-lta" ? (
                <Text style={styles.busDemoNote}>
                  Demo ETA shown. Configure LTA_ACCOUNT_KEY to display live Singapore bus arrivals.
                </Text>
              ) : null}
            </View>
          ) : null}

          <View style={styles.busPickupList}>
            <Text style={styles.busKicker}>MRT/LRT Service Status</Text>
            {trainAlerts.length > 0 ? (
              <View style={styles.pickupItems}>
                {trainAlerts.slice(0, 6).map((alert, index) => (
                  <View style={styles.pickupItem} key={`${alert.line}-${alert.status}-${index}`}>
                    <Text style={styles.trainLineBadge}>{alert.line || "MRT"}</Text>
                    <View style={styles.trainAlertTextBlock}>
                      <Text style={styles.pickupName}>{alert.status}</Text>
                      {alert.message ? <Text style={styles.rowSmall}>{alert.message}</Text> : null}
                    </View>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={styles.busMuted}>No train service alert loaded yet.</Text>
            )}
          </View>

          {busError ? <Text style={styles.busError}>{busError}</Text> : null}
          <Text style={styles.busFooter}>
            Source: {arrivalRows[0]?.source || trainAlerts[0]?.source || "loading"}
          </Text>
        </ScrollView>
      )}

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

function RouteSummary({ routeResult, loading, error, travelMode }) {
  if (loading) {
    return (
      <View style={styles.routeSummary}>
        <Text style={styles.routeSummaryKicker}>OTP {travelModeLabel(travelMode)}</Text>
        <Text style={styles.routeSummaryMuted}>Calculating with OpenTripPlanner...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.routeSummary, styles.routeSummaryError]}>
        <Text style={styles.routeSummaryKicker}>OTP {travelModeLabel(travelMode)}</Text>
        <Text style={styles.routeSummaryErrorText}>{error}</Text>
      </View>
    );
  }

  if (!routeResult) return null;

  const segments = routeResult.segments || [];
  return (
    <View style={styles.routeSummary}>
      <View style={styles.routeSummaryHeader}>
        <View>
          <Text style={styles.routeSummaryKicker}>OTP {travelModeLabel(travelMode)}</Text>
          <Text style={styles.routeSummaryTitle}>{formatDistance(routeResult.distance)} · {formatDuration(routeResult.time)}</Text>
        </View>
        <Text style={styles.routeSourceBadge}>{routeResult.source || "otp"}</Text>
      </View>

      <View style={styles.routeSegmentList}>
        {segments.map((segment, index) => (
          <View style={styles.routeSegmentItem} key={`${segment.mode}-${index}`}>
            <View style={[styles.routeSegmentStripe, { backgroundColor: modeColor(segment.mode) }]} />
            <View style={styles.routeSegmentTextBlock}>
              <View style={styles.routeSegmentTopLine}>
                <Text style={styles.routeSegmentMode}>{displaySegmentMode(segment)}</Text>
                {segment.routeCode ? <Text style={styles.routeLineBadge}>{segment.routeCode}</Text> : null}
              </View>
              <Text style={styles.routeSegmentMeta}>
                {formatDistance(segment.distance)} · {formatDuration(segment.duration)}
              </Text>
              {segment.from || segment.to ? (
                <Text numberOfLines={1} style={styles.routeSegmentStops}>
                  {[segment.from, segment.to].filter(Boolean).join(" to ")}
                </Text>
              ) : null}
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

function displayMode(mode) {
  const text = String(mode || "WALK").toUpperCase();
  if (text === "FOOT") return "WALK";
  if (text === "BICYCLE") return "BIKE";
  if (text === "CAR") return "DRIVE";
  return text;
}

function displaySegmentMode(segment) {
  const mode = displayMode(segment?.mode);
  return mode;
}

function travelModeLabel(mode) {
  const selected = TRAVEL_MODES.find((item) => item.id === mode);
  return selected?.label || "Route";
}

function modeColor(mode) {
  const text = displayMode(mode);
  if (text === "BUS" || text === "COACH") return "#dc2626";
  if (text === "DRIVE") return "#7c3aed";
  if (text === "BIKE") return "#ea580c";
  if (["RAIL", "METRO", "SUBWAY", "TRAM"].includes(text)) return "#16a34a";
  return "#2563eb";
}

function formatDistance(meters) {
  const value = Number(meters);
  if (!Number.isFinite(value)) return "-";
  if (value >= 1000) return `${(value / 1000).toFixed(1)} km`;
  return `${Math.round(value)} m`;
}

function formatDuration(seconds) {
  const value = Number(seconds);
  if (!Number.isFinite(value)) return "-";
  const minutes = Math.max(1, Math.round(value / 60));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder ? `${hours}h ${remainder}m` : `${hours}h`;
}

function resolveHostElement(node) {
  if (typeof HTMLElement !== "undefined" && node instanceof HTMLElement) {
    return node;
  }

  return null;
}

function sourceBadgeStyle(source) {
  if (source === "nus" || source === "lta") return styles.sourceNus;
  if (source === "demo" || source === "demo-lta") return styles.sourceDemo;
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

async function routeForDisplay(routeResult, selectedMode, start, end) {
  if (!routeResult) return null;

  if (selectedMode?.id === "CAR" || selectedMode?.id === "BICYCLE") {
    const profile = selectedMode.id === "CAR" ? "driving" : "bike";
    const direct = await osrmDirectRoute(start, end, profile);
    if (direct.coordinates.length >= 2) {
      const segment = {
        mode: selectedMode.id,
        distance: direct.distance,
        duration: direct.duration,
        coordinates: direct.coordinates,
      };
      return {
        routeResult: {
          ...routeResult,
          distance: direct.distance,
          time: direct.duration,
          duration: direct.duration,
          points: direct.coordinates,
          segments: [segment],
          source: `${routeResult.source || "otp"}+osrm-${profile}`,
        },
        drawableRoute: [segment],
      };
    }
  }

  const segments = routeResult.segments || [];
  if (segments.length === 0) {
    return { routeResult, drawableRoute: routeResult.points };
  }

  const refined = await Promise.all(
    segments.map(async (segment) => {
      const coordinates = segment.coordinates || [];
      const profile = osrmProfileForMode(segment.mode);
      if (!profile || coordinates.length < 2) return segment;

      const snapped = await osrmRouteForCoordinates(coordinates, profile);
      if (snapped.length >= 2) return { ...segment, coordinates: snapped, displaySnapped: true };

      if (isTransitMode(segment.mode)) {
        return { ...segment, coordinates: [], displayHidden: true };
      }

      return segment;
    }),
  );
  const drawableRoute = refined.filter((segment) => (segment.coordinates || []).length >= 2);

  return {
    routeResult: { ...routeResult, segments: refined },
    drawableRoute,
  };
}

function osrmProfileForMode(mode) {
  const value = String(mode || "").toUpperCase();
  if (value === "WALK" || value === "FOOT") return "foot";
  if (value === "BUS" || value === "COACH" || value === "TRANSIT" || value === "CAR") return "driving";
  if (value === "BICYCLE" || value === "BIKE") return "bike";
  return "";
}

async function osrmRouteForCoordinates(coordinates, profile) {
  const waypoints = sampleWaypoints(dedupeCoordinates(coordinates), 18);
  if (waypoints.length < 2) return [];

  try {
    const pairwise = await osrmPairwiseRoute(waypoints, profile);
    if (pairwise.length >= 2) return pairwise;

    const direct = await osrmMultiWaypointRoute(waypoints, profile);
    return direct.length >= 2 ? direct : [];
  } catch (err) {
    console.warn("OSRM display route error:", err);
    return [];
  }
}

async function osrmPairwiseRoute(waypoints, profile) {
  const pieces = [];
  for (let index = 0; index < waypoints.length - 1; index += 1) {
    const segment = await osrmDirectRoute(waypoints[index], waypoints[index + 1], profile);
    if (segment.coordinates.length < 2) {
      return [];
    }
    if (pieces.length) {
      pieces.push(...segment.coordinates.slice(1));
    } else {
      pieces.push(...segment.coordinates);
    }
  }
  return pieces;
}

async function osrmMultiWaypointRoute(waypoints, profile) {
  const url =
    `https://router.project-osrm.org/route/v1/${profile}/` +
    `${waypoints.map((point) => `${point[0]},${point[1]}`).join(";")}?overview=full&geometries=geojson`;
  const response = await fetch(url);
  if (!response.ok) return [];
  const data = await response.json();
  const coordinates = data?.routes?.[0]?.geometry?.coordinates;
  return Array.isArray(coordinates) ? coordinates : [];
}

async function osrmDirectRoute(start, end, profile) {
  if (!start || !end) return { coordinates: [], distance: 0, duration: 0 };
  try {
    const url =
      `https://router.project-osrm.org/route/v1/${profile}/` +
      `${start[0]},${start[1]};${end[0]},${end[1]}?overview=full&geometries=geojson`;
    const response = await fetch(url);
    if (!response.ok) return { coordinates: [], distance: 0, duration: 0 };
    const data = await response.json();
    const route = data?.routes?.[0];
    const coordinates = route?.geometry?.coordinates;
    return {
      coordinates: Array.isArray(coordinates) ? coordinates : [],
      distance: Number(route?.distance) || 0,
      duration: Number(route?.duration) || 0,
    };
  } catch (err) {
    console.warn("OSRM direct route error:", err);
    return { coordinates: [], distance: 0, duration: 0 };
  }
}

function isTransitMode(mode) {
  const value = String(mode || "").toUpperCase();
  return (
    value === "BUS" ||
    value === "COACH" ||
    value === "TRANSIT" ||
    value === "RAIL" ||
    value === "METRO" ||
    value === "SUBWAY" ||
    value === "TRAM"
  );
}

function dedupeCoordinates(coordinates) {
  if (!Array.isArray(coordinates)) return [];
  const result = [];
  for (const coordinate of coordinates) {
    if (!Array.isArray(coordinate) || coordinate.length < 2) continue;
    const lng = Number(coordinate[0]);
    const lat = Number(coordinate[1]);
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) continue;
    const previous = result[result.length - 1];
    if (previous && Math.abs(previous[0] - lng) < 0.000001 && Math.abs(previous[1] - lat) < 0.000001) continue;
    result.push([lng, lat]);
  }
  return result;
}

function sampleWaypoints(coordinates, maxPoints) {
  if (!Array.isArray(coordinates) || coordinates.length <= maxPoints) return coordinates || [];
  const result = [coordinates[0]];
  const step = (coordinates.length - 1) / (maxPoints - 1);
  for (let index = 1; index < maxPoints - 1; index += 1) {
    result.push(coordinates[Math.round(index * step)]);
  }
  result.push(coordinates[coordinates.length - 1]);
  return result;
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
  routingPanel: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 20,
    pointerEvents: "box-none",
  },
  routeCloseButton: {
    position: "absolute",
    top: 28,
    left: 344,
    zIndex: 55,
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(15, 23, 42, 0.12)",
    borderRadius: 999,
    backgroundColor: "#ffffff",
    boxShadow: "0 10px 24px rgba(15, 23, 42, 0.14)",
  },
  routeCloseText: {
    color: "#0f172a",
    fontSize: 22,
    lineHeight: 24,
    fontWeight: "800",
  },
  routeSummary: {
    position: "absolute",
    top: 244,
    left: 20,
    zIndex: 40,
    width: 360,
    maxWidth: "calc(100vw - 40px)",
    gap: 12,
    borderWidth: 1,
    borderColor: "rgba(15, 23, 42, 0.12)",
    borderRadius: 8,
    padding: 14,
    backgroundColor: "rgba(255, 255, 255, 0.96)",
    boxShadow: "0 18px 44px rgba(15, 23, 42, 0.16)",
  },
  routeSummaryHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  routeSummaryKicker: {
    color: "#0f766e",
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  routeSummaryTitle: {
    color: "#111827",
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "900",
  },
  routeSummaryMuted: {
    color: "#64748b",
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "700",
  },
  routeSummaryError: {
    borderColor: "#fecaca",
    backgroundColor: "rgba(254, 242, 242, 0.96)",
  },
  routeSummaryErrorText: {
    color: "#991b1b",
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "800",
  },
  routeSourceBadge: {
    flexShrink: 0,
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 9,
    color: "#0f766e",
    backgroundColor: "#ccfbf1",
    fontSize: 10,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  routeSegmentList: {
    gap: 8,
  },
  routeSegmentItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 8,
    paddingVertical: 9,
    paddingHorizontal: 10,
    backgroundColor: "#f8fafc",
  },
  routeSegmentStripe: {
    width: 28,
    height: 5,
    borderRadius: 999,
  },
  routeSegmentTextBlock: {
    flex: 1,
    minWidth: 0,
  },
  routeSegmentTopLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  routeSegmentMode: {
    color: "#111827",
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "900",
  },
  routeLineBadge: {
    flexShrink: 0,
    borderRadius: 6,
    paddingVertical: 3,
    paddingHorizontal: 6,
    color: "#ffffff",
    backgroundColor: "#dc2626",
    fontSize: 10,
    fontWeight: "900",
  },
  routeSegmentMeta: {
    color: "#64748b",
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "700",
  },
  routeSegmentStops: {
    color: "#475569",
    fontSize: 11,
    lineHeight: 15,
    fontWeight: "600",
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
  busLayerButton: {
    position: "absolute",
    top: 20,
    right: 20,
    zIndex: 10,
    minWidth: 156,
    minHeight: 54,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderColor: "rgba(15, 118, 110, 0.22)",
    borderRadius: 999,
    paddingVertical: 9,
    paddingHorizontal: 12,
    backgroundColor: "rgba(255, 255, 255, 0.94)",
    boxShadow: "0 16px 40px rgba(15, 23, 42, 0.16)",
    backdropFilter: "blur(10px)",
  },
  busLayerButtonIcon: {
    width: 34,
    height: 34,
    borderRadius: 999,
    color: "#ffffff",
    backgroundColor: "#0f766e",
    fontSize: 11,
    lineHeight: 34,
    textAlign: "center",
    fontWeight: "900",
  },
  busLayerButtonTextBlock: {
    minWidth: 0,
    gap: 1,
  },
  busLayerButtonTitle: {
    color: "#0f172a",
    fontSize: 13,
    lineHeight: 17,
    fontWeight: "900",
  },
  busLayerButtonMeta: {
    color: "#64748b",
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "700",
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
  panelCloseButton: {
    flexShrink: 0,
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#dbe6e2",
    borderRadius: 999,
    backgroundColor: "#ffffff",
  },
  panelCloseText: {
    color: "#0f172a",
    fontSize: 20,
    lineHeight: 22,
    fontWeight: "800",
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
  trainLineBadge: {
    minWidth: 42,
    maxWidth: 70,
    minHeight: 24,
    borderRadius: 6,
    paddingVertical: 5,
    paddingHorizontal: 7,
    color: "#ffffff",
    backgroundColor: "#16a34a",
    fontSize: 10,
    fontWeight: "900",
    textAlign: "center",
  },
  trainAlertTextBlock: {
    flex: 1,
    minWidth: 0,
    gap: 2,
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
