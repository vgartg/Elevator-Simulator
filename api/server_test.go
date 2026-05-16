package api

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func newTestServer(t *testing.T) *Server {
	t.Helper()
	s, err := New(Config{Floors: 10, Elevators: 2})
	if err != nil {
		t.Fatalf("new server: %v", err)
	}
	return s
}

func do(t *testing.T, h http.Handler, method, path, body string) *httptest.ResponseRecorder {
	t.Helper()
	var r *http.Request
	if body == "" {
		r = httptest.NewRequest(method, path, nil)
	} else {
		r = httptest.NewRequest(method, path, bytes.NewBufferString(body))
		r.Header.Set("Content-Type", "application/json")
	}
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, r)
	return rec
}

func TestHealth(t *testing.T) {
	s := newTestServer(t)
	rec := do(t, s.Handler(), http.MethodGet, "/api/health", "")
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}
	var body map[string]string
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if body["status"] != "ok" {
		t.Fatalf("expected status=ok, got %q", body["status"])
	}
	if body["version"] == "" {
		t.Fatalf("expected version to be set")
	}
}

func TestConfig(t *testing.T) {
	s := newTestServer(t)
	rec := do(t, s.Handler(), http.MethodGet, "/api/config", "")
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}
	var body map[string]int
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if body["floors"] != 10 || body["elevators"] != 2 {
		t.Fatalf("unexpected config: %+v", body)
	}
}

func TestStateInitial(t *testing.T) {
	s := newTestServer(t)
	rec := do(t, s.Handler(), http.MethodGet, "/api/state", "")
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}
	if !strings.Contains(rec.Body.String(), `"elevators"`) {
		t.Fatalf("expected elevators field in body: %s", rec.Body.String())
	}
}

func TestCallHappyPath(t *testing.T) {
	s := newTestServer(t)
	rec := do(t, s.Handler(), http.MethodPost, "/api/call", `{"floor":5,"direction":"up"}`)
	if rec.Code != http.StatusAccepted {
		t.Fatalf("expected 202, got %d body=%s", rec.Code, rec.Body.String())
	}
}

func TestCallInvalidFloor(t *testing.T) {
	s := newTestServer(t)
	rec := do(t, s.Handler(), http.MethodPost, "/api/call", `{"floor":99,"direction":"up"}`)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", rec.Code)
	}
	var body map[string]string
	_ = json.Unmarshal(rec.Body.Bytes(), &body)
	if body["error"] != "invalid_floor" {
		t.Fatalf("expected invalid_floor, got %q", body["error"])
	}
}

func TestCallInvalidDirection(t *testing.T) {
	s := newTestServer(t)
	rec := do(t, s.Handler(), http.MethodPost, "/api/call", `{"floor":5,"direction":"sideways"}`)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", rec.Code)
	}
}

func TestCallTopFloorUp(t *testing.T) {
	s := newTestServer(t)
	rec := do(t, s.Handler(), http.MethodPost, "/api/call", `{"floor":10,"direction":"up"}`)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for top-floor up, got %d", rec.Code)
	}
}

func TestSelectAndTickMovesElevator(t *testing.T) {
	s := newTestServer(t)
	if rec := do(t, s.Handler(), http.MethodPost, "/api/select", `{"elevatorId":1,"floor":4}`); rec.Code != http.StatusAccepted {
		t.Fatalf("select returned %d", rec.Code)
	}
	rec := do(t, s.Handler(), http.MethodPost, "/api/tick?steps=3", "")
	if rec.Code != http.StatusOK {
		t.Fatalf("tick returned %d body=%s", rec.Code, rec.Body.String())
	}
	var snap struct {
		Elevators []struct {
			ID           int  `json:"id"`
			CurrentFloor int  `json:"currentFloor"`
			DoorsOpen    bool `json:"doorsOpen"`
		} `json:"elevators"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &snap); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if snap.Elevators[0].CurrentFloor != 4 {
		t.Fatalf("expected floor 4, got %d", snap.Elevators[0].CurrentFloor)
	}
	if !snap.Elevators[0].DoorsOpen {
		t.Fatalf("expected doors open on arrival")
	}
}

func TestTickInvalidSteps(t *testing.T) {
	s := newTestServer(t)
	rec := do(t, s.Handler(), http.MethodPost, "/api/tick?steps=abc", "")
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", rec.Code)
	}
}

func TestResetChangesGeometry(t *testing.T) {
	s := newTestServer(t)
	rec := do(t, s.Handler(), http.MethodPost, "/api/reset", `{"floors":6,"elevators":3}`)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}
	rec = do(t, s.Handler(), http.MethodGet, "/api/config", "")
	var body map[string]int
	_ = json.Unmarshal(rec.Body.Bytes(), &body)
	if body["floors"] != 6 || body["elevators"] != 3 {
		t.Fatalf("expected 6/3, got %+v", body)
	}
}

func TestUnknownRouteReturnsJSON404(t *testing.T) {
	s := newTestServer(t)
	rec := do(t, s.Handler(), http.MethodGet, "/api/unknown", "")
	if rec.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d", rec.Code)
	}
	var body map[string]string
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("expected JSON body, got %s", rec.Body.String())
	}
	if body["error"] != "not_found" {
		t.Fatalf("expected not_found, got %q", body["error"])
	}
}

func TestCORSPreflight(t *testing.T) {
	s := newTestServer(t)
	r := httptest.NewRequest(http.MethodOptions, "/api/state", nil)
	r.Header.Set("Origin", "http://example.com")
	r.Header.Set("Access-Control-Request-Method", "GET")
	rec := httptest.NewRecorder()
	s.Handler().ServeHTTP(rec, r)
	if got := rec.Header().Get("Access-Control-Allow-Origin"); got != "*" {
		t.Fatalf("expected CORS wildcard, got %q", got)
	}
}
