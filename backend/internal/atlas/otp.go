package atlas

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"
)

type otpPlanResponse struct {
	Source      string         `json:"source"`
	Mode        string         `json:"mode"`
	Distance    float64        `json:"distance"`
	Duration    int64          `json:"duration"`
	Points      [][]float64    `json:"points"`
	Segments    []otpSegment   `json:"segments"`
	Itineraries []otpItinerary `json:"itineraries"`
	Raw         map[string]any `json:"raw,omitempty"`
}

type otpItinerary struct {
	Duration float64      `json:"duration"`
	WalkTime float64      `json:"walkTime"`
	Transit  bool         `json:"transit"`
	Legs     []otpSegment `json:"legs"`
}

type otpSegment struct {
	Mode        string      `json:"mode"`
	Distance    float64     `json:"distance"`
	Duration    float64     `json:"duration"`
	From        string      `json:"from,omitempty"`
	To          string      `json:"to,omitempty"`
	Coordinates [][]float64 `json:"coordinates"`
}

func (api *API) otpPlan(w http.ResponseWriter, r *http.Request) {
	query := r.URL.Query()
	fromPlace := strings.TrimSpace(query.Get("fromPlace"))
	toPlace := strings.TrimSpace(query.Get("toPlace"))
	mode := strings.TrimSpace(query.Get("mode"))
	if mode == "" {
		mode = "WALK,TRANSIT"
	}
	if fromPlace == "" || toPlace == "" {
		writeError(w, http.StatusBadRequest, errors.New("fromPlace and toPlace are required"))
		return
	}

	if strings.TrimSpace(api.cfg.OTPBaseURL) == "" {
		writeJSON(w, http.StatusOK, demoOTPPlan(fromPlace, toPlace, mode))
		return
	}

	planURL, err := api.buildOTPPlanURL(query)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err)
		return
	}

	req, err := http.NewRequestWithContext(r.Context(), http.MethodGet, planURL, nil)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err)
		return
	}
	client := &http.Client{Timeout: api.cfg.HTTPClientTimeout}
	if client.Timeout <= 0 {
		client.Timeout = 10 * time.Second
	}
	res, err := client.Do(req)
	if err != nil {
		writeError(w, http.StatusBadGateway, fmt.Errorf("otp request failed: %w", err))
		return
	}
	defer res.Body.Close()

	var raw map[string]any
	if err := json.NewDecoder(res.Body).Decode(&raw); err != nil {
		writeError(w, http.StatusBadGateway, fmt.Errorf("invalid otp response: %w", err))
		return
	}
	if res.StatusCode < 200 || res.StatusCode >= 300 {
		writeJSON(w, http.StatusBadGateway, map[string]any{
			"error":  "otp returned an error",
			"status": res.StatusCode,
			"raw":    raw,
		})
		return
	}

	writeJSON(w, http.StatusOK, normalizeOTPPlan(raw, mode))
}

func (api *API) buildOTPPlanURL(source url.Values) (string, error) {
	base, err := url.Parse(strings.TrimRight(api.cfg.OTPBaseURL, "/") + "/plan")
	if err != nil {
		return "", err
	}
	q := url.Values{}
	for key, values := range source {
		for _, value := range values {
			q.Add(key, value)
		}
	}
	if q.Get("numItineraries") == "" {
		q.Set("numItineraries", "3")
	}
	if q.Get("showIntermediateStops") == "" {
		q.Set("showIntermediateStops", "true")
	}
	base.RawQuery = q.Encode()
	return base.String(), nil
}

func normalizeOTPPlan(raw map[string]any, fallbackMode string) otpPlanResponse {
	plan, _ := raw["plan"].(map[string]any)
	rawItineraries, _ := plan["itineraries"].([]any)
	response := otpPlanResponse{
		Source: "otp",
		Mode:   fallbackMode,
		Raw:    raw,
	}
	for _, item := range rawItineraries {
		rawItinerary, _ := item.(map[string]any)
		itinerary := otpItinerary{
			Duration: numberValue(rawItinerary["duration"]),
			WalkTime: numberValue(rawItinerary["walkTime"]),
			Transit:  boolValue(rawItinerary["transit"]),
		}
		rawLegs, _ := rawItinerary["legs"].([]any)
		for _, rawLegItem := range rawLegs {
			rawLeg, _ := rawLegItem.(map[string]any)
			segment := normalizeOTPLeg(rawLeg)
			if len(segment.Coordinates) < 2 {
				continue
			}
			itinerary.Legs = append(itinerary.Legs, segment)
		}
		if len(itinerary.Legs) == 0 {
			continue
		}
		response.Itineraries = append(response.Itineraries, itinerary)
	}
	if len(response.Itineraries) > 0 {
		first := response.Itineraries[0]
		response.Duration = int64(first.Duration)
		response.Segments = first.Legs
		for _, segment := range first.Legs {
			response.Distance += segment.Distance
			response.Points = append(response.Points, segment.Coordinates...)
		}
	}
	return response
}

