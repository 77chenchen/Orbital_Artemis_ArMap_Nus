package atlas

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
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
	RouteCode   string      `json:"routeCode,omitempty"`
	RouteName   string      `json:"routeName,omitempty"`
	Distance    float64     `json:"distance"`
	Duration    float64     `json:"duration"`
	From        string      `json:"from,omitempty"`
	To          string      `json:"to,omitempty"`
	Coordinates [][]float64 `json:"coordinates"`
}

const otpTripQuery = `
query Route($from: Location!, $to: Location!, $modes: Modes!) {
  trip(from: $from, to: $to, modes: $modes, numTripPatterns: 3) {
    routingErrors {
      code
      description
    }
    tripPatterns {
      duration
      streetDistance
      walkTime
      legs {
        mode
        distance
        duration
        line {
          publicCode
          name
        }
        fromPlace {
          name
          latitude
          longitude
        }
        toPlace {
          name
          latitude
          longitude
        }
        pointsOnLink {
          points
          length
          distance
        }
      }
    }
  }
}
`

const otpTripQueryWithoutLine = `
query Route($from: Location!, $to: Location!, $modes: Modes!) {
  trip(from: $from, to: $to, modes: $modes, numTripPatterns: 3) {
    routingErrors {
      code
      description
    }
    tripPatterns {
      duration
      streetDistance
      walkTime
      legs {
        mode
        distance
        duration
        fromPlace {
          name
          latitude
          longitude
        }
        toPlace {
          name
          latitude
          longitude
        }
        pointsOnLink {
          points
          length
          distance
        }
      }
    }
  }
}
`

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
		writeError(w, http.StatusServiceUnavailable, errors.New("OTP_BASE_URL is required for route planning"))
		return
	}

	raw, err := api.queryOTPGraphQL(r, fromPlace, toPlace, mode)
	if err != nil {
		writeError(w, http.StatusBadGateway, err)
		return
	}
	response := normalizeOTPTrip(raw, mode)
	if !hasDrawableOTPRoute(response) && wantsTransit(mode) {
		walkRaw, walkErr := api.queryOTPGraphQL(r, fromPlace, toPlace, "WALK")
		if walkErr == nil {
			walkResponse := normalizeOTPTrip(walkRaw, "WALK")
			if hasDrawableOTPRoute(walkResponse) {
				walkResponse.Source = "otp-graphql-walk-fallback"
				writeJSON(w, http.StatusOK, walkResponse)
				return
			}
		}
	}
	writeJSON(w, http.StatusOK, response)
}

func (api *API) queryOTPGraphQL(r *http.Request, fromPlace string, toPlace string, mode string) (map[string]any, error) {
	from, err := parseOTPPlace(fromPlace)
	if err != nil {
		return nil, err
	}
	to, err := parseOTPPlace(toPlace)
	if err != nil {
		return nil, err
	}

	raw, err := api.executeOTPGraphQL(r, from, to, mode, otpTripQuery)
	if err != nil && strings.Contains(strings.ToLower(err.Error()), "line") {
		return api.executeOTPGraphQL(r, from, to, mode, otpTripQueryWithoutLine)
	}
	return raw, err
}

func (api *API) executeOTPGraphQL(r *http.Request, from otpPlace, to otpPlace, mode string, query string) (map[string]any, error) {
	body := map[string]any{
		"query": query,
		"variables": map[string]any{
			"from": map[string]any{
				"name": "Start",
				"coordinates": map[string]float64{
					"latitude":  from.lat,
					"longitude": from.lng,
				},
			},
			"to": map[string]any{
				"name": "Destination",
				"coordinates": map[string]float64{
					"latitude":  to.lat,
					"longitude": to.lng,
				},
			},
			"modes": otpModes(mode),
		},
	}
	encoded, err := json.Marshal(body)
	if err != nil {
		return nil, err
	}

	req, err := http.NewRequestWithContext(r.Context(), http.MethodPost, api.otpGraphQLEndpoint(), bytes.NewReader(encoded))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: api.cfg.HTTPClientTimeout}
	if client.Timeout <= 0 {
		client.Timeout = 10 * time.Second
	}
	res, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("otp request failed: %w", err)
	}
	defer res.Body.Close()

	var raw map[string]any
	if err := json.NewDecoder(res.Body).Decode(&raw); err != nil {
		return nil, fmt.Errorf("invalid otp response: %w", err)
	}
	if res.StatusCode < 200 || res.StatusCode >= 300 {
		return nil, fmt.Errorf("otp returned status %d", res.StatusCode)
	}
	if errorsValue, ok := raw["errors"]; ok {
		return nil, fmt.Errorf("otp graphql error: %v", errorsValue)
	}
	return raw, nil
}

func (api *API) otpGraphQLEndpoint() string {
	base := strings.TrimRight(api.cfg.OTPBaseURL, "/")
	if strings.Contains(base, "/graphql") {
		return base
	}
	if strings.HasSuffix(base, "/otp") {
		return base + "/routers/default/transmodel/index/graphql"
	}
	return base + "/transmodel/index/graphql"
}

