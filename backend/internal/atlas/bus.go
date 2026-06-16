package atlas

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"
)

var errNUSBusNotConfigured = errors.New("nus bus credentials are not configured")

type NUSBusClient struct {
	cfg    Config
	client *http.Client

	mu          sync.Mutex
	token       string
	tokenExpiry time.Time
	cache       map[string]busCacheEntry
}

type busCacheEntry struct {
	expiresAt time.Time
	data      []byte
}

type BusStop struct {
	Code      string    `json:"code"`
	Name      string    `json:"name"`
	Latitude  float64   `json:"latitude"`
	Longitude float64   `json:"longitude"`
	Source    string    `json:"source"`
	UpdatedAt time.Time `json:"updatedAt"`
}

type BusRoute struct {
	Code        string `json:"code"`
	Name        string `json:"name"`
	Color       string `json:"color"`
	Description string `json:"description"`
}

type BusPickupPoint struct {
	RouteCode  string    `json:"routeCode"`
	RouteID    int       `json:"routeId,omitempty"`
	Seq        int       `json:"seq"`
	StopCode   string    `json:"stopCode"`
	LongName   string    `json:"longName"`
	ShortName  string    `json:"shortName"`
	PickupName string    `json:"pickupName"`
	Latitude   float64   `json:"latitude"`
	Longitude  float64   `json:"longitude"`
	Source     string    `json:"source"`
	UpdatedAt  time.Time `json:"updatedAt"`
}

type BusArrival struct {
	StopCode  string            `json:"stopCode"`
	StopName  string            `json:"stopName"`
	Routes    []BusArrivalRoute `json:"routes"`
	Source    string            `json:"source"`
	UpdatedAt time.Time         `json:"updatedAt"`
}

type BusArrivalRoute struct {
	RouteCode          string `json:"routeCode"`
	ArrivalTime        string `json:"arrivalTime,omitempty"`
	NextArrivalTime    string `json:"nextArrivalTime,omitempty"`
	ArrivalTimeAt      string `json:"arrivalTimeAt,omitempty"`
	NextArrivalTimeAt  string `json:"nextArrivalTimeAt,omitempty"`
	ArrivalMinutes     []int  `json:"arrivalMinutes"`
	CrowdLevel         string `json:"crowdLevel,omitempty"`
	VehiclePlate       string `json:"vehiclePlate,omitempty"`
	NextArrivalVehicle string `json:"nextArrivalVehicle,omitempty"`
}

type ActiveBusResponse struct {
	RouteCode string       `json:"routeCode"`
	Vehicles  []BusVehicle `json:"vehicles"`
	Source    string       `json:"source"`
	UpdatedAt time.Time    `json:"updatedAt"`
}

type BusVehicle struct {
	Plate      string  `json:"plate"`
	Latitude   float64 `json:"latitude"`
	Longitude  float64 `json:"longitude"`
	CrowdLevel string  `json:"crowdLevel,omitempty"`
	Occupancy  float64 `json:"occupancy,omitempty"`
	Speed      float64 `json:"speed,omitempty"`
}

type BusAlert struct {
	Title     string    `json:"title"`
	Message   string    `json:"message"`
	Priority  string    `json:"priority,omitempty"`
	Source    string    `json:"source"`
	UpdatedAt time.Time `json:"updatedAt"`
}

type BusContext struct {
	UserLocation LatLng           `json:"userLocation"`
	NearbyStops  []BusContextStop `json:"nearbyStops"`
	Alerts       []BusAlert       `json:"alerts"`
	Suggestions  []string         `json:"suggestions"`
	Source       string           `json:"source"`
	UpdatedAt    time.Time        `json:"updatedAt"`
}

type LatLng struct {
	Latitude  float64 `json:"latitude"`
	Longitude float64 `json:"longitude"`
}

type BusContextStop struct {
	BusStop
	DistanceM float64           `json:"distanceM"`
	Arrivals  []BusArrivalRoute `json:"arrivals"`
}

func NewNUSBusClient(cfg Config) *NUSBusClient {
	timeout := cfg.HTTPClientTimeout
	if timeout <= 0 {
		timeout = 10 * time.Second
	}
	return &NUSBusClient{
		cfg:    cfg,
		client: &http.Client{Timeout: timeout},
		cache:  make(map[string]busCacheEntry),
	}
}

func (c *NUSBusClient) Configured() bool {
	return c.cfg.NUSBusXHTDAPI != "" && c.cfg.NUSBusXAPPAPI != ""
}

func (c *NUSBusClient) Stops(ctx context.Context) ([]BusStop, error) {
	if !c.Configured() {
		return demoBusStops(), nil
	}
	var raw map[string]any
	if err := c.getBusJSON(ctx, "/BusStops", nil, 24*time.Hour, &raw); err != nil {
		return nil, err
	}
	stops := normalizeBusStops(raw)
	if len(stops) == 0 {
		return nil, errors.New("nus bus returned no stops")
	}
	return stops, nil
}

