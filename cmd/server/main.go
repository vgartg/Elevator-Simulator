package main

import (
	"context"
	"errors"
	"log"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"strconv"
	"syscall"
	"time"

	"github.com/vgartg/elevator-simulator/api"
)

func main() {
	port := envOrDefault("PORT", "3000")
	floors, _ := strconv.Atoi(envOrDefault("FLOORS", "10"))
	cabins, _ := strconv.Atoi(envOrDefault("ELEVATORS", "2"))

	webRoot := ""
	candidate := filepath.Join("web", "dist")
	if info, err := os.Stat(candidate); err == nil && info.IsDir() {
		webRoot = candidate
	}

	srv, err := api.New(api.Config{
		Floors:    floors,
		Elevators: cabins,
		WebRoot:   webRoot,
	})
	if err != nil {
		log.Fatalf("init server: %v", err)
	}

	httpSrv := &http.Server{
		Addr:              ":" + port,
		Handler:           srv.Handler(),
		ReadHeaderTimeout: 5 * time.Second,
	}

	go func() {
		log.Printf("elevator-simulator listening on http://localhost:%s (floors=%d, cabins=%d)", port, floors, cabins)
		if webRoot != "" {
			log.Printf("serving SPA from %s", webRoot)
		}
		if err := httpSrv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Fatalf("listen: %v", err)
		}
	}()

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, syscall.SIGINT, syscall.SIGTERM)
	<-stop

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := httpSrv.Shutdown(ctx); err != nil {
		log.Printf("shutdown: %v", err)
	}
}

func envOrDefault(key, fallback string) string {
	if v, ok := os.LookupEnv(key); ok && v != "" {
		return v
	}
	return fallback
}
