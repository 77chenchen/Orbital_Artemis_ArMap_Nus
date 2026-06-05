package atlas

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

var (
	ErrLLMNotConfigured  = errors.New("llm provider is not configured")
	ErrLLMInvalidRequest = errors.New("llm request is invalid")
	ErrLLMInvalidReply   = errors.New("llm provider returned an invalid response")
)

type ChatMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type LLMChatOptions struct {
	Temperature float64
	MaxTokens   int
}

type LLMChatResult struct {
	Reply    string
	Provider string
	Model    string
}

type LLMClient interface {
	Chat(ctx context.Context, messages []ChatMessage, options LLMChatOptions) (LLMChatResult, error)
	Configured() bool
	Provider() string
	Model() string
}

type OpenAICompatibleLLMClient struct {
	cfg    Config
	client *http.Client
}

func NewLLMClient(cfg Config) LLMClient {
	timeout := cfg.HTTPClientTimeout
	if timeout <= 0 {
		timeout = 10 * time.Second
	}
	return &OpenAICompatibleLLMClient{
		cfg:    cfg,
		client: &http.Client{Timeout: timeout},
	}
}

func (c *OpenAICompatibleLLMClient) Configured() bool {
	return c.cfg.LLMAPIKey != "" && c.cfg.LLMBaseURL != "" && c.cfg.LLMModel != ""
}

func (c *OpenAICompatibleLLMClient) Provider() string {
	if c.cfg.LLMProvider != "" {
		return c.cfg.LLMProvider
	}
	return "openai-compatible"
}

func (c *OpenAICompatibleLLMClient) Model() string {
	return c.cfg.LLMModel
}

func (c *OpenAICompatibleLLMClient) Chat(ctx context.Context, messages []ChatMessage, options LLMChatOptions) (LLMChatResult, error) {
	if !c.Configured() {
		return LLMChatResult{}, ErrLLMNotConfigured
	}
	if len(messages) == 0 {
		return LLMChatResult{}, ErrLLMInvalidRequest
	}
	for _, message := range messages {
		if strings.TrimSpace(message.Role) == "" || strings.TrimSpace(message.Content) == "" {
			return LLMChatResult{}, ErrLLMInvalidRequest
		}
	}

	temperature := options.Temperature
	if temperature <= 0 {
		temperature = 0.7
	}
	maxTokens := options.MaxTokens
	if maxTokens <= 0 {
		maxTokens = 1000
	}

	payload := map[string]any{
		"model":       c.cfg.LLMModel,
		"messages":    messages,
		"temperature": temperature,
		"max_tokens":  maxTokens,
	}
	body, err := json.Marshal(payload)
	if err != nil {
		return LLMChatResult{}, err
	}

	endpoint := strings.TrimRight(c.cfg.LLMBaseURL, "/") + "/chat/completions"
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(body))
	if err != nil {
		return LLMChatResult{}, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+c.cfg.LLMAPIKey)

	resp, err := c.client.Do(req)
	if err != nil {
		return LLMChatResult{}, fmt.Errorf("llm network failure: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return LLMChatResult{}, providerError(resp.StatusCode, resp.Body)
	}

	var decoded openAIChatResponse
	if err := json.NewDecoder(io.LimitReader(resp.Body, 1<<20)).Decode(&decoded); err != nil {
		return LLMChatResult{}, fmt.Errorf("%w: %v", ErrLLMInvalidReply, err)
	}
	if decoded.Error != nil && decoded.Error.Message != "" {
		return LLMChatResult{}, fmt.Errorf("llm provider error: %s", decoded.Error.Message)
	}
	if len(decoded.Choices) == 0 {
		return LLMChatResult{}, ErrLLMInvalidReply
	}
	reply := strings.TrimSpace(decoded.Choices[0].Message.Content)
	if reply == "" {
		return LLMChatResult{}, ErrLLMInvalidReply
	}

	return LLMChatResult{
		Reply:    reply,
		Provider: c.Provider(),
		Model:    c.cfg.LLMModel,
	}, nil
}

type openAIChatResponse struct {
	Choices []struct {
		Message ChatMessage `json:"message"`
	} `json:"choices"`
	Error *struct {
		Message string `json:"message"`
		Type    string `json:"type"`
		Code    any    `json:"code"`
	} `json:"error,omitempty"`
}

func providerError(status int, body io.Reader) error {
	raw, _ := io.ReadAll(io.LimitReader(body, 4096))
	var decoded struct {
		Error struct {
			Message string `json:"message"`
		} `json:"error"`
	}
	if err := json.Unmarshal(raw, &decoded); err == nil && decoded.Error.Message != "" {
		return fmt.Errorf("llm provider error %d: %s", status, decoded.Error.Message)
	}
	return fmt.Errorf("llm provider error %d", status)
}