func normalizeOTPLeg(raw map[string]any) otpSegment {
	mode := strings.ToUpper(strings.TrimSpace(stringValue(raw["mode"])))
	segment := otpSegment{
		Mode:     mode,
		Distance: numberValue(raw["distance"]),
		Duration: numberValue(raw["duration"]),
		From:     placeName(raw["from"]),
		To:       placeName(raw["to"]),
	}
	segment.Coordinates = append(segment.Coordinates, placeCoordinates(raw["from"])...)
	if coordinates := geometryCoordinates(raw["geometry"]); len(coordinates) > 0 {
		segment.Coordinates = coordinates
	}
	if coordinates := geometryCoordinates(raw["legGeometry"]); len(coordinates) > 0 {
		segment.Coordinates = coordinates
	}
	segment.Coordinates = append(segment.Coordinates, placeCoordinates(raw["to"])...)
	return dedupeCoordinates(segment)
}

func demoOTPPlan(fromPlace string, toPlace string, mode string) otpPlanResponse {
	from := parsePlaceCoordinate(fromPlace)
	to := parsePlaceCoordinate(toPlace)
	segmentMode := "WALK"
	if strings.Contains(strings.ToUpper(mode), "BUS") || strings.Contains(strings.ToUpper(mode), "TRANSIT") {
		segmentMode = "BUS"
	}
	mid := []float64{(from[0] + to[0]) / 2, (from[1] + to[1]) / 2}
	segments := []otpSegment{
		{
			Mode:        "WALK",
			Distance:    120,
			Duration:    180,
			From:        "Start",
			To:          "Campus transfer",
			Coordinates: [][]float64{from, mid},
		},
		{
			Mode:        segmentMode,
			Distance:    640,
			Duration:    420,
			From:        "Campus transfer",
			To:          "Destination",
			Coordinates: [][]float64{mid, to},
		},
	}
	points := [][]float64{}
	for _, segment := range segments {
		points = append(points, segment.Coordinates...)
	}
	return otpPlanResponse{
		Source:   "demo-otp",
		Mode:     mode,
		Distance: 760,
		Duration: 600,
		Points:   points,
		Segments: segments,
		Itineraries: []otpItinerary{
			{Duration: 600, WalkTime: 180, Transit: segmentMode != "WALK", Legs: segments},
		},
	}
}

func parsePlaceCoordinate(raw string) []float64 {
	parts := strings.Split(raw, ",")
	if len(parts) != 2 {
		return []float64{103.7739, 1.2948}
	}
	lat := parseFloat(strings.TrimSpace(parts[0]), 1.2948)
	lng := parseFloat(strings.TrimSpace(parts[1]), 103.7739)
	return []float64{lng, lat}
}

func placeCoordinates(value any) [][]float64 {
	place, _ := value.(map[string]any)
	lon, hasLon := numericPlaceValue(place, "lon", "lng", "longitude")
	lat, hasLat := numericPlaceValue(place, "lat", "latitude")
	if !hasLon || !hasLat {
		return nil
	}
	return [][]float64{{lon, lat}}
}

func geometryCoordinates(value any) [][]float64 {
	geometry, _ := value.(map[string]any)
	rawCoordinates, _ := geometry["coordinates"].([]any)
	coordinates := make([][]float64, 0, len(rawCoordinates))
	for _, rawCoord := range rawCoordinates {
		coord, _ := rawCoord.([]any)
		if len(coord) < 2 {
			continue
		}
		coordinates = append(coordinates, []float64{numberValue(coord[0]), numberValue(coord[1])})
	}
	return coordinates
}

func dedupeCoordinates(segment otpSegment) otpSegment {
	if len(segment.Coordinates) < 2 {
		return segment
	}
	coordinates := make([][]float64, 0, len(segment.Coordinates))
	for _, coord := range segment.Coordinates {
		if len(coordinates) > 0 {
			last := coordinates[len(coordinates)-1]
			if last[0] == coord[0] && last[1] == coord[1] {
				continue
			}
		}
		coordinates = append(coordinates, coord)
	}
	segment.Coordinates = coordinates
	return segment
}

func placeName(value any) string {
	place, _ := value.(map[string]any)
	return stringValue(place["name"])
}

func numericPlaceValue(place map[string]any, keys ...string) (float64, bool) {
	for _, key := range keys {
		if value, ok := place[key]; ok {
			return numberValue(value), true
		}
	}
	return 0, false
}

func stringValue(value any) string {
	text, _ := value.(string)
	return text
}

func numberValue(value any) float64 {
	switch typed := value.(type) {
	case float64:
		return typed
	case float32:
		return float64(typed)
	case int:
		return float64(typed)
	case int64:
		return float64(typed)
	case json.Number:
		parsed, _ := typed.Float64()
		return parsed
	default:
		return 0
	}
}

func boolValue(value any) bool {
	typed, _ := value.(bool)
	return typed
}
