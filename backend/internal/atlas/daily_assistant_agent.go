package atlas

import (
	"context"
	"encoding/json"
	"errors"
	"log"
	"net/url"
	"strings"
	"time"
)

const dailyAssistantSystemPrompt = "You are Atlas Day Hub inside a student productivity app. You are an action planner, not a generic chat bot. Help the user plan their day, summarize priorities, reflect on progress, and issue practical app commands. Be concise, specific, and action-oriented. Do not invent private user data. If context is missing, make reasonable general suggestions and state assumptions."

type DailyAssistantAgent struct {
	llm LLMClient
}

type DailyAssistantAgentRequest struct {
	Message string         `json:"message"`
	Context map[string]any `json:"context,omitempty"`
	Mode    string         `json:"mode,omitempty"`
}

type DailyAssistantAgentResponse struct {
	Success       bool                          `json:"success"`
	Reply         string                        `json:"reply"`
	ScheduleItems []DailyAssistantScheduleDraft `json:"scheduleItems,omitempty"`
	Actions       []DailyAssistantAction        `json:"actions,omitempty"`
	Provider      string                        `json:"provider,omitempty"`
	Model         string                        `json:"model,omitempty"`
	Error         string                        `json:"error,omitempty"`
}

type DailyAssistantScheduleDraft struct {
	Title      string `json:"title"`
	ModuleCode string `json:"moduleCode"`
	Location   string `json:"location"`
	StartAt    string `json:"startAt"`
	EndAt      string `json:"endAt"`
	Notes      string `json:"notes,omitempty"`
}

type DailyAssistantAction struct {
	Type    string         `json:"type"`
	Label   string         `json:"label,omitempty"`
	Payload map[string]any `json:"payload,omitempty"`
}

func NewDailyAssistantAgent(llm LLMClient) *DailyAssistantAgent {
	return &DailyAssistantAgent{llm: llm}
}

func (a *DailyAssistantAgent) Run(ctx context.Context, request DailyAssistantAgentRequest) DailyAssistantAgentResponse {
	mode := normalizeDailyAssistantMode(request.Mode)
	message := strings.TrimSpace(request.Message)
	provider, model := "", ""
	if a.llm != nil {
		provider = a.llm.Provider()
		model = a.llm.Model()
	}

	if message == "" {
		return DailyAssistantAgentResponse{
			Success: false,
			Reply:   fallbackDailyAssistantReply(mode),
			Error:   "message is required",
		}
	}
	if a.llm == nil || !a.llm.Configured() {
		log.Printf("daily assistant fallback provider=%s model=%s mode=%s message_chars=%d reason=missing_configuration", provider, model, mode, len(message))
		fallbackStart := time.Now().Add(24 * time.Hour)
		return DailyAssistantAgentResponse{
			Success:  false,
			Reply:    fallbackDailyAssistantReply(mode),
			Actions:  inferDailyAssistantActions(message, request.Context, fallbackStart),
			Provider: provider,
			Model:    model,
			Error:    "LLM provider is not configured",
		}
	}

	result, err := a.llm.Chat(ctx, buildDailyAssistantMessages(mode, message, request.Context), LLMChatOptions{
		Temperature: 0.7,
		MaxTokens:   1000,
	})
	if err != nil {
		log.Printf("daily assistant fallback provider=%s model=%s mode=%s message_chars=%d reason=%s", provider, model, mode, len(message), classifyLLMError(err))
		fallbackStart := time.Now().Add(24 * time.Hour)
		return DailyAssistantAgentResponse{
			Success:  false,
			Reply:    fallbackDailyAssistantReply(mode),
			Actions:  inferDailyAssistantActions(message, request.Context, fallbackStart),
			Provider: provider,
			Model:    model,
			Error:    userFacingLLMError(err),
		}
	}

	parsed := parseDailyAssistantLLMReply(result.Reply)
	fallbackStart := time.Now().Add(24 * time.Hour)
	scheduleItems := sanitizeScheduleDrafts(parsed.ScheduleItems, fallbackStart)
	actions := sanitizeDailyAssistantActions(parsed.Actions, fallbackStart)
	if len(actions) == 0 {
		actions = inferDailyAssistantActions(message, request.Context, fallbackStart)
	}
	return DailyAssistantAgentResponse{
		Success:       true,
		Reply:         parsed.Reply,
		ScheduleItems: scheduleItems,
		Actions:       actions,
		Provider:      result.Provider,
		Model:         result.Model,
	}
}

