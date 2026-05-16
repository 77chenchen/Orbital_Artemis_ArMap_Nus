import React, { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from "react-native";
import CampusMap2D from "./CampusMap2D";
import { api } from "./api.js";
import { colors, shadows } from "./theme";

const facilityTypes = [
  { value: "", label: "All" },
  { value: "study_space", label: "Study" },
  { value: "restroom", label: "Restroom" },
  { value: "lift", label: "Lift" },
  { value: "printing", label: "Printing" },
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
  const tablet = width < 1080;
  const phone = width < 720;

  const buildingByCode = useMemo(
    () => Object.fromEntries(buildings.map((building) => [building.code, building])),
    [buildings],
  );

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

  return (
    <ScrollView contentContainerStyle={[styles.page, phone && styles.pagePhone]}>
      <View style={styles.topbar}>
        <View style={styles.headingBlock}>
          <Text style={styles.eyebrow}>Orbital Artemis Demo</Text>
          <Text style={[styles.pageTitle, phone && styles.pageTitlePhone]}>Atlas campus assistant</Text>
        </View>
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

      <View style={[styles.row, tablet && styles.rowStack]}>
        <Panel style={styles.mapPanel}>
          <PanelHeading eyebrow="Navigation data" title="Supported campus points" />
          <CampusMap2D
            buildings={buildings}
            selectedCode={filters.building}
            onSelect={(code) => setFilters((current) => ({ ...current, building: code }))}
          />
          <View style={styles.buildingList}>
            {buildings.map((building) => (
              <View key={building.code} style={styles.compactCard}>
                <View style={styles.cardCopy}>
                  <Text style={styles.cardTitle}>{building.code}</Text>
                  <Text style={styles.cardText}>{building.name}</Text>
                </View>
                <Text style={styles.meta}>{building.supportedIndoor ? "Indoor ready" : "Outdoor only"}</Text>
              </View>
            ))}
          </View>
        </Panel>

        <Panel style={styles.sidePanel}>
          <PanelHeading eyebrow="Daily agent" title="Recommendations">
            <ActionButton label="Refresh" onPress={loadAll} />
          </PanelHeading>
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
      </View>

      <View style={[styles.row, styles.workRow, tablet && styles.rowStack]}>
        <Panel style={styles.workPanel}>
          <PanelHeading eyebrow="Facility discovery" title="Indoor support" />
          <View style={styles.filterGroup}>
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

        <Panel style={styles.workPanel}>
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
                  <Text style={styles.cardTitle}>{item.moduleCode} · {item.title}</Text>
                  <Text style={styles.cardText}>{buildingByCode[item.location]?.name || item.location}</Text>
                  <Text style={styles.meta}>{formatTime(item.startAt)} to {formatTime(item.endAt)}</Text>
                </View>
                <Pressable onPress={() => deleteSchedule(item.id)} style={styles.deleteButton}>
                  <Text style={styles.deleteLabel}>×</Text>
                </Pressable>
              </View>
            ))}
          </View>
        </Panel>

        <Panel style={[styles.syncPanel, tablet && styles.workPanel]}>
          <PanelHeading eyebrow="External API connection" title="NUSMods sync">
            <ActionButton label="Run now" onPress={runSync} />
          </PanelHeading>
          <View style={styles.syncList}>
            <SyncRow label="Status" value={syncStatus?.status || "never_run"} />
            <SyncRow label="Records seen" value={syncStatus?.recordsSeen ?? 0} />
            <SyncRow label="Last finished" value={syncStatus?.finishedAt ? formatTime(syncStatus.finishedAt) : "Not yet"} />
          </View>
          {syncStatus?.errorMessage ? <Text style={styles.errorText}>{syncStatus.errorMessage}</Text> : null}
        </Panel>
      </View>
    </ScrollView>
  );
}

function Panel({ children, style }) {
  return <View style={[styles.panel, style]}>{children}</View>;
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
  return <TextInput placeholderTextColor="#7a8782" style={[styles.input, style]} {...props} />;
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
  page: {
    minHeight: "100vh",
    gap: 16,
    padding: 24,
    backgroundColor: colors.canvas,
  },
  pagePhone: {
    padding: 14,
  },
  topbar: {
    width: "100%",
    maxWidth: 1400,
    alignSelf: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
  },
  headingBlock: {
    gap: 4,
  },
  eyebrow: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  pageTitle: {
    color: colors.ink,
    fontSize: 42,
    lineHeight: 46,
    fontWeight: "900",
  },
  pageTitlePhone: {
    fontSize: 30,
    lineHeight: 34,
  },
  apiPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    minHeight: 42,
    paddingHorizontal: 12,
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
    width: "100%",
    maxWidth: 1400,
    alignSelf: "center",
    padding: 14,
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
  row: {
    width: "100%",
    maxWidth: 1400,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "stretch",
    gap: 16,
  },
  rowStack: {
    flexDirection: "column",
  },
  workRow: {
    alignItems: "flex-start",
  },
  panel: {
    gap: 16,
    minWidth: 0,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 8,
    backgroundColor: "#ffffff",
    ...shadows.panel,
  },
  mapPanel: {
    flex: 1.25,
  },
  sidePanel: {
    flex: 0.75,
  },
  workPanel: {
    flex: 1,
  },
  syncPanel: {
    flex: 0.72,
  },
  panelHeading: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  panelTitle: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: "900",
  },
  buildingList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
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
    gap: 12,
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
    lineHeight: 20,
  },
  meta: {
    color: colors.muted,
    fontSize: 13,
  },
  distance: {
    color: colors.green,
    fontWeight: "900",
  },
  filterGroup: {
    gap: 10,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    minHeight: 38,
    justifyContent: "center",
    paddingHorizontal: 12,
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
    fontSize: 14,
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
    gap: 10,
  },
  input: {
    minHeight: 44,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 8,
    color: colors.ink,
    backgroundColor: "#ffffff",
    fontSize: 15,
  },
  notesInput: {
    minHeight: 82,
    textAlignVertical: "top",
  },
  actionButton: {
    minHeight: 40,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
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
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 8,
  },
  deleteLabel: {
    color: colors.ink,
    fontSize: 24,
    lineHeight: 26,
  },
  syncList: {
    gap: 10,
  },
  syncRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#e4ece8",
  },
  errorText: {
    color: colors.danger,
    lineHeight: 20,
  },
});
