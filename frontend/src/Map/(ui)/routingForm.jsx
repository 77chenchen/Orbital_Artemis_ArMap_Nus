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
  showDropdown,
  activeField,
  setActiveField,
  setShowDropdown,
  setSuggestions,
  setStartPlace,
  setEndPlace,
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
              onFocus={() => setActiveField("start")}
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
              onFocus={() => setActiveField("query")}
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

        {showDropdown && suggestions?.length > 0 ? (
          <SelectList
            items={suggestions}
            onClick={(place) => {
              const label = place.properties.label;
              const coords = place.geometry.coordinates;

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
});