func buildDailyAssistantMessages(mode, message string, context map[string]any) []ChatMessage {
	messages := []ChatMessage{
		{Role: "system", Content: dailyAssistantSystemPrompt},
		{Role: "system", Content: "Current assistant mode: " + mode + ". Return JSON only with this shape: {\"reply\":\"concise action brief\",\"scheduleItems\":[{\"title\":\"task or event title\",\"moduleCode\":\"module code or TASK\",\"location\":\"campus building code such as COM1, CLB, or UTOWN\",\"startAt\":\"RFC3339 timestamp\",\"endAt\":\"RFC3339 timestamp\",\"notes\":\"optional reason\"}],\"actions\":[{\"type\":\"navigate_section|open_map|create_schedule|create_project|run_sync|ios_calendar|ios_reminder|ios_note|ios_open_app\",\"label\":\"short action label\",\"payload\":{}}]}. Include scheduleItems when suggesting draft plan blocks. Include actions only when the user asks you to do something. Allowed sections are dashboard, map, recommendations, schedule, facilities, tasks, resources, clubs, sync. create_schedule payload must match a schedule item. create_project payload should include title, location, dueAt, and notes when possible. For iOS Calendar, Reminders, Notes, or app-opening requests, use ios_calendar, ios_reminder, ios_note, or ios_open_app. iOS payloads should include title, notes/body when relevant, startAt/endAt/dueAt when relevant, and app when opening an app. Use TASK as moduleCode for non-class work. If exact date or time is missing for a create action, propose a reasonable future block and explain the assumption in notes."},
		{Role: "system", Content: "Current server time: " + time.Now().UTC().Format(time.RFC3339)},
	}
	if len(context) > 0 {
		if encoded, err := json.Marshal(context); err == nil {
			messages = append(messages, ChatMessage{
				Role:    "user",
				Content: "Optional app context as JSON. Use only what is relevant and do not assume missing details:\n" + string(encoded),
			})
		}
	}
	messages = append(messages, ChatMessage{Role: "user", Content: message})
	return messages
}

func parseDailyAssistantLLMReply(raw string) DailyAssistantAgentResponse {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return DailyAssistantAgentResponse{Reply: fallbackDailyAssistantReply("general")}
	}

	cleaned := strings.TrimPrefix(raw, "```json")
	cleaned = strings.TrimPrefix(cleaned, "```")
	cleaned = strings.TrimSuffix(cleaned, "```")
	cleaned = strings.TrimSpace(cleaned)

	var parsed DailyAssistantAgentResponse
	if err := json.Unmarshal([]byte(cleaned), &parsed); err == nil && strings.TrimSpace(parsed.Reply) != "" {
		return parsed
	}
	return DailyAssistantAgentResponse{Reply: raw}
}

func sanitizeScheduleDrafts(drafts []DailyAssistantScheduleDraft, fallbackStart time.Time) []DailyAssistantScheduleDraft {
	clean := make([]DailyAssistantScheduleDraft, 0, len(drafts))
	for _, draft := range drafts {
		title := strings.TrimSpace(draft.Title)
		if title == "" {
			continue
		}
		moduleCode := strings.ToUpper(strings.TrimSpace(draft.ModuleCode))
		if moduleCode == "" {
			moduleCode = "TASK"
		}
		location := strings.ToUpper(strings.TrimSpace(draft.Location))
		if location == "" {
			location = "COM1"
		}
		startAt, startErr := time.Parse(time.RFC3339, strings.TrimSpace(draft.StartAt))
		endAt, endErr := time.Parse(time.RFC3339, strings.TrimSpace(draft.EndAt))
		if startErr != nil {
			startAt = fallbackStart.Truncate(time.Hour)
		}
		if endErr != nil || !endAt.After(startAt) {
			endAt = startAt.Add(time.Hour)
		}
		clean = append(clean, DailyAssistantScheduleDraft{
			Title:      title,
			ModuleCode: moduleCode,
			Location:   location,
			StartAt:    startAt.UTC().Format(time.RFC3339),
			EndAt:      endAt.UTC().Format(time.RFC3339),
			Notes:      strings.TrimSpace(draft.Notes),
		})
		if len(clean) >= 3 {
			break
		}
	}
	return clean
}

