package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"syscall"
	"time"

	"github.com/atlas-nus/armap/backend/internal/atlas"
)

func main() {
	cfg := atlas.Config{
		Port:              env("PORT", "8080"),
		DBPath:            env("DB_PATH", "atlas.db"),
		AllowedOrigin:     env("ALLOWED_ORIGIN", "*"),
		NUSModsAcadYear:   env("NUSMODS_ACAD_YEAR", "2025-2026"),
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
