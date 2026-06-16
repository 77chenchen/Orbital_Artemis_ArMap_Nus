package atlas

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"sort"
	"strings"
	"sync"
	"time"
)

type SingaporeTransitClient struct {
	cfg    Config
	client *http.Client

	mu    sync.Mutex
	cache map[string]busCacheEntry
}

type SGTrainAlert struct {
	Line      string    `json:"line"`
	Status    string    `json:"status"`
	Message   string    `json:"message,omitempty"`
	Source    string    `json:"source"`
	UpdatedAt time.Time `json:"updatedAt"`
}

func NewSingaporeTransitClient(cfg Config) *SingaporeTransitClient {
	timeout := cfg.HTTPClientTimeout
	if timeout <= 0 {
		timeout = 10 * time.Second
	}
	return &SingaporeTransitClient{
		cfg:    cfg,
		client: &http.Client{Timeout: timeout},
		cache:  make(map[string]busCacheEntry),
	}
}

func (c *SingaporeTransitClient) Configured() bool {
	return strings.TrimSpace(c.cfg.LTAAccountKey) != ""
}

func (c *SingaporeTransitClient) BusStops(ctx context.Context) ([]BusStop, error) {
	if !c.Configured() {
		return demoSingaporeBusStops(), nil
	}

	stops := make([]BusStop, 0, 6000)
	for skip := 0; ; skip += 500 {
		var raw map[string]any
		if err := c.getJSON(ctx, "/BusStops", url.Values{"$skip": {fmt.Sprintf("%d", skip)}}, 24*time.Hour, &raw); err != nil {
			return nil, err
		}
		items := firstArray(raw, "value")
		if len(items) == 0 {
			break
		}
		now := time.Now().UTC()
		for _, item := range items {
			code := firstString(item, "BusStopCode")
			lat := firstFloat(item, "Latitude")
			lng := firstFloat(item, "Longitude")
			if code == "" || lat == 0 || lng == 0 {
				continue
			}
			stops = append(stops, BusStop{
				Code:      code,
				Name:      firstNonEmpty(firstString(item, "Description"), code),
				Latitude:  lat,
				Longitude: lng,
				Source:    "lta",
				UpdatedAt: now,
			})
		}
		if len(items) < 500 {
			break
		}
	}
	return stops, nil
}

func (c *SingaporeTransitClient) NearbyBusStops(ctx context.Context, lat, lng float64, limit int) ([]BusContextStop, error) {
	stops, err := c.BusStops(ctx)
	if err != nil {
		return nil, err
	}
	sort.Slice(stops, func(i, j int) bool {
		return distanceMeters(lat, lng, stops[i].Latitude, stops[i].Longitude) < distanceMeters(lat, lng, stops[j].Latitude, stops[j].Longitude)
	})
	if limit <= 0 {
		limit = 8
	}
	if len(stops) > limit {
		stops = stops[:limit]
	}
	result := make([]BusContextStop, 0, len(stops))
	for _, stop := range stops {
		result = append(result, BusContextStop{
			BusStop:   stop,
			DistanceM: distanceMeters(lat, lng, stop.Latitude, stop.Longitude),
		})
	}
	return result, nil
}

func (c *SingaporeTransitClient) BusArrivals(ctx context.Context, stopCode string) (BusArrival, error) {
	stopCode = strings.TrimSpace(stopCode)
	if stopCode == "" {
		return BusArrival{}, errors.New("missing stop")
	}
	if !c.Configured() {
		return demoSingaporeBusArrival(stopCode), nil
	}

	var raw map[string]any
	if err := c.getJSON(ctx, "/BusArrivalv2", url.Values{"BusStopCode": {stopCode}}, 20*time.Second, &raw); err != nil {
		return BusArrival{}, err
	}
	return normalizeLTABusArrival(stopCode, raw), nil
}

func (c *SingaporeTransitClient) TrainAlerts(ctx context.Context) ([]SGTrainAlert, error) {
	if !c.Configured() {
		return demoTrainAlerts(), nil
	}

	var raw map[string]any
	if err := c.getJSON(ctx, "/TrainServiceAlerts", nil, 30*time.Second, &raw); err != nil {
		return nil, err
	}
	return normalizeLTATrainAlerts(raw), nil
}

func (c *SingaporeTransitClient) getJSON(ctx context.Context, path string, params url.Values, ttl time.Duration, target any) error {
	if params == nil {
		params = url.Values{}
	}
	cacheKey := path + "?" + params.Encode()
	if cached, ok := c.cached(cacheKey); ok {
		return json.Unmarshal(cached, target)
	}

	endpoint := strings.TrimRight(firstNonEmpty(c.cfg.LTADataMallBase, "https://datamall2.mytransport.sg/ltaodataservice"), "/") + path
	reqURL, err := url.Parse(endpoint)
	if err != nil {
		return err
	}
	reqURL.RawQuery = params.Encode()

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, reqURL.String(), nil)
	if err != nil {
		return err
	}
	req.Header.Set("AccountKey", c.cfg.LTAAccountKey)
	req.Header.Set("accept", "application/json")

	res, err := c.client.Do(req)
	if err != nil {
		return err
	}
	defer res.Body.Close()
	raw, _ := io.ReadAll(io.LimitReader(res.Body, 4<<20))
	if res.StatusCode < 200 || res.StatusCode >= 300 {
		return fmt.Errorf("lta datamall %s failed with %d: %s", path, res.StatusCode, strings.TrimSpace(string(raw)))
	}
	if err := json.Unmarshal(raw, target); err != nil {
		return fmt.Errorf("decode lta datamall %s: %w", path, err)
	}
	c.setCache(cacheKey, raw, ttl)
	return nil
}