func sanitizeDailyAssistantActions(actions []DailyAssistantAction, fallbackStart time.Time) []DailyAssistantAction {
	clean := make([]DailyAssistantAction, 0, len(actions))
	for _, action := range actions {
		actionType := strings.ToLower(strings.TrimSpace(action.Type))
		if actionType == "" {
			continue
		}
		payload := action.Payload
		if payload == nil {
			payload = map[string]any{}
		}
		label := strings.TrimSpace(action.Label)
		switch actionType {
		case "navigate_section":
			section := normalizeDashboardSection(stringFromPayload(payload, "section"))
			if section == "" {
				continue
			}
			clean = append(clean, DailyAssistantAction{
				Type:    actionType,
				Label:   firstNonEmptyString(label, "Open "+section),
				Payload: map[string]any{"section": section},
			})
		case "open_map":
			destination := strings.TrimSpace(stringFromPayload(payload, "destination"))
			nextPayload := map[string]any{}
			if destination != "" {
				nextPayload["destination"] = destination
			}
			clean = append(clean, DailyAssistantAction{
				Type:    actionType,
				Label:   firstNonEmptyString(label, "Open map"),
				Payload: nextPayload,
			})
		case "create_schedule":
			draft := scheduleDraftFromPayload(payload, fallbackStart)
			if strings.TrimSpace(draft.Title) == "" {
				continue
			}
			clean = append(clean, DailyAssistantAction{
				Type:    actionType,
				Label:   firstNonEmptyString(label, "Create schedule item"),
				Payload: scheduleDraftPayload(draft),
			})
		case "create_project":
			title := strings.TrimSpace(stringFromPayload(payload, "title"))
			if title == "" {
				continue
			}
			dueAt := strings.TrimSpace(stringFromPayload(payload, "dueAt"))
			if dueAt == "" {
				dueAt = fallbackStart.UTC().Format(time.RFC3339)
			}
			clean = append(clean, DailyAssistantAction{
				Type:  actionType,
				Label: firstNonEmptyString(label, "Create project"),
				Payload: map[string]any{
					"title":    title,
					"location": firstNonEmptyString(strings.TrimSpace(stringFromPayload(payload, "location")), "COM1"),
					"dueAt":    dueAt,
					"notes":    strings.TrimSpace(stringFromPayload(payload, "notes")),
				},
			})
		case "run_sync":
			clean = append(clean, DailyAssistantAction{
				Type:    actionType,
				Label:   firstNonEmptyString(label, "Run sync"),
				Payload: map[string]any{},
			})
		case "ios_calendar", "ios_reminder", "ios_note", "ios_open_app":
			if iosAction, ok := sanitizeIOSSystemAction(actionType, label, payload, fallbackStart); ok {
				clean = append(clean, iosAction)
			}
		default:
			continue
		}
		if len(clean) >= 5 {
			break
		}
	}
	return clean
}

