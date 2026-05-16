import React, { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, shadows } from "./theme";

type Building = {
  code: string;
  name: string;
  supportedIndoor?: boolean;
};

type MapPoint = {
  left: string;
  top: string;
  tone: string;
};

type Props = {
  buildings: Building[];
  selectedCode: string;
  onSelect: (code: string) => void;
};

const defaultPoints: Record<string, MapPoint> = {
  COM1: { left: "20%", top: "68%", tone: colors.green },
  CLB: { left: "49%", top: "42%", tone: colors.blue },
  UTOWN: { left: "80%", top: "24%", tone: colors.orange },
};

const fallbackPoints: MapPoint[] = [
  { left: "18%", top: "28%", tone: colors.green },
  { left: "38%", top: "64%", tone: colors.blue },
  { left: "62%", top: "58%", tone: colors.orange },
  { left: "78%", top: "72%", tone: colors.gold },
];

const routeSegments = [
  { left: "21%", top: "64%", width: "29%", rotate: "-28deg" },
  { left: "47%", top: "43%", width: "31%", rotate: "-20deg" },
];

export default function CampusMap2D({ buildings, selectedCode, onSelect }: Props) {
  const [hoveredCode, setHoveredCode] = useState("");
  const [pointer, setPointer] = useState({ x: 50, y: 50, visible: false });

  const points = useMemo(
    () =>
      buildings.map((building, index) => ({
        building,
        point: defaultPoints[building.code] || fallbackPoints[index % fallbackPoints.length],
      })),
    [buildings],
  );

  const activeBuilding = buildings.find((building) => building.code === (hoveredCode || selectedCode)) || buildings[0];

  function movePointer(event: any) {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;
    setPointer({ x, y, visible: true });
  }

  return (
    <View
      style={styles.map}
      onPointerMove={movePointer}
      onPointerLeave={() => setPointer((current) => ({ ...current, visible: false }))}
    >
      <View style={styles.grid} />
      <View style={[styles.greenZone, styles.greenZoneOne]} />
      <View style={[styles.greenZone, styles.greenZoneTwo]} />
      <View style={styles.water} />

      {routeSegments.map((segment) => (
        <View
          key={`${segment.left}-${segment.top}`}
          style={[
            styles.route,
            {
              left: segment.left,
              top: segment.top,
              width: segment.width,
              transform: [{ rotate: segment.rotate }],
            },
          ]}
        />
      ))}

      {pointer.visible && (
        <View
          pointerEvents="none"
          style={[
            styles.pointerGlow,
            {
              left: `${pointer.x}%`,
              top: `${pointer.y}%`,
            },
          ]}
        />
      )}

      {points.map(({ building, point }) => {
        const active = building.code === selectedCode;
        return (
          <Pressable
            key={building.code}
            accessibilityLabel={`${building.name} ${building.code}`}
            onHoverIn={() => setHoveredCode(building.code)}
            onHoverOut={() => setHoveredCode("")}
            onPress={() => onSelect(building.code)}
            style={({ hovered }) => [
              styles.node,
              {
                left: point.left,
                top: point.top,
                backgroundColor: point.tone,
              },
              (hovered || active) && styles.nodeActive,
            ]}
          >
            <Text style={styles.nodeCode}>{building.code}</Text>
          </Pressable>
        );
      })}

      <View style={styles.legend}>
        <Text style={styles.legendLabel}>2D Campus</Text>
        <Text style={styles.legendTitle}>{activeBuilding?.name || "Campus route"}</Text>
        <Text style={styles.legendMeta}>
          {activeBuilding?.supportedIndoor ? "Indoor ready" : "Outdoor route"} · move mouse to scan
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  map: {
    position: "relative",
    minHeight: 330,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 8,
    backgroundColor: "#dfece6",
  },
  grid: {
    ...StyleSheet.absoluteFillObject,
    backgroundImage:
      "linear-gradient(rgba(46,112,88,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(46,112,88,0.1) 1px, transparent 1px)",
    backgroundSize: "34px 34px",
  },
  greenZone: {
    position: "absolute",
    borderRadius: 8,
    backgroundColor: "rgba(79, 169, 131, 0.24)",
  },
  greenZoneOne: {
    left: "8%",
    top: "16%",
    width: "28%",
    height: "22%",
  },
  greenZoneTwo: {
    right: "8%",
    bottom: "12%",
    width: "24%",
    height: "24%",
  },
  water: {
    position: "absolute",
    right: "11%",
    top: "12%",
    width: 92,
    height: 48,
    borderRadius: 48,
    backgroundColor: "rgba(84, 176, 205, 0.32)",
  },
  route: {
    position: "absolute",
    height: 8,
    borderRadius: 99,
    backgroundColor: colors.gold,
    boxShadow: "0 0 18px rgba(242,203,120,0.38)",
    transformOrigin: "left center",
  },
  pointerGlow: {
    position: "absolute",
    width: 124,
    height: 124,
    marginLeft: -62,
    marginTop: -62,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.66)",
    backgroundColor: "rgba(255,255,255,0.18)",
  },
  node: {
    position: "absolute",
    minWidth: 68,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.64)",
    borderRadius: 8,
    transform: [{ translateX: -34 }, { translateY: -22 }],
    ...shadows.lift,
  },
  nodeActive: {
    transform: [{ translateX: -34 }, { translateY: -22 }, { scale: 1.08 }],
    borderColor: colors.gold,
  },
  nodeCode: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "800",
  },
  legend: {
    position: "absolute",
    left: 14,
    bottom: 14,
    right: 14,
    gap: 3,
    maxWidth: 260,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.36)",
    borderRadius: 8,
    backgroundColor: "rgba(17, 42, 37, 0.78)",
  },
  legendLabel: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 99,
    color: colors.ink,
    backgroundColor: colors.mint,
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  legendTitle: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "800",
  },
  legendMeta: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 13,
    lineHeight: 18,
  },
});
