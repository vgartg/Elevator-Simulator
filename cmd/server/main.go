package main

import (
	"encoding/json"
	"log"
	"net/http"

	"github.com/vgartg/elevator-simulator/internal/elevator"
)

var (
	state = elevator.State{
		Elevators: []elevator.Elevator{
			{
				ID:           1,
				CurrentFloor: 1,
				Direction:    "idle",
				IsMoving:     false,
				DoorsOpen:    false,
			},
			{
				ID:           2,
				CurrentFloor: 5,
				Direction:    "idle",
				IsMoving:     false,
				DoorsOpen:    false,
			},
		},
		Floors: 10,
	}
)

func getStateHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(state)
}

type callRequest struct {
	Floor int `json:"floor"`
}

func callElevatorHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req callRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	log.Printf("Call received on floor %d (mock, no action yet)", req.Floor)
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}

func main() {
	fs := http.FileServer(http.Dir("./web/static"))
	http.Handle("/", fs)

	http.HandleFunc("/api/state", getStateHandler)
	http.HandleFunc("/api/call", callElevatorHandler)
	log.Fatal(http.ListenAndServe(":8080", nil))
}