func (c *NUSBusClient) Routes(ctx context.Context) ([]BusRoute, error) {
	if !c.Configured() {
		return demoBusRoutes(), nil
	}
	var raw map[string]any
	if err := c.getBusJSON(ctx, "/ServiceDescription", nil, 24*time.Hour, &raw); err != nil {
		return nil, err
	}
	routes := normalizeBusRoutes(raw)
	if len(routes) == 0 {
		return nil, errors.New("nus bus returned no routes")
	}
	return routes, nil
}

func (c *NUSBusClient) PickupPoints(ctx context.Context, routeCode string) ([]BusPickupPoint, error) {
	routeCode = strings.ToUpper(strings.TrimSpace(routeCode))
	if routeCode == "" {
		return nil, errors.New("missing route")
	}
	if !c.Configured() {
		return demoBusPickupPoints(routeCode), nil
	}
	var raw map[string]any
	if err := c.getBusJSON(ctx, "/PickupPoint", url.Values{"route_code": {routeCode}}, 10*time.Minute, &raw); err != nil {
		return nil, err
	}
	points := normalizeBusPickupPoints(routeCode, raw)
	if len(points) == 0 {
		return nil, errors.New("nus bus returned no pickup points")
	}
	return points, nil
}

func (c *NUSBusClient) Arrivals(ctx context.Context, stopCode string) (BusArrival, error) {
	stopCode = strings.ToUpper(strings.TrimSpace(stopCode))
	if stopCode == "" {
		return BusArrival{}, errors.New("missing stop")
	}
	if !c.Configured() {
		return demoBusArrival(stopCode), nil
	}
	var raw map[string]any
	if err := c.getBusJSON(ctx, "/ShuttleService", url.Values{"busstopname": {stopCode}}, 20*time.Second, &raw); err != nil {
		return BusArrival{}, err
	}
	arrival := normalizeBusArrival(stopCode, raw)
	if arrival.StopCode == "" {
		return BusArrival{}, errors.New("nus bus returned no arrival data")
	}
	return arrival, nil
}

func (c *NUSBusClient) ActiveBus(ctx context.Context, routeCode string) (ActiveBusResponse, error) {
	routeCode = strings.ToUpper(strings.TrimSpace(routeCode))
	if routeCode == "" {
		return ActiveBusResponse{}, errors.New("missing route")
	}
	if !c.Configured() {
		return demoActiveBus(routeCode), nil
	}
	var raw map[string]any
	if err := c.getBusJSON(ctx, "/ActiveBus", url.Values{"route_code": {routeCode}}, 10*time.Second, &raw); err != nil {
		return ActiveBusResponse{}, err
	}
	response := normalizeActiveBus(routeCode, raw)
	return response, nil
}

func (c *NUSBusClient) Alerts(ctx context.Context) ([]BusAlert, error) {
	if !c.Configured() {
		return demoBusAlerts(), nil
	}
	var announcements map[string]any
	var tickers map[string]any
	annErr := c.getBusJSON(ctx, "/Announcements", nil, 5*time.Minute, &announcements)
	tickerErr := c.getBusJSON(ctx, "/TickerTapes", nil, 5*time.Minute, &tickers)
	if annErr != nil && tickerErr != nil {
		return nil, annErr
	}
	alerts := append(normalizeBusAlerts(announcements), normalizeBusAlerts(tickers)...)
	return alerts, nil
}

func (c *NUSBusClient) Context(ctx context.Context, lat, lng float64) (BusContext, error) {
	stops, err := c.Stops(ctx)
	if err != nil {
		return BusContext{}, err
	}
	sort.Slice(stops, func(i, j int) bool {
		return distanceMeters(lat, lng, stops[i].Latitude, stops[i].Longitude) < distanceMeters(lat, lng, stops[j].Latitude, stops[j].Longitude)
	})
	if len(stops) > 3 {
		stops = stops[:3]
	}
	contextStops := make([]BusContextStop, 0, len(stops))
	for _, stop := range stops {
		arrival, err := c.Arrivals(ctx, stop.Code)
		var arrivals []BusArrivalRoute
		if err == nil {
			arrivals = arrival.Routes
			if len(arrivals) > 3 {
				arrivals = arrivals[:3]
			}
		}
		contextStops = append(contextStops, BusContextStop{
			BusStop:   stop,
			DistanceM: distanceMeters(lat, lng, stop.Latitude, stop.Longitude),
			Arrivals:  arrivals,
		})
	}
	alerts, _ := c.Alerts(ctx)
	response := BusContext{
		UserLocation: LatLng{Latitude: lat, Longitude: lng},
		NearbyStops:  contextStops,
		Alerts:       alerts,
		Source:       sourceLabel(c.Configured()),
		UpdatedAt:    time.Now().UTC(),
	}
	if len(contextStops) > 0 {
		response.Suggestions = []string{suggestBusAction(contextStops[0])}
	}
	return response, nil
}