func inferDailyAssistantActions(message string, context map[string]any, fallbackStart time.Time) []DailyAssistantAction {
	text := strings.ToLower(strings.TrimSpace(message))
	if text == "" {
		return nil
	}
	actions := []DailyAssistantAction{}
	if wantsOpen(text) {
		if app := inferIOSApp(text); app != "" {
			actions = append(actions, DailyAssistantAction{
				Type:  "ios_open_app",
				Label: "Open " + app,
				Payload: map[string]any{
					"app": app,
				},
			})
		}
	}
	if strings.Contains(text, "sync") || strings.Contains(text, "同步") {
		actions = append(actions, DailyAssistantAction{Type: "run_sync", Label: "Run sync", Payload: map[string]any{}})
	}
	if section := inferDashboardSection(text); section != "" {
		actionType := "navigate_section"
		if section == "map" {
			actionType = "open_map"
		}
		payload := map[string]any{"section": section}
		if actionType == "open_map" {
			payload = map[string]any{}
		}
		actions = append(actions, DailyAssistantAction{Type: actionType, Label: "Open " + section, Payload: payload})
	}
	if wantsCreate(text) {
		if wantsIOSNote(text) {
			actions = append(actions, DailyAssistantAction{
				Type:  "ios_note",
				Label: "Prepare iOS Note",
				Payload: map[string]any{
					"title": titleFromMessage(message, "Atlas note"),
					"body":  titleFromMessage(message, "Atlas note"),
				},
			})
		} else if wantsIOSReminder(text) {
			actions = append(actions, DailyAssistantAction{
				Type:  "ios_reminder",
				Label: "Prepare iOS Reminder",
				Payload: map[string]any{
					"title": titleFromMessage(message, "Atlas reminder"),
					"dueAt": fallbackStart.UTC().Format(time.RFC3339),
					"notes": "Created from Atlas Day Hub command; time was inferred.",
				},
			})
		} else if strings.Contains(text, "project") || strings.Contains(text, "项目") {
			actions = append(actions, DailyAssistantAction{
				Type:  "create_project",
				Label: "Create project",
				Payload: map[string]any{
					"title":    titleFromMessage(message, "New project"),
					"location": defaultLocationFromContext(context),
					"dueAt":    fallbackStart.UTC().Format(time.RFC3339),
					"notes":    "Created from Atlas Day Hub command",
				},
			})
		} else if strings.Contains(text, "schedule") || strings.Contains(text, "calendar") || strings.Contains(text, "日历") || strings.Contains(text, "安排") || strings.Contains(text, "任务") || strings.Contains(text, "task") {
			draft := DailyAssistantScheduleDraft{
				Title:      titleFromMessage(message, "Assistant task"),
				ModuleCode: "TASK",
				Location:   defaultLocationFromContext(context),
				StartAt:    fallbackStart.UTC().Format(time.RFC3339),
				EndAt:      fallbackStart.Add(time.Hour).UTC().Format(time.RFC3339),
				Notes:      "Created from Atlas Day Hub command; time was inferred.",
			}
			actions = append(actions, DailyAssistantAction{Type: "create_schedule", Label: "Create schedule item", Payload: scheduleDraftPayload(draft)})
			if strings.Contains(text, "ios") || strings.Contains(text, "iphone") || strings.Contains(text, "日历") || strings.Contains(text, "calendar") {
				actions = append(actions, DailyAssistantAction{Type: "ios_calendar", Label: "Prepare iOS Calendar event", Payload: scheduleDraftPayload(draft)})
			}
		}
	}
	return sanitizeDailyAssistantActions(actions, fallbackStart)
}

