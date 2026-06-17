import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

export default function SelectList({ items = [], onClick, loading = false, query = "", menuStyle = null }) {
  const hasQuery = Boolean(query.trim());
  const title = hasQuery ? "Places matching your search" : "Recommended for you";

  return (
    <View style={[styles.menuContainer, menuStyle]}>
      <View style={styles.menuHeader}>
        <Text style={styles.menuTitle}>{loading ? "Searching places..." : title}</Text>
        <Text style={styles.menuMeta}>{loading ? "Live" : `${items.length} shown`}</Text>
      </View>

      <ScrollView
        keyboardShouldPersistTaps="handled"
        style={styles.resultScroll}
        contentContainerStyle={styles.menuContent}
      >
        {items.map((item, index) => {
          const summary = getSuggestionSummary(item);
          return (
            <Pressable
              key={`${item?.properties?.label || "suggestion"}-${index}`}
              accessibilityRole="button"
              accessibilityLabel={`Select ${summary.name}`}
              onPress={() => onClick(item)}
              style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed]}
            >
              <View style={styles.pinBadge}>
                <Text style={styles.pinBadgeText}>⌖</Text>
              </View>
              <View style={styles.placeTextBlock}>
                <Text numberOfLines={1} style={styles.placeName}>
                  {summary.name}
                </Text>
                <Text numberOfLines={1} style={styles.placeDescription}>
                  {summary.reason || summary.description}
                </Text>
              </View>
              <Text numberOfLines={1} style={styles.sourceBadge}>
                {summary.source}
              </Text>
            </Pressable>
          );
        })}

        {!loading && items.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>No place found yet</Text>
            <Text style={styles.emptyText}>Try a building name, lecture theatre, MRT station, or NUS facility.</Text>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

function getSuggestionSummary(item) {
  const properties = item?.properties || {};
  const label = properties.label || properties.name || "Unknown place";
  const parts = label.split(",").map((part) => part.trim()).filter(Boolean);
  const name = properties.name || parts[0] || label;
  const description = properties.description || parts.slice(1, 3).join(" · ") || "Singapore";
  const source = normalizeSource(properties.source || properties.layer || "Map");
  const reason = properties.recommendationReason || "";

  return {
    name,
    description,
    source,
    reason,
  };
}

function normalizeSource(source) {
  const value = String(source || "Map").trim().replace(/_/g, " ");
  const normalized = value.toLowerCase();
  if (normalized === "openstreetmap") return "OSM";
  if (normalized === "venue" || normalized === "address" || normalized === "street") return "Map";
  return value.slice(0, 12);
}

const styles = StyleSheet.create({
  menuContainer: {
    position: "absolute",
    top: "100%",
    left: 0,
    width: "100%",
    marginTop: 8,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(15, 23, 42, 0.1)",
    borderRadius: 8,
    backgroundColor: "#ffffff",
    boxShadow: "0 18px 48px rgba(15, 23, 42, 0.16)",
    zIndex: 1000,
  },
  menuHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
    backgroundColor: "#f8fbfa",
  },
  menuTitle: {
    flex: 1,
    color: "#0f172a",
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "900",
  },
  menuMeta: {
    flexShrink: 0,
    color: "#0f766e",
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  resultScroll: {
    maxHeight: 336,
  },
  menuContent: {
    paddingVertical: 6,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    width: "100%",
    minHeight: 66,
    paddingVertical: 9,
    paddingHorizontal: 12,
  },
  menuItemPressed: {
    backgroundColor: "#eef7f4",
  },
  pinBadge: {
    flexShrink: 0,
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#cfe2dc",
    borderRadius: 8,
    backgroundColor: "#f2faf7",
  },
  pinBadgeText: {
    color: "#0f766e",
    fontSize: 20,
    lineHeight: 22,
    fontWeight: "900",
  },
  placeTextBlock: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  placeName: {
    color: "#0f172a",
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "900",
  },
  placeDescription: {
    color: "#64748b",
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "700",
  },
  sourceBadge: {
    flexShrink: 0,
    maxWidth: 72,
    borderRadius: 7,
    paddingVertical: 5,
    paddingHorizontal: 7,
    color: "#0f766e",
    backgroundColor: "#ccfbf1",
    fontSize: 10,
    lineHeight: 12,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  emptyState: {
    gap: 4,
    paddingVertical: 18,
    paddingHorizontal: 14,
  },
  emptyTitle: {
    color: "#0f172a",
    fontSize: 14,
    lineHeight: 19,
    fontWeight: "900",
  },
  emptyText: {
    color: "#64748b",
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "700",
  },
});