func (c *NUSBusClient) getBusJSON(ctx context.Context, path string, params url.Values, ttl time.Duration, target any) error {
	if params == nil {
		params = url.Values{}
	}
	cacheKey := path + "?" + params.Encode()
	if cached, ok := c.cached(cacheKey); ok {
		return json.Unmarshal(cached, target)
	}
	token, err := c.ensureToken(ctx)
	if err != nil {
		return err
	}
	params.Set("token", token)
	raw, status, err := c.getRaw(ctx, c.cfg.NUSBusAPIBase+path, params)
	if err == nil && status == http.StatusUnauthorized {
		c.clearToken()
		token, err = c.ensureToken(ctx)
		if err != nil {
			return err
		}
		params.Set("token", token)
		raw, status, err = c.getRaw(ctx, c.cfg.NUSBusAPIBase+path, params)
	}
	if err != nil {
		return err
	}
	if status < 200 || status >= 300 {
		return fmt.Errorf("nus bus %s failed with %d: %s", path, status, strings.TrimSpace(string(raw)))
	}
	if err := json.Unmarshal(raw, target); err != nil {
		return fmt.Errorf("decode nus bus %s: %w", path, err)
	}
	c.setCache(cacheKey, raw, ttl)
	return nil
}

func (c *NUSBusClient) ensureToken(ctx context.Context) (string, error) {
	c.mu.Lock()
	if c.token != "" && time.Now().Before(c.tokenExpiry) {
		token := c.token
		c.mu.Unlock()
		return token, nil
	}
	c.mu.Unlock()

	if !c.Configured() {
		return "", errNUSBusNotConfigured
	}

	deviceID := c.cfg.NUSBusDeviceID
	if deviceID == "" {
		deviceID = "atlas-nus-bus-demo-device"
	}
	version := c.cfg.NUSBusVersion
	if version == "" {
		version = "2.56.0"
	}

	var access struct {
		Data struct {
			Token  string `json:"token"`
			UserID string `json:"userid"`
			Domain string `json:"domain"`
		} `json:"data"`
	}
	if err := c.postUnivusJSON(ctx, "/univus-public/mobile/get-access-token", map[string]string{
		"deviceid": deviceID,
		"ipaddr":   "0.0.0.0",
		"version":  version,
	}, &access); err != nil {
		return "", err
	}
	if access.Data.Token == "" || access.Data.UserID == "" {
		return "", errors.New("nus bus access token response is missing token or userid")
	}

	var init struct {
		Data struct {
			Tokens struct {
				NextBusToken2 string `json:"nextbus_token2"`
			} `json:"tokens"`
		} `json:"data"`
	}
	if err := c.postUnivusJSON(ctx, "/univus/mobile/buswidget/get-init-data", map[string]string{
		"deviceid": deviceID,
		"domain":   firstNonEmpty(access.Data.Domain, "PUBLIC"),
		"ipaddr":   "0.0.0.0",
		"token":    access.Data.Token,
		"userid":   access.Data.UserID,
		"version":  version,
	}, &init); err != nil {
		return "", err
	}
	if init.Data.Tokens.NextBusToken2 == "" {
		return "", errors.New("nus bus init response is missing nextbus_token2")
	}

	c.mu.Lock()
	c.token = init.Data.Tokens.NextBusToken2
	c.tokenExpiry = time.Now().Add(20 * time.Hour)
	token := c.token
	c.mu.Unlock()
	return token, nil
}

func (c *NUSBusClient) postUnivusJSON(ctx context.Context, path string, payload any, target any) error {
	body, err := json.Marshal(payload)
	if err != nil {
		return err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.cfg.NUSBusAuthBase+path, bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-HTD-API", c.cfg.NUSBusXHTDAPI)
	req.Header.Set("X-APP-API", c.cfg.NUSBusXAPPAPI)

	res, err := c.client.Do(req)
	if err != nil {
		return err
	}
	defer res.Body.Close()
	raw, _ := io.ReadAll(io.LimitReader(res.Body, 1<<20))
	if res.StatusCode < 200 || res.StatusCode >= 300 {
		return fmt.Errorf("nus bus auth %s failed with %d: %s", path, res.StatusCode, strings.TrimSpace(string(raw)))
	}
	if err := json.Unmarshal(raw, target); err != nil {
		return fmt.Errorf("decode nus bus auth %s: %w", path, err)
	}
	return nil
}

func (c *NUSBusClient) getRaw(ctx context.Context, endpoint string, params url.Values) ([]byte, int, error) {
	reqURL, err := url.Parse(endpoint)
	if err != nil {
		return nil, 0, err
	}
	reqURL.RawQuery = params.Encode()
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, reqURL.String(), nil)
	if err != nil {
		return nil, 0, err
	}
	res, err := c.client.Do(req)
	if err != nil {
		return nil, 0, err
	}
	defer res.Body.Close()
	raw, _ := io.ReadAll(io.LimitReader(res.Body, 1<<20))
	return raw, res.StatusCode, nil
}