func sanitizeIOSSystemAction(actionType, label string, payload map[string]any, fallbackStart time.Time) (DailyAssistantAction, bool) {
	switch actionType {
	case "ios_calendar":
		draft := scheduleDraftFromPayload(payload, fallbackStart)
		if strings.TrimSpace(draft.Title) == "" {
			return DailyAssistantAction{}, false
		}
		command := iosCalendarCommand(draft)
		return DailyAssistantAction{
			Type:  actionType,
			Label: firstNonEmptyString(label, "Send to iOS Calendar"),
			Payload: map[string]any{
				"app":              "Calendar",
				"intent":           "create_event",
				"title":            draft.Title,
				"location":         draft.Location,
				"startAt":          draft.StartAt,
				"endAt":            draft.EndAt,
				"notes":            draft.Notes,
				"command":          command,
				"clipboardText":    command,
				"shortcutName":     "Atlas Add Calendar Event",
				"url":              iosShortcutURL("Atlas Add Calendar Event", command),
				"requiresShortcut": true,
			},
		}, true
	case "ios_reminder":
		title := strings.TrimSpace(stringFromPayload(payload, "title"))
		if title == "" {
			return DailyAssistantAction{}, false
		}
		dueAt := strings.TrimSpace(stringFromPayload(payload, "dueAt"))
		if dueAt == "" {
			dueAt = fallbackStart.UTC().Format(time.RFC3339)
		}
		notes := strings.TrimSpace(stringFromPayload(payload, "notes"))
		command := iosReminderCommand(title, dueAt, notes)
		return DailyAssistantAction{
			Type:  actionType,
			Label: firstNonEmptyString(label, "Send to iOS Reminders"),
			Payload: map[string]any{
				"app":              "Reminders",
				"intent":           "create_reminder",
				"title":            title,
				"dueAt":            dueAt,
				"notes":            notes,
				"command":          command,
				"clipboardText":    command,
				"shortcutName":     "Atlas Add Reminder",
				"url":              iosShortcutURL("Atlas Add Reminder", command),
				"requiresShortcut": true,
			},
		}, true
	case "ios_note":
		title := strings.TrimSpace(stringFromPayload(payload, "title"))
		body := strings.TrimSpace(firstNonEmptyString(stringFromPayload(payload, "body"), stringFromPayload(payload, "notes")))
		if title == "" && body == "" {
			return DailyAssistantAction{}, false
		}
		if title == "" {
			title = "Atlas note"
		}
		command := iosNoteCommand(title, body)
		return DailyAssistantAction{
			Type:  actionType,
			Label: firstNonEmptyString(label, "Send to iOS Notes"),
			Payload: map[string]any{
				"app":              "Notes",
				"intent":           "create_note",
				"title":            title,
				"body":             body,
				"command":          command,
				"clipboardText":    command,
				"shortcutName":     "Atlas Add Note",
				"url":              iosShortcutURL("Atlas Add Note", command),
				"requiresShortcut": true,
			},
		}, true
	case "ios_open_app":
		app := normalizeIOSApp(firstNonEmptyString(stringFromPayload(payload, "app"), inferIOSApp(stringFromPayload(payload, "target"))))
		if app == "" {
			return DailyAssistantAction{}, false
		}
		return DailyAssistantAction{
			Type:  actionType,
			Label: firstNonEmptyString(label, "Open "+app),
			Payload: map[string]any{
				"app":    app,
				"intent": "open_app",
				"url":    iosAppURL(app),
			},
		}, true
	default:
		return DailyAssistantAction{}, false
	}
}

func normalizeDailyAssistantMode(mode string) string {
	switch strings.ToLower(strings.TrimSpace(mode)) {
	case "daily_plan", "reflection", "task_summary", "general":
		return strings.ToLower(strings.TrimSpace(mode))
	default:
		return "general"
	}
}

func scheduleDraftFromPayload(payload map[string]any, fallbackStart time.Time) DailyAssistantScheduleDraft {
	draft := DailyAssistantScheduleDraft{
		Title:      strings.TrimSpace(stringFromPayload(payload, "title")),
		ModuleCode: strings.TrimSpace(stringFromPayload(payload, "moduleCode")),
		Location:   strings.TrimSpace(stringFromPayload(payload, "location")),
		StartAt:    strings.TrimSpace(stringFromPayload(payload, "startAt")),
		EndAt:      strings.TrimSpace(stringFromPayload(payload, "endAt")),
		Notes:      strings.TrimSpace(stringFromPayload(payload, "notes")),
	}
	clean := sanitizeScheduleDrafts([]DailyAssistantScheduleDraft{draft}, fallbackStart)
	if len(clean) == 0 {
		return DailyAssistantScheduleDraft{}
	}
	return clean[0]
}

func scheduleDraftPayload(draft DailyAssistantScheduleDraft) map[string]any {
	return map[string]any{
		"title":      draft.Title,
		"moduleCode": draft.ModuleCode,
		"location":   draft.Location,
		"startAt":    draft.StartAt,
		"endAt":      draft.EndAt,
		"notes":      draft.Notes,
	}
}

func normalizeDashboardSection(section string) string {
	switch strings.ToLower(strings.TrimSpace(section)) {
	case "dashboard", "home":
		return "dashboard"
	case "map", "ar", "route", "navigation":
		return "map"
	case "recommendations", "assistant", "daily_assistant":
		return "recommendations"
	case "schedule", "calendar":
		return "schedule"
	case "facilities", "facility":
		return "facilities"
	case "tasks", "task":
		return "tasks"
	case "resources", "resource":
		return "resources"
	case "clubs", "events":
		return "clubs"
	case "sync", "settings":
		return "sync"
	default:
		return ""
	}
}