func normalizeOTPTrip(raw map[string]any, fallbackMode string) otpPlanResponse {
	data, _ := raw["data"].(map[string]any)
	trip, _ := data["trip"].(map[string]any)
	rawPatterns, _ := trip["tripPatterns"].([]any)
	response := otpPlanResponse{
		Source: "otp-graphql",
		Mode:   fallbackMode,
		Raw:    raw,
	}
	for _, item := range rawPatterns {
		rawPattern, _ := item.(map[string]any)
		itinerary := otpItinerary{
			Duration: numberValue(rawPattern["duration"]),
			WalkTime: numberValue(rawPattern["walkTime"]),
		}
		rawLegs, _ := rawPattern["legs"].([]any)
		for _, rawLegItem := range rawLegs {
			rawLeg, _ := rawLegItem.(map[string]any)
			segment := normalizeOTPGraphQLLeg(rawLeg)
			if len(segment.Coordinates) < 2 {
				continue
			}
			if segment.Mode != "FOOT" && segment.Mode != "WALK" {
				itinerary.Transit = true
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

func hasDrawableOTPRoute(response otpPlanResponse) bool {
	for _, segment := range response.Segments {
		if len(segment.Coordinates) >= 2 {
			return true
		}
	}
	return len(response.Points) >= 2
}

func normalizeOTPGraphQLLeg(raw map[string]any) otpSegment {
	mode := strings.ToUpper(strings.TrimSpace(stringValue(raw["mode"])))
	if mode == "FOOT" {
		mode = "WALK"
	}
	segment := otpSegment{
		Mode:      mode,
		RouteCode: lineValue(raw["line"], "publicCode"),
		RouteName: lineValue(raw["line"], "name"),
		Distance:  numberValue(raw["distance"]),
		Duration:  numberValue(raw["duration"]),
		From:      placeName(raw["fromPlace"]),
		To:        placeName(raw["toPlace"]),
	}
	if link, _ := raw["pointsOnLink"].(map[string]any); link != nil {
		segment.Coordinates = decodePolyline(stringValue(link["points"]))
	}
	segment.Coordinates = append(placeCoordinates(raw["fromPlace"]), segment.Coordinates...)
	segment.Coordinates = append(segment.Coordinates, placeCoordinates(raw["toPlace"])...)
	return dedupeCoordinates(segment)
}

func normalizeOTPLeg(raw map[string]any) otpSegment {
	mode := strings.ToUpper(strings.TrimSpace(stringValue(raw["mode"])))
	segment := otpSegment{
		Mode:      mode,
		RouteCode: firstNonEmpty(stringValue(raw["routeShortName"]), stringValue(raw["route"])),
		RouteName: firstNonEmpty(stringValue(raw["routeLongName"]), stringValue(raw["agencyName"])),
		Distance:  numberValue(raw["distance"]),
		Duration:  numberValue(raw["duration"]),
		From:      placeName(raw["from"]),
		To:        placeName(raw["to"]),
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

type otpPlace struct {
	lat float64
	lng float64
}

func parseOTPPlace(raw string) (otpPlace, error) {
	parts := strings.Split(raw, ",")
	if len(parts) != 2 {
		return otpPlace{}, errors.New("places must use lat,lng format")
	}
	lat := parseFloat(strings.TrimSpace(parts[0]), 0)
	lng := parseFloat(strings.TrimSpace(parts[1]), 0)
	if lat == 0 || lng == 0 {
		return otpPlace{}, errors.New("places must contain valid coordinates")
	}
	return otpPlace{lat: lat, lng: lng}, nil
}

func otpModes(mode string) map[string]any {
	modes := map[string]any{}
	if wantsTransit(mode) {
		modes["accessMode"] = "foot"
		modes["egressMode"] = "foot"
		modes["transportModes"] = []map[string]string{
			{"transportMode": "bus"},
			{"transportMode": "rail"},
			{"transportMode": "metro"},
			{"transportMode": "tram"},
		}
		return modes
	}
	modes["directMode"] = directOTPMode(mode)
	modes["transportModes"] = []map[string]string{}
	return modes
}

func directOTPMode(mode string) string {
	upperMode := strings.ToUpper(mode)
	switch {
	case strings.Contains(upperMode, "CAR") || strings.Contains(upperMode, "DRIVE"):
		return "car"
	case strings.Contains(upperMode, "BICYCLE") || strings.Contains(upperMode, "BIKE") || strings.Contains(upperMode, "CYCLE"):
		return "bicycle"
	default:
		return "foot"
	}
}

func wantsTransit(mode string) bool {
	upperMode := strings.ToUpper(mode)
	return strings.Contains(upperMode, "TRANSIT") ||
		strings.Contains(upperMode, "BUS") ||
		strings.Contains(upperMode, "RAIL") ||
		strings.Contains(upperMode, "METRO") ||
		strings.Contains(upperMode, "SUBWAY") ||
		strings.Contains(upperMode, "TRAM")
}

func decodePolyline(encoded string) [][]float64 {
	coordinates := [][]float64{}
	var lat int
	var lng int
	for index := 0; index < len(encoded); {
		deltaLat, next := decodePolylineValue(encoded, index)
		if next <= index {
			break
		}
		index = next
		deltaLng, next := decodePolylineValue(encoded, index)
		if next <= index {
			break
		}
		index = next
		lat += deltaLat
		lng += deltaLng
		coordinates = append(coordinates, []float64{float64(lng) / 1e5, float64(lat) / 1e5})
	}
	return coordinates
}

func decodePolylineValue(encoded string, index int) (int, int) {
	var result int
	var shift uint
	for index < len(encoded) {
		value := int(encoded[index]) - 63
		index++
		result |= (value & 0x1f) << shift
		shift += 5
		if value < 0x20 {
			break
		}
	}
	if result&1 != 0 {
		return ^(result >> 1), index
	}
	return result >> 1, index
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

func lineValue(value any, key string) string {
	line, _ := value.(map[string]any)
	return stringValue(line[key])
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