func (c *NUSBusClient) cached(key string) ([]byte, bool) {
	c.mu.Lock()
	defer c.mu.Unlock()
	entry, ok := c.cache[key]
	if !ok || time.Now().After(entry.expiresAt) {
		return nil, false
	}
	return entry.data, true
}

func (c *NUSBusClient) setCache(key string, data []byte, ttl time.Duration) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.cache[key] = busCacheEntry{expiresAt: time.Now().Add(ttl), data: data}
}

func (c *NUSBusClient) clearToken() {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.token = ""
	c.tokenExpiry = time.Time{}
}

func normalizeBusStops(raw map[string]any) []BusStop {
	items := firstArray(raw, "BusStopsResult", "busstops", "BusStops", "stops")
	stops := make([]BusStop, 0, len(items))
	for _, item := range items {
		code := strings.ToUpper(firstString(item, "name", "Name", "busstopname", "busStopName", "code", "id"))
		name := firstNonEmpty(firstString(item, "caption", "Caption", "longname", "LongName", "description"), code)
		lat := firstFloat(item, "lat", "latitude", "Latitude")
		lng := firstFloat(item, "lng", "lon", "long", "longitude", "Longitude")
		if fallback, ok := knownBusStopCoords[code]; ok {
			if lat == 0 {
				lat = fallback.Latitude
			}
			if lng == 0 {
				lng = fallback.Longitude
			}
		}
		if code == "" || lat == 0 || lng == 0 {
			continue
		}
		stops = append(stops, BusStop{
			Code: code, Name: name, Latitude: lat, Longitude: lng,
			Source: "nus", UpdatedAt: time.Now().UTC(),
		})
	}
	return stops
}

func normalizeBusRoutes(raw map[string]any) []BusRoute {
	items := firstArray(raw, "ServiceDescriptionResult", "ServiceDescription", "services", "routes")
	routes := make([]BusRoute, 0, len(items))
	for _, item := range items {
		code := strings.ToUpper(firstString(item, "name", "Name", "route_code", "routeCode", "serviceName", "ServiceName"))
		if code == "" {
			continue
		}
		routes = append(routes, BusRoute{
			Code:        code,
			Name:        firstNonEmpty(firstString(item, "caption", "Caption", "longname", "LongName"), code),
			Color:       normalizeHexColor(firstString(item, "color", "COLOR_CODE", "colour")),
			Description: firstString(item, "description", "Description", "route_desc", "RouteDesc"),
		})
	}
	if len(routes) == 0 {
		return demoBusRoutes()
	}
	return routes
}

func normalizeBusPickupPoints(routeCode string, raw map[string]any) []BusPickupPoint {
	items := firstArray(raw, "PickupPointResult", "pickuppoint", "PickupPoint", "pickupPoints", "stops")
	points := make([]BusPickupPoint, 0, len(items))
	now := time.Now().UTC()
	for _, item := range items {
		stopCode := strings.ToUpper(firstString(item, "busstopcode", "busStopCode", "code", "name", "ShortName"))
		point := BusPickupPoint{
			RouteCode:  routeCode,
			RouteID:    firstInt(item, "routeid", "routeId"),
			Seq:        firstInt(item, "seq", "sequence"),
			StopCode:   stopCode,
			LongName:   firstString(item, "LongName", "longName"),
			ShortName:  firstString(item, "ShortName", "shortName"),
			PickupName: firstString(item, "pickupname", "pickupName", "name"),
			Latitude:   firstFloat(item, "lat", "latitude", "Latitude"),
			Longitude:  firstFloat(item, "lng", "lon", "longitude", "Longitude"),
			Source:     "nus",
			UpdatedAt:  now,
		}
		if point.PickupName == "" {
			point.PickupName = firstNonEmpty(point.LongName, point.ShortName, point.StopCode)
		}
		if point.StopCode == "" {
			point.StopCode = strings.ToUpper(firstNonEmpty(point.ShortName, point.PickupName))
		}
		if fallback, ok := knownBusStopCoords[point.StopCode]; ok {
			if point.Latitude == 0 {
				point.Latitude = fallback.Latitude
			}
			if point.Longitude == 0 {
				point.Longitude = fallback.Longitude
			}
		}
		if point.Latitude == 0 || point.Longitude == 0 {
			continue
		}
		points = append(points, point)
	}
	sort.Slice(points, func(i, j int) bool {
		return points[i].Seq < points[j].Seq
	})
	return points
}

