package atlas

import (
	"context"
	"errors"
	"strings"
	"testing"
)

type fakeLLMClient struct {
	configured bool
	reply      string
	err        error
	messages   []ChatMessage
}

func (f *fakeLLMClient) Chat(ctx context.Context, messages []ChatMessage, options LLMChatOptions) (LLMChatResult, error) {
	f.messages = messages
	if f.err != nil {
		return LLMChatResult{}, f.err
	}
	return LLMChatResult{Reply: f.reply, Provider: f.Provider(), Model: f.Model()}, nil
}

func (f *fakeLLMClient) Configured() bool {
	return f.configured
}

func (f *fakeLLMClient) Provider() string {
	return "mock"
}

func (f *fakeLLMClient) Model() string {
	return "mock-model"
}

func TestDailyAssistantAgentReturnsLLMReply(t *testing.T) {
	llm := &fakeLLMClient{configured: true, reply: `{
		"reply": "1. Start with CP2106.\n2. Leave for COM1 by 09:30.",
		"scheduleItems": [
			{
				"title": "Focus on CP2106",
				"moduleCode": "TASK",
				"location": "CLB",
				"startAt": "2026-06-06T02:00:00Z",
				"endAt": "2026-06-06T03:00:00Z",
				"notes": "Suggested study block"
			}
		],
		"actions": [
			{
				"type": "create_schedule",
				"label": "Add focus block",
				"payload": {
					"title": "Focus on CP2106",
					"moduleCode": "task",
					"location": "clb",
					"startAt": "2026-06-06T02:00:00Z",
					"endAt": "2026-06-06T03:00:00Z",
					"notes": "Suggested study block"
				}
			}
		]
	}`}
	agent := NewDailyAssistantAgent(llm)

	response := agent.Run(context.Background(), DailyAssistantAgentRequest{
		Message: "Plan my morning.",
		Mode:    "daily_plan",
		Context: map[string]any{"scheduleCount": 1},
	})

	if !response.Success {
		t.Fatalf("expected success, got error %q", response.Error)
	}
	if response.Reply != "1. Start with CP2106.\n2. Leave for COM1 by 09:30." {
		t.Fatalf("unexpected reply: %q", response.Reply)
	}
	if len(response.ScheduleItems) != 1 {
		t.Fatalf("expected one schedule draft, got %#v", response.ScheduleItems)
	}
	if response.ScheduleItems[0].ModuleCode != "TASK" || response.ScheduleItems[0].Location != "CLB" {
		t.Fatalf("schedule draft was not normalized: %#v", response.ScheduleItems[0])
	}
	if len(response.Actions) != 1 {
		t.Fatalf("expected one action, got %#v", response.Actions)
	}
	if response.Actions[0].Type != "create_schedule" || response.Actions[0].Payload["moduleCode"] != "TASK" {
		t.Fatalf("action was not normalized: %#v", response.Actions[0])
	}
	if response.Provider != "mock" || response.Model != "mock-model" {
		t.Fatalf("unexpected provider metadata: %#v", response)
	}
	if len(llm.messages) != 5 {
		t.Fatalf("expected system, mode, time, context, and user messages; got %d", len(llm.messages))
	}
	if !strings.Contains(llm.messages[0].Content, "Atlas Day Hub") {
		t.Fatalf("system prompt was not included: %#v", llm.messages)
	}
	if !strings.Contains(llm.messages[1].Content, "scheduleItems") {
		t.Fatalf("structured output instruction was not included: %#v", llm.messages)
	}
}

func TestDailyAssistantAgentFallsBackWhenUnconfigured(t *testing.T) {
	llm := &fakeLLMClient{configured: false, err: ErrLLMNotConfigured}
	agent := NewDailyAssistantAgent(llm)

	response := agent.Run(context.Background(), DailyAssistantAgentRequest{
		Message: "Open the map and run sync.",
		Mode:    "task_summary",
	})

	if response.Success {
		t.Fatal("expected fallback response to be marked unsuccessful")
	}
	if response.Error != "LLM provider is not configured" {
		t.Fatalf("unexpected error: %q", response.Error)
	}
	if !strings.Contains(response.Reply, "Task summary fallback") {
		t.Fatalf("unexpected fallback reply: %q", response.Reply)
	}
	if len(response.Actions) != 3 {
		t.Fatalf("expected inferred map and sync actions, got %#v", response.Actions)
	}
	if len(llm.messages) != 0 {
		t.Fatal("unconfigured LLM should not be called")
	}
}

