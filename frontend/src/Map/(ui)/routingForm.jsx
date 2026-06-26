import React from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import SelectList from "./selectList";

export default function RoutingForm({
  start,
  end,
  setStart,
  setEnd,
  startPlace,
  endPlace,
  suggestions,
  suggestionLoading = false,
  showDropdown,
  activeField,
  setActiveField,
  setShowDropdown,
  setSuggestions,
  setStartPlace,
  setEndPlace,
  onPlaceSelected,
  travelModes = [],
  travelMode,
  setTravelMode,
  routeDrawn,
  onPressAR,
  onUseCurrentLocation,
}) {
  return (
    <View style={styles.routingContainer}>
      <View style={styles.inputWrapper}>
        <View style={styles.routeCard}>
          <View style={styles.routeMarkers}>
            <View style={[styles.dot, styles.startDot]} />
            <View style={styles.line} />
            <View style={[styles.dot, styles.endDot]} />
          </View>

          <View style={styles.routeInputs}>
            <TextInput
              value={start}
              placeholder="Starting point"
              placeholderTextColor="#888888"
              onFocus={() => {
                setActiveField("start");
                setShowDropdown(true);
              }}
              onChangeText={(value) => {
                setStart(value);
                setActiveField("start");
                setShowDropdown(true);
              }}
              style={styles.routeInput}
            />

            <TextInput
              value={end}
              placeholder="Destination"
              placeholderTextColor="#888888"
              onFocus={() => {
                setActiveField("query");
                setShowDropdown(true);
              }}
              onChangeText={(value) => {
                setEnd(value);
                setActiveField("query");
                setShowDropdown(true);
              }}
              style={styles.routeInput}
            />
            
          </View>

          <Pressable
            onPress={() => {
              const temp = start;
              setStart(end);
              setEnd(temp);
              const temp2 = startPlace;
              setStartPlace(endPlace);
              setEndPlace(temp2);
            }}
            style={({ pressed }) => [styles.swapButton, pressed && styles.swapButtonPressed]}
          >
            <Text style={styles.swapText}>A/B</Text>
          </Pressable>
        </View>
        <View style={styles.currentLocationCard}>
          <Pressable
            onPress={onUseCurrentLocation}
            style={({ pressed }) => [styles.currentLocationButton, pressed && styles.currentLocationButtonPressed]}
          >
            <Text style={styles.currentLocationButtonText}>Use current location</Text>
          </Pressable>
        </View>
        {routeDrawn ? (
          <Pressable
            onPress={onPressAR}
            style={({ pressed }) => [styles.arButton, pressed && styles.arButtonPressed]}
          >
            <Text style={styles.arButtonText}>AR</Text>
          </Pressable>
        ) : null}

        {travelModes.length > 0 ? (
          <View style={styles.modeSelector}>
            {travelModes.map((mode) => {
              const active = travelMode === mode.id;
              return (
                <Pressable
                  key={mode.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Route by ${mode.label}`}
                  onPress={() => setTravelMode(mode.id)}
                  style={({ pressed }) => [
                    styles.modeButton,
                    active && styles.modeButtonActive,
                    pressed && styles.modeButtonPressed,
                  ]}
                >
                  <Text style={[styles.modeButtonText, active && styles.modeButtonTextActive]}>
                    {mode.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}

        

        {showDropdown ? (
          <SelectList
            items={suggestions}
            loading={suggestionLoading}
            query={activeField === "start" ? start : end}
            onClick={(place) => {
              const label = place.properties.label;
              const coords = place.geometry.coordinates;
              const query = activeField === "start" ? start : end;
              onPlaceSelected?.(place, query);

              if (activeField === "start") {
                setStart(label);
                setStartPlace({ label, coords });
              }

              if (activeField === "query") {
                setEnd(label);
                setEndPlace({ label, coords });
              }

              setActiveField(null);
              setShowDropdown(false);
              setSuggestions([]);
            }}
          />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  routingContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    height: "100vh",
    width: 400,
    maxWidth: "100vw",
    backgroundColor: "#ffffff",
    borderRightWidth: 1,
    borderRightColor: "#eeeeee",
    overflow: "visible",
    zIndex: 20,
  },
  inputWrapper: {
    position: "relative",
    width: "100%",
    zIndex: 30,
  },
  routeCard: {
    position: "relative",
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 40,
    borderBottomWidth: 2,
    borderBottomColor: "rgb(1, 64, 252)",
    backgroundColor: "#ffffff",
  },
  routeMarkers: {
    alignItems: "center",
    width: 40,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 50,
  },
  startDot: {
    backgroundColor: "#1a73e8",
  },
  endDot: {
    backgroundColor: "#ea4335",
  },
  line: {
    width: 2,
    height: 40,
    marginVertical: 3,
    backgroundColor: "#dddddd",
  },
  routeInputs: {
    flex: 1,
    gap: 15,
  },
  routeInput: {
    width: "100%",
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderWidth: 0,
    borderBottomWidth: 1,
    borderBottomColor: "#1a73e8",
    outlineStyle: "none",
    color: "#111111",
    backgroundColor: "transparent",
    fontSize: 14,
  },
  swapButton: {
    width: 42,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
    backgroundColor: "#f1f3f4",
  },
  swapButtonPressed: {
    backgroundColor: "#e8eaed",
  },
  swapText: {
    color: "#202124",
    fontSize: 16,
    fontWeight: "800",
  },
  modeSelector: {
    flexDirection: "row",
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
    backgroundColor: "#ffffff",
  },
  modeButton: {
    flex: 1,
    minHeight: 36,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    backgroundColor: "#ffffff",
  },
  modeButtonActive: {
    borderColor: "#1a73e8",
    backgroundColor: "#eff6ff",
  },
  modeButtonPressed: {
    backgroundColor: "#e5e7eb",
  },
  modeButtonText: {
    color: "#374151",
    fontSize: 12,
    fontWeight: "800",
  },
  modeButtonTextActive: {
    color: "#1d4ed8",
  },
  arButton: {
    marginTop: 12,
    marginHorizontal: 20,
    height: 44,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#111827",
  },
  arButtonPressed: {
    opacity: 0.8,
  },
  arButtonText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "800",
  },
  currentLocationCard: {
    flex: 1,
    marginTop: 8,
    alignItems: "center",
    justifyContent: "center"
  },
  currentLocationButton: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: "#eff6ff",
  },
  currentLocationButtonPressed: {
    backgroundColor: "#dbeafe",
  },
  currentLocationButtonText: {
    color: "#1d4ed8",
    fontSize: 12,
    fontWeight: "800",
  },
});