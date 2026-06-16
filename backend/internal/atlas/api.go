package atlas

import (
	"context"
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"google.golang.org/api/idtoken"
)

const googleVerificationTimeout = 10 * time.Second

type API struct {
	cfg       Config
	store     *Store
	client    *NUSModsClient
	busClient *NUSBusClient
	sgTransit *SingaporeTransitClient
	agent     *DailyAssistantAgent
	secretKey []byte
}

func NewAPI(cfg Config, store *Store, client *NUSModsClient) *API {
	secret := cfg.JWTSecret
	if secret == "" {
		secret = "8f4c1d9a73be52f6c1a8e4b97d3f62a1e5c8b0d7f4a9c2e6b1d3f8a7c5e9b2d4"
	}
	return &API{cfg: cfg, store: store, client: client, busClient: NewNUSBusClient(cfg), sgTransit: NewSingaporeTransitClient(cfg), agent: NewDailyAssistantAgent(NewLLMClient(cfg)),
		secretKey: []byte(secret),
	}
}

func (api *API) Routes() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/health", api.health)
	mux.HandleFunc("GET /api/config", api.publicConfig)
	mux.HandleFunc("GET /api/buildings", api.Protect(api.listBuildings))
	mux.HandleFunc("GET /api/facilities", api.Protect(api.listFacilities))
	mux.HandleFunc("GET /api/schedule", api.Protect(api.listSchedule))
	mux.HandleFunc("POST /api/schedule", api.Protect(api.createSchedule))
	mux.HandleFunc("DELETE /api/schedule/{id}", api.Protect(api.deleteSchedule))
	mux.HandleFunc("GET /api/recommendations", api.Protect(api.recommendations))
	mux.HandleFunc("POST /api/agent/daily-assistant", api.Protect(api.dailyAssistantAgent))
	mux.HandleFunc("GET /api/sync/status", api.Protect(api.syncStatus))
	mux.HandleFunc("POST /api/sync/run", api.Protect(api.runSync))
	mux.HandleFunc("GET /api/bus/stops", api.listBusStops)
	mux.HandleFunc("GET /api/bus/routes", api.listBusRoutes)
	mux.HandleFunc("GET /api/bus/pickup-points", api.busPickupPoints)
	mux.HandleFunc("GET /api/bus/arrivals", api.busArrivals)
	mux.HandleFunc("GET /api/bus/active", api.activeBus)
	mux.HandleFunc("GET /api/bus/alerts", api.busAlerts)
	mux.HandleFunc("GET /api/bus/context", api.busContext)
	mux.HandleFunc("GET /api/sg/bus/stops", api.sgBusStops)
	mux.HandleFunc("GET /api/sg/bus/nearby", api.sgNearbyBusStops)
	mux.HandleFunc("GET /api/sg/bus/arrivals", api.sgBusArrivals)
	mux.HandleFunc("GET /api/sg/train/alerts", api.sgTrainAlerts)
	mux.HandleFunc("GET /api/otp/plan", api.Protect(api.otpPlan))
	mux.HandleFunc("POST /api/login", api.login)
	mux.HandleFunc("POST /api/auth/google", api.googleLogin)
	mux.HandleFunc("POST /api/register", api.register)
	mux.HandleFunc("POST /api/password/security-question", api.passwordSecurityQuestion)
	mux.HandleFunc("POST /api/password/reset", api.resetPassword)
	mux.HandleFunc("POST /api/password/change", api.Protect(api.changePassword))
	if api.cfg.StaticDir != "" {
		mux.HandleFunc("/", api.serveStaticApp)
	}
	return api.withCORS(mux)
}

func (api *API) serveStaticApp(w http.ResponseWriter, r *http.Request) {
	if strings.HasPrefix(r.URL.Path, "/api/") {
		http.NotFound(w, r)
		return
	}
	cleanPath := strings.TrimPrefix(filepath.Clean(r.URL.Path), string(filepath.Separator))
	path := filepath.Join(api.cfg.StaticDir, cleanPath)
	info, err := os.Stat(path)
	if err != nil || info.IsDir() {
		http.ServeFile(w, r, filepath.Join(api.cfg.StaticDir, "index.html"))
		return
	}
	http.ServeFile(w, r, path)
}

func (api *API) Protect(next http.HandlerFunc) http.HandlerFunc {
	// this func serves as middleware
	// and protects unauthorized access via verifying jwt tokens
	// one is supposed to wrap this func around the handler that u wan to protect.

	return func(w http.ResponseWriter, r *http.Request) {

		authHeader := r.Header.Get("Authorization")

		if authHeader == "" {
			http.Error(w, "missing token; Login First :p", http.StatusUnauthorized)
			return
		}

		tokenString := strings.TrimPrefix(authHeader, "Bearer ")
		if tokenString == "demo-mode" && r.URL.Path == "/api/agent/daily-assistant" {
			next.ServeHTTP(w, r)
			return
		}

		token, err := jwt.Parse(
			tokenString,
			func(token *jwt.Token) (interface{}, error) {
				return api.secretKey, nil
			},
			jwt.WithValidMethods([]string{jwt.SigningMethodHS256.Alg()}),
		)

		if err != nil || !token.Valid {
			http.Error(w, "invalid token", http.StatusUnauthorized)
			return
		}
		next.ServeHTTP(w, r)
	}
}

