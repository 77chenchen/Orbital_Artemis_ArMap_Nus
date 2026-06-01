import React, { useEffect, useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { api } from "./api.js";
import MapScreen from "./Map/map";
import { colors, shadows } from "./theme";

const facilityTypes = [
  { value: "", label: "All" },
  { value: "study_space", label: "Study" },
  { value: "restroom", label: "Restroom" },
  { value: "lift", label: "Lift" },
  { value: "printing", label: "Printing" },
];

const sections = [
  { key: "map", label: "Map", kicker: "Search, route, bus" },
  { key: "recommendations", label: "Agent", kicker: "Daily suggestions" },
  { key: "facilities", label: "Facilities", kicker: "Indoor support" },
  { key: "schedule", label: "Schedule", kicker: "Student day plan" },
  { key: "sync", label: "Sync", kicker: "NUSMods status" },
];

const emptyForm = {
  title: "",
  moduleCode: "",
  location: "COM1",
  startAt: "",
  endAt: "",
  notes: "",
};

export default function Dashboard() {
  const [activeSection, setActiveSection] = useState("map");
  const [health, setHealth] = useState(null);
  const [buildings, setBuildings] = useState([]);
  const [facilities, setFacilities] = useState([]);
  const [schedule, setSchedule] = useState([]);
  const [recommendations, setRecommendations] = useState([]);
  const [syncStatus, setSyncStatus] = useState(null);
  const [filters, setFilters] = useState({ building: "", type: "" });
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const { width } = useWindowDimensions();
  const compact = width < 920;

  const buildingByCode = useMemo(
    () => Object.fromEntries(buildings.map((building) => [building.code, building])),
    [buildings],
  );

  const activeBuilding =
    buildings.find((building) => building.code === filters.building) || buildings[0];

  const indoorReadyCount = buildings.filter((building) => building.supportedIndoor).length;
  const activeSectionMeta = sections.find((section) => section.key === activeSection) || sections[0];

  async function loadAll() {
    setError("");
    try {
      const [healthData, buildingData, scheduleData, recData, syncData] = await Promise.all([
        api.health(),
        api.buildings(),
        api.schedule(),
        api.recommendations(),
        api.syncStatus(),
      ]);
      setHealth(healthData);
      setBuildings(buildingData);
      setSchedule(scheduleData);
      setRecommendations(recData);
      setSyncStatus(syncData);
      setForm((current) => ({
        ...current,
        location: current.location || buildingData[0]?.code || "COM1",
      }));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadFacilities(nextFilters = filters) {
    try {
      setFacilities(await api.facilities(nextFilters));
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  useEffect(() => {
    loadFacilities(filters);
  }, [filters.building, filters.type]);

  async function submitSchedule() {
    setError("");
    setNotice("");

    try {
      await api.createSchedule({
        ...form,
        startAt: new Date(form.startAt).toISOString(),
        endAt: new Date(form.endAt).toISOString(),
      });
      setForm((current) => ({ ...emptyForm, location: current.location }));
      setNotice("Schedule item saved.");
      const [scheduleData, recData] = await Promise.all([api.schedule(), api.recommendations()]);
      setSchedule(scheduleData);
      setRecommendations(recData);
    } catch (err) {
      setError(err.message);
    }
  }

  async function deleteSchedule(id) {
    setError("");
    try {
      await api.deleteSchedule(id);
      const [scheduleData, recData] = await Promise.all([api.schedule(), api.recommendations()]);
      setSchedule(scheduleData);
      setRecommendations(recData);
    } catch (err) {
      setError(err.message);
    }
  }

  async function runSync() {
    setError("");
    setNotice("");
    try {
      const status = await api.runSync();
      setSyncStatus(status);
      setNotice(`NUSMods sync ${status.status}; records seen: ${status.recordsSeen}.`);
    } catch (err) {
      setError(err.message);
      const status = await api.syncStatus().catch(() => null);
      if (status) setSyncStatus(status);
    }
  }

  function renderSection() {
    if (activeSection === "map") {
      return (
        <View style={styles.mapStage}>
          <MapScreen embedded />
        </View>
      );
    }

    return (
      <ScrollView style={styles.contentScroll} contentContainerStyle={styles.contentBody}>
        <View style={styles.contentHeader}>
          <View>
            <Text style={styles.eyebrow}>{activeSectionMeta.kicker}</Text>
            <Text style={styles.contentTitle}>{activeSectionMeta.label}</Text>
          </View>
          {activeSection === "recommendations" ? <ActionButton label="Refresh" onPress={loadAll} /> : null}
          {activeSection === "sync" ? <ActionButton label="Run sync" onPress={runSync} /> : null}
        </View>

        {activeSection === "recommendations" ? (
          <Panel>
            <PanelHeading eyebrow="Daily agent" title="Recommendations" />
            <View style={styles.stack}>
              {recommendations.map((rec) => (
                <View key={`${rec.kind}-${rec.title}`} style={styles.compactCard}>
                  <View style={styles.cardCopy}>
                    <Text style={styles.cardTitle}>{rec.title}</Text>
                    <Text style={styles.cardText}>{rec.description}</Text>
                  </View>
                  <Text style={styles.distance}>{Math.round(rec.distanceM)} m</Text>
                </View>
              ))}
            </View>
          </Panel>
        ) : null}

        {activeSection === "facilities" ? (
          <Panel>
            <PanelHeading eyebrow="Map context" title={activeBuilding?.code || "Campus"} />
            <Text style={styles.cardText}>
              {activeBuilding?.name || "Select a building filter to focus campus facilities."}
            </Text>
            <View style={styles.filterBlock}>
              <View style={styles.chipRow}>
                <FilterChip
                  label="All buildings"
                  selected={!filters.building}
                  onPress={() => setFilters((current) => ({ ...current, building: "" }))}
                />
                {buildings.map((building) => (
                  <FilterChip
                    key={building.code}
                    label={building.code}
                    selected={filters.building === building.code}
                    onPress={() => setFilters((current) => ({ ...current, building: building.code }))}
                  />
                ))}
              </View>
              <View style={styles.chipRow}>
                {facilityTypes.map((type) => (
                  <FilterChip
                    key={type.value}
                    label={type.label}
                    selected={filters.type === type.value}
                    onPress={() => setFilters((current) => ({ ...current, type: type.value }))}
                  />
                ))}
              </View>
            </View>
            <View style={styles.stack}>
              {facilities.map((facility) => (
                <View key={facility.id} style={styles.compactCard}>
                  <View style={styles.cardCopy}>
                    <Text style={styles.cardTitle}>{facility.name}</Text>
                    <Text style={styles.cardText}>{facility.description}</Text>
                  </View>
                  <View style={styles.metaColumn}>
                    <Text style={styles.meta}>{facility.buildingCode} L{facility.floor}</Text>
                    <Text style={styles.meta}>{facility.crowdLevel}</Text>
                  </View>
                </View>
              ))}
            </View>
          </Panel>
        ) : null}

        {activeSection === "schedule" ? (
          <Panel>
            <PanelHeading eyebrow="Schedule API" title="Student day plan" />
            <View style={styles.form}>
              <FormInput
                placeholder="Title"
                value={form.title}
                onChangeText={(title) => setForm((current) => ({ ...current, title }))}
              />
              <FormInput
                placeholder="Module code"
                value={form.moduleCode}
                onChangeText={(moduleCode) => setForm((current) => ({ ...current, moduleCode }))}
              />
              <View style={styles.chipRow}>
                {buildings.map((building) => (
                  <FilterChip
                    key={building.code}
                    label={building.code}
                    selected={form.location === building.code}
                    onPress={() => setForm((current) => ({ ...current, location: building.code }))}
                  />
                ))}
              </View>
              <FormInput
                placeholder="Start 2026-05-15T09:00"
                value={form.startAt}
                onChangeText={(startAt) => setForm((current) => ({ ...current, startAt }))}
              />
              <FormInput
                placeholder="End 2026-05-15T10:00"
                value={form.endAt}
                onChangeText={(endAt) => setForm((current) => ({ ...current, endAt }))}
              />
              <FormInput
                multiline
                placeholder="Notes"
                value={form.notes}
                onChangeText={(notes) => setForm((current) => ({ ...current, notes }))}
                style={styles.notesInput}
              />
              <ActionButton label="Save schedule" onPress={submitSchedule} primary />
            </View>
            <View style={styles.stack}>
              {schedule.map((item) => (
                <View key={item.id} style={styles.compactCard}>
                  <View style={styles.cardCopy}>
                    <Text style={styles.cardTitle}>{item.moduleCode} - {item.title}</Text>
                    <Text style={styles.cardText}>{buildingByCode[item.location]?.name || item.location}</Text>
                    <Text style={styles.meta}>{formatTime(item.startAt)} to {formatTime(item.endAt)}</Text>
                  </View>
                  <Pressable onPress={() => deleteSchedule(item.id)} style={styles.deleteButton}>
                    <Text style={styles.deleteLabel}>x</Text>
                  </Pressable>
                </View>
              ))}
            </View>
          </Panel>
        ) : null}

        {activeSection === "sync" ? (
          <Panel>
            <PanelHeading eyebrow="External API" title="NUSMods sync" />
            <View style={styles.syncList}>
              <SyncRow label="Status" value={syncStatus?.status || "never_run"} />
              <SyncRow label="Records seen" value={syncStatus?.recordsSeen ?? 0} />
              <SyncRow label="Last finished" value={syncStatus?.finishedAt ? formatTime(syncStatus.finishedAt) : "Not yet"} />
            </View>
            {syncStatus?.errorMessage ? <Text style={styles.errorText}>{syncStatus.errorMessage}</Text> : null}
          </Panel>
        ) : null}
      </ScrollView>
    );
  }

  return (
    <View style={[styles.shell, compact && styles.shellCompact]}>
      <View style={[styles.sidebar, compact && styles.sidebarCompact]}>
        <View style={styles.brandBlock}>
          <Text style={styles.eyebrow}>Orbital Artemis</Text>
          <Text style={styles.pageTitle}>Atlas Dashboard</Text>
          <View style={[styles.apiPill, health && styles.apiPillOnline]}>
            <View style={[styles.statusDot, health && styles.statusDotOnline]} />
            <Text style={styles.apiLabel}>{health ? "API online" : loading ? "Checking API" : "API offline"}</Text>
          </View>
        </View>

        {notice || error ? (
          <View style={[styles.notice, error && styles.noticeError]}>
            <Text style={[styles.noticeText, error && styles.noticeErrorText]}>{error || notice}</Text>
          </View>
        ) : null}

        <StatusStrip
          items={[
            { label: "Buildings", value: buildings.length },
            { label: "Indoor", value: indoorReadyCount },
            { label: "Plans", value: schedule.length },
          ]}
        />

        <View style={styles.navList}>
          {sections.map((section) => (
            <Pressable
              key={section.key}
              onPress={() => setActiveSection(section.key)}
              style={[styles.navItem, activeSection === section.key && styles.navItemActive]}
            >
              <View style={styles.navText}>
                <Text style={[styles.navLabel, activeSection === section.key && styles.navLabelActive]}>
                  {section.label}
                </Text>
                <Text style={[styles.navKicker, activeSection === section.key && styles.navKickerActive]}>
                  {section.kicker}
                </Text>
              </View>
              <Text style={[styles.navArrow, activeSection === section.key && styles.navArrowActive]}>{">"}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.mainStage}>{renderSection()}</View>
    </View>
  );
}

function StatusStrip({ items }) {
  return (
    <View style={styles.statusStrip}>
      {items.map((item) => (
        <View key={item.label} style={styles.statusItem}>
          <Text style={styles.statusValue}>{item.value}</Text>
          <Text style={styles.statusLabel}>{item.label}</Text>
        </View>
      ))}
    </View>
  );
}

function Panel({ children }) {
  return <View style={styles.panel}>{children}</View>;
}

function PanelHeading({ eyebrow, title, children }) {
  return (
    <View style={styles.panelHeading}>
      <View style={styles.headingBlock}>
        <Text style={styles.eyebrow}>{eyebrow}</Text>
        <Text style={styles.panelTitle}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

function ActionButton({ label, onPress, primary = false }) {
  return (
    <Pressable onPress={onPress} style={[styles.actionButton, primary && styles.actionButtonPrimary]}>
      <Text style={[styles.actionLabel, primary && styles.actionLabelPrimary]}>{label}</Text>
    </Pressable>
  );
}

function FilterChip({ label, selected, onPress }) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, selected && styles.chipSelected]}>
      <Text style={[styles.chipLabel, selected && styles.chipLabelSelected]}>{label}</Text>
    </Pressable>
  );
}

function FormInput({ style, ...props }) {
  return <TextInput placeholderTextColor="#748179" style={[styles.input, style]} {...props} />;
}

function SyncRow({ label, value }) {
  return (
    <View style={styles.syncRow}>
      <Text style={styles.cardText}>{label}</Text>
      <Text style={styles.cardTitle}>{value}</Text>
    </View>
  );
}

function formatTime(value) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

const styles = StyleSheet.create({
  shell: {
    flexDirection: "row",
    height: "100vh",
    minHeight: 640,
    overflow: "hidden",
    backgroundColor: "#e8efeb",
  },
  shellCompact: {
    flexDirection: "column",
  },
  sidebar: {
    width: 330,
    flexShrink: 0,
    gap: 14,
    padding: 18,
    borderRightWidth: 1,
    borderRightColor: "#d8e3df",
    backgroundColor: "#f7faf8",
    ...shadows.panel,
  },
  sidebarCompact: {
    width: "100%",
    maxHeight: 340,
    borderRightWidth: 0,
    borderBottomWidth: 1,
    borderBottomColor: "#d8e3df",
  },
  brandBlock: {
    gap: 8,
  },
  headingBlock: {
    gap: 4,
  },
  eyebrow: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  pageTitle: {
    color: colors.ink,
    fontSize: 29,
    lineHeight: 34,
    fontWeight: "900",
  },
  apiPill: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    minHeight: 36,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 8,
    backgroundColor: "#ffffff",
  },
  apiPillOnline: {
    borderColor: "rgba(46,112,88,0.3)",
  },
  statusDot: {
    width: 9,
    height: 9,
    borderRadius: 99,
    backgroundColor: colors.danger,
  },
  statusDotOnline: {
    backgroundColor: colors.green,
  },
  apiLabel: {
    color: colors.muted,
    fontWeight: "800",
  },
  notice: {
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(242,203,120,0.46)",
    borderRadius: 8,
    backgroundColor: "rgba(242,203,120,0.2)",
  },
  noticeError: {
    borderColor: "rgba(169,71,71,0.22)",
    backgroundColor: "rgba(169,71,71,0.08)",
  },
  noticeText: {
    color: "#66521f",
    fontWeight: "700",
  },
  noticeErrorText: {
    color: colors.danger,
  },
  statusStrip: {
    flexDirection: "row",
    gap: 8,
  },
  statusItem: {
    flex: 1,
    minWidth: 0,
    gap: 2,
    padding: 12,
    borderWidth: 1,
    borderColor: "#dfe8e4",
    borderRadius: 8,
    backgroundColor: "#ffffff",
  },
  statusValue: {
    color: colors.ink,
    fontSize: 20,
    lineHeight: 24,
    fontWeight: "900",
  },
  statusLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  navList: {
    gap: 8,
  },
  navItem: {
    minHeight: 68,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderWidth: 1,
    borderColor: "#dfe8e4",
    borderRadius: 8,
    backgroundColor: "#ffffff",
  },
  navItemActive: {
    borderColor: "rgba(46,112,88,0.36)",
    backgroundColor: "#e8f3ef",
  },
  navText: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  navLabel: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: "900",
  },
  navLabelActive: {
    color: colors.green,
  },
  navKicker: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 16,
  },
  navKickerActive: {
    color: "#49645b",
  },
  navArrow: {
    color: "#9aa9a2",
    fontSize: 24,
    lineHeight: 24,
    fontWeight: "800",
  },
  navArrowActive: {
    color: colors.green,
  },
  mainStage: {
    flex: 1,
    minWidth: 0,
    minHeight: 0,
    position: "relative",
    overflow: "hidden",
  },
  mapStage: {
    flex: 1,
    minWidth: 0,
    minHeight: 0,
    position: "relative",
    overflow: "hidden",
    backgroundColor: "#dfe8e4",
  },
  contentScroll: {
    flex: 1,
  },
  contentBody: {
    width: "100%",
    maxWidth: 980,
    alignSelf: "center",
    gap: 16,
    padding: 24,
  },
  contentHeader: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  contentTitle: {
    color: colors.ink,
    fontSize: 34,
    lineHeight: 39,
    fontWeight: "900",
  },
  panel: {
    gap: 14,
    minWidth: 0,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 8,
    backgroundColor: "#ffffff",
  },
  panelHeading: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  panelTitle: {
    color: colors.ink,
    fontSize: 17,
    fontWeight: "900",
  },
  stack: {
    gap: 10,
  },
  compactCard: {
    flexGrow: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: "#e4ece8",
    borderRadius: 8,
    backgroundColor: "#ffffff",
  },
  cardCopy: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  cardTitle: {
    color: colors.ink,
    fontWeight: "900",
  },
  cardText: {
    color: colors.muted,
    lineHeight: 19,
  },
  meta: {
    color: colors.muted,
    fontSize: 12,
  },
  distance: {
    color: colors.green,
    fontWeight: "900",
  },
  filterBlock: {
    gap: 9,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    minHeight: 34,
    justifyContent: "center",
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 8,
    backgroundColor: "#ffffff",
  },
  chipSelected: {
    borderColor: colors.green,
    backgroundColor: colors.green,
  },
  chipLabel: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "800",
  },
  chipLabelSelected: {
    color: "#ffffff",
  },
  metaColumn: {
    alignItems: "flex-end",
    gap: 3,
  },
  form: {
    gap: 9,
  },
  input: {
    minHeight: 42,
    paddingHorizontal: 11,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 8,
    color: colors.ink,
    backgroundColor: "#ffffff",
    fontSize: 14,
  },
  notesInput: {
    minHeight: 76,
    textAlignVertical: "top",
  },
  actionButton: {
    minHeight: 36,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 11,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 8,
    backgroundColor: "#ffffff",
  },
  actionButtonPrimary: {
    borderColor: colors.green,
    backgroundColor: colors.green,
  },
  actionLabel: {
    color: colors.ink,
    fontWeight: "900",
  },
  actionLabelPrimary: {
    color: "#ffffff",
  },
  deleteButton: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 8,
  },
  deleteLabel: {
    color: colors.danger,
    fontSize: 17,
    lineHeight: 19,
    fontWeight: "900",
  },
  syncList: {
    gap: 10,
  },
  syncRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#e4ece8",
  },
  errorText: {
    color: colors.danger,
  },
});
