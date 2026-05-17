package elevator

import (
	"errors"
	"testing"
)

func TestNewBuildingErrorsWrapInvalidConfig(t *testing.T) {
	_, err := NewBuilding(1, 1)
	if !errors.Is(err, ErrInvalidConfig) {
		t.Fatalf("expected ErrInvalidConfig sentinel, got %v", err)
	}
	_, err = NewBuilding(10, 99)
	if !errors.Is(err, ErrInvalidConfig) {
		t.Fatalf("expected ErrInvalidConfig sentinel, got %v", err)
	}
}

func TestCallInvalidFloorWrapsSentinel(t *testing.T) {
	b, _ := NewBuilding(10, 1)
	err := b.Call(0, DirectionUp)
	if !errors.Is(err, ErrInvalidFloor) {
		t.Fatalf("expected ErrInvalidFloor, got %v", err)
	}
	err = b.Call(11, DirectionUp)
	if !errors.Is(err, ErrInvalidFloor) {
		t.Fatalf("expected ErrInvalidFloor, got %v", err)
	}
}

func TestCallSidewaysIsInvalidDirection(t *testing.T) {
	b, _ := NewBuilding(10, 1)
	err := b.Call(5, Direction("sideways"))
	if !errors.Is(err, ErrInvalidDirection) {
		t.Fatalf("expected ErrInvalidDirection, got %v", err)
	}
}

func TestSelectIgnoresCurrentFloor(t *testing.T) {
	b, _ := NewBuilding(10, 1)
	if err := b.Select(1, 1); err != nil {
		t.Fatalf("select on current floor returned error: %v", err)
	}
	if got := len(b.Elevators[0].Queue); got != 0 {
		t.Fatalf("expected queue to stay empty, got %d entries", got)
	}
}

func TestSelectInvalidElevatorWrapsSentinel(t *testing.T) {
	b, _ := NewBuilding(10, 2)
	err := b.Select(99, 4)
	if !errors.Is(err, ErrInvalidElevator) {
		t.Fatalf("expected ErrInvalidElevator, got %v", err)
	}
}

func TestSelectSetsDirectionForIdleCabin(t *testing.T) {
	b, _ := NewBuilding(10, 1)
	b.Elevators[0].CurrentFloor = 5
	if err := b.Select(1, 2); err != nil {
		t.Fatalf("select: %v", err)
	}
	if got := b.Elevators[0].Direction; got != DirectionDown {
		t.Fatalf("expected direction=down, got %q", got)
	}
}

func TestGetSnapshotIsADeepCopy(t *testing.T) {
	b, _ := NewBuilding(10, 1)
	if err := b.Select(1, 6); err != nil {
		t.Fatalf("select: %v", err)
	}
	if err := b.Call(4, DirectionUp); err != nil {
		t.Fatalf("call: %v", err)
	}
	snap := b.GetSnapshot()
	snap.Elevators[0].Queue[0] = 99
	snap.Calls[0].Floor = 99
	if b.Elevators[0].Queue[0] == 99 {
		t.Fatalf("snapshot mutation leaked into elevator queue")
	}
	if b.Calls[0].Floor == 99 {
		t.Fatalf("snapshot mutation leaked into pending calls")
	}
}

func TestHasStopReportsQueueContents(t *testing.T) {
	e := &Elevator{Queue: []int{3, 5, 7}}
	if !e.HasStop(5) {
		t.Fatalf("expected HasStop(5) to be true")
	}
	if e.HasStop(4) {
		t.Fatalf("expected HasStop(4) to be false")
	}
}

func TestAddStopDeduplicates(t *testing.T) {
	e := &Elevator{CurrentFloor: 1, Direction: DirectionUp}
	e.AddStop(3)
	e.AddStop(3)
	e.AddStop(5)
	if got := len(e.Queue); got != 2 {
		t.Fatalf("expected 2 unique stops, got %d (%v)", got, e.Queue)
	}
}

func TestSortQueueDownwardOrderIsDescending(t *testing.T) {
	e := &Elevator{CurrentFloor: 9, Direction: DirectionDown, Queue: []int{2, 7, 4}}
	e.sortQueue()
	want := []int{7, 4, 2}
	for i, f := range want {
		if e.Queue[i] != f {
			t.Fatalf("expected %v, got %v", want, e.Queue)
		}
	}
}
