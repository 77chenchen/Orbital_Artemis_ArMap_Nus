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
  { key: "map", label: "Map", kicker: "Search, route, bus", marker: "01" },
  { key: "recommendations", label: "Daily Assistant", kicker: "Plans and suggestions", marker: "02" },
  { key: "facilities", label: "Facilities", kicker: "Indoor support", marker: "03" },
  { key: "schedule", label: "Schedule", kicker: "Student day plan", marker: "04" },
  { key: "sync", label: "Sync", kicker: "NUSMods status", marker: "05" },
];

const assistantModes = [
  { value: "daily_plan", label: "Daily plan" },
  { value: "reflection", label: "Reflection" },
  { value: "task_summary", label: "Task summary" },
  { value: "general", label: "General" },
];

const assistantPrompts = [
  "Find my best study window today.",
  "Summarise what I should do next.",
  "Where should I go between classes?",
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
  const [assistantMessage, setAssistantMessage] = useState("Plan my day around my current schedule.");
  const [assistantMode, setAssistantMode] = useState("daily_plan");
  const [assistantResponse, setAssistantResponse] = useState(null);
  const [assistantLoading, setAssistantLoading] = useState(false);
  const [assistantAddingKey, setAssistantAddingKey] = useState("");
  const [assistantError, setAssistantError] = useState("");
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
  const sortedSchedule = useMemo(
    () =>
      [...schedule].sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime()),
    [schedule],
  );
  const nextScheduleItem = sortedSchedule.find((item) => new Date(item.endAt).getTime() >= Date.now()) || sortedSchedule[0];
  const topRecommendation = recommendations[0];
  const nearestRecommendation = recommendations.reduce(
    (nearest, rec) => (!nearest || rec.distanceM < nearest.distanceM ? rec : nearest),
    null,
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
    function handleAgentSection(event) {
      const section = event.detail?.section;
      if (sections.some((item) => item.key === section)) {
        setActiveSection(section);
      }
    }

    window.addEventListener("atlas:dashboard-section", handleAgentSection);
    return () => window.removeEventListener("atlas:dashboard-section", handleAgentSection);
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

  async function submitDailyAssistant() {
    const message = assistantMessage.trim();
    setAssistantError("");
    setAssistantResponse(null);

    if (!message) {
      setAssistantError("Message is required.");
      return;
    }

    setAssistantLoading(true);
    try {
      const response = await api.dailyAssistant({
        message,
        mode: assistantMode,
        context: {
          currentTime: new Date().toISOString(),
          schedule: sortedSchedule.map((item) => ({
            title: item.title,
            moduleCode: item.moduleCode,
            location: item.location,
            startAt: item.startAt,
            endAt: item.endAt,
          })),
          recommendations: recommendations.slice(0, 5),
          syncStatus: syncStatus?.status || "never_run",
          campusSignal: {
            buildings: buildings.length,
            indoorReadyBuildings: indoorReadyCount,
            facilityMatches: facilities.length,
          },
        },
      });
      setAssistantResponse(response);
      if (!response.success) {
        setAssistantError(response.error || "Assistant returned a fallback response.");
      }
    } catch (err) {
      setAssistantError(err.message);
      setAssistantResponse({
        success: false,
        reply: fallbackAssistantReply(assistantMode),
        error: err.message,
      });
    } finally {
      setAssistantLoading(false);
    }
  }

  async function addAssistantScheduleItem(item, index) {
    const key = `${item.title}-${item.startAt}-${index}`;
    setAssistantAddingKey(key);
    setAssistantError("");
    setNotice("");
    try {
      await api.createSchedule({
        title: item.title,
        moduleCode: item.moduleCode || "TASK",
        location: item.location || buildings[0]?.code || "COM1",
        startAt: new Date(item.startAt).toISOString(),
        endAt: new Date(item.endAt).toISOString(),
        notes: item.notes || "Added from Daily Assistant",
      });
      const [scheduleData, recData] = await Promise.all([api.schedule(), api.recommendations()]);
      setSchedule(scheduleData);
      setRecommendations(recData);
      setAssistantResponse((current) =>
        current
          ? {
              ...current,
              scheduleItems: (current.scheduleItems || []).filter((_, itemIndex) => itemIndex !== index),
            }
          : current,
      );
      setNotice("Assistant schedule item added.");
    } catch (err) {
      setAssistantError(err.message);
    } finally {
      setAssistantAddingKey("");
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
          <>
            <View style={styles.agentHero}>
              <View style={styles.agentHeroCopy}>
                <Text style={styles.eyebrow}>Next move</Text>
                <Text style={styles.agentHeroTitle}>
                  {topRecommendation?.title || nextScheduleItem?.title || "Your campus day is ready"}
                </Text>
                <Text style={styles.agentHeroText}>
                  {topRecommendation?.description ||
                    (nextScheduleItem
                      ? `${nextScheduleItem.moduleCode} at ${buildingByCode[nextScheduleItem.location]?.name || nextScheduleItem.location}`
                      : "Atlas will surface routes, schedule gaps, and nearby campus support here.")}
                </Text>
                <View style={styles.agentActions}>
                  <ActionButton label="Open map" onPress={() => setActiveSection("map")} primary />
                  <ActionButton label="Edit plan" onPress={() => setActiveSection("schedule")} />
                </View>
              </View>
              <View style={styles.agentHeroAside}>
                <Text style={styles.agentAsideValue}>
                  {nextScheduleItem ? formatTime(nextScheduleItem.startAt) : "Ready"}
                </Text>
                <Text style={styles.agentAsideLabel}>
                  {nextScheduleItem
                    ? buildingByCode[nextScheduleItem.location]?.name || nextScheduleItem.location
                    : "No upcoming class"}
                </Text>
              </View>
            </View>

            <View style={[styles.agentMetricGrid, compact && styles.agentMetricGridCompact]}>
              <MetricTile label="Suggestions" value={recommendations.length} tone="green" />
              <MetricTile label="Plans" value={schedule.length} tone="blue" />
              <MetricTile
                label="Nearest"
                value={nearestRecommendation ? `${Math.round(nearestRecommendation.distanceM)}m` : "-"}
                tone="orange"
              />
            </View>

            <View style={[styles.assistantSurface, compact && styles.assistantSurfaceCompact]}>
              <View style={[styles.assistantIntro, compact && styles.assistantIntroCompact]}>
                <Text style={styles.assistantBadge}>Atlas AI</Text>
                <Text style={styles.assistantTitle}>Daily Assistant</Text>
                <Text style={styles.assistantIntroText}>
                  Ask for a practical campus plan using your schedule, nearby recommendations, sync status,
                  and facility context.
                </Text>
                <View style={styles.assistantContextGrid}>
                  <ContextPill label="Schedule" value={schedule.length} />
                  <ContextPill label="Signals" value={facilities.length} />
                </View>
              </View>

              <View style={styles.assistantWorkbench}>
                <View style={styles.assistantModeRow}>
                  {assistantModes.map((mode) => (
                    <FilterChip
                      key={mode.value}
                      label={mode.label}
                      selected={assistantMode === mode.value}
                      onPress={() => setAssistantMode(mode.value)}
                    />
                  ))}
                </View>
                <View style={styles.assistantPromptGrid}>
                  {assistantPrompts.map((prompt) => (
                    <Pressable
                      key={prompt}
                      onPress={() => setAssistantMessage(prompt)}
                      style={styles.promptCard}
                    >
                      <Text style={styles.promptText}>{prompt}</Text>
                    </Pressable>
                  ))}
                </View>
                <View style={[styles.assistantComposer, compact && styles.assistantComposerCompact]}>
                  <FormInput
                    multiline
                    placeholder="Ask Atlas to plan, reflect, or summarise your campus day"
                    value={assistantMessage}
                    onChangeText={setAssistantMessage}
                    style={styles.assistantInput}
                  />
                  <ActionButton
                    label={assistantLoading ? "Thinking" : "Ask Atlas"}
                    onPress={submitDailyAssistant}
                    disabled={assistantLoading || !assistantMessage.trim()}
                    primary
                  />
                </View>
                {assistantResponse ? (
                  <View style={[styles.assistantResponse, !assistantResponse.success && styles.assistantResponseFallback]}>
                    <Text style={styles.assistantReply}>{assistantResponse.reply}</Text>
                    {assistantResponse.scheduleItems?.length ? (
                      <View style={styles.scheduleDraftList}>
                        <Text style={styles.scheduleDraftHeading}>Suggested schedule</Text>
                        {assistantResponse.scheduleItems.map((item, index) => {
                          const key = `${item.title}-${item.startAt}-${index}`;
                          return (
                            <View key={key} style={styles.scheduleDraftCard}>
                              <View style={styles.cardCopy}>
                                <Text style={styles.cardTitle}>{item.moduleCode || "TASK"} - {item.title}</Text>
                                <Text style={styles.cardText}>
                                  {(buildingByCode[item.location]?.name || item.location || "COM1")} - {formatTime(item.startAt)} to {formatTime(item.endAt)}
                                </Text>
                                {item.notes ? <Text style={styles.meta}>{item.notes}</Text> : null}
                              </View>
                              <ActionButton
                                label={assistantAddingKey === key ? "Adding" : "Add"}
                                onPress={() => addAssistantScheduleItem(item, index)}
                                disabled={Boolean(assistantAddingKey)}
                                primary
                              />
                            </View>
                          );
                        })}
                      </View>
                    ) : null}
                    <Text style={styles.assistantMeta}>
                      {[assistantResponse.provider, assistantResponse.model].filter(Boolean).join(" / ") ||
                        "local fallback"}
                    </Text>
                  </View>
                ) : (
                  <View style={styles.assistantEmptyState}>
                    <Text style={styles.assistantEmptyText}>Ready to turn today into a focused plan.</Text>
                  </View>
                )}
                {assistantError ? <Text style={styles.errorText}>{assistantError}</Text> : null}
              </View>
            </View>

            <View style={[styles.agentGrid, compact && styles.agentGridCompact]}>
              <Panel style={styles.agentColumn}>
                <PanelHeading eyebrow="Priority queue" title="Agent suggestions" />
                <View style={styles.stack}>
                  {recommendations.map((rec, index) => (
                    <View key={`${rec.kind}-${rec.title}`} style={styles.agentQueueItem}>
                      <View style={styles.queueRank}>
                        <Text style={styles.queueRankText}>{index + 1}</Text>
                      </View>
                      <View style={styles.cardCopy}>
                        <View style={styles.queueTitleRow}>
                          <Text style={styles.cardTitle}>{rec.title}</Text>
                          <Text style={styles.kindPill}>{rec.kind}</Text>
                        </View>
                        <Text style={styles.cardText}>{rec.description}</Text>
                      </View>
                      <Text style={styles.distance}>{Math.round(rec.distanceM)} m</Text>
                    </View>
                  ))}
                  {!recommendations.length ? (
                    <Text style={styles.cardText}>No recommendations yet. Refresh after adding schedule context.</Text>
                  ) : null}
                </View>
              </Panel>

              <Panel style={styles.agentColumn}>
                <PanelHeading eyebrow="Today" title="Timeline" />
                <View style={styles.timeline}>
                  {sortedSchedule.map((item) => (
                    <View key={item.id} style={styles.timelineItem}>
                      <View style={styles.timelineRail}>
                        <View style={styles.timelineDot} />
                      </View>
                      <View style={styles.cardCopy}>
                        <Text style={styles.cardTitle}>{item.moduleCode} - {item.title}</Text>
                        <Text style={styles.cardText}>{buildingByCode[item.location]?.name || item.location}</Text>
                        <Text style={styles.meta}>{formatTime(item.startAt)} to {formatTime(item.endAt)}</Text>
                      </View>
                    </View>
                  ))}
                  {!sortedSchedule.length ? (
                    <Text style={styles.cardText}>No scheduled items yet. Add one in Schedule to unlock richer guidance.</Text>
                  ) : null}
                </View>
              </Panel>
            </View>

            <Panel>
              <PanelHeading eyebrow="Campus signal" title="Context used by Atlas" />
              <View style={styles.signalGrid}>
                <SignalRow label="Supported buildings" value={buildings.length} />
                <SignalRow label="Indoor-ready buildings" value={indoorReadyCount} />
                <SignalRow label="Facility matches" value={facilities.length} />
                <SignalRow label="NUSMods sync" value={syncStatus?.status || "never_run"} />
              </View>
            </Panel>
          </>
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
          <Text style={[styles.eyebrow, styles.brandEyebrow]}>Orbital Artemis</Text>
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
              <Text style={[styles.navMarker, activeSection === section.key && styles.navMarkerActive]}>
                {section.marker}
              </Text>
              <View style={styles.navText}>
                <Text style={[styles.navLabel, activeSection === section.key && styles.navLabelActive]}>
                  {section.label}
                </Text>
                <Text style={[styles.navKicker, activeSection === section.key && styles.navKickerActive]}>
                  {section.kicker}
                </Text>
              </View>
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

function MetricTile({ label, value, tone }) {
  return (
    <View style={[styles.metricTile, styles[`metricTile${capitalize(tone)}`]]}>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

function ContextPill({ label, value }) {
  return (
    <View style={styles.contextPill}>
      <Text style={styles.contextValue}>{value}</Text>
      <Text style={styles.contextLabel}>{label}</Text>
    </View>
  );
}

function SignalRow({ label, value }) {
  return (
    <View style={styles.signalRow}>
      <Text style={styles.cardText}>{label}</Text>
      <Text style={styles.cardTitle}>{value}</Text>
    </View>
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

function ActionButton({ label, onPress, primary = false, disabled = false }) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={[styles.actionButton, primary && styles.actionButtonPrimary, disabled && styles.actionButtonDisabled]}
    >
      <Text
        style={[
          styles.actionLabel,
          primary && styles.actionLabelPrimary,
          disabled && styles.actionLabelDisabled,
        ]}
      >
        {label}
      </Text>
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

function capitalize(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function fallbackAssistantReply(mode) {
  if (mode === "daily_plan") {
    return "Daily plan fallback:\n1. Pick your top 2 priorities.\n2. Check your next scheduled item.\n3. Leave buffer time for campus travel.\n4. Revisit the plan this evening.";
  }
  if (mode === "reflection") {
    return "Reflection fallback:\n1. Note one win.\n2. Name one friction point.\n3. Choose one small adjustment for tomorrow.";
  }
  if (mode === "task_summary") {
    return "Task summary fallback:\n1. Separate urgent tasks from optional tasks.\n2. Group similar work.\n3. Start with the next concrete action.";
  }
  return "Assistant fallback:\n1. Clarify what needs attention.\n2. Choose one practical next action.\n3. Keep the plan short enough to follow.";
}

const baseStyles = {
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
  agentHero: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "stretch",
    justifyContent: "space-between",
    gap: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: "rgba(46,112,88,0.22)",
    borderRadius: 8,
    backgroundColor: "#f6fbf8",
  },
  agentHeroCopy: {
    flex: 1,
    minWidth: 280,
    gap: 9,
  },
  agentHeroTitle: {
    color: colors.ink,
    fontSize: 27,
    lineHeight: 32,
    fontWeight: "900",
  },
  agentHeroText: {
    maxWidth: 620,
    color: colors.muted,
    fontSize: 15,
    lineHeight: 22,
  },
  agentActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 4,
  },
  agentHeroAside: {
    width: 210,
    minHeight: 128,
    justifyContent: "space-between",
    padding: 14,
    borderWidth: 1,
    borderColor: "#dce8e3",
    borderRadius: 8,
    backgroundColor: "#ffffff",
  },
  agentAsideValue: {
    color: colors.green,
    fontSize: 25,
    lineHeight: 30,
    fontWeight: "900",
  },
  agentAsideLabel: {
    color: colors.muted,
    lineHeight: 19,
  },
  agentMetricGrid: {
    flexDirection: "row",
    gap: 12,
  },
  agentMetricGridCompact: {
    flexWrap: "wrap",
  },
  metricTile: {
    flex: 1,
    minWidth: 170,
    gap: 4,
    padding: 15,
    borderWidth: 1,
    borderRadius: 8,
    backgroundColor: "#ffffff",
  },
  metricTileGreen: {
    borderColor: "rgba(46,112,88,0.28)",
  },
  metricTileBlue: {
    borderColor: "rgba(71,118,184,0.28)",
  },
  metricTileOrange: {
    borderColor: "rgba(219,138,86,0.32)",
  },
  metricValue: {
    color: colors.ink,
    fontSize: 24,
    lineHeight: 28,
    fontWeight: "900",
  },
  metricLabel: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  assistantModeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  assistantComposer: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: 10,
  },
  assistantComposerCompact: {
    flexDirection: "column",
  },
  assistantInput: {
    flex: 1,
    minHeight: 78,
    textAlignVertical: "top",
  },
  assistantResponse: {
    gap: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(46,112,88,0.24)",
    borderRadius: 8,
    backgroundColor: "#f6fbf8",
  },
  assistantResponseFallback: {
    borderColor: "rgba(242,203,120,0.42)",
    backgroundColor: "rgba(242,203,120,0.12)",
  },
  assistantReply: {
    color: colors.ink,
    lineHeight: 20,
    whiteSpace: "pre-wrap",
  },
  assistantMeta: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "800",
  },
  agentGrid: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 16,
  },
  agentGridCompact: {
    flexDirection: "column",
  },
  agentColumn: {
    flex: 1,
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
  agentQueueItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#e4ece8",
    borderRadius: 8,
    backgroundColor: "#ffffff",
  },
  queueRank: {
    width: 30,
    height: 30,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    backgroundColor: "#e8f3ef",
  },
  queueRankText: {
    color: colors.green,
    fontWeight: "900",
  },
  queueTitleRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 8,
  },
  kindPill: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 8,
    overflow: "hidden",
    color: colors.green,
    backgroundColor: "#e8f3ef",
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  timeline: {
    gap: 4,
  },
  timelineItem: {
    flexDirection: "row",
    gap: 10,
    paddingVertical: 8,
  },
  timelineRail: {
    width: 18,
    alignItems: "center",
    paddingTop: 3,
  },
  timelineDot: {
    width: 10,
    height: 10,
    borderRadius: 99,
    backgroundColor: colors.blue,
  },
  signalGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  signalRow: {
    flexBasis: "48%",
    flexGrow: 1,
    minWidth: 220,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: "#e4ece8",
    borderRadius: 8,
    backgroundColor: "#ffffff",
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
  actionButtonDisabled: {
    opacity: 0.55,
  },
  actionLabel: {
    color: colors.ink,
    fontWeight: "900",
  },
  actionLabelPrimary: {
    color: "#ffffff",
  },
  actionLabelDisabled: {
    color: "#d8e3df",
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
};

const redesignStyles = {
  shell: {
    flexDirection: "row",
    height: "100vh",
    minHeight: 640,
    overflow: "hidden",
    backgroundColor: "#edf0ed",
  },
  shellCompact: {
    flexDirection: "column",
  },
  sidebar: {
    width: 318,
    flexShrink: 0,
    gap: 16,
    padding: 18,
    borderRightWidth: 1,
    borderRightColor: "#d7ddd8",
    backgroundColor: "#fbfcfa",
    ...shadows.panel,
  },
  sidebarCompact: {
    width: "100%",
    maxHeight: 390,
    borderRightWidth: 0,
    borderBottomWidth: 1,
    borderBottomColor: "#d7ddd8",
  },
  brandBlock: {
    gap: 10,
    padding: 16,
    borderWidth: 1,
    borderColor: "#222b27",
    borderRadius: 8,
    backgroundColor: "#222b27",
  },
  eyebrow: {
    color: "#6e7c75",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0,
    textTransform: "uppercase",
  },
  pageTitle: {
    color: "#ffffff",
    fontSize: 28,
    lineHeight: 33,
    fontWeight: "900",
  },
  brandEyebrow: {
    color: "#98dfc6",
  },
  apiPill: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    minHeight: 34,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  apiPillOnline: {
    borderColor: "rgba(129,210,176,0.42)",
  },
  apiLabel: {
    color: "#d9e2dd",
    fontSize: 12,
    fontWeight: "900",
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
    borderColor: "#dfe4df",
    borderRadius: 8,
    backgroundColor: "#ffffff",
  },
  statusValue: {
    color: "#242b27",
    fontSize: 21,
    lineHeight: 25,
    fontWeight: "900",
  },
  statusLabel: {
    color: "#738079",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0,
    textTransform: "uppercase",
  },
  navList: {
    gap: 8,
  },
  navItem: {
    minHeight: 66,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "#dfe4df",
    borderRadius: 8,
    backgroundColor: "#ffffff",
  },
  navItemActive: {
    borderColor: "rgba(46,112,88,0.35)",
    backgroundColor: "#edf7f1",
    boxShadow: "inset 3px 0 0 #2e7058",
  },
  navMarker: {
    width: 32,
    color: "#9aa39d",
    fontSize: 12,
    fontWeight: "900",
  },
  navMarkerActive: {
    color: "#2e7058",
  },
  navText: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  navLabel: {
    color: "#242b27",
    fontSize: 15,
    fontWeight: "900",
  },
  navLabelActive: {
    color: "#1f5f49",
  },
  navKicker: {
    color: "#738079",
    fontSize: 12,
    lineHeight: 16,
  },
  navKickerActive: {
    color: "#50665b",
  },
  mainStage: {
    flex: 1,
    minWidth: 0,
    minHeight: 0,
    position: "relative",
    overflow: "hidden",
    backgroundColor: "#edf0ed",
  },
  contentBody: {
    width: "100%",
    maxWidth: 1160,
    alignSelf: "center",
    gap: 18,
    padding: 26,
  },
  contentHeader: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 12,
    paddingBottom: 2,
  },
  contentTitle: {
    color: "#242b27",
    fontSize: 36,
    lineHeight: 42,
    fontWeight: "900",
  },
  agentHero: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "stretch",
    justifyContent: "space-between",
    gap: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: "#d6ddd8",
    borderRadius: 8,
    backgroundColor: "#ffffff",
    boxShadow: "0 18px 42px rgba(35, 43, 39, 0.08)",
  },
  agentHeroCopy: {
    flex: 1,
    minWidth: 280,
    gap: 10,
  },
  agentHeroTitle: {
    maxWidth: 720,
    color: "#242b27",
    fontSize: 30,
    lineHeight: 36,
    fontWeight: "900",
  },
  agentHeroText: {
    maxWidth: 680,
    color: "#617069",
    fontSize: 15,
    lineHeight: 23,
  },
  agentHeroAside: {
    width: 226,
    minHeight: 132,
    justifyContent: "space-between",
    padding: 15,
    borderWidth: 1,
    borderColor: "rgba(71,118,184,0.24)",
    borderRadius: 8,
    backgroundColor: "#f4f7fb",
  },
  agentAsideValue: {
    color: "#4776b8",
    fontSize: 26,
    lineHeight: 31,
    fontWeight: "900",
  },
  agentMetricGrid: {
    flexDirection: "row",
    gap: 12,
  },
  metricTile: {
    flex: 1,
    minWidth: 170,
    gap: 4,
    padding: 16,
    borderWidth: 1,
    borderRadius: 8,
    backgroundColor: "#ffffff",
  },
  metricTileGreen: {
    borderColor: "rgba(46,112,88,0.26)",
    backgroundColor: "#f2faf5",
  },
  metricTileBlue: {
    borderColor: "rgba(71,118,184,0.26)",
    backgroundColor: "#f4f7fb",
  },
  metricTileOrange: {
    borderColor: "rgba(219,138,86,0.3)",
    backgroundColor: "#fff7f1",
  },
  metricValue: {
    color: "#242b27",
    fontSize: 25,
    lineHeight: 30,
    fontWeight: "900",
  },
  metricLabel: {
    color: "#738079",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0,
    textTransform: "uppercase",
  },
  assistantSurface: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: 0,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#222b27",
    borderRadius: 8,
    backgroundColor: "#222b27",
    boxShadow: "0 20px 46px rgba(35, 43, 39, 0.16)",
  },
  assistantSurfaceCompact: {
    flexDirection: "column",
  },
  assistantIntro: {
    width: 286,
    gap: 12,
    padding: 20,
    backgroundColor: "#222b27",
  },
  assistantIntroCompact: {
    width: "100%",
  },
  assistantBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
    borderRadius: 8,
    overflow: "hidden",
    color: "#98dfc6",
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  assistantTitle: {
    color: "#ffffff",
    fontSize: 25,
    lineHeight: 30,
    fontWeight: "900",
  },
  assistantIntroText: {
    color: "#c7d2cc",
    fontSize: 14,
    lineHeight: 21,
  },
  assistantContextGrid: {
    flexDirection: "row",
    gap: 8,
    marginTop: "auto",
  },
  contextPill: {
    flex: 1,
    minWidth: 0,
    gap: 2,
    padding: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.07)",
  },
  contextValue: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "900",
  },
  contextLabel: {
    color: "#aebbb4",
    fontSize: 10,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  assistantWorkbench: {
    flex: 1,
    minWidth: 0,
    gap: 12,
    padding: 16,
    backgroundColor: "#fbfcfa",
  },
  assistantModeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  assistantPromptGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  promptCard: {
    flexGrow: 1,
    flexBasis: 190,
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: "#dfe4df",
    borderRadius: 8,
    backgroundColor: "#ffffff",
  },
  promptText: {
    color: "#3f4a45",
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "800",
  },
  assistantComposer: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: 10,
  },
  assistantComposerCompact: {
    flexDirection: "column",
  },
  assistantInput: {
    flex: 1,
    minHeight: 92,
    textAlignVertical: "top",
    backgroundColor: "#ffffff",
  },
  assistantResponse: {
    gap: 9,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(46,112,88,0.25)",
    borderRadius: 8,
    backgroundColor: "#edf7f1",
  },
  assistantResponseFallback: {
    borderColor: "rgba(219,138,86,0.36)",
    backgroundColor: "#fff7f1",
  },
  assistantReply: {
    color: "#242b27",
    lineHeight: 21,
    whiteSpace: "pre-wrap",
  },
  assistantMeta: {
    color: "#65716b",
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  scheduleDraftList: {
    gap: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "rgba(46,112,88,0.16)",
  },
  scheduleDraftHeading: {
    color: "#2e7058",
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  scheduleDraftCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: "rgba(46,112,88,0.18)",
    borderRadius: 8,
    backgroundColor: "#ffffff",
  },
  assistantEmptyState: {
    minHeight: 52,
    justifyContent: "center",
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: "#dfe4df",
    borderRadius: 8,
    backgroundColor: "#f4f6f4",
  },
  assistantEmptyText: {
    color: "#6f7c75",
    fontWeight: "800",
  },
  agentGrid: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 16,
  },
  agentGridCompact: {
    flexDirection: "column",
  },
  panel: {
    gap: 14,
    minWidth: 0,
    padding: 16,
    borderWidth: 1,
    borderColor: "#d8ded9",
    borderRadius: 8,
    backgroundColor: "#ffffff",
    boxShadow: "0 12px 28px rgba(35, 43, 39, 0.06)",
  },
  panelTitle: {
    color: "#242b27",
    fontSize: 18,
    fontWeight: "900",
  },
  compactCard: {
    flexGrow: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
    padding: 13,
    borderWidth: 1,
    borderColor: "#e2e7e2",
    borderRadius: 8,
    backgroundColor: "#ffffff",
  },
  cardTitle: {
    color: "#242b27",
    fontWeight: "900",
  },
  cardText: {
    color: "#617069",
    lineHeight: 20,
  },
  meta: {
    color: "#7a877f",
    fontSize: 12,
  },
  distance: {
    color: "#1f5f49",
    fontWeight: "900",
  },
  agentQueueItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    padding: 13,
    borderWidth: 1,
    borderColor: "#e2e7e2",
    borderRadius: 8,
    backgroundColor: "#ffffff",
  },
  queueRank: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    backgroundColor: "#edf7f1",
  },
  queueRankText: {
    color: "#1f5f49",
    fontWeight: "900",
  },
  kindPill: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 8,
    overflow: "hidden",
    color: "#4776b8",
    backgroundColor: "#f4f7fb",
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  timelineItem: {
    flexDirection: "row",
    gap: 10,
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: "#eef1ee",
  },
  timelineDot: {
    width: 10,
    height: 10,
    borderRadius: 99,
    backgroundColor: "#db8a56",
  },
  signalRow: {
    flexBasis: "48%",
    flexGrow: 1,
    minWidth: 220,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: "#e2e7e2",
    borderRadius: 8,
    backgroundColor: "#fbfcfa",
  },
  chip: {
    minHeight: 34,
    justifyContent: "center",
    paddingHorizontal: 11,
    borderWidth: 1,
    borderColor: "#d8ded9",
    borderRadius: 8,
    backgroundColor: "#ffffff",
  },
  chipSelected: {
    borderColor: "#222b27",
    backgroundColor: "#222b27",
  },
  chipLabel: {
    color: "#647069",
    fontSize: 13,
    fontWeight: "900",
  },
  chipLabelSelected: {
    color: "#ffffff",
  },
  input: {
    minHeight: 43,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "#d8ded9",
    borderRadius: 8,
    color: "#242b27",
    backgroundColor: "#ffffff",
    fontSize: 14,
  },
  actionButton: {
    minHeight: 38,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: "#d8ded9",
    borderRadius: 8,
    backgroundColor: "#ffffff",
  },
  actionButtonPrimary: {
    borderColor: "#2e7058",
    backgroundColor: "#2e7058",
  },
  actionButtonDisabled: {
    opacity: 0.55,
  },
  actionLabel: {
    color: "#242b27",
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
    borderColor: "#ecd6cf",
    borderRadius: 8,
    backgroundColor: "#fff6f3",
  },
  syncRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e7e2",
  },
  errorText: {
    color: "#a94747",
    fontWeight: "800",
  },
};

const styles = StyleSheet.create({
  ...baseStyles,
  ...redesignStyles,
});