func (c *SingaporeTransitClient) cached(key string) ([]byte, bool) {
	c.mu.Lock()
	defer c.mu.Unlock()
	entry, ok := c.cache[key]
	if !ok || time.Now().After(entry.expiresAt) {
		return nil, false
	}
	return entry.data, true
}

func (c *SingaporeTransitClient) setCache(key string, data []byte, ttl time.Duration) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.cache[key] = busCacheEntry{expiresAt: time.Now().Add(ttl), data: data}
}

func normalizeLTABusArrival(stopCode string, raw map[string]any) BusArrival {
	items := firstArray(raw, "Services")
	routes := make([]BusArrivalRoute, 0, len(items))
	for _, item := range items {
		next := firstMap(item, "NextBus")
		next2 := firstMap(item, "NextBus2")
		route := BusArrivalRoute{
			RouteCode:         firstString(item, "ServiceNo"),
			ArrivalTimeAt:     firstString(next, "EstimatedArrival"),
			NextArrivalTimeAt: firstString(next2, "EstimatedArrival"),
			CrowdLevel:        normalizeLTALoad(firstString(next, "Load")),
		}
		route.ArrivalMinutes = arrivalMinutesFromTimestamps(route.ArrivalTimeAt, route.NextArrivalTimeAt)
		if len(route.ArrivalMinutes) > 0 {
			route.ArrivalTime = fmt.Sprintf("%d", route.ArrivalMinutes[0])
		}
		if len(route.ArrivalMinutes) > 1 {
			route.NextArrivalTime = fmt.Sprintf("%d", route.ArrivalMinutes[1])
		}
		if route.RouteCode != "" {
			routes = append(routes, route)
		}
	}
	return BusArrival{
		StopCode:  firstNonEmpty(firstString(raw, "BusStopCode"), stopCode),
		StopName:  stopCode,
		Routes:    routes,
		Source:    "lta",
		UpdatedAt: time.Now().UTC(),
	}
}

func normalizeLTATrainAlerts(raw map[string]any) []SGTrainAlert {
	now := time.Now().UTC()
	statusItems := firstArray(raw, "value", "Status")
	alerts := make([]SGTrainAlert, 0, len(statusItems))
	for _, item := range statusItems {
		line := firstString(item, "Line", "LineCode")
		status := firstString(item, "Status")
		if line == "" && status == "" {
			continue
		}
		alerts = append(alerts, SGTrainAlert{
			Line:      line,
			Status:    firstNonEmpty(status, "Unknown"),
			Message:   firstString(item, "Message", "Description"),
			Source:    "lta",
			UpdatedAt: now,
		})
	}
	if len(alerts) == 0 {
		alerts = append(alerts, SGTrainAlert{
			Line:      "MRT/LRT",
			Status:    "Normal",
			Message:   "No train disruption alert returned by LTA DataMall.",
			Source:    "lta",
			UpdatedAt: now,
		})
	}
	return alerts
}

func normalizeLTALoad(value string) string {
	switch strings.ToUpper(strings.TrimSpace(value)) {
	case "SEA":
		return "low"
	case "SDA":
		return "medium"
	case "LSD":
		return "high"
	default:
		return ""
	}
}

func arrivalMinutesFromTimestamps(values ...string) []int {
	minutes := make([]int, 0, len(values))
	now := time.Now()
	for _, value := range values {
		value = strings.TrimSpace(value)
		if value == "" {
			continue
		}
		parsed, err := time.Parse(time.RFC3339, value)
		if err != nil {
			continue
		}
		diff := int(parsed.Sub(now).Minutes() + 0.5)
		if diff < 0 {
			diff = 0
		}
		minutes = append(minutes, diff)
	}
	return minutes
}

func demoSingaporeBusStops() []BusStop {
	now := time.Now().UTC()
	return []BusStop{
		{Code: "16009", Name: "Kent Ridge Stn Exit A/NUH", Latitude: 1.29355, Longitude: 103.78424, Source: "demo-lta", UpdatedAt: now},
		{Code: "16189", Name: "Opp Yusof Ishak Hse", Latitude: 1.2988, Longitude: 103.77442, Source: "demo-lta", UpdatedAt: now},
		{Code: "17099", Name: "Utown", Latitude: 1.30502, Longitude: 103.77383, Source: "demo-lta", UpdatedAt: now},
		{Code: "18121", Name: "Aft Clementi Rd", Latitude: 1.30048, Longitude: 103.77085, Source: "demo-lta", UpdatedAt: now},
	}
}

func demoSingaporeBusArrival(stopCode string) BusArrival {
	now := time.Now().UTC()
	return BusArrival{
		StopCode:  stopCode,
		StopName:  stopCode,
		Source:    "demo-lta",
		UpdatedAt: now,
		Routes: []BusArrivalRoute{
			{RouteCode: "95", ArrivalTime: "3", NextArrivalTime: "11", ArrivalMinutes: []int{3, 11}, CrowdLevel: "medium"},
			{RouteCode: "96", ArrivalTime: "5", NextArrivalTime: "14", ArrivalMinutes: []int{5, 14}, CrowdLevel: "low"},
		},
	}
}

func demoTrainAlerts() []SGTrainAlert {
	return []SGTrainAlert{
		{Line: "MRT/LRT", Status: "Demo", Message: "Set LTA_ACCOUNT_KEY for live train service alerts. LTA does not provide real-time train arrival ETAs.", Source: "demo-lta", UpdatedAt: time.Now().UTC()},
	}
}