func (api *API) register(w http.ResponseWriter, r *http.Request) {
	var cred Credentials

	if err := json.NewDecoder(r.Body).Decode(&cred); err != nil {
		writeError(w, http.StatusBadRequest, errors.New("invalid JSON body"))
		return
	}
	cred.Email = strings.TrimSpace(cred.Email)
	cred.SecurityQuestion = strings.TrimSpace(cred.SecurityQuestion)
	cred.SecurityAnswer = strings.TrimSpace(cred.SecurityAnswer)
	if cred.Email == "" || len(cred.Password) < 6 || cred.SecurityQuestion == "" || cred.SecurityAnswer == "" {
		writeError(w, http.StatusBadRequest, errors.New("invalid credentials"))
		return
	}

	// search in db whether user alr exists
	exists, err := api.store.userExists(r.Context(), cred)
	if err != nil || exists {
		writeError(w, http.StatusBadRequest, errors.New("invalid credentials"))
		return
	}

	// user does not exist then register it
	err = api.store.registerIntoDB(r.Context(), cred)
	if err != nil {
		writeError(w, http.StatusBadRequest, errors.New(err.Error()))
		return
	}

	// if everything is sucessful, return status ok
	writeJSON(w, http.StatusOK, map[string]string{
		"message": "Register ok",
	})

}

func (api *API) passwordSecurityQuestion(w http.ResponseWriter, r *http.Request) {
	var payload struct {
		Email string `json:"email"`
	}
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		writeError(w, http.StatusBadRequest, errors.New("invalid JSON body"))
		return
	}
	email := strings.TrimSpace(payload.Email)
	if email == "" {
		writeError(w, http.StatusBadRequest, errors.New("email is required"))
		return
	}
	question, err := api.store.securityQuestionForEmail(r.Context(), email)
	if err != nil {
		writeError(w, http.StatusNotFound, errors.New("no security question found for this account"))
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{
		"question": question,
	})
}

func (api *API) resetPassword(w http.ResponseWriter, r *http.Request) {
	var cred Credentials
	if err := json.NewDecoder(r.Body).Decode(&cred); err != nil {
		writeError(w, http.StatusBadRequest, errors.New("invalid JSON body"))
		return
	}
	cred.Email = strings.TrimSpace(cred.Email)
	cred.SecurityAnswer = strings.TrimSpace(cred.SecurityAnswer)
	if cred.Email == "" || cred.SecurityAnswer == "" || len(cred.Password) < 6 {
		writeError(w, http.StatusBadRequest, errors.New("invalid reset request"))
		return
	}
	ok, err := api.store.resetPasswordWithSecurityAnswer(r.Context(), cred)
	if err != nil {
		status := http.StatusInternalServerError
		if errors.Is(err, ErrNotFound) {
			status = http.StatusNotFound
		}
		writeError(w, status, errors.New("password reset failed"))
		return
	}
	if !ok {
		writeError(w, http.StatusUnauthorized, errors.New("security answer did not match"))
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{
		"message": "password reset ok",
	})
}

func (api *API) changePassword(w http.ResponseWriter, r *http.Request) {
	var payload struct {
		CurrentPassword string `json:"currentPassword"`
		NewPassword     string `json:"newPassword"`
	}
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		writeError(w, http.StatusBadRequest, errors.New("invalid JSON body"))
		return
	}
	email, err := api.authenticatedEmail(r)
	if err != nil {
		writeError(w, http.StatusUnauthorized, errors.New("invalid token"))
		return
	}
	if payload.CurrentPassword == "" || len(payload.NewPassword) < 6 {
		writeError(w, http.StatusBadRequest, errors.New("invalid password change request"))
		return
	}
	ok, err := api.store.changePassword(r.Context(), email, payload.CurrentPassword, payload.NewPassword)
	if err != nil {
		status := http.StatusInternalServerError
		if errors.Is(err, ErrNotFound) {
			status = http.StatusNotFound
		}
		writeError(w, status, errors.New("password change failed"))
		return
	}
	if !ok {
		writeError(w, http.StatusUnauthorized, errors.New("current password did not match"))
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{
		"message": "password changed",
	})
}

func (api *API) authenticatedEmail(r *http.Request) (string, error) {
	authHeader := r.Header.Get("Authorization")
	tokenString := strings.TrimPrefix(authHeader, "Bearer ")
	token, err := jwt.Parse(
		tokenString,
		func(token *jwt.Token) (interface{}, error) {
			return api.secretKey, nil
		},
		jwt.WithValidMethods([]string{jwt.SigningMethodHS256.Alg()}),
	)
	if err != nil || !token.Valid {
		return "", errors.New("invalid token")
	}
	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok {
		return "", errors.New("invalid token claims")
	}
	email, _ := claims["email"].(string)
	email = strings.TrimSpace(email)
	if email == "" {
		return "", errors.New("missing token email")
	}
	return email, nil
}

