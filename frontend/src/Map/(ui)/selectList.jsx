import React from "react";
import { Pressable, ScrollView, StyleSheet, Text } from "react-native";

export default function SelectList({ items, onClick }) {
  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      style={styles.menuContainer}
      contentContainerStyle={styles.menuContent}
    >
      {items.map((item, index) => (
        <Pressable
          key={`${item?.properties?.label || "suggestion"}-${index}`}
          onPress={() => onClick(item)}
          style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed]}
        >
          <Text numberOfLines={1} style={styles.menuText}>
            {item.properties.label}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  menuContainer: {
    position: "absolute",
    top: "100%",
    left: 0,
    width: "100%",
    maxHeight: 300,
    marginTop: 8,
    borderRadius: 12,
    backgroundColor: "#ffffff",
    boxShadow: "0 16px 38px rgba(15, 23, 42, 0.12)",
    zIndex: 1000,
  },
  menuContent: {
    paddingVertical: 0,
  },
  menuItem: {
    width: "100%",
    minHeight: 56,
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  menuItemPressed: {
    backgroundColor: "#f1f3f4",
  },
  menuText: {
    color: "#202124",
    fontSize: 16,
  },
});
