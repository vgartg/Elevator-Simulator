package elevator

import "sort"

// Version is the simulator core version.
const Version = "1.0.0"

// Direction describes the current travel intent of an elevator.
type Direction string

const (
	DirectionIdle Direction = "idle"
	DirectionUp   Direction = "up"
	DirectionDown Direction = "down"
)

// Elevator is a single cabin moving inside a shaft.
type Elevator struct {
	ID           int       `json:"id"`
	CurrentFloor int       `json:"currentFloor"`
	Direction    Direction `json:"direction"`
	DoorsOpen    bool      `json:"doorsOpen"`
	Queue        []int     `json:"queue"`
}

// Call is a pending hall call awaiting dispatch.
type Call struct {
	Floor     int       `json:"floor"`
	Direction Direction `json:"direction"`
}

// Stats summarises lifetime simulator activity.
type Stats struct {
	Ticks        int `json:"ticks"`
	StopsServed  int `json:"stopsServed"`
	CallsPlaced  int `json:"callsPlaced"`
	CallsServed  int `json:"callsServed"`
}

// HasStop reports whether the elevator already plans to stop at floor.
func (e *Elevator) HasStop(floor int) bool {
	for _, f := range e.Queue {
		if f == floor {
			return true
		}
	}
	return false
}

// AddStop inserts floor into the queue if not already present.
func (e *Elevator) AddStop(floor int) {
	if e.HasStop(floor) || floor == e.CurrentFloor {
		return
	}
	e.Queue = append(e.Queue, floor)
	e.sortQueue()
}

// sortQueue orders pending stops in the direction of travel so the
// elevator sweeps without backtracking — classic SCAN/LOOK behavior.
func (e *Elevator) sortQueue() {
	if len(e.Queue) < 2 {
		return
	}
	sort.SliceStable(e.Queue, func(i, j int) bool {
		a, b := e.Queue[i], e.Queue[j]
		switch e.Direction {
		case DirectionDown:
			return a > b
		default:
			return a < b
		}
	})
}
