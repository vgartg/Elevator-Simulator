package elevator

import (
	"errors"
	"fmt"
	"sync"
)

const (
	minFloors    = 2
	maxFloors    = 50
	minElevators = 1
	maxElevators = 8
)

// ErrInvalidFloor is returned when a floor is outside [1, Floors].
var ErrInvalidFloor = errors.New("invalid floor")

// ErrInvalidElevator is returned when an elevator id is unknown.
var ErrInvalidElevator = errors.New("invalid elevator id")

// ErrInvalidDirection is returned when a hall call direction is neither up nor down.
var ErrInvalidDirection = errors.New("invalid direction")

// ErrInvalidConfig is returned when a reset is attempted with out-of-range geometry.
var ErrInvalidConfig = errors.New("invalid building configuration")

// Building owns every elevator and the global call queue.
type Building struct {
	mu        sync.Mutex
	Floors    int
	Elevators []*Elevator
	Calls     []Call
	Stats     Stats
}

// Snapshot is the JSON-friendly view of the building's current state.
type Snapshot struct {
	Floors    int        `json:"floors"`
	Elevators []Elevator `json:"elevators"`
	Calls     []Call     `json:"calls"`
	Stats     Stats      `json:"stats"`
}

// NewBuilding builds a fresh simulation with the given geometry. Elevators
// start parked on floor 1, doors closed, idle.
func NewBuilding(floors, cabins int) (*Building, error) {
	if floors < minFloors || floors > maxFloors {
		return nil, fmt.Errorf("%w: floors must be in [%d,%d]", ErrInvalidConfig, minFloors, maxFloors)
	}
	if cabins < minElevators || cabins > maxElevators {
		return nil, fmt.Errorf("%w: elevators must be in [%d,%d]", ErrInvalidConfig, minElevators, maxElevators)
	}
	b := &Building{Floors: floors}
	for i := 1; i <= cabins; i++ {
		b.Elevators = append(b.Elevators, &Elevator{
			ID:           i,
			CurrentFloor: 1,
			Direction:    DirectionIdle,
			Queue:        []int{},
		})
	}
	return b, nil
}

// Snapshot copies the current state for safe serialization outside the lock.
func (b *Building) GetSnapshot() Snapshot {
	b.mu.Lock()
	defer b.mu.Unlock()

	cabins := make([]Elevator, len(b.Elevators))
	for i, e := range b.Elevators {
		queue := make([]int, len(e.Queue))
		copy(queue, e.Queue)
		cabins[i] = Elevator{
			ID:           e.ID,
			CurrentFloor: e.CurrentFloor,
			Direction:    e.Direction,
			DoorsOpen:    e.DoorsOpen,
			Queue:        queue,
		}
	}
	calls := make([]Call, len(b.Calls))
	copy(calls, b.Calls)
	return Snapshot{
		Floors:    b.Floors,
		Elevators: cabins,
		Calls:     calls,
		Stats:     b.Stats,
	}
}

// Call places a hall call from floor in the given direction. The call is
// queued for dispatch on the next tick.
func (b *Building) Call(floor int, dir Direction) error {
	if floor < 1 || floor > b.Floors {
		return ErrInvalidFloor
	}
	if dir != DirectionUp && dir != DirectionDown {
		return ErrInvalidDirection
	}
	if (floor == 1 && dir == DirectionDown) || (floor == b.Floors && dir == DirectionUp) {
		return ErrInvalidDirection
	}
	b.mu.Lock()
	defer b.mu.Unlock()

	for _, c := range b.Calls {
		if c.Floor == floor && c.Direction == dir {
			return nil
		}
	}
	b.Calls = append(b.Calls, Call{Floor: floor, Direction: dir})
	b.Stats.CallsPlaced++
	return nil
}

// Select adds an in-cabin destination to a specific elevator.
func (b *Building) Select(elevatorID, floor int) error {
	if floor < 1 || floor > b.Floors {
		return ErrInvalidFloor
	}
	b.mu.Lock()
	defer b.mu.Unlock()
	e := b.findElevator(elevatorID)
	if e == nil {
		return ErrInvalidElevator
	}
	if floor == e.CurrentFloor {
		return nil
	}
	e.AddStop(floor)
	if e.Direction == DirectionIdle {
		if floor > e.CurrentFloor {
			e.Direction = DirectionUp
		} else {
			e.Direction = DirectionDown
		}
		e.sortQueue()
	}
	return nil
}

func (b *Building) findElevator(id int) *Elevator {
	for _, e := range b.Elevators {
		if e.ID == id {
			return e
		}
	}
	return nil
}
