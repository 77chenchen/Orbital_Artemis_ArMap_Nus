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
	if response.Provider != "mock" || response.Model != "mock-model" {
		t.Fatalf("unexpected provider metadata: %#v", response)
	}
	if len(llm.messages) != 5 {
		t.Fatalf("expected system, mode, time, context, and user messages; got %d", len(llm.messages))
	}
	if !strings.Contains(llm.messages[0].Content, "Daily Assistant") {
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
		Message: "Summarize my tasks.",
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
	if len(llm.messages) != 0 {
		t.Fatal("unconfigured LLM should not be called")
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