func inferDashboardSection(text string) string {
	switch {
	case strings.Contains(text, "map") || strings.Contains(text, "route") || strings.Contains(text, "导航") || strings.Contains(text, "地图"):
		return "map"
	case strings.Contains(text, "calendar") || strings.Contains(text, "schedule") || strings.Contains(text, "日历") || strings.Contains(text, "课表"):
		return "schedule"
	case strings.Contains(text, "task") || strings.Contains(text, "任务"):
		return "tasks"
	case strings.Contains(text, "project") || strings.Contains(text, "项目"):
		return "tasks"
	case strings.Contains(text, "facility") || strings.Contains(text, "设施"):
		return "facilities"
	case strings.Contains(text, "setting") || strings.Contains(text, "设置"):
		return "sync"
	case strings.Contains(text, "assistant") || strings.Contains(text, "agent") || strings.Contains(text, "助手"):
		return "recommendations"
	default:
		return ""
	}
}

func wantsCreate(text string) bool {
	return strings.Contains(text, "create") || strings.Contains(text, "add") || strings.Contains(text, "new ") || strings.Contains(text, "新建") || strings.Contains(text, "创建") || strings.Contains(text, "添加")
}

func wantsOpen(text string) bool {
	return strings.Contains(text, "open") || strings.Contains(text, "launch") || strings.Contains(text, "打开") || strings.Contains(text, "启动")
}

func wantsIOSNote(text string) bool {
	return strings.Contains(text, "note") || strings.Contains(text, "notes") || strings.Contains(text, "备忘录") || strings.Contains(text, "笔记")
}

func wantsIOSReminder(text string) bool {
	return strings.Contains(text, "reminder") || strings.Contains(text, "reminders") || strings.Contains(text, "提醒")
}

func inferIOSApp(text string) string {
	switch {
	case strings.Contains(text, "calendar") || strings.Contains(text, "日历"):
		return "Calendar"
	case strings.Contains(text, "reminder") || strings.Contains(text, "reminders") || strings.Contains(text, "提醒"):
		return "Reminders"
	case strings.Contains(text, "note") || strings.Contains(text, "notes") || strings.Contains(text, "备忘录") || strings.Contains(text, "笔记"):
		return "Notes"
	case strings.Contains(text, "map") || strings.Contains(text, "maps") || strings.Contains(text, "地图") || strings.Contains(text, "导航"):
		return "Maps"
	case strings.Contains(text, "mail") || strings.Contains(text, "email") || strings.Contains(text, "邮件"):
		return "Mail"
	default:
		return ""
	}
}

func normalizeIOSApp(app string) string {
	switch strings.ToLower(strings.TrimSpace(app)) {
	case "calendar", "日历":
		return "Calendar"
	case "reminder", "reminders", "提醒":
		return "Reminders"
	case "note", "notes", "备忘录", "笔记":
		return "Notes"
	case "map", "maps", "地图", "导航":
		return "Maps"
	case "mail", "email", "邮件":
		return "Mail"
	case "shortcuts", "shortcut", "快捷指令":
		return "Shortcuts"
	default:
		return ""
	}
}

func iosAppURL(app string) string {
	switch normalizeIOSApp(app) {
	case "Calendar":
		return "calshow://"
	case "Reminders":
		return "x-apple-reminderkit://"
	case "Notes":
		return "mobilenotes://"
	case "Maps":
		return "maps://"
	case "Mail":
		return "message://"
	case "Shortcuts":
		return "shortcuts://"
	default:
		return ""
	}
}

func iosShortcutURL(shortcutName, command string) string {
	return "shortcuts://run-shortcut?name=" + url.QueryEscape(shortcutName) + "&input=text&text=" + url.QueryEscape(command)
}

func iosCalendarCommand(draft DailyAssistantScheduleDraft) string {
	parts := []string{
		"Create Calendar event",
		"title: " + draft.Title,
		"start: " + draft.StartAt,
		"end: " + draft.EndAt,
		"location: " + draft.Location,
	}
	if strings.TrimSpace(draft.Notes) != "" {
		parts = append(parts, "notes: "+strings.TrimSpace(draft.Notes))
	}
	return strings.Join(parts, "\n")
}