func normalizeBusArrival(stopCode string, raw map[string]any) BusArrival {
	result := firstMap(raw, "ShuttleServiceResult")
	stopName := firstNonEmpty(firstString(result, "caption", "name"), stopCode)
	items := firstArray(result, "shuttles", "Shuttles")
	routes := make([]BusArrivalRoute, 0, len(items))
	for _, item := range items {
		etas := firstArray(item, "_etas", "etas")
		route := BusArrivalRoute{
			RouteCode:          strings.ToUpper(firstString(item, "name", "Name", "route_code", "routeCode")),
			ArrivalTime:        firstString(item, "arrivalTime"),
			NextArrivalTime:    firstString(item, "nextArrivalTime"),
			ArrivalTimeAt:      etaTimestamp(etas, 0),
			NextArrivalTimeAt:  etaTimestamp(etas, 1),
			CrowdLevel:         normalizeCrowd(firstString(item, "passengers", "nextPassengers", "crowdLevel")),
			VehiclePlate:       firstString(item, "arrivalTime_veh_plate", "vehiclePlate", "plate"),
			NextArrivalVehicle: firstString(item, "nextArrivalTime_veh_plate"),
		}
		route.ArrivalMinutes = compactMinutes(route.ArrivalTime, route.NextArrivalTime)
		if route.RouteCode != "" {
			routes = append(routes, route)
		}
	}
	return BusArrival{
		StopCode:  stopCode,
		StopName:  stopName,
		Routes:    routes,
		Source:    "nus",
		UpdatedAt: time.Now().UTC(),
	}
}

func normalizeActiveBus(routeCode string, raw map[string]any) ActiveBusResponse {
	items := firstArray(raw, "ActiveBusResult", "activebus", "ActiveBus", "vehicles")
	vehicles := make([]BusVehicle, 0, len(items))
	for _, item := range items {
		load := firstMap(item, "loadInfo")
		vehicle := BusVehicle{
			Plate:      firstString(item, "vehplate", "plate", "vehiclePlate"),
			Latitude:   firstFloat(item, "lat", "latitude"),
			Longitude:  firstFloat(item, "lng", "lon", "longitude"),
			CrowdLevel: normalizeCrowd(firstString(load, "crowdLevel")),
			Occupancy:  firstFloat(load, "occupancy"),
			Speed:      firstFloat(item, "speed"),
		}
		if vehicle.Latitude != 0 && vehicle.Longitude != 0 {
			vehicles = append(vehicles, vehicle)
		}
	}
	return ActiveBusResponse{RouteCode: routeCode, Vehicles: vehicles, Source: "nus", UpdatedAt: time.Now().UTC()}
}

func normalizeBusAlerts(raw map[string]any) []BusAlert {
	items := firstArray(raw, "AnnouncementsResult", "announcements", "Announcements", "TickerTapesResult", "tickertapes", "TickerTapes")
	alerts := make([]BusAlert, 0, len(items))
	for _, item := range items {
		title := firstNonEmpty(firstString(item, "title", "Title", "subject"), "NUS Bus Update")
		message := firstString(item, "message", "Message", "content", "Content", "description")
		if message == "" {
			continue
		}
		alerts = append(alerts, BusAlert{
			Title: title, Message: stripHTML(message), Priority: firstString(item, "priority", "Priority"),
			Source: "nus", UpdatedAt: time.Now().UTC(),
		})
	}
	return alerts
}

func (api *API) listBusStops(w http.ResponseWriter, r *http.Request) {
	stops, err := api.busClient.Stops(r.Context())
	if err != nil {
		writeError(w, http.StatusBadGateway, err)
		return
	}
	writeJSON(w, http.StatusOK, stops)
}

func (api *API) listBusRoutes(w http.ResponseWriter, r *http.Request) {
	routes, err := api.busClient.Routes(r.Context())
	if err != nil {
		writeError(w, http.StatusBadGateway, err)
		return
	}
	writeJSON(w, http.StatusOK, routes)
}

func (api *API) busPickupPoints(w http.ResponseWriter, r *http.Request) {
	points, err := api.busClient.PickupPoints(r.Context(), r.URL.Query().Get("route"))
	if err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	writeJSON(w, http.StatusOK, points)
}

func (api *API) busArrivals(w http.ResponseWriter, r *http.Request) {
	arrival, err := api.busClient.Arrivals(r.Context(), r.URL.Query().Get("stop"))
	if err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	writeJSON(w, http.StatusOK, arrival)
}

func (api *API) activeBus(w http.ResponseWriter, r *http.Request) {
	active, err := api.busClient.ActiveBus(r.Context(), r.URL.Query().Get("route"))
	if err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	writeJSON(w, http.StatusOK, active)
}