func (api *API) login(w http.ResponseWriter, r *http.Request) {
	var cred Credentials

	// decode JSON body
	if err := json.NewDecoder(r.Body).Decode(&cred); err != nil {
		writeError(w, http.StatusBadRequest, errors.New("invalid JSON body"))
		return
	}

	// validate user
	isValidUser, err := api.store.searchUserDB(r.Context(), cred)

	if err != nil || !isValidUser {
		writeError(w, http.StatusUnauthorized, errors.New("invalid credentials"))
		return
	}

	tokenString, err := api.issueLoginToken(jwt.MapClaims{
		"email": cred.Email,
		"name":  displayNameFromEmail(cred.Email),
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, err)
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"message": "login ok",
		"token":   tokenString,
		"user": map[string]string{
			"email":    cred.Email,
			"name":     displayNameFromEmail(cred.Email),
			"provider": "password",
		},
	})
}

func (api *API) googleLogin(w http.ResponseWriter, r *http.Request) {
	if api.cfg.GoogleClientID == "" {
		writeError(w, http.StatusServiceUnavailable, errors.New("google sign-in is not configured"))
		return
	}

	var payload struct {
		Credential string `json:"credential"`
	}
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		writeError(w, http.StatusBadRequest, errors.New("invalid JSON body"))
		return
	}
	if payload.Credential == "" {
		writeError(w, http.StatusBadRequest, errors.New("missing google credential"))
		return
	}

	verifyCtx, cancel := context.WithTimeout(r.Context(), googleVerificationTimeout)
	defer cancel()

	verified, err := idtoken.Validate(verifyCtx, payload.Credential, api.cfg.GoogleClientID)
	if err != nil {
		log.Printf("google id token validation failed: %v", err)
		if errors.Is(verifyCtx.Err(), context.DeadlineExceeded) {
			writeError(w, http.StatusGatewayTimeout, errors.New("google sign-in verification timed out"))
			return
		}
		writeError(w, http.StatusUnauthorized, errors.New("invalid google credential"))
		return
	}

	email, _ := verified.Claims["email"].(string)
	if email == "" {
		writeError(w, http.StatusUnauthorized, errors.New("google credential is missing email"))
		return
	}
	if !googleEmailVerified(verified.Claims["email_verified"]) {
		writeError(w, http.StatusUnauthorized, errors.New("google email is not verified"))
		return
	}

	subject, _ := verified.Claims["sub"].(string)
	name, _ := verified.Claims["name"].(string)
	picture, _ := verified.Claims["picture"].(string)
	if strings.TrimSpace(name) == "" {
		name = displayNameFromEmail(email)
	}
	tokenString, err := api.issueLoginToken(jwt.MapClaims{
		"email":         email,
		"name":          name,
		"picture":       picture,
		"auth_provider": "google",
		"google_sub":    subject,
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, err)
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"message": "google login ok",
		"token":   tokenString,
		"user": map[string]string{
			"email":    email,
			"name":     name,
			"picture":  picture,
			"provider": "google",
		},
	})
}

func (api *API) issueLoginToken(claims jwt.MapClaims) (string, error) {
	claims["exp"] = time.Now().Add(time.Hour * 24).Unix()
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(api.secretKey)
}

func googleEmailVerified(value any) bool {
	switch typed := value.(type) {
	case bool:
		return typed
	case string:
		return strings.EqualFold(typed, "true")
	default:
		return false
	}
}

func displayNameFromEmail(email string) string {
	localPart, _, ok := strings.Cut(email, "@")
	if !ok || strings.TrimSpace(localPart) == "" {
		return "Atlas User"
	}
	localPart = strings.NewReplacer(".", " ", "_", " ", "-", " ").Replace(localPart)
	words := strings.Fields(localPart)
	for i, word := range words {
		if word == "" {
			continue
		}
		words[i] = strings.ToUpper(word[:1]) + strings.ToLower(word[1:])
	}
	if len(words) == 0 {
		return "Atlas User"
	}
	return strings.Join(words, " ")
}

func (api *API) health(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]any{
		"status":  "ok",
		"service": "atlas-api",
		"time":    time.Now().UTC(),
	})
}

func (api *API) publicConfig(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]any{
		"googleClientId": api.cfg.GoogleClientID,
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

func (api *API) dailyAssistantAgent(w http.ResponseWriter, r *http.Request) {
	var payload DailyAssistantAgentRequest
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		writeJSON(w, http.StatusBadRequest, DailyAssistantAgentResponse{
			Success: false,
			Reply:   fallbackDailyAssistantReply("general"),
			Error:   "invalid JSON body",
		})
		return
	}

	response := api.agent.Run(r.Context(), payload)
	status := http.StatusOK
	if response.Error == "message is required" {
		status = http.StatusBadRequest
	}
	writeJSON(w, status, response)
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
			w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
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