func iosReminderCommand(title, dueAt, notes string) string {
	parts := []string{
		"Create Reminder",
		"title: " + strings.TrimSpace(title),
		"due: " + strings.TrimSpace(dueAt),
	}
	if strings.TrimSpace(notes) != "" {
		parts = append(parts, "notes: "+strings.TrimSpace(notes))
	}
	return strings.Join(parts, "\n")
}

func iosNoteCommand(title, body string) string {
	parts := []string{
		"Create Note",
		"title: " + strings.TrimSpace(title),
	}
	if strings.TrimSpace(body) != "" {
		parts = append(parts, "body: "+strings.TrimSpace(body))
	}
	return strings.Join(parts, "\n")
}

func titleFromMessage(message, fallback string) string {
	title := strings.TrimSpace(message)
	replacer := strings.NewReplacer("新建", "", "创建", "", "添加", "", "create", "", "Create", "", "add", "", "Add", "", "new", "", "New", "")
	title = strings.TrimSpace(replacer.Replace(title))
	if title == "" {
		return fallback
	}
	if len([]rune(title)) > 80 {
		return string([]rune(title)[:80])
	}
	return title
}

func defaultLocationFromContext(context map[string]any) string {
	if value, ok := context["defaultLocation"].(string); ok && strings.TrimSpace(value) != "" {
		return strings.ToUpper(strings.TrimSpace(value))
	}
	return "COM1"
}

func stringFromPayload(payload map[string]any, key string) string {
	if payload == nil {
		return ""
	}
	value, ok := payload[key]
	if !ok || value == nil {
		return ""
	}
	switch typed := value.(type) {
	case string:
		return typed
	default:
		return strings.TrimSpace(strings.Trim(strings.ReplaceAll(strings.TrimSpace(toJSON(typed)), "\n", " "), "\""))
	}
}

func firstNonEmptyString(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return strings.TrimSpace(value)
		}
	}
	return ""
}

func toJSON(value any) string {
	encoded, err := json.Marshal(value)
	if err != nil {
		return ""
	}
	return string(encoded)
}

func fallbackDailyAssistantReply(mode string) string {
	switch normalizeDailyAssistantMode(mode) {
	case "daily_plan":
		return "Daily plan fallback:\n1. Pick your top 2 priorities for the next study block.\n2. Check your next scheduled item and leave buffer time for travel.\n3. Use one short break between focused sessions.\n4. Revisit the plan this evening and adjust tomorrow's first task."
	case "reflection":
		return "Reflection fallback:\n1. Note one thing that went well today.\n2. Name one friction point without judging it.\n3. Choose one small adjustment for tomorrow.\n4. Close with a realistic next step."
	case "task_summary":
		return "Task summary fallback:\n1. Separate urgent work from nice-to-have work.\n2. Group similar study tasks together.\n3. Start with the smallest task that unlocks progress.\n4. Keep the next action visible and concrete."
	default:
		return "Assistant fallback:\n1. Clarify what needs attention now.\n2. Choose one practical next action.\n3. Check schedule or campus constraints before committing.\n4. Keep the plan short enough to follow."
	}
}

func classifyLLMError(err error) string {
	switch {
	case errors.Is(err, ErrLLMNotConfigured):
		return "missing_configuration"
	case errors.Is(err, ErrLLMInvalidRequest):
		return "invalid_request"
	case errors.Is(err, ErrLLMInvalidReply):
		return "invalid_response"
	case strings.Contains(err.Error(), "network failure"):
		return "network_failure"
	case strings.Contains(err.Error(), "provider error"):
		return "provider_error"
	default:
		return "llm_error"
	}
}

func userFacingLLMError(err error) string {
	switch classifyLLMError(err) {
	case "missing_configuration":
		return "LLM provider is not configured"
	case "network_failure":
		return "LLM network request failed"
	case "invalid_response":
		return "LLM provider returned an invalid response"
	case "provider_error":
		return "LLM provider returned an error"
	default:
		return "Atlas Day Hub LLM request failed"
	}
}
