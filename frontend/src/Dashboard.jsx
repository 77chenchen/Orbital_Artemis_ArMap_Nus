import React, { useEffect, useMemo, useState } from "react";
import {
  Image,
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
import teamLogo from "./assets/brand/team_logo.jpg";

const PENDING_DASHBOARD_SECTION_KEY = "atlas.pendingDashboardSection";

const navItems = [
  { key: "dashboard", label: "Dashboard", icon: "home" },
  { key: "map", label: "AR Map", icon: "route" },
  { key: "recommendations", label: "Daily Assistant", icon: "spark" },
  { key: "schedule", label: "Schedule", icon: "calendar" },
  { key: "facilities", label: "Facilities", icon: "building" },
  { key: "inbox", label: "Inbox", icon: "inbox" },
  { key: "tasks", label: "Tasks", icon: "check" },
  { key: "resources", label: "Resources", icon: "book" },
  { key: "clubs", label: "Clubs & Events", icon: "people" },
  { key: "sync", label: "Settings", icon: "settings" },
];

const assistantModes = [
  { value: "daily_plan", label: "Study Plan" },
  { value: "general", label: "Campus Guide" },
  { value: "task_summary", label: "Task Summary" },
];

const facilityTypes = [
  { value: "", label: "All" },
  { value: "study_space", label: "Study" },
  { value: "restroom", label: "Restroom" },
  { value: "lift", label: "Lift" },
  { value: "printing", label: "Printing" },
];

const defaultForm = {
  title: "",
  moduleCode: "",
  location: "COM1",
  startAt: "",
  endAt: "",
  notes: "",
};

const fallbackProfile = {
  email: "demo@atlas.local",
  name: "Atlas User",
  picture: "",
  provider: "demo",
};

const defaultPersonalSettings = {
  preferredName: "",
  avatarUrl: "",
  studyStyle: "balanced",
  commuteMode: "walking",
  assistantTone: "concise",
  theme: "atlas",
  density: "comfortable",
  defaultSection: "dashboard",
  dailyReminder: "09:00",
  quietMode: false,
  reduceMotion: false,
};

const studyStyleOptions = [
  { value: "focused", label: "Focused" },
  { value: "balanced", label: "Balanced" },
  { value: "social", label: "Social" },
];

const commuteModeOptions = [
  { value: "walking", label: "Walking" },
  { value: "bus", label: "Bus" },
  { value: "cycling", label: "Cycling" },
];

const assistantToneOptions = [
  { value: "concise", label: "Concise" },
  { value: "friendly", label: "Friendly" },
  { value: "coach", label: "Coach" },
];

const themeOptions = [
  { value: "atlas", label: "Atlas" },
  { value: "sunrise", label: "Sunrise" },
  { value: "night", label: "Night" },
];

const densityOptions = [
  { value: "comfortable", label: "Comfort" },
  { value: "compact", label: "Compact" },
];

const defaultSectionOptions = navItems
  .filter((item) => ["dashboard", "map", "recommendations", "schedule", "tasks"].includes(item.key))
  .map((item) => ({ value: item.key, label: item.label }));

export default function Dashboard() {
  const [activeSection, setActiveSection] = useState(() => readPersonalSettings().defaultSection || "dashboard");
  const [health, setHealth] = useState(null);
  const [buildings, setBuildings] = useState([]);
  const [facilities, setFacilities] = useState([]);
  const [schedule, setSchedule] = useState([]);
  const [recommendations, setRecommendations] = useState([]);
  const [syncStatus, setSyncStatus] = useState(null);
  const [filters, setFilters] = useState({ building: "", type: "" });
  const [form, setForm] = useState(defaultForm);
  const [assistantMode, setAssistantMode] = useState("daily_plan");
  const [assistantMessage, setAssistantMessage] = useState("");
  const [assistantResponse, setAssistantResponse] = useState(null);
  const [assistantLoading, setAssistantLoading] = useState(false);
  const [assistantError, setAssistantError] = useState("");
  const [assistantAddingKey, setAssistantAddingKey] = useState("");
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [profile, setProfile] = useState(() => readStoredProfile());
  const [personalSettings, setPersonalSettings] = useState(() => readPersonalSettings());
  const [profileSettingsOpen, setProfileSettingsOpen] = useState(false);
  const { width } = useWindowDimensions();

  const compact = width < 980;
  const phone = width < 680;

  const buildingByCode = useMemo(
    () => Object.fromEntries(buildings.map((building) => [building.code, building])),
    [buildings],
  );

  const sortedSchedule = useMemo(
    () =>
      [...schedule].sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime()),
    [schedule],
  );

  const nextScheduleItem =
    sortedSchedule.find((item) => new Date(item.endAt).getTime() >= Date.now()) || sortedSchedule[0];
  const indoorReadyCount = buildings.filter((building) => building.supportedIndoor).length;
  const dashboardTasks = useMemo(() => buildDashboardTasks(sortedSchedule), [sortedSchedule]);
  const dashboardWeekEvents = useMemo(() => buildWeekEvents(sortedSchedule), [sortedSchedule]);

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
    setProfile(readStoredProfile());
    setPersonalSettings(readPersonalSettings());
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const openSection = (section) => {
      if (navItems.some((item) => item.key === section)) setActiveSection(section);
    };

    try {
      const pendingSection = window.sessionStorage.getItem(PENDING_DASHBOARD_SECTION_KEY);
      if (pendingSection) {
        window.sessionStorage.removeItem(PENDING_DASHBOARD_SECTION_KEY);
        openSection(pendingSection);
      }
    } catch {
      // Section navigation events still work when storage is unavailable.
    }

    function handleAgentSection(event) {
      const section = event.detail?.section;
      try {
        window.sessionStorage.removeItem(PENDING_DASHBOARD_SECTION_KEY);
      } catch {
        // Ignore storage failures; the in-memory event is enough.
      }
      openSection(section);
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
      setForm((current) => ({ ...defaultForm, location: current.location }));
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

  async function changePassword(passwords) {
    setError("");
    setNotice("");
    if (passwords.newPassword !== passwords.confirmPassword) {
      setError("New passwords do not match.");
      return false;
    }
    if (passwords.newPassword.length < 6) {
      setError("New password must be at least 6 characters.");
      return false;
    }
    try {
      await api.changePassword({
        currentPassword: passwords.currentPassword,
        newPassword: passwords.newPassword,
      });
      setNotice("Password changed.");
      return true;
    } catch (err) {
      setError(err.message);
      return false;
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
          personalSettings,
          campusSignal: {
            buildings: buildings.length,
            indoorReadyBuildings: indoorReadyCount,
            facilityMatches: facilities.length,
          },
        },
      });
      setAssistantResponse(response);
      if (!response.success) setAssistantError(response.error || "Assistant returned a fallback response.");
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

  function renderMain() {
    if (activeSection === "map") {
      return (
        <View style={styles.mapStage}>
          <MapScreen embedded />
        </View>
      );
    }

    if (activeSection === "dashboard") {
      return (
        <ScrollView style={styles.scroll} contentContainerStyle={[styles.dashboardBody, phone && styles.dashboardBodyPhone]}>
          <TopBar
            compact={compact}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            onOpenSection={setActiveSection}
            profile={profile}
            personalSettings={personalSettings}
          />
          {(notice || error) && (
            <View style={[styles.notice, error && styles.noticeError]}>
              <Text style={[styles.noticeText, error && styles.noticeErrorText]}>{error || notice}</Text>
            </View>
          )}
          {searchQuery.trim() ? (
            <SearchResults
              query={searchQuery}
              buildings={buildings}
              facilities={facilities}
              schedule={sortedSchedule}
              recommendations={recommendations}
              onOpenSection={setActiveSection}
            />
          ) : null}
          <View style={[styles.dashboardTopGrid, compact && styles.dashboardTopGridCompact]}>
            <View style={styles.primaryTopColumn}>
              <HeroCard
                item={nextScheduleItem}
                buildingByCode={buildingByCode}
                onOpenMap={() => setActiveSection("map")}
                onDetails={() => setActiveSection("schedule")}
              />
              <AssistantCard
                assistantMode={assistantMode}
                setAssistantMode={setAssistantMode}
                assistantMessage={assistantMessage}
                setAssistantMessage={setAssistantMessage}
                assistantResponse={assistantResponse}
                assistantLoading={assistantLoading}
                assistantError={assistantError}
                assistantAddingKey={assistantAddingKey}
                onSubmit={submitDailyAssistant}
                onAddSchedule={addAssistantScheduleItem}
                schedule={dashboardTasks}
                recommendations={recommendations}
              />
            </View>

            <View style={styles.sideTopColumn}>
              <UpcomingCard item={nextScheduleItem} buildingByCode={buildingByCode} onSchedule={() => setActiveSection("schedule")} />
              <CampusPreview
                buildings={buildings}
                recommendations={recommendations}
                onOpenMap={() => setActiveSection("map")}
              />
              <StatsRow
                buildings={buildings.length}
                steps={6842}
                tasks={Math.max(sortedSchedule.length, recommendations.length)}
                events={Math.max(2, sortedSchedule.length)}
              />
            </View>
          </View>
          <View style={[styles.dashboardBottomGrid, compact && styles.dashboardBottomGridCompact]}>
            <TasksCard schedule={dashboardTasks} onDelete={deleteSchedule} style={styles.bottomPanel} />
            <WeekCard schedule={dashboardWeekEvents} buildingByCode={buildingByCode} style={styles.bottomPanelWide} />
            <FocusTimer style={styles.bottomPanel} />
          </View>
        </ScrollView>
      );
    }

    return (
      <ScrollView style={styles.scroll} contentContainerStyle={[styles.sectionBody, phone && styles.sectionBodyPhone]}>
        <SectionHeader
          title={sectionTitle(activeSection)}
          subtitle={sectionSubtitle(activeSection)}
          action={activeSection === "sync" ? "Run sync" : activeSection === "recommendations" ? "Refresh" : ""}
          onAction={activeSection === "sync" ? runSync : loadAll}
        />
        {(notice || error) && (
          <View style={[styles.notice, error && styles.noticeError]}>
            <Text style={[styles.noticeText, error && styles.noticeErrorText]}>{error || notice}</Text>
          </View>
        )}

        {activeSection === "recommendations" && (
          <AssistantFull
            assistantMode={assistantMode}
            setAssistantMode={setAssistantMode}
            assistantMessage={assistantMessage}
            setAssistantMessage={setAssistantMessage}
            assistantResponse={assistantResponse}
            assistantLoading={assistantLoading}
            assistantError={assistantError}
            assistantAddingKey={assistantAddingKey}
            onSubmit={submitDailyAssistant}
            onAddSchedule={addAssistantScheduleItem}
            recommendations={recommendations}
            schedule={sortedSchedule}
            buildingByCode={buildingByCode}
            compact={compact}
            phone={phone}
          />
        )}

        {activeSection === "schedule" && (
          <ScheduleEditor
            form={form}
            setForm={setForm}
            buildings={buildings}
            schedule={sortedSchedule}
            buildingByCode={buildingByCode}
            onSubmit={submitSchedule}
            onDelete={deleteSchedule}
          />
        )}

        {activeSection === "facilities" && (
          <FacilitiesPanel
            buildings={buildings}
            facilities={facilities}
            filters={filters}
            setFilters={setFilters}
          />
        )}

        {activeSection === "sync" && (
          <SettingsPanel
            health={health}
            loading={loading}
            syncStatus={syncStatus}
            buildings={buildings}
            indoorReadyCount={indoorReadyCount}
            facilities={facilities}
          />
        )}

        {activeSection === "tasks" && (
          <TasksPanel
            schedule={dashboardTasks}
            onDelete={deleteSchedule}
            onOpenSchedule={() => setActiveSection("schedule")}
          />
        )}

        {activeSection === "inbox" && (
          <InboxPanel
            health={health}
            syncStatus={syncStatus}
            schedule={sortedSchedule}
            recommendations={recommendations}
            onOpenAssistant={() => setActiveSection("recommendations")}
          />
        )}

        {activeSection === "resources" && (
          <ResourcesPanel
            buildings={buildings}
            facilities={facilities}
            recommendations={recommendations}
            onOpenMap={() => setActiveSection("map")}
          />
        )}

        {activeSection === "clubs" && (
          <ClubsPanel
            schedule={sortedSchedule}
            onOpenSchedule={() => setActiveSection("schedule")}
          />
        )}
      </ScrollView>
    );
  }

  return (
    <View
      dataSet={{
        atlasTheme: personalSettings.theme,
        atlasDensity: personalSettings.density,
        atlasReduceMotion: personalSettings.reduceMotion ? "true" : "false",
      }}
      style={[
        styles.shell,
        compact && styles.shellCompact,
        personalSettings.theme === "sunrise" && styles.shellThemeSunrise,
        personalSettings.theme === "night" && styles.shellThemeNight,
        personalSettings.density === "compact" && styles.shellDensityCompact,
      ]}
    >
      <Sidebar
        activeSection={activeSection}
        setActiveSection={setActiveSection}
        health={health}
        loading={loading}
        schedule={schedule}
        profile={profile}
        personalSettings={personalSettings}
        settingsOpen={profileSettingsOpen}
        setSettingsOpen={setProfileSettingsOpen}
        onSaveSettings={(nextSettings) => {
          const saved = savePersonalSettings(nextSettings, profile);
          setPersonalSettings(saved.settings);
          setProfile(saved.profile);
          setActiveSection(saved.settings.defaultSection || "dashboard");
          setNotice("Personal settings saved.");
          setError("");
        }}
        onChangePassword={changePassword}
        compact={compact}
      />
      <View
        style={[
          styles.main,
          personalSettings.theme === "sunrise" && styles.mainThemeSunrise,
          personalSettings.theme === "night" && styles.mainThemeNight,
        ]}
      >
        <DashboardSectionBoundary section={activeSection} onOpenSection={setActiveSection}>
          <DashboardSectionContent render={renderMain} />
        </DashboardSectionBoundary>
      </View>
    </View>
  );
}

class DashboardSectionBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("Atlas dashboard section failed", error, info);
  }

  componentDidUpdate(previousProps) {
    if (previousProps.section !== this.props.section && this.state.error) {
      this.setState({ error: null });
    }
  }

  render() {
    if (!this.state.error) return this.props.children;

    const message = this.state.error instanceof Error ? this.state.error.message : "This section failed to render.";

    return (
      <View style={styles.sectionError}>
        <Text style={styles.sectionErrorKicker}>Section recovery</Text>
        <Text style={styles.sectionErrorTitle}>{`${sectionTitle(this.props.section)} could not render`}</Text>
        <Text style={styles.sectionErrorText}>{message}</Text>
        <View style={styles.sectionErrorActions}>
          <Pressable onPress={() => this.setState({ error: null })} style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>Try again</Text>
          </Pressable>
          <Pressable onPress={() => this.props.onOpenSection?.("recommendations")} style={styles.secondaryButton}>
            <Text style={styles.secondaryButtonText}>Open Daily Assistant</Text>
          </Pressable>
          <Pressable onPress={() => this.props.onOpenSection?.("dashboard")} style={styles.secondaryButton}>
            <Text style={styles.secondaryButtonText}>Back to dashboard</Text>
          </Pressable>
        </View>
      </View>
    );
  }
}

function DashboardSectionContent({ render }) {
  return render();
}