func (api *API) busAlerts(w http.ResponseWriter, r *http.Request) {
	alerts, err := api.busClient.Alerts(r.Context())
	if err != nil {
		writeError(w, http.StatusBadGateway, err)
		return
	}
	writeJSON(w, http.StatusOK, alerts)
}

func (api *API) busContext(w http.ResponseWriter, r *http.Request) {
	lat := parseFloat(r.URL.Query().Get("lat"), 1.2966)
	lng := parseFloat(r.URL.Query().Get("lng"), 103.7764)
	context, err := api.busClient.Context(r.Context(), lat, lng)
	if err != nil {
		writeError(w, http.StatusBadGateway, err)
		return
	}
	writeJSON(w, http.StatusOK, context)
}

func (api *API) sgBusStops(w http.ResponseWriter, r *http.Request) {
	stops, err := api.sgTransit.BusStops(r.Context())
	if err != nil {
		writeError(w, http.StatusBadGateway, err)
		return
	}
	writeJSON(w, http.StatusOK, stops)
}

func (api *API) sgNearbyBusStops(w http.ResponseWriter, r *http.Request) {
	lat := parseFloat(r.URL.Query().Get("lat"), 1.2966)
	lng := parseFloat(r.URL.Query().Get("lng"), 103.7764)
	limit := firstPositiveInt(parseInt(r.URL.Query().Get("limit"), 8), 8)
	stops, err := api.sgTransit.NearbyBusStops(r.Context(), lat, lng, limit)
	if err != nil {
		writeError(w, http.StatusBadGateway, err)
		return
	}
	writeJSON(w, http.StatusOK, stops)
}

func (api *API) sgBusArrivals(w http.ResponseWriter, r *http.Request) {
	arrival, err := api.sgTransit.BusArrivals(r.Context(), r.URL.Query().Get("stop"))
	if err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	writeJSON(w, http.StatusOK, arrival)
}

func (api *API) sgTrainAlerts(w http.ResponseWriter, r *http.Request) {
	alerts, err := api.sgTransit.TrainAlerts(r.Context())
	if err != nil {
		writeError(w, http.StatusBadGateway, err)
		return
	}
	writeJSON(w, http.StatusOK, alerts)
}

func firstArray(root map[string]any, keys ...string) []map[string]any {
	for _, key := range keys {
		value, ok := root[key]
		if !ok {
			continue
		}
		if array := anySliceToMapSlice(value); len(array) > 0 {
			return array
		}
		if nested, ok := value.(map[string]any); ok {
			if array := firstArray(nested, keys...); len(array) > 0 {
				return array
			}
		}
	}
	return nil
}

func firstMap(root map[string]any, keys ...string) map[string]any {
	for _, key := range keys {
		if value, ok := root[key].(map[string]any); ok {
			return value
		}
	}
	return map[string]any{}
}

func anySliceToMapSlice(value any) []map[string]any {
	slice, ok := value.([]any)
	if !ok {
		return nil
	}
	items := make([]map[string]any, 0, len(slice))
	for _, item := range slice {
		if mapped, ok := item.(map[string]any); ok {
			items = append(items, mapped)
		}
	}
	return items
}

func firstString(root map[string]any, keys ...string) string {
	for _, key := range keys {
		if value, ok := root[key]; ok {
			switch typed := value.(type) {
			case string:
				if strings.TrimSpace(typed) != "" {
					return strings.TrimSpace(typed)
				}
			case float64:
				return strconv.FormatFloat(typed, 'f', -1, 64)
			case int:
				return strconv.Itoa(typed)
			}
		}
	}
	return ""
}

func firstInt(root map[string]any, keys ...string) int {
	for _, key := range keys {
		value, ok := root[key]
		if !ok {
			continue
		}
		switch typed := value.(type) {
		case int:
			return typed
		case float64:
			return int(typed)
		case string:
			parsed, err := strconv.Atoi(strings.TrimSpace(typed))
			if err == nil {
				return parsed
			}
		}
	}
	return 0
}

func parseInt(raw string, fallback int) int {
	parsed, err := strconv.Atoi(strings.TrimSpace(raw))
	if err != nil {
		return fallback
	}
	return parsed
}

func firstPositiveInt(value int, fallback int) int {
	if value > 0 {
		return value
	}
	return fallback
}

func firstFloat(root map[string]any, keys ...string) float64 {
	for _, key := range keys {
		value, ok := root[key]
		if !ok {
			continue
		}
		switch typed := value.(type) {
		case float64:
			return typed
		case int:
			return float64(typed)
		case string:
			parsed, err := strconv.ParseFloat(strings.TrimSpace(typed), 64)
			if err == nil {
				return parsed
			}
		}
	}
	return 0
}

