package atlas

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"
)

type NUSModsClient struct {
	baseURL  string
	acadYear string
	client   *http.Client
}

type NUSModsModule struct {
	ModuleCode string `json:"moduleCode"`
	Title      string `json:"title"`
	Semesters  []int  `json:"semesters"`
}

func NewNUSModsClient(acadYear string, timeout time.Duration) *NUSModsClient {
	return &NUSModsClient{
		baseURL:  "https://api.nusmods.com/v2",
		acadYear: acadYear,
		client:   &http.Client{Timeout: timeout},
	}
}

func (c *NUSModsClient) FetchModuleList(ctx context.Context) ([]NUSModsModule, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, fmt.Sprintf("%s/%s/moduleList.json", c.baseURL, c.acadYear), nil)
	if err != nil {
		return nil, err
	}
	res, err := c.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer res.Body.Close()
	if res.StatusCode < 200 || res.StatusCode >= 300 {
		return nil, fmt.Errorf("NUSMods returned %s", res.Status)
	}
	var modules []NUSModsModule
	if err := json.NewDecoder(res.Body).Decode(&modules); err != nil {
		return nil, err
	}
	return modules, nil
}