function Sidebar({
  activeSection,
  setActiveSection,
  health,
  loading,
  schedule,
  profile,
  personalSettings,
  settingsOpen,
  setSettingsOpen,
  onSaveSettings,
  onChangePassword,
  compact,
}) {
  const initials = initialsFromProfile(profile);
  const meta = profile.email || (profile.provider === "demo" ? "Demo mode" : "Signed in");

  return (
    <View style={[styles.sidebar, compact && styles.sidebarCompact]}>
      <View style={styles.brand}>
        <View style={styles.logoMark}>
          <Image source={{ uri: teamLogo }} style={styles.logoImage} resizeMode="cover" />
        </View>
        <View>
          <Text style={styles.brandName}>Artemis</Text>
          <Text style={styles.brandSub}>Campus navigation</Text>
        </View>
      </View>

      <View style={styles.navList}>
        {navItems.map((item) => (
          <Pressable
            key={item.key}
            onPress={() => setActiveSection(item.key)}
            style={[styles.navItem, activeSection === item.key && styles.navItemActive]}
          >
            <View style={[styles.navIcon, activeSection === item.key && styles.navIconActive]}>
              <SidebarIcon name={item.icon} active={activeSection === item.key} />
            </View>
            <Text style={[styles.navLabel, activeSection === item.key && styles.navLabelActive]}>{item.label}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.profileDock}>
        {settingsOpen ? (
          <ProfileSettingsPopover
            profile={profile}
            settings={personalSettings}
            onSave={(nextSettings) => {
              onSaveSettings(nextSettings);
              setSettingsOpen(false);
            }}
            onClose={() => setSettingsOpen(false)}
            onChangePassword={onChangePassword}
            compact={compact}
          />
        ) : null}
        <Pressable
          accessibilityRole="button"
          onPress={() => setSettingsOpen((current) => !current)}
          style={[styles.profileCard, settingsOpen && styles.profileCardActive]}
        >
          <View style={styles.avatar}>
            {profile.picture ? (
              <Image source={{ uri: profile.picture }} style={styles.avatarImage} resizeMode="cover" />
            ) : (
              <Text style={styles.avatarText}>{initials}</Text>
            )}
          </View>
          <View style={styles.profileCopy}>
            <Text style={styles.profileName} numberOfLines={1}>{profile.name}</Text>
            <Text style={styles.profileMeta} numberOfLines={1}>{meta}</Text>
          </View>
          <Text style={styles.profileChevron}>{settingsOpen ? "^" : "v"}</Text>
        </Pressable>
        <Text style={styles.profileHint} numberOfLines={1}>{`${settingsLabel(themeOptions, personalSettings.theme)} theme · ${settingsLabel(densityOptions, personalSettings.density)}`}</Text>
      </View>

      <View style={styles.statusCard}>
        <Text style={styles.statusTitle}>NUS Status</Text>
        <View style={styles.statusLine}>
          <View style={[styles.statusDot, health && styles.statusDotOnline]} />
          <Text style={styles.statusText}>{health ? "All Systems Normal" : loading ? "Checking API" : "API Offline"}</Text>
        </View>
        <View style={styles.statusSketch}>
          <View style={styles.sketchBuildingTall} />
          <View style={styles.sketchBuilding} />
          <View style={styles.sketchRoad} />
        </View>
      <Text style={styles.statusSmall}>{`${schedule.length} plan items loaded`}</Text>
      </View>
    </View>
  );
}

function ProfileSettingsPopover({ profile, settings, onSave, onClose, onChangePassword, compact }) {
  const [draft, setDraft] = useState(() => ({
    ...defaultPersonalSettings,
    ...settings,
    preferredName: settings.preferredName || profile.name || "",
    avatarUrl: settings.avatarUrl || profile.picture || "",
  }));
  const [passwordDraft, setPasswordDraft] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState("");

  function updateDraft(key, value) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function updatePasswordDraft(key, value) {
    setPasswordDraft((current) => ({ ...current, [key]: value }));
  }

  function handleSave() {
    onSave(draft);
  }

  async function handlePasswordSave() {
    setPasswordMessage("");
    setPasswordSaving(true);
    const ok = await onChangePassword(passwordDraft);
    setPasswordSaving(false);
    if (!ok) return;
    setPasswordDraft({ currentPassword: "", newPassword: "", confirmPassword: "" });
    setPasswordMessage("Password updated.");
  }

  return (
    <View style={[styles.profilePopover, compact && styles.profilePopoverCompact]}>
      <View style={styles.popoverHeader}>
        <View>
          <Text style={styles.popoverKicker}>Personalization</Text>
          <Text style={styles.popoverTitle}>Your Artemis setup</Text>
        </View>
        <Pressable accessibilityRole="button" onClick={onClose} onPress={onClose} style={styles.iconTextButton}>
          <Text style={styles.iconTextButtonText}>x</Text>
        </Pressable>
      </View>

      <ScrollView style={styles.preferenceScroll} contentContainerStyle={styles.preferenceForm}>
        <View style={styles.avatarPreviewRow}>
          <View style={styles.avatarPreview}>
            {draft.avatarUrl ? (
              <Image source={{ uri: draft.avatarUrl }} style={styles.avatarImage} resizeMode="cover" />
            ) : (
              <Text style={styles.avatarText}>{initialsFromProfile({ ...profile, name: draft.preferredName })}</Text>
            )}
          </View>
          <View style={styles.eventCopy}>
            <Text style={styles.preferenceLabel}>Avatar</Text>
            <Text style={styles.preferenceHelp}>Use an image URL or leave it empty for initials.</Text>
          </View>
        </View>
        <FormInput
          value={draft.preferredName}
          onChangeText={(preferredName) => updateDraft("preferredName", preferredName)}
          placeholder="Preferred name"
          style={styles.preferenceInput}
        />
        <FormInput
          value={draft.avatarUrl}
          onChangeText={(avatarUrl) => updateDraft("avatarUrl", avatarUrl)}
          placeholder="Avatar image URL"
          style={styles.preferenceInput}
        />

        <PreferenceGroup title="Theme">
          {themeOptions.map((option) => (
            <FilterChip
              key={option.value}
              label={option.label}
              selected={draft.theme === option.value}
              onPress={() => updateDraft("theme", option.value)}
            />
          ))}
        </PreferenceGroup>

        <PreferenceGroup title="Dashboard density">
          {densityOptions.map((option) => (
            <FilterChip
              key={option.value}
              label={option.label}
              selected={draft.density === option.value}
              onPress={() => updateDraft("density", option.value)}
            />
          ))}
        </PreferenceGroup>

        <PreferenceGroup title="Default page">
          {defaultSectionOptions.map((option) => (
            <FilterChip
              key={option.value}
              label={option.label}
              selected={draft.defaultSection === option.value}
              onPress={() => updateDraft("defaultSection", option.value)}
            />
          ))}
        </PreferenceGroup>

        <PreferenceGroup title="Study style">
          {studyStyleOptions.map((option) => (
            <FilterChip
              key={option.value}
              label={option.label}
              selected={draft.studyStyle === option.value}
              onPress={() => updateDraft("studyStyle", option.value)}
            />
          ))}
        </PreferenceGroup>

        <PreferenceGroup title="Route preference">
          {commuteModeOptions.map((option) => (
            <FilterChip
              key={option.value}
              label={option.label}
              selected={draft.commuteMode === option.value}
              onPress={() => updateDraft("commuteMode", option.value)}
            />
          ))}
        </PreferenceGroup>

        <PreferenceGroup title="Assistant tone">
          {assistantToneOptions.map((option) => (
            <FilterChip
              key={option.value}
              label={option.label}
              selected={draft.assistantTone === option.value}
              onPress={() => updateDraft("assistantTone", option.value)}
            />
          ))}
        </PreferenceGroup>

        <View style={styles.preferenceInline}>
          <Text style={styles.preferenceLabel}>Daily reminder</Text>
          <TextInput
            value={draft.dailyReminder}
            onChangeText={(dailyReminder) => updateDraft("dailyReminder", dailyReminder)}
            placeholder="09:00"
            placeholderTextColor="#8a8580"
            style={styles.timeInput}
          />
        </View>

        <PreferenceToggle
          label="Quiet mode"
          value={draft.quietMode}
          onPress={() => updateDraft("quietMode", !draft.quietMode)}
        />
        <PreferenceToggle
          label="Reduce motion"
          value={draft.reduceMotion}
          onPress={() => updateDraft("reduceMotion", !draft.reduceMotion)}
        />

        <View style={styles.passwordPanel}>
          <Text style={styles.preferenceLabel}>Change password</Text>
          <FormInput
            value={passwordDraft.currentPassword}
            onChangeText={(currentPassword) => updatePasswordDraft("currentPassword", currentPassword)}
            placeholder="Current password"
            secureTextEntry
            style={styles.preferenceInput}
          />
          <FormInput
            value={passwordDraft.newPassword}
            onChangeText={(newPassword) => updatePasswordDraft("newPassword", newPassword)}
            placeholder="New password"
            secureTextEntry
            style={styles.preferenceInput}
          />
          <FormInput
            value={passwordDraft.confirmPassword}
            onChangeText={(confirmPassword) => updatePasswordDraft("confirmPassword", confirmPassword)}
            placeholder="Confirm new password"
            secureTextEntry
            style={styles.preferenceInput}
          />
          <button
            type="button"
            disabled={passwordSaving || !passwordDraft.currentPassword || !passwordDraft.newPassword || !passwordDraft.confirmPassword}
            onClick={handlePasswordSave}
            style={{
              ...webSecondaryButtonStyle,
              alignSelf: "flex-start",
              opacity:
                passwordSaving || !passwordDraft.currentPassword || !passwordDraft.newPassword || !passwordDraft.confirmPassword
                  ? 0.58
                  : 1,
            }}
          >
            {passwordSaving ? "Saving..." : "Update password"}
          </button>
          {passwordMessage ? <Text style={styles.preferenceSuccess}>{passwordMessage}</Text> : null}
        </View>

        <View style={styles.popoverActions}>
          <button type="button" onClick={onClose} style={webSecondaryButtonStyle}>
            Cancel
          </button>
          <button type="button" onClick={handleSave} style={webSaveProfileButtonStyle}>
            Save
          </button>
        </View>
      </ScrollView>
    </View>
  );
}

function PreferenceGroup({ title, children }) {
  return (
    <View style={styles.preferenceGroup}>
      <Text style={styles.preferenceLabel}>{title}</Text>
      <View style={styles.preferenceChips}>{children}</View>
    </View>
  );
}

function PreferenceToggle({ label, value, onPress }) {
  return (
    <Pressable accessibilityRole="switch" accessibilityState={{ checked: value }} onPress={onPress} style={styles.preferenceToggle}>
      <Text style={styles.preferenceLabel}>{label}</Text>
      <View style={[styles.toggleTrack, value && styles.toggleTrackOn]}>
        <View style={[styles.toggleKnob, value && styles.toggleKnobOn]} />
      </View>
    </Pressable>
  );
}

function SidebarIcon({ name, active }) {
  const stroke = active ? "#f0c986" : "rgba(255, 248, 226, 0.54)";
  const fill = active ? "rgba(240, 201, 134, 0.16)" : "rgba(255, 248, 226, 0.04)";
  const common = {
    fill: "none",
    stroke,
    strokeWidth: 1.9,
    strokeLinecap: "round",
    strokeLinejoin: "round",
  };

  return (
    <svg aria-hidden="true" width="19" height="19" viewBox="0 0 24 24">
      {name === "home" && (
        <>
          <path {...common} d="M4.5 11.5 12 5l7.5 6.5" />
          <path {...common} d="M7 10.5V19h10v-8.5" />
          <path {...common} d="M10 19v-5h4v5" />
        </>
      )}
      {name === "route" && (
        <>
          <circle cx="6.5" cy="17.5" r="2.2" fill={fill} stroke={stroke} strokeWidth="1.7" />
          <circle cx="17.5" cy="6.5" r="2.2" fill={fill} stroke={stroke} strokeWidth="1.7" />
          <path {...common} d="M8.4 16.2c3.7-2 1.8-6.3 5.4-8.2" />
        </>
      )}
      {name === "spark" && (
        <>
          <path {...common} d="M12 4.5l1.5 5 5 1.5-5 1.5-1.5 5-1.5-5-5-1.5 5-1.5z" />
          <path {...common} d="M18.5 16.5l1.2 2.2 2.1 1.1-2.1 1.1-1.2 2.1-1.1-2.1-2.2-1.1 2.2-1.1z" />
        </>
      )}
      {name === "calendar" && (
        <>
          <rect x="5" y="6.5" width="14" height="13" rx="2.4" fill={fill} stroke={stroke} strokeWidth="1.7" />
          <path {...common} d="M8 4.5v4M16 4.5v4M5.5 10.5h13" />
        </>
      )}
      {name === "building" && (
        <>
          <path {...common} d="M6.5 19.5v-13h7v13" />
          <path {...common} d="M13.5 10h4v9.5" />
          <path {...common} d="M9 9h2M9 12.5h2M9 16h2" />
        </>
      )}
      {name === "inbox" && (
        <>
          <path {...common} d="M5 7h14l-2 10H7z" />
          <path {...common} d="M8.5 13h2.2l1.3 2 1.3-2h2.2" />
        </>
      )}
      {name === "check" && (
        <>
          <rect x="5.5" y="5.5" width="13" height="13" rx="3" fill={fill} stroke={stroke} strokeWidth="1.7" />
          <path {...common} d="m8.8 12.2 2.2 2.2 4.4-5" />
        </>
      )}
      {name === "book" && (
        <>
          <path {...common} d="M6 5.5h7a3 3 0 0 1 3 3v10h-7a3 3 0 0 0-3 3z" />
          <path {...common} d="M16 8.5h2.5v10H16" />
        </>
      )}
      {name === "people" && (
        <>
          <circle cx="9" cy="9" r="2.6" fill={fill} stroke={stroke} strokeWidth="1.7" />
          <path {...common} d="M4.8 18c.6-2.8 2.1-4.2 4.2-4.2s3.6 1.4 4.2 4.2" />
          <path {...common} d="M15 8.2c1.7.2 2.8 1.3 2.8 2.8 0 1.2-.6 2.1-1.6 2.6M17 14.5c1.4.6 2.2 1.8 2.5 3.5" />
        </>
      )}
      {name === "settings" && (
        <>
          <circle cx="12" cy="12" r="2.7" fill={fill} stroke={stroke} strokeWidth="1.7" />
          <path {...common} d="M12 4.8v2M12 17.2v2M4.8 12h2M17.2 12h2M6.9 6.9l1.4 1.4M15.7 15.7l1.4 1.4M17.1 6.9l-1.4 1.4M8.3 15.7l-1.4 1.4" />
        </>
      )}
    </svg>
  );
}

function TopBar({ compact, searchQuery, setSearchQuery, onOpenSection, profile, personalSettings }) {
  const displayName = personalSettings.preferredName || profile.name;
  const firstName = displayName.split(" ")[0] || "there";

  return (
    <View style={[styles.topBar, compact && styles.topBarCompact]}>
      <View style={styles.greeting}>
        <Text style={styles.sunGlyph}>*</Text>
        <View>
          <Text style={styles.greetingTitle}>Good morning, {firstName}</Text>
          <Text style={styles.greetingText}>Have a productive day at NUS!</Text>
        </View>
      </View>
      <View style={styles.searchBox}>
        <Text style={styles.searchIcon}>Q</Text>
        <TextInput
          style={styles.searchInput}
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search buildings, places, events..."
          placeholderTextColor="#8a8580"
        />
        {searchQuery ? (
          <Pressable accessibilityRole="button" onPress={() => setSearchQuery("")} style={styles.shortcutButton}>
            <Text style={styles.shortcut}>Clear</Text>
          </Pressable>
        ) : (
          <Text style={styles.shortcut}>K</Text>
        )}
      </View>
      <View style={styles.topActions}>
        <SquareButton label="Bell" onPress={() => onOpenSection("inbox")} />
        <SquareButton label="Cal" onPress={() => onOpenSection("schedule")} />
        <SquareButton label="Ask AI" dark onPress={() => onOpenSection("recommendations")} />
      </View>
    </View>
  );
}

function readStoredProfile() {
  if (typeof window === "undefined") return fallbackProfile;

  const stored = safeParseJSON(window.localStorage.getItem("atlas_user"));
  if (stored && (stored.name || stored.email)) {
    return normalizeProfile(stored);
  }

  const token = window.localStorage.getItem("token") || "";
  if (token === "demo-mode") {
    return { ...fallbackProfile, name: "Demo Student" };
  }

  const tokenProfile = readJwtPayload(token);
  return normalizeProfile(tokenProfile || fallbackProfile);
}

function readPersonalSettings() {
  if (typeof window === "undefined") return defaultPersonalSettings;
  const stored = safeParseJSON(window.localStorage.getItem("atlas_user_settings"));
  return normalizePersonalSettings(stored || {});
}

function savePersonalSettings(settings, currentProfile) {
  const normalizedSettings = normalizePersonalSettings(settings);
  const preferredName = normalizedSettings.preferredName.trim();
  const avatarUrl = normalizedSettings.avatarUrl.trim();
  const nextProfile = normalizeProfile({
    ...currentProfile,
    name: preferredName || currentProfile.name,
    picture: avatarUrl,
  });

  if (typeof window !== "undefined") {
    window.localStorage.setItem("atlas_user_settings", JSON.stringify(normalizedSettings));
    window.localStorage.setItem("atlas_user", JSON.stringify(nextProfile));
  }

  return { settings: normalizedSettings, profile: nextProfile };
}

function normalizePersonalSettings(settings) {
  const allowedStudyStyles = new Set(studyStyleOptions.map((option) => option.value));
  const allowedCommuteModes = new Set(commuteModeOptions.map((option) => option.value));
  const allowedAssistantTones = new Set(assistantToneOptions.map((option) => option.value));
  const allowedThemes = new Set(themeOptions.map((option) => option.value));
  const allowedDensities = new Set(densityOptions.map((option) => option.value));
  const allowedDefaultSections = new Set(defaultSectionOptions.map((option) => option.value));

  return {
    preferredName: typeof settings.preferredName === "string" ? settings.preferredName.trim() : "",
    avatarUrl: typeof settings.avatarUrl === "string" ? settings.avatarUrl.trim() : "",
    studyStyle: allowedStudyStyles.has(settings.studyStyle) ? settings.studyStyle : defaultPersonalSettings.studyStyle,
    commuteMode: allowedCommuteModes.has(settings.commuteMode) ? settings.commuteMode : defaultPersonalSettings.commuteMode,
    assistantTone: allowedAssistantTones.has(settings.assistantTone) ? settings.assistantTone : defaultPersonalSettings.assistantTone,
    theme: allowedThemes.has(settings.theme) ? settings.theme : defaultPersonalSettings.theme,
    density: allowedDensities.has(settings.density) ? settings.density : defaultPersonalSettings.density,
    defaultSection: allowedDefaultSections.has(settings.defaultSection)
      ? settings.defaultSection
      : defaultPersonalSettings.defaultSection,
    dailyReminder: normalizeReminderTime(settings.dailyReminder),
    quietMode: Boolean(settings.quietMode),
    reduceMotion: Boolean(settings.reduceMotion),
  };
}

function normalizeReminderTime(value) {
  if (typeof value !== "string") return defaultPersonalSettings.dailyReminder;
  const trimmed = value.trim();
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(trimmed) ? trimmed : defaultPersonalSettings.dailyReminder;
}

function normalizeProfile(profile) {
  const email = typeof profile.email === "string" ? profile.email : "";
  const name =
    typeof profile.name === "string" && profile.name.trim()
      ? profile.name.trim()
      : displayNameFromEmail(email);

  return {
    email,
    name,
    picture: typeof profile.picture === "string" ? profile.picture : "",
    provider: typeof profile.provider === "string" ? profile.provider : profile.auth_provider || "",
  };
}

function safeParseJSON(value) {
  try {
    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
}

function readJwtPayload(token) {
  try {
    const [, payload] = token.split(".");
    if (!payload) return null;
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const decoded = window.atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, "="));
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

function displayNameFromEmail(email) {
  const localPart = (email || "").split("@")[0] || "Atlas User";
  return localPart
    .replace(/[._-]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ") || "Atlas User";
}

function initialsFromProfile(profile) {
  const source = profile.name || profile.email || "Atlas User";
  const parts = source.replace(/@.*$/, "").replace(/[._-]+/g, " ").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function HeroCard({ item, buildingByCode, onOpenMap, onDetails }) {
  return (
    <View style={styles.heroCard}>
      <View style={styles.heroCopy}>
        <Text style={styles.goldKicker}>NEXT UP</Text>
        <Text style={styles.heroTitle}>{item?.title || "CS2103 Project Meeting"}</Text>
        <Text style={styles.heroMeta}>{item ? `Today, ${timeRange(item)}` : "Today, 1:00 PM - 2:30 PM"}</Text>
        <Text style={styles.heroMeta}>{item ? buildingByCode[item.location]?.name || item.location : "COM1-0203"}</Text>
        <View style={styles.heroActions}>
          <Pressable onPress={onOpenMap} style={styles.goldButton}>
            <Text style={styles.goldButtonText}>Open in AR Map</Text>
          </Pressable>
          <Pressable onPress={onDetails} style={styles.outlineDarkButton}>
            <Text style={styles.outlineDarkButtonText}>View Details</Text>
          </Pressable>
        </View>
      </View>
      <CampusLineArt dark />
    </View>
  );
}

function UpcomingCard({ item, buildingByCode, onSchedule }) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.headerInline}>
          <Text style={styles.cardKicker}>UP NEXT</Text>
          <Text style={styles.pillMuted}>in 2h 15m</Text>
        </View>
        <Text style={styles.moreText}>...</Text>
      </View>
      <View style={styles.eventBox}>
        <View style={styles.dateTile}>
          <Text style={styles.dateMonth}>MAY</Text>
          <Text style={styles.dateDay}>22</Text>
        </View>
        <View style={styles.eventCopy}>
          <Text style={styles.eventTitle}>{item?.title || "CS2103 Project Meeting"}</Text>
          <Text style={styles.smallMeta}>{item ? timeRange(item) : "1:00 PM - 2:30 PM"}</Text>
          <Text style={styles.smallMeta}>{item ? buildingByCode[item.location]?.name || item.location : "COM1-0203"}</Text>
        </View>
      </View>
      <Pressable onPress={onSchedule} style={styles.linkButton}>
        <Text style={styles.linkText}>{"View schedule ->"}</Text>
      </Pressable>
    </View>
  );
}

function AssistantCard(props) {
  const previewTasks = props.schedule.slice(0, 3);

  return (
    <View style={styles.assistantCard}>
      <View style={styles.assistantHeader}>
        <View style={styles.assistantSpark}>
          <Text style={styles.assistantSparkText}>*</Text>
        </View>
        <View>
          <Text style={styles.assistantTitle}>Daily Assistant</Text>
          <Text style={styles.assistantSubtitle}>Your AI companion for campus life</Text>
        </View>
      </View>
      <View style={styles.chipRow}>
        {assistantModes.map((mode) => (
          <FilterChip
            key={mode.value}
            label={mode.label}
            selected={props.assistantMode === mode.value}
            onPress={() => props.setAssistantMode(mode.value)}
          />
        ))}
      </View>
      <View style={styles.assistantContent}>
        <View style={styles.assistantChat}>
          <View style={styles.assistantBubble}>
            <Text style={styles.assistantBubbleText}>Hi Qichen! Here's your plan for today.</Text>
            {(previewTasks.length ? previewTasks : sampleTasks()).map((task, index) => (
              <View key={`${task.title}-${index}`} style={styles.checkItem}>
                <View style={styles.checkBox} />
                <Text style={styles.checkLine}>{task.title || task}</Text>
              </View>
            ))}
          </View>
          <View style={styles.inputRow}>
            <TextInput
              value={props.assistantMessage}
              onChangeText={props.setAssistantMessage}
              placeholder="Ask me anything..."
              placeholderTextColor="#9a958e"
              style={styles.askInput}
            />
            <Pressable
              disabled={props.assistantLoading}
              onPress={props.onSubmit}
              style={[styles.sendButton, props.assistantLoading && styles.disabled]}
            >
              <Text style={styles.sendButtonText}>{props.assistantLoading ? "..." : ">"}</Text>
            </Pressable>
          </View>
          {props.assistantResponse && (
            <View style={styles.responseBox}>
              <Text style={styles.responseText}>{props.assistantResponse.reply}</Text>
              {(props.assistantResponse.scheduleItems || []).map((item, index) => {
                const key = `${item.title}-${item.startAt}-${index}`;
                return (
                  <Pressable
                    key={key}
                    disabled={Boolean(props.assistantAddingKey)}
                    onPress={() => props.onAddSchedule(item, index)}
                    style={styles.miniAddButton}
                  >
                    <Text style={styles.miniAddText}>{props.assistantAddingKey === key ? "Adding" : `Add ${item.title}`}</Text>
                  </Pressable>
                );
              })}
            </View>
          )}
          {props.assistantError ? <Text style={styles.errorText}>{props.assistantError}</Text> : null}
        </View>
        <View style={styles.suggestedBox}>
          <Text style={styles.suggestedTitle}>Suggested for you</Text>
          {(props.recommendations.length ? props.recommendations : sampleRecommendations()).slice(0, 3).map((rec) => (
            <View key={`${rec.kind}-${rec.title}`} style={styles.suggestionItem}>
              <Text style={styles.suggestionIcon}>•</Text>
              <View style={styles.suggestionCopy}>
                <Text style={styles.suggestionTitle}>{rec.title}</Text>
                <Text style={styles.suggestionText}>{rec.description}</Text>
              </View>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

function CampusPreview({ buildings, recommendations, onOpenMap }) {
  return (
    <View style={styles.mapCard}>
      <View style={styles.mapHeader}>
        <Text style={styles.mapTitle}>Campus Map</Text>
        <Pressable onPress={onOpenMap} style={styles.darkMiniButton}>
          <Text style={styles.darkMiniButtonText}>Open Map</Text>
        </Pressable>
      </View>
      <View style={styles.mapIllustration}>
        <View style={styles.mapRoadMain} />
        <View style={styles.mapRoadNorth} />
        <View style={styles.mapRoadSouth} />
        <View style={styles.mapRoute} />
        <View style={[styles.campusBlock, styles.campusBlockCom]} />
        <View style={[styles.campusBlock, styles.campusBlockLibrary]} />
        <View style={[styles.campusBlock, styles.campusBlockUtown]} />
        <View style={[styles.campusBlock, styles.campusBlockFood]} />
        <View style={styles.mapTransitHub} />
        <View style={styles.mapPinMain}>
          <View style={styles.mapPinDot} />
        </View>
        <View style={[styles.smallMapPin, styles.smallMapPinLibrary]} />
        <View style={[styles.smallMapPin, styles.smallMapPinUtown]} />
        <Text style={[styles.mapLabel, styles.mapLabelCom]}>COM1</Text>
        <Text style={[styles.mapLabel, styles.mapLabelLibrary]}>Central Library</Text>
        <Text style={[styles.mapLabel, styles.mapLabelUtown]}>UTown</Text>
        <Text style={[styles.mapLabel, styles.mapLabelFood]}>Food & Study</Text>
      </View>
      <Text style={styles.mapMeta}>{`${buildings.length || 3} buildings tracked, ${recommendations.length || 2} live suggestions`}</Text>
    </View>
  );
}

function StatsRow({ buildings, steps, tasks, events }) {
  return (
    <View style={styles.statsRow}>
      <StatTile value={buildings || 3} label="Buildings" sub="Visited today" />
      <StatTile value={steps.toLocaleString()} label="Steps" sub="Today" />
      <StatTile value={tasks || 4} label="Tasks" sub="Remaining" />
      <StatTile value={events || 2} label="Events" sub="This week" />
    </View>
  );
}

function StatTile({ value, label, sub }) {
  return (
    <View style={styles.statTile}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statSub}>{sub}</Text>
    </View>
  );
}

function TasksCard({ schedule, onDelete, style }) {
  const items = schedule.slice(0, 3);

  return (
    <View style={[styles.card, style]}>
      <View style={styles.cardHeader}>
        <Text style={styles.sectionCardTitle}>Tasks</Text>
        <Text style={styles.linkTiny}>{"View all tasks ->"}</Text>
      </View>
      {items.map((item, index) => (
        <View key={item.id || index} style={styles.taskRow}>
          <View style={styles.checkbox} />
          <Text style={styles.taskTitle}>{item.moduleCode ? `${item.moduleCode} ${item.title}` : item.title}</Text>
          {item.synthetic ? (
            <Text style={styles.taskDue}>{index === 0 ? "Today" : "May 24"}</Text>
          ) : (
            <Pressable onPress={() => onDelete(item.id)} style={styles.deleteMini}>
              <Text style={styles.deleteMiniText}>x</Text>
            </Pressable>
          )}
        </View>
      ))}
    </View>
  );
}

function WeekCard({ schedule, buildingByCode, style }) {
  const days = ["MON\n20", "TUE\n21", "WED\n22", "THU\n23", "FRI\n24", "SAT\n25", "SUN\n26"];

  return (
    <View style={[styles.card, style]}>
      <Text style={styles.sectionCardTitle}>Week at a glance</Text>
      <View style={styles.weekDays}>
        {days.map((day) => (
          <View key={day} style={[styles.dayCell, day.includes("WED") && styles.dayCellActive]}>
            <Text style={[styles.dayText, day.includes("WED") && styles.dayTextActive]}>{day}</Text>
          </View>
        ))}
      </View>
      {schedule.slice(0, 2).map((item) => (
        <View key={item.id} style={styles.weekEvent}>
          <View style={styles.eventAccent} />
          <View style={styles.eventCopy}>
            <Text style={styles.eventTitle}>{item.moduleCode || "TASK"} {item.title}</Text>
            <Text style={styles.smallMeta}>{buildingByCode[item.location]?.name || item.location || "COM1-0203"}</Text>
          </View>
          <Text style={styles.smallMeta}>{item.startAt ? timeRange(item) : "1:00 PM - 2:30 PM"}</Text>
        </View>
      ))}
    </View>
  );
}

function FocusTimer({ style }) {
  const [secondsLeft, setSecondsLeft] = useState(25 * 60);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    if (!running) return undefined;
    const timer = window.setInterval(() => {
      setSecondsLeft((current) => {
        if (current <= 1) {
          window.clearInterval(timer);
          setRunning(false);
          return 0;
        }
        return current - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [running]);

  const minutes = Math.floor(secondsLeft / 60).toString().padStart(2, "0");
  const seconds = (secondsLeft % 60).toString().padStart(2, "0");

  return (
    <View style={[styles.focusCard, style]}>
      <Text style={styles.sectionCardTitle}>Focus Timer</Text>
      <View style={styles.focusBody}>
        <View style={styles.timerRing}>
          <Text style={styles.timerText}>{`${minutes}:${seconds}`}</Text>
          <Pressable onPress={() => setRunning((current) => !current)} style={styles.timerStart}>
            <Text style={styles.timerStartText}>{running ? "Pause" : secondsLeft === 0 ? "Done" : "Start"}</Text>
          </Pressable>
        </View>
        <View style={styles.focusCopy}>
          <Text style={styles.focusTitle}>Let's focus!</Text>
          <Text style={styles.focusText}>{running ? "Timer is running." : "Use a 25 minute block for deep work."}</Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              setRunning(false);
              setSecondsLeft(25 * 60);
            }}
            style={styles.linkButton}
          >
            <Text style={styles.linkText}>Reset timer</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function AssistantFull(props) {
  const [expanded, setExpanded] = useState(false);
  const today = new Intl.DateTimeFormat("en-SG", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date());
  const upcoming = props.schedule.slice(0, 4);
  const recommendations = (props.recommendations.length ? props.recommendations : sampleRecommendations()).slice(0, 3);
  const quickPrompts = [
    "Plan my day around my classes",
    "Where can I study nearby?",
    "Summarise my priority tasks",
  ];

  return (
    <View style={styles.assistantWorkspace}>
      <View style={[styles.assistantOverview, props.phone && styles.assistantOverviewPhone]}>
        <View style={styles.assistantOverviewGlow} />
        <View style={styles.assistantOverviewTop}>
          <View style={styles.assistantOrb}>
            <AssistantGlyph name="spark" color="#123f38" size={25} />
          </View>
          <View style={styles.assistantOverviewCopy}>
            <Text style={styles.assistantOverviewEyebrow}>{today.toUpperCase()}</Text>
            <Text style={styles.assistantOverviewTitle}>Let’s make today feel manageable.</Text>
            <Text style={styles.assistantOverviewText}>
              I can organise your classes, surface the next useful task, and help you move around campus without the usual tab-juggling.
            </Text>
          </View>
          <View style={styles.assistantLivePill}>
            <View style={styles.assistantLiveDot} />
            <Text style={styles.assistantLiveText}>Ready</Text>
          </View>
        </View>
        <View style={styles.assistantOverviewStats}>
          <AssistantStat icon="calendar" value={props.schedule.length || 3} label="Plans today" />
          <AssistantStat icon="check" value={Math.max(1, recommendations.length)} label="Priorities" />
          <AssistantStat icon="pin" value={upcoming[0]?.location || "COM1"} label="Next stop" />
        </View>
      </View>

      <View style={[styles.assistantModeBar, props.phone && styles.assistantModeBarPhone]}>
        <View>
          <Text style={styles.assistantModeLabel}>WHAT DO YOU NEED?</Text>
          <Text style={styles.assistantModeHint}>Choose a focus, then talk naturally.</Text>
        </View>
        <View style={[styles.assistantModeChoices, props.phone && styles.assistantModeChoicesPhone]}>
          {assistantModes.map((mode) => (
            <Pressable
              key={mode.value}
              onPress={() => props.setAssistantMode(mode.value)}
              style={[styles.assistantModeChoice, props.assistantMode === mode.value && styles.assistantModeChoiceActive]}
            >
              <AssistantGlyph
                name={mode.value === "daily_plan" ? "calendar" : mode.value === "task_summary" ? "check" : "compass"}
                color={props.assistantMode === mode.value ? "#fff8e2" : "#49645e"}
                size={16}
              />
              <Text style={[styles.assistantModeChoiceText, props.assistantMode === mode.value && styles.assistantModeChoiceTextActive]}>
                {mode.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={[styles.assistantMainGrid, props.compact && styles.assistantMainGridCompact, expanded && styles.assistantMainGridExpanded]}>
        <View
          style={[
            styles.assistantConversation,
            props.phone && styles.assistantConversationPhone,
            expanded && styles.assistantConversationExpanded,
          ]}
        >
          <View style={styles.assistantConversationHeader}>
            <View style={styles.assistantConversationIdentity}>
              <View style={styles.assistantMiniOrb}>
                <AssistantGlyph name="spark" color="#fff8e2" size={15} />
              </View>
              <View>
                <Text style={styles.assistantConversationTitle}>Artemis</Text>
                <Text style={styles.assistantConversationMeta}>Campus copilot · online now</Text>
              </View>
            </View>
            <View style={styles.assistantConversationActions}>
              <Text style={styles.assistantContextBadge}>{assistantModes.find((mode) => mode.value === props.assistantMode)?.label}</Text>
              <Pressable
                accessibilityLabel={expanded ? "Collapse assistant" : "Expand assistant"}
                accessibilityRole="button"
                onPress={() => setExpanded((current) => !current)}
                style={[styles.assistantExpandButton, expanded && styles.assistantExpandButtonActive]}
              >
                <AssistantGlyph name={expanded ? "collapse" : "expand"} color={expanded ? "#fff8e2" : "#49645e"} size={17} />
                <Text style={[styles.assistantExpandText, expanded && styles.assistantExpandTextActive]}>
                  {expanded ? "Collapse" : "Expand"}
                </Text>
              </Pressable>
            </View>
          </View>

          <ScrollView
            testID="assistant-message-scroll"
            style={[styles.assistantMessageScroll, expanded && styles.assistantMessageScrollExpanded]}
            contentContainerStyle={styles.assistantMessageArea}
            showsVerticalScrollIndicator
          >
            <View style={styles.assistantBotRow}>
              <View style={styles.assistantBotAvatar}>
                <AssistantGlyph name="spark" color="#c97654" size={15} />
              </View>
              <View style={styles.assistantBotBubble}>
                <Text style={styles.assistantBotGreeting}>Good morning! I’ve looked over your day.</Text>
                <Text style={styles.assistantBotText}>
                  {upcoming.length
                    ? `You have ${upcoming.length} upcoming ${upcoming.length === 1 ? "item" : "items"}. We can build a realistic plan around ${upcoming[0].title || "your next class"}.`
                    : "Your calendar is open. Tell me what you want to accomplish and I’ll turn it into a practical campus plan."}
                </Text>
              </View>
            </View>

            {props.assistantResponse ? (
              <View style={styles.assistantResponseCard}>
                <View style={styles.assistantResponseHeader}>
                  <AssistantGlyph name="spark" color="#2e7058" size={16} />
                  <Text style={styles.assistantResponseLabel}>YOUR PERSONALISED PLAN</Text>
                </View>
                <Text style={styles.assistantResponseCopy}>{props.assistantResponse.reply}</Text>
                {(props.assistantResponse.scheduleItems || []).map((item, index) => {
                  const key = `${item.title}-${item.startAt}-${index}`;
                  return (
                    <View key={key} style={styles.assistantPlanItem}>
                      <View style={styles.assistantPlanTime}>
                        <Text style={styles.assistantPlanTimeText}>{formatAssistantTime(item.startAt)}</Text>
                      </View>
                      <View style={styles.assistantPlanCopy}>
                        <Text style={styles.assistantPlanTitle}>{item.title}</Text>
                        <Text style={styles.assistantPlanMeta}>{item.location || "Campus"}</Text>
                      </View>
                      <Pressable
                        disabled={Boolean(props.assistantAddingKey)}
                        onPress={() => props.onAddSchedule(item, index)}
                        style={styles.assistantAddButton}
                      >
                        <Text style={styles.assistantAddButtonText}>{props.assistantAddingKey === key ? "Adding…" : "+ Add"}</Text>
                      </Pressable>
                    </View>
                  );
                })}
              </View>
            ) : null}

            {props.assistantLoading ? (
              <View style={styles.assistantThinkingRow}>
                <View style={styles.assistantThinkingDot} />
                <View style={styles.assistantThinkingDot} />
                <View style={styles.assistantThinkingDot} />
                <Text style={styles.assistantThinkingText}>Artemis is putting the pieces together…</Text>
              </View>
            ) : null}
            {props.assistantError ? <Text style={styles.errorText}>{props.assistantError}</Text> : null}
          </ScrollView>

          <View style={styles.assistantComposerWrap}>
            <Text style={styles.assistantPromptLabel}>TRY ASKING</Text>
            <View style={styles.assistantQuickRow}>
              {quickPrompts.map((prompt) => (
                <Pressable key={prompt} onPress={() => props.setAssistantMessage(prompt)} style={styles.assistantQuickPrompt}>
                  <Text style={styles.assistantQuickPromptText}>{prompt}</Text>
                </Pressable>
              ))}
            </View>
            <View style={styles.assistantComposer}>
              <View style={styles.assistantComposerIcon}>
                <AssistantGlyph name="message" color="#c97654" size={18} />
              </View>
              <TextInput
                value={props.assistantMessage}
                onChangeText={props.setAssistantMessage}
                onSubmitEditing={props.onSubmit}
                placeholder="Ask Artemis to plan, prioritise, or find something…"
                placeholderTextColor="#8d948f"
                style={styles.assistantComposerInput}
              />
              <Pressable
                disabled={props.assistantLoading || !props.assistantMessage.trim()}
                onPress={props.onSubmit}
                style={[
                  styles.assistantComposerSend,
                  (props.assistantLoading || !props.assistantMessage.trim()) && styles.assistantComposerSendDisabled,
                ]}
              >
                <AssistantGlyph name="arrow" color="#fff8e2" size={19} />
              </Pressable>
            </View>
            <Text style={styles.assistantComposerNote}>Artemis uses your Atlas schedule and campus data to shape each answer.</Text>
          </View>
        </View>

        <View style={[styles.assistantSideRail, props.phone && styles.assistantSideRailPhone, expanded && styles.assistantSideRailHidden]}>
          <View style={styles.assistantRailCard}>
            <View style={styles.assistantRailHeader}>
              <View>
                <Text style={styles.assistantRailEyebrow}>YOUR DAY</Text>
                <Text style={styles.assistantRailTitle}>Coming up</Text>
              </View>
              <View style={styles.assistantRailCount}>
                <Text style={styles.assistantRailCountText}>{upcoming.length || 3}</Text>
              </View>
            </View>
            {(upcoming.length ? upcoming : buildDashboardTasks([])).slice(0, 4).map((item, index) => (
              <View key={item.id || `${item.title}-${index}`} style={styles.assistantTimelineItem}>
                <View style={styles.assistantTimelineTrack}>
                  <View style={[styles.assistantTimelineDot, index === 0 && styles.assistantTimelineDotActive]} />
                  {index < Math.min((upcoming.length || 3), 4) - 1 ? <View style={styles.assistantTimelineLine} /> : null}
                </View>
                <View style={styles.assistantTimelineCopy}>
                  <Text style={styles.assistantTimelineTime}>{item.startAt ? formatAssistantTime(item.startAt) : index === 0 ? "1:00 PM" : "Later"}</Text>
                  <Text numberOfLines={2} style={styles.assistantTimelineTitle}>{item.title}</Text>
                  <Text style={styles.assistantTimelineMeta}>{item.location || item.moduleCode || "NUS Campus"}</Text>
                </View>
              </View>
            ))}
          </View>

          <View style={styles.assistantRailCard}>
            <View style={styles.assistantRailHeader}>
              <View>
                <Text style={styles.assistantRailEyebrow}>SMART PICKS</Text>
                <Text style={styles.assistantRailTitle}>For you</Text>
              </View>
              <AssistantGlyph name="compass" color="#c97654" size={20} />
            </View>
            {recommendations.map((rec, index) => (
              <View key={`${rec.kind}-${rec.title}`} style={styles.assistantInsightItem}>
                <View style={[styles.assistantInsightIcon, index === 1 && styles.assistantInsightIconGreen]}>
                  <AssistantGlyph name={rec.kind === "route" ? "pin" : rec.kind === "task" ? "check" : "book"} color={index === 1 ? "#2e7058" : "#c97654"} size={16} />
                </View>
                <View style={styles.assistantInsightCopy}>
                  <Text style={styles.assistantInsightTitle}>{rec.title}</Text>
                  <Text numberOfLines={2} style={styles.assistantInsightText}>{rec.description}</Text>
                </View>
                {rec.distanceM ? <Text style={styles.assistantInsightDistance}>{Math.round(rec.distanceM)}m</Text> : null}
              </View>
            ))}
          </View>
        </View>
      </View>
    </View>
  );
}

function AssistantStat({ icon, value, label }) {
  return (
    <View style={styles.assistantStat}>
      <View style={styles.assistantStatIcon}>
        <AssistantGlyph name={icon} color="#f0c986" size={17} />
      </View>
      <View>
        <Text style={styles.assistantStatValue}>{value}</Text>
        <Text style={styles.assistantStatLabel}>{label}</Text>
      </View>
    </View>
  );
}

function AssistantGlyph({ name, color = "currentColor", size = 18 }) {
  const common = { fill: "none", stroke: color, strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" };
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24">
      {name === "spark" ? <path {...common} d="m12 3 1.7 5.3L19 10l-5.3 1.7L12 17l-1.7-5.3L5 10l5.3-1.7L12 3Z" /> : null}
      {name === "calendar" ? <><rect {...common} x="4.5" y="6" width="15" height="14" rx="2.5" /><path {...common} d="M8 4v4m8-4v4M5 10h14" /></> : null}
      {name === "check" ? <><circle {...common} cx="12" cy="12" r="8.5" /><path {...common} d="m8.2 12.1 2.4 2.5 5.3-5.3" /></> : null}
      {name === "pin" ? <><path {...common} d="M19 10c0 5-7 10-7 10S5 15 5 10a7 7 0 1 1 14 0Z" /><circle {...common} cx="12" cy="10" r="2.2" /></> : null}
      {name === "compass" ? <><circle {...common} cx="12" cy="12" r="8.5" /><path {...common} d="m15.7 8.3-2.1 5.3-5.3 2.1 2.1-5.3 5.3-2.1Z" /></> : null}
      {name === "message" ? <><path {...common} d="M5 18.5 6.2 15A7.5 7.5 0 1 1 9 18l-4 1.5Z" /><path {...common} d="M9 11h6m-6 3h3.5" /></> : null}
      {name === "arrow" ? <><path {...common} d="M5 12h13m-5-5 5 5-5 5" /></> : null}
      {name === "book" ? <><path {...common} d="M5 5.5h6a3 3 0 0 1 3 3v10H8a3 3 0 0 0-3 3v-16Z" /><path {...common} d="M14 8.5a3 3 0 0 1 3-3h2v13h-2a3 3 0 0 0-3 3" /></> : null}
      {name === "expand" ? <><path {...common} d="M8.5 4.5h-4v4m11-4h4v4m-15 7v4h4m11-4v4h-4" /><path {...common} d="m4.8 8.2 4-4m6.4 0 4 4m-14.4 7.6 4 4m6.4 0 4-4" /></> : null}
      {name === "collapse" ? <><path {...common} d="M8.5 8.5h-4m0 0v-4m11 4h4m0 0v-4m-11 11h-4m0 0v4m11-4h4m0 0v4" /><path {...common} d="m4.8 8.2 4-4m6.4 0 4 4m-14.4 7.6 4 4m6.4 0 4-4" /></> : null}
    </svg>
  );
}

function formatAssistantTime(value) {
  if (!value) return "Flexible";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Flexible";
  return new Intl.DateTimeFormat("en-SG", { hour: "numeric", minute: "2-digit" }).format(date);
}

function ScheduleEditor({ form, setForm, buildings, schedule, buildingByCode, onSubmit, onDelete }) {
  return (
    <View style={styles.twoColumnPanel}>
      <View style={styles.card}>
        <Text style={styles.sectionCardTitle}>Add Schedule Item</Text>
        <View style={styles.form}>
          <FormInput placeholder="Title" value={form.title} onChangeText={(title) => setForm((current) => ({ ...current, title }))} />
          <FormInput placeholder="Module code" value={form.moduleCode} onChangeText={(moduleCode) => setForm((current) => ({ ...current, moduleCode }))} />
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
          <FormInput placeholder="Start 2026-05-22T13:00" value={form.startAt} onChangeText={(startAt) => setForm((current) => ({ ...current, startAt }))} />
          <FormInput placeholder="End 2026-05-22T14:30" value={form.endAt} onChangeText={(endAt) => setForm((current) => ({ ...current, endAt }))} />
          <FormInput multiline placeholder="Notes" value={form.notes} onChangeText={(notes) => setForm((current) => ({ ...current, notes }))} style={styles.notesInput} />
          <Pressable onPress={onSubmit} style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>Save schedule</Text>
          </Pressable>
        </View>
      </View>
      <View style={styles.card}>
        <Text style={styles.sectionCardTitle}>Today</Text>
        {schedule.map((item) => (
          <View key={item.id} style={styles.scheduleRow}>
            <View style={styles.eventCopy}>
              <Text style={styles.eventTitle}>{item.moduleCode} {item.title}</Text>
              <Text style={styles.smallMeta}>{`${buildingByCode[item.location]?.name || item.location} | ${timeRange(item)}`}</Text>
            </View>
            <Pressable onPress={() => onDelete(item.id)} style={styles.deleteMini}>
              <Text style={styles.deleteMiniText}>x</Text>
            </Pressable>
          </View>
        ))}
      </View>
    </View>
  );
}

function FacilitiesPanel({ buildings, facilities, filters, setFilters }) {
  return (
    <View style={styles.card}>
      <Text style={styles.sectionCardTitle}>Campus Facilities</Text>
      <View style={styles.chipRow}>
        <FilterChip label="All buildings" selected={!filters.building} onPress={() => setFilters((current) => ({ ...current, building: "" }))} />
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
      {facilities.map((facility) => (
        <View key={facility.id} style={styles.scheduleRow}>
          <View style={styles.eventCopy}>
            <Text style={styles.eventTitle}>{facility.name}</Text>
            <Text style={styles.smallMeta}>{facility.description}</Text>
          </View>
          <Text style={styles.distanceText}>{`${facility.buildingCode} L${facility.floor}`}</Text>
        </View>
      ))}
    </View>
  );
}

function SettingsPanel({ health, loading, syncStatus, buildings, indoorReadyCount, facilities }) {
  return (
    <View style={styles.card}>
      <Text style={styles.sectionCardTitle}>System Settings</Text>
      <InfoRow label="API" value={health ? "online" : loading ? "checking" : "offline"} />
      <InfoRow label="NUSMods sync" value={syncStatus?.status || "never_run"} />
      <InfoRow label="Records seen" value={syncStatus?.recordsSeen ?? 0} />
      <InfoRow label="Buildings" value={buildings.length} />
      <InfoRow label="Indoor ready" value={indoorReadyCount} />
      <InfoRow label="Facility matches" value={facilities.length} />
      {syncStatus?.errorMessage ? <Text style={styles.errorText}>{syncStatus.errorMessage}</Text> : null}
    </View>
  );
}

function SearchResults({ query, buildings, facilities, schedule, recommendations, onOpenSection }) {
  const normalized = query.trim().toLowerCase();
  const buildingMatches = buildings.filter((item) =>
    [item.code, item.name, item.description].some((value) => String(value || "").toLowerCase().includes(normalized)),
  );
  const facilityMatches = facilities.filter((item) =>
    [item.name, item.description, item.buildingCode, item.type].some((value) => String(value || "").toLowerCase().includes(normalized)),
  );
  const scheduleMatches = schedule.filter((item) =>
    [item.title, item.moduleCode, item.location, item.notes].some((value) => String(value || "").toLowerCase().includes(normalized)),
  );
  const recommendationMatches = recommendations.filter((item) =>
    [item.title, item.description, item.location, item.kind].some((value) => String(value || "").toLowerCase().includes(normalized)),
  );
  const total = buildingMatches.length + facilityMatches.length + scheduleMatches.length + recommendationMatches.length;

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.sectionCardTitle}>Search results</Text>
        <Text style={styles.pillMuted}>{`${total} matches`}</Text>
      </View>
      {total === 0 ? <Text style={styles.bodyText}>No campus matches found.</Text> : null}
      {buildingMatches.slice(0, 3).map((item) => (
        <ResultRow
          key={`building-${item.code}`}
          label="Building"
          title={`${item.code} · ${item.name}`}
          detail={item.description}
          onPress={() => onOpenSection("map")}
        />
      ))}
      {facilityMatches.slice(0, 3).map((item) => (
        <ResultRow
          key={`facility-${item.id}`}
          label="Facility"
          title={item.name}
          detail={`${item.buildingCode} L${item.floor} · ${item.description}`}
          onPress={() => onOpenSection("facilities")}
        />
      ))}
      {scheduleMatches.slice(0, 3).map((item) => (
        <ResultRow
          key={`schedule-${item.id}`}
          label="Schedule"
          title={item.title}
          detail={`${item.moduleCode || "TASK"} · ${timeRange(item)}`}
          onPress={() => onOpenSection("schedule")}
        />
      ))}
      {recommendationMatches.slice(0, 3).map((item) => (
        <ResultRow
          key={`rec-${item.kind}-${item.title}`}
          label="Assistant"
          title={item.title}
          detail={item.description}
          onPress={() => onOpenSection("recommendations")}
        />
      ))}
    </View>
  );
}

function ResultRow({ label, title, detail, onPress }) {
  return (
    <Pressable onPress={onPress} style={styles.resultRow}>
      <Text style={styles.resultLabel}>{label}</Text>
      <View style={styles.eventCopy}>
        <Text style={styles.eventTitle}>{title}</Text>
        <Text style={styles.smallMeta}>{detail}</Text>
      </View>
    </Pressable>
  );
}

function TasksPanel({ schedule, onDelete, onOpenSchedule }) {
  return (
    <View style={styles.twoColumnPanel}>
      <TasksCard schedule={schedule} onDelete={onDelete} style={styles.bottomPanelWide} />
      <View style={styles.card}>
        <Text style={styles.sectionCardTitle}>Task controls</Text>
        <Text style={styles.bodyText}>Tasks are generated from your schedule and assistant suggestions. Add a new item from Schedule.</Text>
        <Pressable onPress={onOpenSchedule} style={styles.primaryButton}>
          <Text style={styles.primaryButtonText}>Add schedule item</Text>
        </Pressable>
      </View>
    </View>
  );
}

function InboxPanel({ health, syncStatus, schedule, recommendations, onOpenAssistant }) {
  const messages = [
    {
      title: health ? "API connection is healthy" : "API needs attention",
      detail: health ? "Campus data is available." : "Some live data may be unavailable.",
    },
    {
      title: `NUSMods sync: ${syncStatus?.status || "not run"}`,
      detail: `${syncStatus?.recordsSeen ?? 0} records seen in the latest sync.`,
    },
    {
      title: `${schedule.length} schedule items loaded`,
      detail: schedule[0] ? `Next: ${schedule[0].title}` : "Create your first schedule item.",
    },
    {
      title: `${recommendations.length} assistant suggestions`,
      detail: recommendations[0]?.title || "Ask Daily Assistant for a fresh plan.",
    },
  ];

  return (
    <View style={styles.card}>
      <Text style={styles.sectionCardTitle}>Inbox</Text>
      {messages.map((message) => (
        <View key={message.title} style={styles.scheduleRow}>
          <View style={styles.statusDotOnline} />
          <View style={styles.eventCopy}>
            <Text style={styles.eventTitle}>{message.title}</Text>
            <Text style={styles.smallMeta}>{message.detail}</Text>
          </View>
        </View>
      ))}
      <Pressable onPress={onOpenAssistant} style={styles.primaryButton}>
        <Text style={styles.primaryButtonText}>Ask Daily Assistant</Text>
      </Pressable>
    </View>
  );
}

function ResourcesPanel({ buildings, facilities, recommendations, onOpenMap }) {
  return (
    <View style={styles.twoColumnPanel}>
      <View style={styles.card}>
        <Text style={styles.sectionCardTitle}>Campus resources</Text>
        <InfoRow label="Buildings indexed" value={buildings.length} />
        <InfoRow label="Facilities available" value={facilities.length} />
        <InfoRow label="Study spaces" value={facilities.filter((item) => item.type === "study_space").length} />
        <InfoRow label="Route suggestions" value={recommendations.length} />
        <Pressable onPress={onOpenMap} style={styles.primaryButton}>
          <Text style={styles.primaryButtonText}>Open campus map</Text>
        </Pressable>
      </View>
      <View style={styles.card}>
        <Text style={styles.sectionCardTitle}>Quick facility list</Text>
        {facilities.slice(0, 5).map((facility) => (
          <View key={facility.id} style={styles.scheduleRow}>
            <View style={styles.eventCopy}>
              <Text style={styles.eventTitle}>{facility.name}</Text>
              <Text style={styles.smallMeta}>{`${facility.buildingCode} L${facility.floor} · ${facility.crowdLevel}`}</Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

function ClubsPanel({ schedule, onOpenSchedule }) {
  const clubEvents = [
    { title: "Computing Club Booth", time: "Today 5:30 PM", location: "COM1 Lobby" },
    { title: "Orbital Project Sharing", time: "Tomorrow 3:00 PM", location: "Central Library" },
    { title: "NUS Hackers Friday Hacks", time: "Friday 7:00 PM", location: "UTown" },
  ];

  return (
    <View style={styles.twoColumnPanel}>
      <View style={styles.card}>
        <Text style={styles.sectionCardTitle}>Clubs & Events</Text>
        {clubEvents.map((event) => (
          <View key={event.title} style={styles.scheduleRow}>
            <View style={styles.eventCopy}>
              <Text style={styles.eventTitle}>{event.title}</Text>
              <Text style={styles.smallMeta}>{`${event.time} · ${event.location}`}</Text>
            </View>
          </View>
        ))}
      </View>
      <View style={styles.card}>
        <Text style={styles.sectionCardTitle}>Schedule context</Text>
        <Text style={styles.bodyText}>{`You currently have ${schedule.length} plan items. Add event plans in Schedule so Artemis can include them in recommendations.`}</Text>
        <Pressable onPress={onOpenSchedule} style={styles.primaryButton}>
          <Text style={styles.primaryButtonText}>Plan an event</Text>
        </Pressable>
      </View>
    </View>
  );
}

function SectionHeader({ title, subtitle, action, onAction }) {
  return (
    <View style={styles.sectionHeader}>
      <View>
        <Text style={styles.pageKicker}>Artemis</Text>
        <Text style={styles.pageTitle}>{title}</Text>
        <Text style={styles.pageSubtitle}>{subtitle}</Text>
      </View>
      {action ? (
        <Pressable onPress={onAction} style={styles.primaryButton}>
          <Text style={styles.primaryButtonText}>{action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function InfoRow({ label, value }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.bodyText}>{label}</Text>
      <Text style={styles.eventTitle}>{value}</Text>
    </View>
  );
}

function CampusLineArt({ dark = false }) {
  return (
    <View style={[styles.lineArt, dark && styles.lineArtDark]}>
      <View style={[styles.blockTower, dark && styles.blockDark]} />
      <View style={[styles.blockLow, dark && styles.blockDark]} />
      <View style={[styles.blockWide, dark && styles.blockDark]} />
      <View style={[styles.routeLine, dark && styles.routeLineDark]} />
      <View style={[styles.pin, dark && styles.pinDark]}>
        <View style={styles.pinInner} />
      </View>
    </View>
  );
}

function SquareButton({ label, dark, onPress }) {
  return (
    <Pressable onPress={onPress} style={[styles.squareButton, dark && styles.squareButtonDark]}>
      <Text style={[styles.squareButtonText, dark && styles.squareButtonTextDark]}>{label}</Text>
    </Pressable>
  );
}

function FilterChip({ label, selected, onPress }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={[styles.chip, selected && styles.chipSelected]}>
      <Text style={[styles.chipLabel, selected && styles.chipLabelSelected]}>{label}</Text>
    </Pressable>
  );
}

function FormInput({ style, ...props }) {
  return <TextInput placeholderTextColor="#8a8580" style={[styles.formInput, style]} {...props} />;
}

function formatClock(value) {
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function timeRange(item) {
  return `${formatClock(item.startAt)} - ${formatClock(item.endAt)}`;
}

function buildDashboardTasks(schedule) {
  if (schedule.length >= 3) return schedule.slice(0, 3);

  const seed = schedule[0];
  const items = seed
    ? [
        { ...seed, title: seed.title || "Project meeting" },
        {
          id: "synthetic-review-cs2106",
          title: "Review lecture slides",
          moduleCode: "CS2106",
          location: "CLB",
          synthetic: true,
        },
        {
          id: "synthetic-gym",
          title: "Gym session",
          moduleCode: "USC",
          location: "U Sports Complex",
          synthetic: true,
        },
      ]
    : [
        { id: "synthetic-cs2103", title: "Project Meeting", moduleCode: "CS2103", location: "COM1", synthetic: true },
        { id: "synthetic-review-cs2106", title: "Review lecture slides", moduleCode: "CS2106", location: "CLB", synthetic: true },
        { id: "synthetic-gym", title: "Gym session", moduleCode: "USC", location: "U Sports Complex", synthetic: true },
      ];

  return dedupeByTitle(items).slice(0, 3);
}

function buildWeekEvents(schedule) {
  if (schedule.length >= 2) return schedule.slice(0, 2);

  const first = schedule[0] || {
    id: "synthetic-week-cs2103",
    moduleCode: "CS2103",
    title: "Project Meeting",
    location: "COM1",
    startAt: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
    endAt: new Date(Date.now() + 3.5 * 60 * 60 * 1000).toISOString(),
    synthetic: true,
  };

  return [
    first,
    {
      id: "synthetic-week-ma1521",
      moduleCode: "MA1521",
      title: "Tutorial",
      location: "AS5-0211",
      startAt: new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString(),
      endAt: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(),
      synthetic: true,
    },
  ];
}

function dedupeByTitle(items) {
  const seen = new Set();
  return items.filter((item) => {
    const key = `${item.moduleCode || ""}-${item.title || ""}`.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
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

function sampleTasks() {
  return ["CS2103 Project Meeting at 1:00 PM", "Review lecture slides for CS2106", "Gym session at U Sports Complex"];
}

function sampleRecommendations() {
  return [
    { kind: "study", title: "Best study spots nearby", description: "Central Library, UTown", distanceM: 240 },
    { kind: "route", title: "Walk to COM1 in 8 min", description: "via Kent Ridge Path", distanceM: 180 },
    { kind: "task", title: "2 tasks due this week", description: "CS2106, MA1521", distanceM: 0 },
  ];
}

function sectionTitle(section) {
  return navItems.find((item) => item.key === section)?.label || "Dashboard";
}

function sectionSubtitle(section) {
  const subtitles = {
    recommendations: "Plan the day with your campus assistant.",
    schedule: "Create and review classes, meetings, and focus blocks.",
    facilities: "Filter campus support spaces by building and type.",
    sync: "Check service health and NUSMods sync status.",
    inbox: "Campus notices and assistant follow-ups.",
    tasks: "Academic actions and reminders.",
    resources: "Saved locations, guides, and study materials.",
    clubs: "Events around NUS this week.",
  };
  return subtitles[section] || "Campus life at a glance.";
}

function settingsLabel(options, value) {
  return options.find((option) => option.value === value)?.label || options[0]?.label || "";
}

const webSecondaryButtonStyle = {
  minHeight: 38,
  padding: "0 14px",
  border: "1px solid rgba(18, 63, 56, 0.14)",
  borderRadius: 10,
  color: "#40504a",
  background: "rgba(255, 255, 255, 0.46)",
  font: "inherit",
  fontSize: 13,
  fontWeight: 900,
  cursor: "pointer",
};

const webSaveProfileButtonStyle = {
  minHeight: 38,
  padding: "0 16px",
  border: 0,
  borderRadius: 10,
  color: "#fff8e2",
  background: "#123f38",
  font: "inherit",
  fontSize: 13,
  fontWeight: 900,
  cursor: "pointer",
};

const styles = StyleSheet.create({
  shell: {
    flexDirection: "row",
    height: "100vh",
    minHeight: 720,
    overflow: "hidden",
    backgroundColor: "#efe6d7",
    backgroundImage:
      "radial-gradient(circle at 18% 12%, rgba(239, 105, 68, 0.12), transparent 24%), radial-gradient(circle at 84% 18%, rgba(30, 91, 87, 0.16), transparent 28%), linear-gradient(135deg, #f4eadc 0%, #dde5d8 46%, #d8ceb8 100%)",
  },
  shellCompact: {
    flexDirection: "column",
    overflow: "auto",
  },
  shellThemeSunrise: {
    backgroundColor: "#f4e0cf",
    backgroundImage:
      "radial-gradient(circle at 18% 12%, rgba(222, 105, 68, 0.18), transparent 24%), radial-gradient(circle at 84% 18%, rgba(219, 138, 86, 0.18), transparent 28%), linear-gradient(135deg, #f7e2cc 0%, #ead8c1 48%, #dbe4d5 100%)",
  },
  shellThemeNight: {
    backgroundColor: "#111b22",
    backgroundImage:
      "radial-gradient(circle at 18% 12%, rgba(71, 118, 184, 0.2), transparent 24%), radial-gradient(circle at 84% 18%, rgba(151, 223, 198, 0.12), transparent 28%), linear-gradient(135deg, #101920 0%, #182830 48%, #1d352f 100%)",
  },
  shellDensityCompact: {
    minHeight: 640,
  },
  sidebar: {
    zIndex: 10,
    width: 248,
    flexShrink: 0,
    gap: 14,
    paddingHorizontal: 18,
    paddingVertical: 28,
    backgroundColor: "#123a3b",
    backgroundImage:
      "radial-gradient(circle at 24% 9%, rgba(217, 155, 104, 0.22), transparent 28%), radial-gradient(circle at 88% 34%, rgba(120, 208, 177, 0.14), transparent 30%), linear-gradient(155deg, #123b3d 0%, #1f4b43 54%, #423d33 100%)",
    boxShadow: "inset -1px 0 0 rgba(255, 243, 208, 0.1)",
  },
  sidebarCompact: {
    width: "100%",
    minHeight: "100vh",
  },
  brand: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginBottom: 18,
  },
  logoMark: {
    width: 54,
    height: 54,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 243, 208, 0.34)",
    borderRadius: 18,
    overflow: "hidden",
    backgroundColor: "rgba(255, 252, 243, 0.88)",
    boxShadow: "0 16px 34px rgba(5, 18, 18, 0.22)",
  },
  logoImage: {
    width: "100%",
    height: "100%",
  },
  brandName: {
    color: "#fff3d0",
    fontFamily: "Georgia, 'Times New Roman', serif",
    fontSize: 27,
    lineHeight: 31,
    fontWeight: "900",
    letterSpacing: 0.2,
    textShadow: "0 5px 18px rgba(5, 18, 18, 0.3)",
  },
  brandSub: {
    color: "rgba(255, 243, 208, 0.66)",
    marginTop: 1,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.7,
    textTransform: "uppercase",
  },
  navList: {
    gap: 4,
  },
  navItem: {
    minHeight: 46,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "transparent",
    transitionProperty: "background-color, border-color, transform",
    transitionDuration: "180ms",
  },
  navItemActive: {
    borderColor: "rgba(240, 201, 134, 0.36)",
    backgroundColor: "rgba(255, 248, 226, 0.11)",
    boxShadow: "inset 3px 0 0 rgba(240, 201, 134, 0.72), 0 12px 28px rgba(5, 18, 18, 0.12)",
  },
  navIcon: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    backgroundColor: "rgba(255, 248, 226, 0.045)",
  },
  navIconActive: {
    backgroundColor: "rgba(240, 201, 134, 0.12)",
  },
  navLabel: {
    color: "rgba(255, 248, 226, 0.74)",
    fontSize: 14,
    fontWeight: "700",
  },
  navLabelActive: {
    color: "#fff8e2",
    fontWeight: "900",
  },
  profileDock: {
    position: "relative",
    marginTop: "auto",
    gap: 7,
    zIndex: 4,
  },
  profileCard: {
    zIndex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: "rgba(255, 243, 208, 0.13)",
    borderRadius: 16,
    backgroundColor: "rgba(255, 248, 226, 0.075)",
    boxShadow: "0 14px 34px rgba(5, 18, 18, 0.12)",
  },
  profileCardActive: {
    borderColor: "rgba(240, 201, 134, 0.48)",
    backgroundColor: "rgba(255, 248, 226, 0.13)",
  },
  avatar: {
    width: 46,
    height: 46,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 23,
    backgroundColor: "#f0c986",
    overflow: "hidden",
  },
  avatarImage: {
    width: "100%",
    height: "100%",
  },
  avatarText: {
    color: "#123a3b",
    fontWeight: "900",
  },
  profileCopy: {
    flex: 1,
    minWidth: 0,
  },
  profileName: {
    color: "#fff8e2",
    fontSize: 15,
    fontWeight: "800",
  },
  profileMeta: {
    color: "rgba(255, 248, 226, 0.66)",
    marginTop: 2,
  },
  profileChevron: {
    color: "#fff8e2",
    fontWeight: "900",
  },
  profileHint: {
    paddingHorizontal: 4,
    color: "rgba(255, 248, 226, 0.52)",
    fontSize: 11,
    fontWeight: "700",
  },
  profilePopover: {
    position: "absolute",
    zIndex: 8,
    left: 0,
    bottom: 88,
    width: 326,
    maxHeight: "78vh",
    gap: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(240, 201, 134, 0.34)",
    borderRadius: 18,
    backgroundColor: "#fff8e8",
    boxShadow: "0 22px 56px rgba(5, 18, 18, 0.28)",
  },
  profilePopoverCompact: {
    position: "relative",
    bottom: "auto",
    width: "100%",
  },
  popoverHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  popoverKicker: {
    color: "#c97654",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0.7,
    textTransform: "uppercase",
  },
  popoverTitle: {
    marginTop: 4,
    color: "#123f38",
    fontSize: 18,
    fontWeight: "900",
  },
  iconTextButton: {
    width: 30,
    height: 30,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(18, 63, 56, 0.12)",
    backgroundColor: "rgba(255, 255, 255, 0.52)",
  },
  iconTextButtonText: {
    color: "#123f38",
    fontSize: 16,
    fontWeight: "900",
  },
  preferenceForm: {
    gap: 12,
    paddingBottom: 2,
  },
  preferenceScroll: {
    maxHeight: "68vh",
  },
  preferenceInput: {
    minHeight: 42,
    backgroundColor: "rgba(255, 255, 255, 0.66)",
  },
  preferenceGroup: {
    gap: 7,
  },
  preferenceLabel: {
    color: "#40504a",
    fontSize: 12,
    fontWeight: "900",
  },
  preferenceHelp: {
    color: "#6d7280",
    fontSize: 12,
  },
  preferenceSuccess: {
    color: "#2e7058",
    fontSize: 12,
    fontWeight: "900",
  },
  avatarPreviewRow: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: "rgba(18, 63, 56, 0.09)",
    borderRadius: 12,
    backgroundColor: "rgba(255, 255, 255, 0.44)",
  },
  avatarPreview: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    borderRadius: 24,
    backgroundColor: "#f0c986",
  },
  passwordPanel: {
    gap: 9,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(18, 63, 56, 0.1)",
    borderRadius: 12,
    backgroundColor: "rgba(255, 255, 255, 0.42)",
  },
  preferenceChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7,
  },
  preferenceInline: {
    minHeight: 42,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  timeInput: {
    width: 92,
    minHeight: 38,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "rgba(18, 63, 56, 0.12)",
    borderRadius: 10,
    color: "#123f38",
    backgroundColor: "rgba(255, 255, 255, 0.66)",
    outlineStyle: "none",
  },
  preferenceToggle: {
    minHeight: 38,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  toggleTrack: {
    width: 46,
    height: 26,
    justifyContent: "center",
    padding: 3,
    borderRadius: 13,
    backgroundColor: "rgba(18, 63, 56, 0.18)",
  },
  toggleTrackOn: {
    backgroundColor: "#2e7058",
  },
  toggleKnob: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#fff8e8",
    boxShadow: "0 4px 10px rgba(5, 18, 18, 0.18)",
  },
  toggleKnobOn: {
    marginLeft: 20,
  },
  popoverActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 9,
    paddingTop: 4,
  },
  secondaryButton: {
    minHeight: 38,
    justifyContent: "center",
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: "rgba(18, 63, 56, 0.14)",
    borderRadius: 10,
    backgroundColor: "rgba(255, 255, 255, 0.46)",
  },
  secondaryButtonText: {
    color: "#40504a",
    fontSize: 13,
    fontWeight: "900",
  },
  saveProfileButton: {
    minHeight: 38,
    justifyContent: "center",
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: "#123f38",
  },
  saveProfileButtonText: {
    color: "#fff8e2",
    fontSize: 13,
    fontWeight: "900",
  },
  statusCard: {
    gap: 12,
    minHeight: 132,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(255, 243, 208, 0.13)",
    borderRadius: 18,
    backgroundColor: "rgba(255, 248, 226, 0.07)",
    boxShadow: "0 14px 34px rgba(5, 18, 18, 0.12)",
  },
  statusTitle: {
    color: "#fff8e2",
    fontSize: 17,
    fontWeight: "800",
  },
  statusLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  statusDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: "#a94747",
  },
  statusDotOnline: {
    backgroundColor: "#7bd69e",
  },
  statusText: {
    color: "#fff8e2",
    fontSize: 13,
    fontWeight: "700",
  },
  statusSketch: {
    flex: 1,
    minHeight: 84,
    justifyContent: "flex-end",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 243, 208, 0.16)",
  },
  sketchBuildingTall: {
    position: "absolute",
    left: 76,
    bottom: 0,
    width: 42,
    height: 78,
    borderWidth: 1,
    borderColor: "rgba(240, 201, 134, 0.52)",
  },
  sketchBuilding: {
    position: "absolute",
    left: 28,
    bottom: 0,
    width: 62,
    height: 52,
    borderWidth: 1,
    borderColor: "rgba(240, 201, 134, 0.34)",
  },
  sketchRoad: {
    height: 1,
    marginLeft: 16,
    marginRight: 28,
    backgroundColor: "rgba(240, 201, 134, 0.36)",
    transform: [{ rotate: "-12deg" }],
  },
  statusSmall: {
    color: "rgba(255, 248, 226, 0.58)",
    fontSize: 12,
  },
  main: {
    zIndex: 0,
    flex: 1,
    minWidth: 0,
    minHeight: 0,
    overflow: "hidden",
    backgroundColor: "rgba(255, 249, 236, 0.72)",
    backgroundImage:
      "repeating-linear-gradient(0deg, rgba(32, 25, 18, 0.035) 0 1px, transparent 1px 4px), radial-gradient(circle at 86% 14%, rgba(18, 78, 69, 0.08), transparent 28%), radial-gradient(circle at 20% 86%, rgba(217, 155, 104, 0.1), transparent 30%)",
  },
  mainThemeSunrise: {
    backgroundColor: "rgba(255, 246, 236, 0.78)",
    backgroundImage:
      "repeating-linear-gradient(0deg, rgba(78, 43, 28, 0.03) 0 1px, transparent 1px 4px), radial-gradient(circle at 86% 14%, rgba(219, 138, 86, 0.12), transparent 28%), radial-gradient(circle at 20% 86%, rgba(46, 112, 88, 0.08), transparent 30%)",
  },
  mainThemeNight: {
    backgroundColor: "rgba(16, 25, 32, 0.9)",
    backgroundImage:
      "repeating-linear-gradient(0deg, rgba(255, 255, 255, 0.035) 0 1px, transparent 1px 4px), radial-gradient(circle at 86% 14%, rgba(71, 118, 184, 0.12), transparent 28%), radial-gradient(circle at 20% 86%, rgba(120, 208, 177, 0.08), transparent 30%)",
  },
  sectionError: {
    flex: 1,
    alignItems: "flex-start",
    justifyContent: "center",
    gap: 12,
    padding: 34,
  },
  sectionErrorKicker: {
    color: "#c97654",
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  sectionErrorTitle: {
    color: "#123f38",
    fontSize: 28,
    lineHeight: 34,
    fontWeight: "900",
  },
  sectionErrorText: {
    maxWidth: 620,
    color: "#686f78",
    fontSize: 14,
    lineHeight: 21,
  },
  sectionErrorActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 4,
  },
  scroll: {
    flex: 1,
  },
  dashboardBody: {
    gap: 28,
    padding: 36,
    paddingBottom: 32,
  },
  dashboardBodyPhone: {
    padding: 18,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 20,
    marginBottom: 6,
  },
  topBarCompact: {
    flexWrap: "wrap",
  },
  greeting: {
    flex: 1,
    minWidth: 260,
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  sunGlyph: {
    color: "#cf9e4e",
    fontSize: 40,
    lineHeight: 42,
  },
  greetingTitle: {
    color: "#123f38",
    fontSize: 20,
    fontWeight: "700",
  },
  greetingText: {
    color: "#5f6c62",
    marginTop: 5,
    fontSize: 14,
  },
  searchBox: {
    width: 480,
    maxWidth: "100%",
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 18,
    borderWidth: 1,
    borderColor: "rgba(18, 63, 56, 0.12)",
    borderRadius: 16,
    backgroundColor: "rgba(255, 252, 243, 0.78)",
    boxShadow: "0 10px 26px rgba(35, 30, 23, 0.06)",
  },
  searchIcon: {
    color: "#40504a",
    fontWeight: "900",
  },
  searchInput: {
    flex: 1,
    minWidth: 0,
    color: "#123f38",
    outlineStyle: "none",
  },
  shortcut: {
    minWidth: 30,
    paddingVertical: 3,
    paddingHorizontal: 6,
    textAlign: "center",
    color: "#90897f",
    borderWidth: 1,
    borderColor: "rgba(18, 63, 56, 0.12)",
    borderRadius: 8,
    overflow: "hidden",
  },
  shortcutButton: {
    borderRadius: 8,
  },
  topActions: {
    flexDirection: "row",
    gap: 10,
  },
  squareButton: {
    minWidth: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(18, 63, 56, 0.12)",
    backgroundColor: "rgba(255, 252, 243, 0.72)",
    transitionProperty: "transform, box-shadow, background-color",
    transitionDuration: "180ms",
  },
  squareButtonDark: {
    borderColor: "rgba(201, 118, 84, 0.28)",
    backgroundColor: "rgba(217, 155, 104, 0.16)",
  },
  squareButtonText: {
    color: "#123f38",
    fontSize: 12,
    fontWeight: "600",
  },
  squareButtonTextDark: {
    color: "#123f38",
  },
  notice: {
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(201, 118, 84, 0.34)",
    borderRadius: 8,
    backgroundColor: "rgba(217, 155, 104, 0.14)",
  },
  noticeError: {
    borderColor: "rgba(169,71,71,0.28)",
    backgroundColor: "rgba(169,71,71,0.08)",
  },
  noticeText: {
    color: "#7b5438",
    fontWeight: "800",
  },
  noticeErrorText: {
    color: "#a94747",
  },
  dashboardTopGrid: {
    flexDirection: "row",
    gap: 28,
  },
  dashboardTopGridCompact: {
    flexDirection: "column",
  },
  primaryTopColumn: {
    flex: 2,
    minWidth: 0,
    gap: 24,
  },
  sideTopColumn: {
    flex: 1.35,
    minWidth: 320,
    gap: 24,
  },
  dashboardBottomGrid: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: 24,
  },
  dashboardBottomGridCompact: {
    flexDirection: "column",
  },
  bottomPanel: {
    flex: 1,
    minWidth: 260,
  },
  bottomPanelWide: {
    flex: 1.25,
    minWidth: 320,
  },
  heroCard: {
    minHeight: 300,
    flexDirection: "row",
    overflow: "hidden",
    padding: 32,
    borderRadius: 20,
    backgroundColor: "#123a3b",
    backgroundImage:
      "radial-gradient(circle at 18% 18%, rgba(217, 155, 104, 0.2), transparent 28%), radial-gradient(circle at 84% 24%, rgba(120, 208, 177, 0.13), transparent 32%), linear-gradient(145deg, #123b3d 0%, #1f4b43 54%, #423d33 100%)",
    boxShadow: "0 24px 60px rgba(18, 58, 59, 0.2)",
  },
  heroCopy: {
    flex: 1,
    zIndex: 2,
    gap: 18,
  },
  goldKicker: {
    color: "#f0c986",
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.8,
  },
  heroTitle: {
    color: "#fff8e2",
    fontSize: 32,
    lineHeight: 39,
    fontWeight: "700",
  },
  heroMeta: {
    color: "rgba(255, 248, 226, 0.78)",
    fontSize: 14,
    fontWeight: "500",
  },
  heroActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 14,
    marginTop: 8,
  },
  goldButton: {
    minHeight: 46,
    justifyContent: "center",
    paddingHorizontal: 24,
    borderRadius: 14,
    backgroundImage: "linear-gradient(135deg, #d99b68 0%, #c97654 100%)",
  },
  goldButtonText: {
    color: "#fff8e2",
    fontWeight: "900",
  },
  outlineDarkButton: {
    minHeight: 46,
    justifyContent: "center",
    paddingHorizontal: 24,
    borderWidth: 1,
    borderColor: "rgba(255, 248, 226, 0.34)",
    borderRadius: 14,
  },
  outlineDarkButtonText: {
    color: "#fff8e2",
    fontWeight: "800",
  },
  lineArt: {
    position: "absolute",
    right: 0,
    bottom: 0,
    width: "62%",
    height: "100%",
    opacity: 0.82,
  },
  lineArtDark: {
    opacity: 0.72,
  },
  blockTower: {
    position: "absolute",
    right: 144,
    top: 50,
    width: 78,
    height: 110,
    borderWidth: 1,
    borderColor: "rgba(18, 63, 56, 0.14)",
    backgroundColor: "rgba(217, 155, 104, 0.12)",
    transform: [{ rotate: "-18deg" }],
  },
  blockLow: {
    position: "absolute",
    right: 48,
    top: 82,
    width: 110,
    height: 76,
    borderWidth: 1,
    borderColor: "rgba(18, 63, 56, 0.12)",
    backgroundColor: "rgba(255,255,255,0.28)",
    transform: [{ rotate: "-18deg" }],
  },
  blockWide: {
    position: "absolute",
    right: 126,
    bottom: 36,
    width: 172,
    height: 64,
    borderWidth: 1,
    borderColor: "rgba(18, 63, 56, 0.12)",
    backgroundColor: "rgba(240, 201, 134, 0.18)",
    transform: [{ rotate: "-18deg" }],
  },
  blockDark: {
    borderColor: "rgba(230,193,132,0.26)",
    backgroundColor: "rgba(255,250,240,0.04)",
  },
  routeLine: {
    position: "absolute",
    right: 46,
    bottom: 70,
    width: 260,
    height: 3,
    backgroundColor: "rgba(240, 201, 134, 0.68)",
    transform: [{ rotate: "-18deg" }],
  },
  routeLineDark: {
    backgroundColor: "rgba(240, 201, 134, 0.62)",
  },
  pin: {
    position: "absolute",
    right: 210,
    bottom: 88,
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 17,
    backgroundColor: "#123f38",
  },
  pinDark: {
    backgroundColor: "#f0c986",
  },
  pinInner: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: "#ffffff",
  },
  card: {
    gap: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: "rgba(18, 63, 56, 0.1)",
    borderRadius: 20,
    backgroundColor: "rgba(255, 252, 243, 0.82)",
    backgroundImage:
      "linear-gradient(180deg, rgba(255,255,255,0.42), rgba(255,255,255,0.06)), repeating-linear-gradient(0deg, rgba(32, 25, 18, 0.018) 0 1px, transparent 1px 5px)",
    boxShadow: "0 18px 50px rgba(35, 30, 23, 0.08)",
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  headerInline: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  cardKicker: {
    color: "#123f38",
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.7,
  },
  pillMuted: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    overflow: "hidden",
    color: "#6d7280",
    backgroundColor: "rgba(18, 63, 56, 0.06)",
    fontSize: 12,
    fontWeight: "600",
  },
  moreText: {
    color: "#123f38",
    fontSize: 18,
    fontWeight: "900",
  },
  eventBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(18, 63, 56, 0.08)",
    borderRadius: 16,
    backgroundColor: "rgba(255, 255, 255, 0.42)",
  },
  resultRow: {
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(18, 63, 56, 0.08)",
    borderRadius: 14,
    backgroundColor: "rgba(255, 255, 255, 0.34)",
  },
  resultLabel: {
    minWidth: 74,
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: 999,
    overflow: "hidden",
    color: "#c97654",
    backgroundColor: "rgba(217, 155, 104, 0.12)",
    textAlign: "center",
    fontSize: 11,
    fontWeight: "900",
  },
  dateTile: {
    width: 64,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(18, 63, 56, 0.1)",
    borderRadius: 14,
    backgroundColor: "#fff8e8",
  },
  dateMonth: {
    paddingVertical: 8,
    textAlign: "center",
    color: "#fff8e2",
    backgroundColor: "#123f38",
    fontSize: 12,
    fontWeight: "600",
  },
  dateDay: {
    paddingVertical: 10,
    textAlign: "center",
    color: "#123f38",
    fontSize: 26,
    fontWeight: "700",
  },
  eventCopy: {
    flex: 1,
    minWidth: 0,
    gap: 5,
  },
  eventTitle: {
    color: "#123f38",
    fontSize: 15,
    fontWeight: "700",
  },
  smallMeta: {
    color: "#6d7280",
    fontSize: 12,
  },
  linkButton: {
    alignSelf: "flex-start",
  },
  linkText: {
    color: "#235f52",
    fontSize: 14,
    fontWeight: "800",
  },
  assistantCard: {
    gap: 16,
    padding: 22,
    borderWidth: 1,
    borderColor: "rgba(18, 63, 56, 0.08)",
    borderRadius: 20,
    backgroundColor: "rgba(255, 252, 243, 0.82)",
    backgroundImage:
      "linear-gradient(180deg, rgba(255,255,255,0.36), rgba(255,255,255,0.06)), repeating-linear-gradient(90deg, rgba(32, 25, 18, 0.016) 0 1px, transparent 1px 5px)",
    boxShadow: "0 12px 34px rgba(35, 30, 23, 0.05)",
  },
  assistantHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  assistantSpark: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 19,
    backgroundColor: "rgba(217, 155, 104, 0.16)",
  },
  assistantSparkText: {
    color: "#c97654",
    fontSize: 22,
    lineHeight: 28,
  },
  assistantTitle: {
    color: "#123f38",
    fontSize: 20,
    fontWeight: "700",
  },
  assistantSubtitle: {
    color: "#6d7280",
    marginTop: 4,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    minHeight: 32,
    justifyContent: "center",
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "rgba(18, 63, 56, 0.09)",
    borderRadius: 999,
    backgroundColor: "rgba(255, 255, 255, 0.42)",
  },
  chipSelected: {
    borderColor: "rgba(201, 118, 84, 0.36)",
    backgroundColor: "rgba(217, 155, 104, 0.15)",
  },
  chipLabel: {
    color: "#4f5663",
    fontSize: 12,
    fontWeight: "600",
  },
  chipLabelSelected: {
    color: "#123f38",
  },
  assistantContent: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 14,
  },
  assistantChat: {
    flex: 1.4,
    minWidth: 280,
    gap: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(18, 63, 56, 0.08)",
    borderRadius: 16,
    backgroundColor: "rgba(255, 255, 255, 0.38)",
  },
  assistantBubble: {
    gap: 9,
  },
  assistantBubbleText: {
    color: "#123f38",
    fontSize: 14,
    fontWeight: "700",
  },
  checkItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  checkBox: {
    width: 13,
    height: 13,
    borderWidth: 1,
    borderColor: "rgba(18, 63, 56, 0.24)",
    borderRadius: 4,
  },
  checkLine: {
    color: "#4f5663",
    fontSize: 13,
  },
  assistantHint: {
    color: "#88827a",
    marginTop: 4,
    fontSize: 13,
  },
  inputRow: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingLeft: 14,
    paddingRight: 8,
    borderWidth: 1,
    borderColor: "rgba(18, 63, 56, 0.1)",
    borderRadius: 14,
    backgroundColor: "#fff8e8",
  },
  askInput: {
    flex: 1,
    minWidth: 0,
    paddingRight: 10,
    color: "#123f38",
    outlineStyle: "none",
  },
  sendButton: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    backgroundColor: "#123f38",
  },
  sendButtonText: {
    color: "#fff8e2",
    fontWeight: "900",
  },
  disabled: {
    opacity: 0.58,
  },
  responseBox: {
    gap: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: "#d9d0c4",
    borderRadius: 8,
    backgroundColor: "#fff8e8",
  },
  responseText: {
    color: "#303844",
    fontSize: 13,
    lineHeight: 20,
    whiteSpace: "pre-wrap",
  },
  miniAddButton: {
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "#123f38",
  },
  miniAddText: {
    color: "#fff8e2",
    fontSize: 12,
    fontWeight: "900",
  },
  errorText: {
    color: "#a94747",
    fontSize: 13,
    fontWeight: "800",
  },
  suggestedBox: {
    flex: 0.9,
    minWidth: 230,
    gap: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(18, 63, 56, 0.07)",
    borderRadius: 16,
    backgroundColor: "rgba(255, 255, 255, 0.34)",
  },
  suggestedTitle: {
    color: "#123f38",
    fontWeight: "700",
  },
  suggestionItem: {
    flexDirection: "row",
    gap: 12,
  },
  suggestionIcon: {
    width: 18,
    color: "#c97654",
    fontWeight: "700",
  },
  suggestionCopy: {
    flex: 1,
    gap: 3,
  },
  suggestionTitle: {
    color: "#294b43",
    fontSize: 13,
    fontWeight: "600",
  },
  suggestionText: {
    color: "#77726c",
    fontSize: 12,
  },
  lowerGrid: {
    flexDirection: "row",
    gap: 20,
  },
  lowerGridPhone: {
    flexDirection: "column",
  },
  sectionCardTitle: {
    color: "#123f38",
    fontSize: 20,
    fontWeight: "700",
  },
  linkTiny: {
    color: "#6d6a65",
    fontSize: 11,
  },
  taskRow: {
    minHeight: 40,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(18, 63, 56, 0.08)",
  },
  checkbox: {
    width: 14,
    height: 14,
    borderWidth: 1,
    borderColor: "#7e858d",
    borderRadius: 4,
  },
  taskTitle: {
    flex: 1,
    color: "#294b43",
    fontSize: 13,
  },
  taskDue: {
    color: "#6d7280",
    fontSize: 11,
    fontWeight: "600",
  },
  deleteMini: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#d9d0c4",
    borderRadius: 8,
  },
  deleteMiniText: {
    color: "#a94747",
    fontWeight: "900",
  },
  weekDays: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 4,
  },
  dayCell: {
    flex: 1,
    minWidth: 30,
    height: 52,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
  },
  dayCellActive: {
    backgroundColor: "#123f38",
  },
  dayText: {
    color: "#6e737b",
    textAlign: "center",
    fontSize: 11,
    lineHeight: 17,
  },
  dayTextActive: {
    color: "#fff8e2",
    fontWeight: "700",
  },
  weekEvent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "rgba(18, 63, 56, 0.08)",
  },
  eventAccent: {
    width: 5,
    height: 42,
    borderRadius: 4,
    backgroundColor: "#d99b68",
  },
  mapCard: {
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(18, 63, 56, 0.08)",
    borderRadius: 20,
    backgroundColor: "rgba(255, 252, 243, 0.82)",
    boxShadow: "0 14px 40px rgba(35, 30, 23, 0.06)",
  },
  mapHeader: {
    zIndex: 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    padding: 18,
    paddingBottom: 0,
  },
  mapTitle: {
    color: "#123f38",
    fontSize: 18,
    fontWeight: "700",
  },
  darkMiniButton: {
    minHeight: 36,
    justifyContent: "center",
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: "rgba(201, 118, 84, 0.36)",
    borderRadius: 12,
    backgroundColor: "rgba(217, 155, 104, 0.13)",
  },
  darkMiniButtonText: {
    color: "#123f38",
    fontSize: 12,
    fontWeight: "700",
  },
  mapIllustration: {
    height: 184,
    overflow: "hidden",
    backgroundColor: "#efe6d7",
    backgroundImage:
      "radial-gradient(circle at 16% 18%, rgba(217, 155, 104, 0.14), transparent 28%), radial-gradient(circle at 82% 26%, rgba(18, 78, 69, 0.12), transparent 30%)",
  },
  mapRoadMain: {
    position: "absolute",
    left: "-8%",
    top: "45%",
    width: "118%",
    height: 22,
    borderRadius: 12,
    backgroundColor: "rgba(255,250,240,0.92)",
    transform: [{ rotate: "-14deg" }],
  },
  mapRoadNorth: {
    position: "absolute",
    left: "4%",
    top: "24%",
    width: "92%",
    height: 12,
    borderRadius: 8,
    backgroundColor: "rgba(255,250,240,0.72)",
    transform: [{ rotate: "10deg" }],
  },
  mapRoadSouth: {
    position: "absolute",
    left: "2%",
    bottom: "22%",
    width: "96%",
    height: 14,
    borderRadius: 8,
    backgroundColor: "rgba(255,250,240,0.76)",
    transform: [{ rotate: "-3deg" }],
  },
  mapRoute: {
    position: "absolute",
    left: "18%",
    top: "52%",
    width: "58%",
    height: 3,
    borderRadius: 2,
    backgroundColor: "#c97654",
    transform: [{ rotate: "-14deg" }],
  },
  campusBlock: {
    position: "absolute",
    borderWidth: 1,
    borderColor: "rgba(18, 63, 56, 0.12)",
    backgroundColor: "rgba(240, 201, 134, 0.22)",
  },
  campusBlockCom: {
    left: "20%",
    top: "28%",
    width: 92,
    height: 62,
    transform: [{ rotate: "-14deg" }],
  },
  campusBlockLibrary: {
    right: "14%",
    top: "18%",
    width: 112,
    height: 68,
    transform: [{ rotate: "-14deg" }],
  },
  campusBlockUtown: {
    right: "16%",
    bottom: "17%",
    width: 132,
    height: 54,
    transform: [{ rotate: "-14deg" }],
  },
  campusBlockFood: {
    left: "11%",
    bottom: "17%",
    width: 92,
    height: 48,
    transform: [{ rotate: "-14deg" }],
  },
  mapTransitHub: {
    position: "absolute",
    left: "48%",
    top: "42%",
    width: 64,
    height: 64,
    borderWidth: 9,
    borderColor: "rgba(18, 63, 56, 0.1)",
    borderRadius: 32,
  },
  mapPinMain: {
    position: "absolute",
    left: "49%",
    top: "43%",
    width: 52,
    height: 52,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 26,
    backgroundColor: "rgba(18, 63, 56, 0.1)",
  },
  mapPinDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: "#123f38",
  },
  smallMapPin: {
    position: "absolute",
    width: 13,
    height: 13,
    borderWidth: 3,
    borderColor: "#c97654",
    borderRadius: 7,
    backgroundColor: "#123f38",
  },
  smallMapPinLibrary: {
    right: "22%",
    top: "28%",
  },
  smallMapPinUtown: {
    right: "28%",
    bottom: "26%",
  },
  mapLabel: {
    position: "absolute",
    color: "#294b43",
    fontSize: 11,
    fontWeight: "600",
  },
  mapLabelCom: {
    left: "29%",
    top: "35%",
  },
  mapLabelLibrary: {
    right: "8%",
    top: "24%",
  },
  mapLabelUtown: {
    right: "20%",
    bottom: "17%",
  },
  mapLabelFood: {
    left: "10%",
    bottom: "24%",
  },
  mapMeta: {
    paddingHorizontal: 18,
    paddingBottom: 14,
    color: "#6d7280",
    fontSize: 12,
  },
  statsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  statTile: {
    flex: 1,
    minWidth: 112,
    gap: 4,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(18, 63, 56, 0.08)",
    borderRadius: 18,
    backgroundColor: "rgba(255, 252, 243, 0.72)",
  },
  statValue: {
    color: "#123f38",
    fontSize: 24,
    fontWeight: "700",
  },
  statLabel: {
    color: "#294b43",
    fontSize: 13,
    fontWeight: "600",
  },
  statSub: {
    color: "#686f78",
    fontSize: 12,
  },
  focusCard: {
    minHeight: 210,
    gap: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: "rgba(18, 63, 56, 0.08)",
    borderRadius: 20,
    backgroundColor: "rgba(255, 252, 243, 0.82)",
    backgroundImage: "linear-gradient(180deg, rgba(255,255,255,0.36), rgba(255,255,255,0.06))",
    boxShadow: "0 14px 40px rgba(35, 30, 23, 0.06)",
  },
  focusBody: {
    flexDirection: "column",
    alignItems: "flex-start",
    gap: 18,
  },
  timerRing: {
    width: 128,
    height: 128,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 4,
    borderColor: "#d99b68",
    borderRadius: 64,
    backgroundColor: "#fff8e8",
  },
  timerText: {
    color: "#123f38",
    fontSize: 28,
    fontWeight: "700",
  },
  timerStart: {
    marginTop: 8,
    paddingHorizontal: 15,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: "#d9d0c4",
    borderRadius: 8,
  },
  timerStartText: {
    color: "#123f38",
    fontSize: 12,
    fontWeight: "800",
  },
  focusCopy: {
    alignSelf: "stretch",
  },
  focusTitle: {
    color: "#123f38",
    fontSize: 17,
    fontWeight: "800",
  },
  focusText: {
    color: "#686f78",
    marginTop: 8,
  },
  mapStage: {
    flex: 1,
    minWidth: 0,
    minHeight: 0,
    overflow: "hidden",
  },
  sectionBody: {
    width: "100%",
    maxWidth: 1120,
    alignSelf: "center",
    gap: 20,
    padding: 34,
  },
  sectionBodyPhone: {
    padding: 18,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 16,
  },
  pageKicker: {
    color: "#c97654",
    fontSize: 12,
    fontWeight: "900",
  },
  pageTitle: {
    color: "#123f38",
    marginTop: 6,
    fontSize: 34,
    fontWeight: "800",
  },
  pageSubtitle: {
    color: "#686f78",
    marginTop: 8,
  },
  primaryButton: {
    minHeight: 42,
    alignSelf: "flex-start",
    justifyContent: "center",
    paddingHorizontal: 18,
    borderRadius: 8,
    backgroundImage: "linear-gradient(135deg, #d99b68 0%, #c97654 100%)",
  },
  primaryButtonText: {
    color: "#fff8e2",
    fontWeight: "900",
  },
  assistantWorkspace: {
    gap: 18,
  },
  assistantOverview: {
    position: "relative",
    overflow: "hidden",
    gap: 24,
    padding: 28,
    borderWidth: 1,
    borderColor: "rgba(240, 201, 134, 0.2)",
    borderRadius: 24,
    backgroundColor: "#123f38",
    backgroundImage:
      "radial-gradient(circle at 84% 14%, rgba(240, 201, 134, 0.22), transparent 28%), radial-gradient(circle at 14% 88%, rgba(120, 208, 177, 0.16), transparent 34%), linear-gradient(135deg, #123b3d 0%, #1c4a42 58%, #3c3b32 100%)",
    boxShadow: "0 22px 52px rgba(18, 58, 59, 0.18)",
  },
  assistantOverviewPhone: {
    padding: 20,
  },
  assistantOverviewGlow: {
    position: "absolute",
    right: -52,
    top: -64,
    width: 220,
    height: 220,
    borderWidth: 1,
    borderColor: "rgba(240, 201, 134, 0.14)",
    borderRadius: 110,
    boxShadow: "0 0 0 38px rgba(240, 201, 134, 0.035), 0 0 0 78px rgba(240, 201, 134, 0.025)",
  },
  assistantOverviewTop: {
    zIndex: 1,
    flexDirection: "row",
    alignItems: "flex-start",
    flexWrap: "wrap",
    gap: 18,
  },
  assistantOrb: {
    width: 54,
    height: 54,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 19,
    backgroundColor: "#f0c986",
    boxShadow: "0 12px 28px rgba(5, 18, 18, 0.22)",
  },
  assistantOverviewCopy: {
    flex: 1,
    minWidth: 260,
    gap: 7,
  },
  assistantOverviewEyebrow: {
    color: "#f0c986",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.1,
  },
  assistantOverviewTitle: {
    color: "#fff8e2",
    fontFamily: "Georgia, 'Times New Roman', serif",
    fontSize: 28,
    lineHeight: 35,
    fontWeight: "800",
  },
  assistantOverviewText: {
    maxWidth: 700,
    color: "rgba(255, 248, 226, 0.7)",
    fontSize: 14,
    lineHeight: 21,
  },
  assistantLivePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: "rgba(255, 248, 226, 0.16)",
    borderRadius: 999,
    backgroundColor: "rgba(255, 248, 226, 0.08)",
  },
  assistantLiveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "#7bd69e",
    boxShadow: "0 0 0 4px rgba(123, 214, 158, 0.11)",
  },
  assistantLiveText: {
    color: "#fff8e2",
    fontSize: 11,
    fontWeight: "800",
  },
  assistantOverviewStats: {
    zIndex: 1,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  assistantStat: {
    minWidth: 150,
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 13,
    borderWidth: 1,
    borderColor: "rgba(255, 248, 226, 0.11)",
    borderRadius: 15,
    backgroundColor: "rgba(255, 248, 226, 0.07)",
  },
  assistantStatIcon: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 11,
    backgroundColor: "rgba(240, 201, 134, 0.12)",
  },
  assistantStatValue: {
    color: "#fff8e2",
    fontSize: 17,
    fontWeight: "900",
  },
  assistantStatLabel: {
    marginTop: 2,
    color: "rgba(255, 248, 226, 0.56)",
    fontSize: 11,
    fontWeight: "700",
  },
  assistantModeBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 16,
    padding: 16,
    paddingLeft: 20,
    borderWidth: 1,
    borderColor: "rgba(18, 63, 56, 0.09)",
    borderRadius: 18,
    backgroundColor: "rgba(255, 252, 243, 0.72)",
    boxShadow: "0 10px 28px rgba(35, 30, 23, 0.05)",
  },
  assistantModeBarPhone: {
    alignItems: "flex-start",
    padding: 14,
  },
  assistantModeLabel: {
    color: "#c97654",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1,
  },
  assistantModeHint: {
    marginTop: 4,
    color: "#777f7a",
    fontSize: 12,
  },
  assistantModeChoices: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  assistantModeChoicesPhone: {
    width: "100%",
  },
  assistantModeChoice: {
    minHeight: 38,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingHorizontal: 13,
    borderWidth: 1,
    borderColor: "rgba(18, 63, 56, 0.1)",
    borderRadius: 12,
    backgroundColor: "rgba(255, 255, 255, 0.48)",
  },
  assistantModeChoiceActive: {
    borderColor: "#123f38",
    backgroundColor: "#123f38",
    boxShadow: "0 8px 18px rgba(18, 63, 56, 0.18)",
  },
  assistantModeChoiceText: {
    color: "#49645e",
    fontSize: 12,
    fontWeight: "800",
  },
  assistantModeChoiceTextActive: {
    color: "#fff8e2",
  },
  assistantMainGrid: {
    flexDirection: "row",
    alignItems: "flex-start",
    flexWrap: "wrap",
    gap: 18,
  },
  assistantMainGridCompact: {
    flexDirection: "column",
  },
  assistantMainGridExpanded: {
    flexDirection: "column",
  },
  assistantConversation: {
    flex: 1.85,
    minWidth: 420,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(18, 63, 56, 0.1)",
    borderRadius: 22,
    backgroundColor: "rgba(255, 252, 243, 0.9)",
    boxShadow: "0 18px 48px rgba(35, 30, 23, 0.08)",
  },
  assistantConversationPhone: {
    width: "100%",
    minWidth: 0,
  },
  assistantConversationExpanded: {
    width: "100%",
    minWidth: 0,
    flex: 1,
  },
  assistantConversationHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    padding: 18,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(18, 63, 56, 0.08)",
    backgroundColor: "rgba(255, 255, 255, 0.38)",
  },
  assistantConversationIdentity: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
  },
  assistantMiniOrb: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 13,
    backgroundColor: "#123f38",
  },
  assistantConversationTitle: {
    color: "#123f38",
    fontSize: 15,
    fontWeight: "900",
  },
  assistantConversationMeta: {
    marginTop: 2,
    color: "#818780",
    fontSize: 11,
  },
  assistantConversationActions: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    justifyContent: "flex-end",
    gap: 8,
  },
  assistantContextBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    overflow: "hidden",
    borderRadius: 999,
    color: "#2e7058",
    backgroundColor: "rgba(46, 112, 88, 0.09)",
    fontSize: 10,
    fontWeight: "900",
  },
  assistantExpandButton: {
    minHeight: 32,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: "rgba(18, 63, 56, 0.1)",
    borderRadius: 10,
    backgroundColor: "rgba(255, 255, 255, 0.58)",
  },
  assistantExpandButtonActive: {
    borderColor: "#123f38",
    backgroundColor: "#123f38",
  },
  assistantExpandText: {
    color: "#49645e",
    fontSize: 10,
    fontWeight: "900",
  },
  assistantExpandTextActive: {
    color: "#fff8e2",
  },
  assistantMessageScroll: {
    height: "46vh",
    minHeight: 380,
    maxHeight: 560,
    backgroundImage:
      "radial-gradient(circle at 96% 0%, rgba(217, 155, 104, 0.08), transparent 26%), repeating-linear-gradient(0deg, rgba(32, 25, 18, 0.015) 0 1px, transparent 1px 5px)",
  },
  assistantMessageScrollExpanded: {
    height: "62vh",
    minHeight: 500,
    maxHeight: 760,
  },
  assistantMessageArea: {
    flexGrow: 1,
    minHeight: "100%",
    gap: 14,
    padding: 20,
  },
  assistantBotRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 11,
  },
  assistantBotAvatar: {
    width: 32,
    height: 32,
    flexShrink: 0,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 11,
    backgroundColor: "rgba(217, 155, 104, 0.13)",
  },
  assistantBotBubble: {
    maxWidth: "84%",
    gap: 6,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(18, 63, 56, 0.07)",
    borderRadius: 4,
    borderTopRightRadius: 16,
    borderBottomRightRadius: 16,
    borderBottomLeftRadius: 16,
    backgroundColor: "rgba(255, 255, 255, 0.64)",
  },
  assistantBotGreeting: {
    color: "#123f38",
    fontSize: 14,
    fontWeight: "900",
  },
  assistantBotText: {
    color: "#65716c",
    fontSize: 13,
    lineHeight: 20,
  },
  assistantResponseCard: {
    alignSelf: "stretch",
    gap: 11,
    marginLeft: 43,
    padding: 15,
    borderWidth: 1,
    borderColor: "rgba(46, 112, 88, 0.16)",
    borderRadius: 16,
    backgroundColor: "rgba(232, 243, 236, 0.72)",
  },
  assistantResponseHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  assistantResponseLabel: {
    color: "#2e7058",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.9,
  },
  assistantResponseCopy: {
    color: "#294b43",
    fontSize: 13,
    lineHeight: 20,
    whiteSpace: "pre-wrap",
  },
  assistantPlanItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "rgba(46, 112, 88, 0.12)",
  },
  assistantPlanTime: {
    minWidth: 58,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: "rgba(46, 112, 88, 0.1)",
  },
  assistantPlanTimeText: {
    color: "#2e7058",
    textAlign: "center",
    fontSize: 10,
    fontWeight: "900",
  },
  assistantPlanCopy: {
    flex: 1,
    minWidth: 0,
  },
  assistantPlanTitle: {
    color: "#294b43",
    fontSize: 12,
    fontWeight: "900",
  },
  assistantPlanMeta: {
    marginTop: 2,
    color: "#77817d",
    fontSize: 10,
  },
  assistantAddButton: {
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 9,
    backgroundColor: "#123f38",
  },
  assistantAddButtonText: {
    color: "#fff8e2",
    fontSize: 10,
    fontWeight: "900",
  },
  assistantThinkingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginLeft: 43,
  },
  assistantThinkingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#d99b68",
  },
  assistantThinkingText: {
    marginLeft: 5,
    color: "#7a817d",
    fontSize: 11,
  },
  assistantComposerWrap: {
    gap: 10,
    padding: 18,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: "rgba(18, 63, 56, 0.08)",
  },
  assistantPromptLabel: {
    color: "#90958f",
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 0.9,
  },
  assistantQuickRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7,
  },
  assistantQuickPrompt: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: "rgba(18, 63, 56, 0.1)",
    borderRadius: 999,
    backgroundColor: "rgba(255, 255, 255, 0.55)",
  },
  assistantQuickPromptText: {
    color: "#58706a",
    fontSize: 10,
    fontWeight: "700",
  },
  assistantComposer: {
    minHeight: 54,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 8,
    paddingLeft: 13,
    borderWidth: 1,
    borderColor: "rgba(18, 63, 56, 0.14)",
    borderRadius: 16,
    backgroundColor: "#fffdf8",
    boxShadow: "0 10px 24px rgba(35, 30, 23, 0.06)",
  },
  assistantComposerIcon: {
    width: 24,
    alignItems: "center",
  },
  assistantComposerInput: {
    flex: 1,
    minWidth: 0,
    color: "#123f38",
    fontSize: 13,
    outlineStyle: "none",
  },
  assistantComposerSend: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 13,
    backgroundColor: "#123f38",
    boxShadow: "0 8px 18px rgba(18, 63, 56, 0.2)",
  },
  assistantComposerSendDisabled: {
    opacity: 0.38,
  },
  assistantComposerNote: {
    color: "#969a94",
    fontSize: 9,
    textAlign: "center",
  },
  assistantSideRail: {
    flex: 0.9,
    minWidth: 280,
    gap: 18,
  },
  assistantSideRailPhone: {
    width: "100%",
    minWidth: 0,
  },
  assistantSideRailHidden: {
    display: "none",
  },
  assistantRailCard: {
    gap: 14,
    padding: 18,
    borderWidth: 1,
    borderColor: "rgba(18, 63, 56, 0.09)",
    borderRadius: 20,
    backgroundColor: "rgba(255, 252, 243, 0.86)",
    boxShadow: "0 14px 38px rgba(35, 30, 23, 0.065)",
  },
  assistantRailHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  assistantRailEyebrow: {
    color: "#c97654",
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 0.9,
  },
  assistantRailTitle: {
    marginTop: 4,
    color: "#123f38",
    fontSize: 17,
    fontWeight: "900",
  },
  assistantRailCount: {
    width: 30,
    height: 30,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    backgroundColor: "rgba(217, 155, 104, 0.13)",
  },
  assistantRailCountText: {
    color: "#c97654",
    fontSize: 12,
    fontWeight: "900",
  },
  assistantTimelineItem: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: 11,
    minHeight: 65,
  },
  assistantTimelineTrack: {
    width: 16,
    alignItems: "center",
  },
  assistantTimelineDot: {
    width: 8,
    height: 8,
    marginTop: 4,
    borderWidth: 2,
    borderColor: "#b9c4bf",
    borderRadius: 4,
    backgroundColor: "#fffaf0",
  },
  assistantTimelineDotActive: {
    width: 10,
    height: 10,
    borderColor: "#c97654",
    borderRadius: 5,
    backgroundColor: "#d99b68",
    boxShadow: "0 0 0 4px rgba(217, 155, 104, 0.12)",
  },
  assistantTimelineLine: {
    flex: 1,
    width: 1,
    marginTop: 4,
    backgroundColor: "rgba(18, 63, 56, 0.12)",
  },
  assistantTimelineCopy: {
    flex: 1,
    minWidth: 0,
    paddingBottom: 11,
  },
  assistantTimelineTime: {
    color: "#c97654",
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 0.3,
  },
  assistantTimelineTitle: {
    marginTop: 3,
    color: "#294b43",
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "900",
  },
  assistantTimelineMeta: {
    marginTop: 3,
    color: "#888e89",
    fontSize: 10,
  },
  assistantInsightItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "rgba(18, 63, 56, 0.075)",
  },
  assistantInsightIcon: {
    width: 34,
    height: 34,
    flexShrink: 0,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 11,
    backgroundColor: "rgba(217, 155, 104, 0.12)",
  },
  assistantInsightIconGreen: {
    backgroundColor: "rgba(46, 112, 88, 0.1)",
  },
  assistantInsightCopy: {
    flex: 1,
    minWidth: 0,
  },
  assistantInsightTitle: {
    color: "#294b43",
    fontSize: 11,
    fontWeight: "900",
  },
  assistantInsightText: {
    marginTop: 3,
    color: "#888e89",
    fontSize: 10,
    lineHeight: 14,
  },
  assistantInsightDistance: {
    color: "#c97654",
    fontSize: 9,
    fontWeight: "900",
  },
  twoColumnPanel: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 20,
  },
  queueItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#e6ded5",
  },
  queueRank: {
    width: 34,
    height: 34,
    paddingTop: 8,
    textAlign: "center",
    color: "#123f38",
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: "#e6c184",
    fontWeight: "900",
  },
  distanceText: {
    color: "#c97654",
    fontWeight: "900",
  },
  form: {
    gap: 12,
  },
  formInput: {
    minHeight: 44,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "#d9d0c4",
    borderRadius: 8,
    color: "#123f38",
    backgroundColor: "#fff8e8",
    outlineStyle: "none",
  },
  notesInput: {
    minHeight: 82,
    textAlignVertical: "top",
  },
  scheduleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#e6ded5",
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#e6ded5",
  },
  bodyText: {
    color: "#686f78",
    lineHeight: 22,
  },
});