func compactMinutes(values ...string) []int {
	minutes := make([]int, 0, len(values))
	for _, value := range values {
		trimmed := strings.TrimSpace(strings.ToLower(value))
		if trimmed == "" || trimmed == "-" || trimmed == "na" {
			continue
		}
		if strings.Contains(trimmed, "arr") {
			minutes = append(minutes, 0)
			continue
		}
		fields := strings.FieldsFunc(trimmed, func(r rune) bool { return r < '0' || r > '9' })
		if len(fields) == 0 {
			continue
		}
		parsed, err := strconv.Atoi(fields[0])
		if err == nil {
			minutes = append(minutes, parsed)
		}
	}
	return minutes
}

func etaTimestamp(etas []map[string]any, index int) string {
	if index < 0 || index >= len(etas) {
		return ""
	}
	return firstString(etas[index], "ts", "timestamp", "time")
}

func normalizeCrowd(value string) string {
	value = strings.ToLower(strings.TrimSpace(value))
	switch {
	case strings.Contains(value, "high") || strings.Contains(value, "crowd"):
		return "high"
	case strings.Contains(value, "medium") || strings.Contains(value, "moderate"):
		return "medium"
	case strings.Contains(value, "low") || strings.Contains(value, "light"):
		return "low"
	default:
		return ""
	}
}

func normalizeHexColor(value string) string {
	value = strings.TrimPrefix(strings.TrimSpace(value), "#")
	if len(value) == 6 {
		return "#" + strings.ToUpper(value)
	}
	return ""
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return strings.TrimSpace(value)
		}
	}
	return ""
}

func stripHTML(value string) string {
	builder := strings.Builder{}
	inTag := false
	for _, r := range value {
		switch r {
		case '<':
			inTag = true
		case '>':
			inTag = false
		default:
			if !inTag {
				builder.WriteRune(r)
			}
		}
	}
	return strings.Join(strings.Fields(builder.String()), " ")
}

func distanceMeters(lat1, lng1, lat2, lng2 float64) float64 {
	const metersPerDegree = 111_320
	avgLat := (lat1 + lat2) / 2
	dx := (lng2 - lng1) * metersPerDegree * cosDegrees(avgLat)
	dy := (lat2 - lat1) * metersPerDegree
	if dx < 0 {
		dx = -dx
	}
	if dy < 0 {
		dy = -dy
	}
	return dx + dy
}

func cosDegrees(degrees float64) float64 {
	switch {
	case degrees > 1.31:
		return 0.9997
	default:
		return 0.9998
	}
}

func suggestBusAction(stop BusContextStop) string {
	if len(stop.Arrivals) == 0 {
		return fmt.Sprintf("Walk to %s; live arrival data is not available yet.", stop.Code)
	}
	route := stop.Arrivals[0]
	if len(route.ArrivalMinutes) == 0 {
		return fmt.Sprintf("Walk to %s and check route %s.", stop.Code, route.RouteCode)
	}
	return fmt.Sprintf("Walk %.0fm to %s and take %s in %d minutes.", stop.DistanceM, stop.Code, route.RouteCode, route.ArrivalMinutes[0])
}

func sourceLabel(configured bool) string {
	if configured {
		return "nus"
	}
	return "demo"
}

var knownBusStopCoords = map[string]LatLng{
	"COM2":   {Latitude: 1.29486, Longitude: 103.77388},
	"COM3":   {Latitude: 1.29537, Longitude: 103.77427},
	"CLB":    {Latitude: 1.29661, Longitude: 103.77234},
	"YIH":    {Latitude: 1.29854, Longitude: 103.77406},
	"UTOWN":  {Latitude: 1.30483, Longitude: 103.77382},
	"KR-MRT": {Latitude: 1.29234, Longitude: 103.78499},
	"PGP":    {Latitude: 1.29094, Longitude: 103.78022},
	"BIZ2":   {Latitude: 1.29311, Longitude: 103.77405},
}

func demoBusStops() []BusStop {
	now := time.Now().UTC()
	return []BusStop{
		{Code: "COM2", Name: "COM 2", Latitude: 1.29486, Longitude: 103.77388, Source: "demo", UpdatedAt: now},
		{Code: "CLB", Name: "Central Library", Latitude: 1.29661, Longitude: 103.77234, Source: "demo", UpdatedAt: now},
		{Code: "YIH", Name: "Yusof Ishak House", Latitude: 1.29854, Longitude: 103.77406, Source: "demo", UpdatedAt: now},
		{Code: "UTOWN", Name: "University Town", Latitude: 1.30483, Longitude: 103.77382, Source: "demo", UpdatedAt: now},
		{Code: "KR-MRT", Name: "Kent Ridge MRT", Latitude: 1.29234, Longitude: 103.78499, Source: "demo", UpdatedAt: now},
		{Code: "PGP", Name: "Prince George's Park", Latitude: 1.29094, Longitude: 103.78022, Source: "demo", UpdatedAt: now},
	}
}

