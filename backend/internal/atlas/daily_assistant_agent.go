package atlas

import (
	"context"
	"encoding/json"
	"errors"
	"log"
	"strings"
	"time"
)

const dailyAssistantSystemPrompt = "You are a helpful Daily Assistant inside a student productivity app. You help the user plan their day, summarize priorities, reflect on progress, and make practical suggestions. Be concise, supportive, and action-oriented. Do not invent private user data. If context is missing, make reasonable general suggestions."

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
		return DailyAssistantAgentResponse{
			Success:  false,
			Reply:    fallbackDailyAssistantReply(mode),
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
		return DailyAssistantAgentResponse{
			Success:  false,
			Reply:    fallbackDailyAssistantReply(mode),
			Provider: provider,
			Model:    model,
			Error:    userFacingLLMError(err),
		}
	}

	parsed := parseDailyAssistantLLMReply(result.Reply)
	return DailyAssistantAgentResponse{
		Success: true,
		Reply:   parsed.Reply,
		ScheduleItems: sanitizeScheduleDrafts(
			parsed.ScheduleItems,
			time.Now().Add(24*time.Hour),
		),
		Provider: result.Provider,
		Model:    result.Model,
	}
}

func buildDailyAssistantMessages(mode, message string, context map[string]any) []ChatMessage {
	messages := []ChatMessage{
		{Role: "system", Content: dailyAssistantSystemPrompt},
		{Role: "system", Content: "Current assistant mode: " + mode + ". Return JSON only with this shape: {\"reply\":\"concise response\",\"scheduleItems\":[{\"title\":\"task or event title\",\"moduleCode\":\"module code or TASK\",\"location\":\"campus building code such as COM1, CLB, or UTOWN\",\"startAt\":\"RFC3339 timestamp\",\"endAt\":\"RFC3339 timestamp\",\"notes\":\"optional reason\"}]}. Include scheduleItems only when the user asks to add, plan, schedule, block time, or create tasks. Use TASK as moduleCode for non-class work. If exact date or time is missing, propose a reasonable future study block and explain the assumption in notes."},
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

func normalizeDailyAssistantMode(mode string) string {
	switch strings.ToLower(strings.TrimSpace(mode)) {
	case "daily_plan", "reflection", "task_summary", "general":
		return strings.ToLower(strings.TrimSpace(mode))
	default:
		return "general"
	}
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
		return "Daily Assistant LLM request failed"
	}
}
