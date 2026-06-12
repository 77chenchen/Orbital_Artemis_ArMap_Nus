package main

import (
	"bufio"
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"strings"
	"syscall"
	"time"

	"github.com/atlas-nus/armap/backend/internal/atlas"
)

const defaultGoogleClientID = "256709725892-l8c193prtctrjm4bhsv0fdknhshuvdqd.apps.googleusercontent.com"

func main() {
	loadDotEnv(".env")
	loadDotEnv("../.env")

	cfg := atlas.Config{
		Port:              env("PORT", "8080"),
		DBPath:            env("DB_PATH", "atlas.db"),
		AllowedOrigin:     env("ALLOWED_ORIGIN", "*"),
		StaticDir:         env("STATIC_DIR", ""),
		JWTSecret:         env("JWT_SECRET", ""),
		GoogleClientID:    env("GOOGLE_CLIENT_ID", defaultGoogleClientID),
		NUSModsAcadYear:   env("NUSMODS_ACAD_YEAR", "2025-2026"),
		NUSBusAuthBase:    env("NUS_BUS_AUTH_BASE", "https://myizaac2.nus.edu.sg"),
		NUSBusAPIBase:     env("NUS_BUS_API_BASE", "https://fms.connectx.com.sg/apiy/NUSETA"),
		NUSBusXHTDAPI:     env("NUS_BUS_X_HTD_API", ""),
		NUSBusXAPPAPI:     env("NUS_BUS_X_APP_API", ""),
		NUSBusDeviceID:    env("NUS_BUS_DEVICE_ID", "atlas-nus-bus-demo-device"),
		NUSBusVersion:     env("NUS_BUS_VERSION", "2.56.0"),
		LLMProvider:       env("LLM_PROVIDER", "openai-compatible"),
		LLMAPIKey:         env("LLM_API_KEY", ""),
		LLMBaseURL:        env("LLM_BASE_URL", ""),
		LLMModel:          env("LLM_MODEL", ""),
		SyncInterval:      durationEnv("SYNC_INTERVAL", 6*time.Hour),
		HTTPClientTimeout: durationEnv("HTTP_CLIENT_TIMEOUT", 10*time.Second),
	}

	store, err := atlas.OpenStore(cfg.DBPath)
	if err != nil {
		log.Fatalf("open store: %v", err)
	}
	defer store.Close()

	if err := store.Migrate(context.Background()); err != nil {
		log.Fatalf("migrate store: %v", err)
	}
	if err := store.Seed(context.Background()); err != nil {
		log.Fatalf("seed store: %v", err)
	}

	client := atlas.NewNUSModsClient(cfg.NUSModsAcadYear, cfg.HTTPClientTimeout)
	api := atlas.NewAPI(cfg, store, client)
	scheduler := atlas.NewScheduler(store, client, cfg.SyncInterval)

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	scheduler.Start(ctx)

	server := &http.Server{
		Addr:         ":" + cfg.Port,
		Handler:      api.Routes(),
		ReadTimeout:  10 * time.Second,
		WriteTimeout: 20 * time.Second,
	}

	go func() {
		log.Printf("Atlas API listening on http://localhost:%s", cfg.Port)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("server error: %v", err)
		}
	}()

	<-ctx.Done()
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := server.Shutdown(shutdownCtx); err != nil {
		log.Printf("server shutdown error: %v", err)
	}
}

func loadDotEnv(path string) {
	file, err := os.Open(path)
	if err != nil {
		return
	}
	defer file.Close()

	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" || strings.HasPrefix(line, "#") || !strings.Contains(line, "=") {
			continue
		}

		key, value, ok := strings.Cut(line, "=")
		if !ok {
			continue
		}

		key = strings.TrimSpace(key)
		value = strings.TrimSpace(value)
		if key == "" {
			continue
		}
		if _, exists := os.LookupEnv(key); exists {
			continue
		}

		value = strings.Trim(value, `"'`)
		if err := os.Setenv(key, value); err != nil {
			log.Printf("skip env %s from %s: %v", key, path, err)
		}
	}
}

func env(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}

func durationEnv(key string, fallback time.Duration) time.Duration {
	value := os.Getenv(key)
	if value == "" {
		return fallback
	}
	seconds, err := strconv.Atoi(value)
	if err != nil || seconds <= 0 {
		return fallback
	}
	return time.Duration(seconds) * time.Second
}