func demoBusRoutes() []BusRoute {
	return []BusRoute{
		{Code: "A1", Name: "A1", Color: "#E04F5F", Description: "Kent Ridge MRT, Central Library, UTown loop"},
		{Code: "A2", Name: "A2", Color: "#2F80ED", Description: "Reverse campus loop"},
		{Code: "D1", Name: "D1", Color: "#27AE60", Description: "COM and UTown connector"},
		{Code: "D2", Name: "D2", Color: "#F2C94C", Description: "PGP and campus connector"},
	}
}

func demoBusPickupPoints(routeCode string) []BusPickupPoint {
	now := time.Now().UTC()
	routeCode = strings.ToUpper(routeCode)
	routeStops := map[string][]string{
		"A1": {"KR-MRT", "CLB", "YIH", "UTOWN"},
		"A2": {"UTOWN", "YIH", "CLB", "KR-MRT"},
		"D1": {"COM2", "CLB", "UTOWN"},
		"D2": {"PGP", "COM2", "YIH"},
	}
	codes := routeStops[routeCode]
	if len(codes) == 0 {
		codes = []string{"COM2", "CLB", "UTOWN"}
	}
	stopsByCode := map[string]BusStop{}
	for _, stop := range demoBusStops() {
		stopsByCode[stop.Code] = stop
	}
	points := make([]BusPickupPoint, 0, len(codes))
	for i, code := range codes {
		stop := stopsByCode[code]
		points = append(points, BusPickupPoint{
			RouteCode:  routeCode,
			Seq:        i + 1,
			StopCode:   code,
			LongName:   stop.Name,
			ShortName:  code,
			PickupName: firstNonEmpty(stop.Name, code),
			Latitude:   stop.Latitude,
			Longitude:  stop.Longitude,
			Source:     "demo",
			UpdatedAt:  now,
		})
	}
	return points
}

func demoBusArrival(stopCode string) BusArrival {
	now := time.Now().UTC()
	routes := map[string][]BusArrivalRoute{
		"COM2": {
			{RouteCode: "D1", ArrivalTime: "2", NextArrivalTime: "8", ArrivalMinutes: []int{2, 8}, CrowdLevel: "medium", VehiclePlate: "PC1234A"},
			{RouteCode: "A1", ArrivalTime: "5", NextArrivalTime: "12", ArrivalMinutes: []int{5, 12}, CrowdLevel: "low", VehiclePlate: "PC2345B"},
		},
		"CLB": {
			{RouteCode: "A1", ArrivalTime: "3", NextArrivalTime: "10", ArrivalMinutes: []int{3, 10}, CrowdLevel: "low", VehiclePlate: "PC3456C"},
			{RouteCode: "A2", ArrivalTime: "6", NextArrivalTime: "14", ArrivalMinutes: []int{6, 14}, CrowdLevel: "medium", VehiclePlate: "PC4567D"},
		},
		"UTOWN": {
			{RouteCode: "D1", ArrivalTime: "4", NextArrivalTime: "11", ArrivalMinutes: []int{4, 11}, CrowdLevel: "high", VehiclePlate: "PC5678E"},
			{RouteCode: "A2", ArrivalTime: "7", NextArrivalTime: "15", ArrivalMinutes: []int{7, 15}, CrowdLevel: "medium", VehiclePlate: "PC6789F"},
		},
	}
	return BusArrival{
		StopCode:  stopCode,
		StopName:  stopCode,
		Routes:    routes[stopCode],
		Source:    "demo",
		UpdatedAt: now,
	}
}

func demoActiveBus(routeCode string) ActiveBusResponse {
	now := time.Now().UTC()
	vehicles := map[string][]BusVehicle{
		"A1": {
			{Plate: "PC2345B", Latitude: 1.2962, Longitude: 103.7731, CrowdLevel: "low", Occupancy: 0.32, Speed: 18},
			{Plate: "PC3456C", Latitude: 1.2928, Longitude: 103.7832, CrowdLevel: "medium", Occupancy: 0.58, Speed: 22},
		},
		"D1": {
			{Plate: "PC1234A", Latitude: 1.2969, Longitude: 103.7740, CrowdLevel: "medium", Occupancy: 0.52, Speed: 16},
			{Plate: "PC5678E", Latitude: 1.3035, Longitude: 103.7738, CrowdLevel: "high", Occupancy: 0.81, Speed: 12},
		},
	}
	return ActiveBusResponse{RouteCode: routeCode, Vehicles: vehicles[routeCode], Source: "demo", UpdatedAt: now}
}

func demoBusAlerts() []BusAlert {
	return []BusAlert{}
}
