package atlas

import (
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"strings"
	"time"
)

type API struct {
	cfg    Config
	store  *Store
	client *NUSModsClient
}

func NewAPI(cfg Config, store *Store, client *NUSModsClient) *API {
	return &API{cfg: cfg, store: store, client: client}
}

func (api *API) Routes() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/health", api.health)
	mux.HandleFunc("GET /api/buildings", api.listBuildings)
	mux.HandleFunc("GET /api/facilities", api.listFacilities)
	mux.HandleFunc("GET /api/schedule", api.listSchedule)
	mux.HandleFunc("POST /api/schedule", api.createSchedule)
	mux.HandleFunc("DELETE /api/schedule/{id}", api.deleteSchedule)
	mux.HandleFunc("GET /api/recommendations", api.recommendations)
	mux.HandleFunc("GET /api/sync/status", api.syncStatus)
	mux.HandleFunc("POST /api/sync/run", api.runSync)
	return api.withCORS(mux)
}

func (api *API) health(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]any{
		"status":  "ok",
		"service": "atlas-api",
		"time":    time.Now().UTC(),
	})
}

func (api *API) listBuildings(w http.ResponseWriter, r *http.Request) {
	buildings, err := api.store.ListBuildings(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, err)
		return
	}
	writeJSON(w, http.StatusOK, buildings)
}

func (api *API) listFacilities(w http.ResponseWriter, r *http.Request) {
	facilities, err := api.store.ListFacilities(r.Context(), r.URL.Query().Get("building"), r.URL.Query().Get("type"))
	if err != nil {
		writeError(w, http.StatusInternalServerError, err)
		return
	}
	writeJSON(w, http.StatusOK, facilities)
}

func (api *API) listSchedule(w http.ResponseWriter, r *http.Request) {
	items, err := api.store.ListSchedule(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, err)
		return
	}
	writeJSON(w, http.StatusOK, items)
}

func (api *API) createSchedule(w http.ResponseWriter, r *http.Request) {
	var payload ScheduleItem
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		writeError(w, http.StatusBadRequest, errors.New("invalid JSON body"))
		return
	}
	item, err := api.store.CreateScheduleItem(r.Context(), payload)
	if err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	writeJSON(w, http.StatusCreated, item)
}

func (api *API) deleteSchedule(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil || id <= 0 {
		writeError(w, http.StatusBadRequest, errors.New("invalid schedule id"))
		return
	}
	if err := api.store.DeleteScheduleItem(r.Context(), id); err != nil {
		if errors.Is(err, ErrNotFound) {
			writeError(w, http.StatusNotFound, errors.New("schedule item not found"))
			return
		}
		writeError(w, http.StatusInternalServerError, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (api *API) recommendations(w http.ResponseWriter, r *http.Request) {
	lat := parseFloat(r.URL.Query().Get("lat"), 1.2966)
	lng := parseFloat(r.URL.Query().Get("lng"), 103.7764)
	now := time.Now().UTC()
	if raw := r.URL.Query().Get("now"); raw != "" {
		parsed, err := time.Parse(time.RFC3339, raw)
		if err != nil {
			writeError(w, http.StatusBadRequest, errors.New("now must be RFC3339"))
			return
		}
		now = parsed
	}
	recs, err := api.store.Recommendations(r.Context(), lat, lng, now)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err)
		return
	}
	writeJSON(w, http.StatusOK, recs)
}

func (api *API) syncStatus(w http.ResponseWriter, r *http.Request) {
	status, err := api.store.LatestSyncStatus(r.Context())
	if err != nil {
		if errors.Is(err, ErrNotFound) {
			writeJSON(w, http.StatusOK, map[string]any{"status": "never_run"})
			return
		}
		writeError(w, http.StatusInternalServerError, err)
		return
	}
	writeJSON(w, http.StatusOK, status)
}

func (api *API) runSync(w http.ResponseWriter, r *http.Request) {
	status := RunNUSModsSync(r.Context(), api.store, api.client)
	code := http.StatusOK
	if status.Status == "failed" {
		code = http.StatusBadGateway
	}
	writeJSON(w, code, status)
}

func (api *API) withCORS(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		if origin != "" && (api.cfg.AllowedOrigin == "*" || strings.EqualFold(origin, api.cfg.AllowedOrigin)) {
			w.Header().Set("Access-Control-Allow-Origin", origin)
			w.Header().Set("Vary", "Origin")
			w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
			w.Header().Set("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS")
		}
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func writeJSON(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(value)
}

func writeError(w http.ResponseWriter, status int, err error) {
	writeJSON(w, status, map[string]string{"error": err.Error()})
}

func parseFloat(raw string, fallback float64) float64 {
	if raw == "" {
		return fallback
	}
	parsed, err := strconv.ParseFloat(raw, 64)
	if err != nil {
		return fallback
	}
	return parsed
}