func TestDailyAssistantAgentInfersCreateProjectAction(t *testing.T) {
	llm := &fakeLLMClient{configured: false, err: ErrLLMNotConfigured}
	agent := NewDailyAssistantAgent(llm)

	response := agent.Run(context.Background(), DailyAssistantAgentRequest{
		Message: "新建项目 Orbital demo polish",
	})

	if len(response.Actions) == 0 {
		t.Fatalf("expected inferred create project action, got %#v", response.Actions)
	}
	action := response.Actions[0]
	if action.Type != "navigate_section" && action.Type != "create_project" {
		t.Fatalf("unexpected first action: %#v", action)
	}
	foundProject := false
	for _, action := range response.Actions {
		if action.Type == "create_project" {
			foundProject = true
			if !strings.Contains(action.Payload["title"].(string), "Orbital demo polish") {
				t.Fatalf("project title was not inferred: %#v", action)
			}
		}
	}
	if !foundProject {
		t.Fatalf("expected create_project action, got %#v", response.Actions)
	}
}

func TestDailyAssistantAgentSanitizesIOSCalendarAction(t *testing.T) {
	llm := &fakeLLMClient{configured: true, reply: `{
		"reply": "I prepared the iOS Calendar handoff.",
		"actions": [
			{
				"type": "ios_calendar",
				"payload": {
					"title": "Orbital polish block",
					"moduleCode": "task",
					"location": "clb",
					"startAt": "2026-06-06T02:00:00Z",
					"endAt": "2026-06-06T03:00:00Z",
					"notes": "Focus on mobile QA"
				}
			}
		]
	}`}
	agent := NewDailyAssistantAgent(llm)

	response := agent.Run(context.Background(), DailyAssistantAgentRequest{
		Message: "Add this to iOS calendar.",
	})

	if !response.Success {
		t.Fatalf("expected success, got %q", response.Error)
	}
	if len(response.Actions) != 1 {
		t.Fatalf("expected one action, got %#v", response.Actions)
	}
	action := response.Actions[0]
	if action.Type != "ios_calendar" {
		t.Fatalf("unexpected action type: %#v", action)
	}
	if action.Payload["app"] != "Calendar" || action.Payload["shortcutName"] != "Atlas Add Calendar Event" {
		t.Fatalf("ios payload was not normalized: %#v", action.Payload)
	}
	if !strings.Contains(action.Payload["url"].(string), "shortcuts://run-shortcut") {
		t.Fatalf("expected shortcuts url: %#v", action.Payload)
	}
	if !strings.Contains(action.Payload["command"].(string), "Orbital polish block") {
		t.Fatalf("expected command text to include title: %#v", action.Payload)
	}
}

func TestDailyAssistantAgentInfersIOSNoteAction(t *testing.T) {
	llm := &fakeLLMClient{configured: false, err: ErrLLMNotConfigured}
	agent := NewDailyAssistantAgent(llm)

	response := agent.Run(context.Background(), DailyAssistantAgentRequest{
		Message: "新建备忘录 记得检查移动端 AR",
	})

	foundNote := false
	for _, action := range response.Actions {
		if action.Type == "ios_note" {
			foundNote = true
			if action.Payload["app"] != "Notes" {
				t.Fatalf("unexpected note payload: %#v", action.Payload)
			}
			if !strings.Contains(action.Payload["command"].(string), "移动端 AR") {
				t.Fatalf("note command did not include user content: %#v", action.Payload)
			}
		}
	}
	if !foundNote {
		t.Fatalf("expected ios_note action, got %#v", response.Actions)
	}
}

func TestDailyAssistantAgentFallsBackOnProviderError(t *testing.T) {
	llm := &fakeLLMClient{configured: true, err: errors.New("llm provider error 429")}
	agent := NewDailyAssistantAgent(llm)

	response := agent.Run(context.Background(), DailyAssistantAgentRequest{
		Message: "Reflect on my day.",
		Mode:    "reflection",
	})

	if response.Success {
		t.Fatal("expected provider failure to return fallback")
	}
	if response.Error != "LLM provider returned an error" {
		t.Fatalf("unexpected error: %q", response.Error)
	}
	if !strings.Contains(response.Reply, "Reflection fallback") {
		t.Fatalf("unexpected fallback reply: %q", response.Reply)
	}
}

func TestParseDailyAssistantLLMReplyAcceptsPlainText(t *testing.T) {
	parsed := parseDailyAssistantLLMReply("Plain response")

	if parsed.Reply != "Plain response" {
		t.Fatalf("unexpected reply: %q", parsed.Reply)
	}
	if len(parsed.ScheduleItems) != 0 {
		t.Fatalf("plain text should not create drafts: %#v", parsed.ScheduleItems)
	}
}
