// Package api exposes the elevator simulator over HTTP.
package api

import (
	"encoding/json"
	"errors"
	"net/http"
	"path/filepath"
	"strconv"
	"sync"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"

	"github.com/vgartg/elevator-simulator/internal/elevator"
)

// Server wraps a building, its dispatcher, and the HTTP router.
type Server struct {
	mu       sync.Mutex
	building *elevator.Building
	floors   int
	cabins   int
	router   chi.Router
	webRoot  string
}

// Config tunes the simulator dimensions at startup.
type Config struct {
	Floors    int
	Elevators int
	WebRoot   string
}

// New constructs a server with the requested geometry. Static SPA assets are
// served from WebRoot at "/" when the path is non-empty.
func New(cfg Config) (*Server, error) {
	if cfg.Floors == 0 {
		cfg.Floors = 10
	}
	if cfg.Elevators == 0 {
		cfg.Elevators = 2
	}
	b, err := elevator.NewBuilding(cfg.Floors, cfg.Elevators)
	if err != nil {
		return nil, err
	}
	s := &Server{
		building: b,
		floors:   cfg.Floors,
		cabins:   cfg.Elevators,
		webRoot:  cfg.WebRoot,
	}
	s.routes()
	return s, nil
}

// Handler returns the underlying chi router. Useful for testing.
func (s *Server) Handler() http.Handler { return s.router }

func (s *Server) routes() {
	r := chi.NewRouter()
	r.Use(middleware.Recoverer)
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   []string{"*"},
		AllowedMethods:   []string{"GET", "POST", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Content-Type"},
		AllowCredentials: false,
		MaxAge:           300,
	}))
	r.NotFound(s.notFound)
	r.MethodNotAllowed(s.methodNotAllowed)

	r.Route("/api", func(r chi.Router) {
		r.Get("/health", s.health)
		r.Get("/config", s.config)
		r.Get("/state", s.state)
		r.Post("/call", s.call)
		r.Post("/select", s.selectFloor)
		r.Post("/tick", s.tick)
		r.Post("/reset", s.reset)
	})

	if s.webRoot != "" {
		fs := http.FileServer(http.Dir(s.webRoot))
		r.Handle("/*", spaFallback(s.webRoot, fs))
	}

	s.router = r
}

func (s *Server) health(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{
		"status":  "ok",
		"version": elevator.Version,
	})
}

func (s *Server) config(w http.ResponseWriter, _ *http.Request) {
	s.mu.Lock()
	defer s.mu.Unlock()
	writeJSON(w, http.StatusOK, map[string]int{
		"floors":    s.floors,
		"elevators": s.cabins,
	})
}

func (s *Server) state(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, s.building.GetSnapshot())
}

type callBody struct {
	Floor     int                `json:"floor"`
	Direction elevator.Direction `json:"direction"`
}

func (s *Server) call(w http.ResponseWriter, r *http.Request) {
	var body callBody
	if err := decodeJSON(r, &body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_body", err.Error())
		return
	}
	if err := s.building.Call(body.Floor, body.Direction); err != nil {
		writeError(w, http.StatusBadRequest, errorCode(err), err.Error())
		return
	}
	writeJSON(w, http.StatusAccepted, s.building.GetSnapshot())
}

type selectBody struct {
	ElevatorID int `json:"elevatorId"`
	Floor      int `json:"floor"`
}

func (s *Server) selectFloor(w http.ResponseWriter, r *http.Request) {
	var body selectBody
	if err := decodeJSON(r, &body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_body", err.Error())
		return
	}
	if err := s.building.Select(body.ElevatorID, body.Floor); err != nil {
		writeError(w, http.StatusBadRequest, errorCode(err), err.Error())
		return
	}
	writeJSON(w, http.StatusAccepted, s.building.GetSnapshot())
}

func (s *Server) tick(w http.ResponseWriter, r *http.Request) {
	steps := 1
	if q := r.URL.Query().Get("steps"); q != "" {
		n, err := strconv.Atoi(q)
		if err != nil || n < 1 || n > 200 {
			writeError(w, http.StatusBadRequest, "invalid_steps", "steps must be an integer in [1,200]")
			return
		}
		steps = n
	}
	for i := 0; i < steps; i++ {
		s.building.Tick()
	}
	writeJSON(w, http.StatusOK, s.building.GetSnapshot())
}

type resetBody struct {
	Floors    int `json:"floors"`
	Elevators int `json:"elevators"`
}

func (s *Server) reset(w http.ResponseWriter, r *http.Request) {
	var body resetBody
	if err := decodeJSON(r, &body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_body", err.Error())
		return
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	if body.Floors == 0 {
		body.Floors = s.floors
	}
	if body.Elevators == 0 {
		body.Elevators = s.cabins
	}
	b, err := elevator.NewBuilding(body.Floors, body.Elevators)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid_config", err.Error())
		return
	}
	s.building = b
	s.floors = body.Floors
	s.cabins = body.Elevators
	writeJSON(w, http.StatusOK, s.building.GetSnapshot())
}

func (s *Server) notFound(w http.ResponseWriter, _ *http.Request) {
	writeError(w, http.StatusNotFound, "not_found", "route not found")
}

func (s *Server) methodNotAllowed(w http.ResponseWriter, _ *http.Request) {
	writeError(w, http.StatusMethodNotAllowed, "method_not_allowed", "method not allowed for route")
}

func errorCode(err error) string {
	switch {
	case errors.Is(err, elevator.ErrInvalidFloor):
		return "invalid_floor"
	case errors.Is(err, elevator.ErrInvalidElevator):
		return "invalid_elevator"
	case errors.Is(err, elevator.ErrInvalidDirection):
		return "invalid_direction"
	case errors.Is(err, elevator.ErrInvalidConfig):
		return "invalid_config"
	default:
		return "bad_request"
	}
}

func writeJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}

func writeError(w http.ResponseWriter, status int, code, message string) {
	writeJSON(w, status, map[string]string{
		"error":   code,
		"message": message,
	})
}

func decodeJSON(r *http.Request, dst any) error {
	dec := json.NewDecoder(r.Body)
	dec.DisallowUnknownFields()
	return dec.Decode(dst)
}

// spaFallback serves static files but falls back to index.html for unknown
// paths so deep links into the SPA still work.
func spaFallback(root string, fs http.Handler) http.Handler {
	indexPath := filepath.Join(root, "index.html")
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		path := filepath.Join(root, filepath.Clean(r.URL.Path))
		if path == root || !fileExists(path) {
			http.ServeFile(w, r, indexPath)
			return
		}
		fs.ServeHTTP(w, r)
	})
}
