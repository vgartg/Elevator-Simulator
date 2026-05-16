package elevator

import "testing"

func TestNewBuildingRejectsBadConfig(t *testing.T) {
	cases := []struct {
		name        string
		floors      int
		elevators   int
		expectError bool
	}{
		{"valid", 10, 2, false},
		{"floors too low", 1, 1, true},
		{"floors too high", 999, 1, true},
		{"elevators too low", 10, 0, true},
		{"elevators too high", 10, 99, true},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			_, err := NewBuilding(tc.floors, tc.elevators)
			if (err != nil) != tc.expectError {
				t.Fatalf("got err=%v, expectError=%v", err, tc.expectError)
			}
		})
	}
}

func TestCallRejectsImpossibleDirections(t *testing.T) {
	b, _ := NewBuilding(10, 1)
	if err := b.Call(1, DirectionDown); err == nil {
		t.Fatal("expected error calling down from ground floor")
	}
	if err := b.Call(10, DirectionUp); err == nil {
		t.Fatal("expected error calling up from top floor")
	}
	if err := b.Call(5, DirectionUp); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestCallDeduplicates(t *testing.T) {
	b, _ := NewBuilding(10, 1)
	for i := 0; i < 3; i++ {
		if err := b.Call(5, DirectionUp); err != nil {
			t.Fatalf("call %d failed: %v", i, err)
		}
	}
	if got := len(b.Calls); got != 1 {
		t.Fatalf("expected 1 queued call after dedup, got %d", got)
	}
}

func TestTickMovesElevatorTowardTarget(t *testing.T) {
	b, _ := NewBuilding(10, 1)
	if err := b.Select(1, 4); err != nil {
		t.Fatalf("select: %v", err)
	}
	b.Tick()
	b.Tick()
	b.Tick()
	snap := b.GetSnapshot()
	if snap.Elevators[0].CurrentFloor != 4 {
		t.Fatalf("expected floor 4 after 3 ticks, got %d", snap.Elevators[0].CurrentFloor)
	}
	if !snap.Elevators[0].DoorsOpen {
		t.Fatal("expected doors open on arrival")
	}
}

func TestDispatchPicksClosestIdleElevator(t *testing.T) {
	b, _ := NewBuilding(10, 2)
	b.Elevators[0].CurrentFloor = 1
	b.Elevators[1].CurrentFloor = 8

	if err := b.Call(7, DirectionDown); err != nil {
		t.Fatalf("call: %v", err)
	}
	b.Tick()

	if len(b.Elevators[1].Queue) == 0 && b.Elevators[1].CurrentFloor != 7 {
		t.Fatalf("expected elevator #2 to take the call, got queues %v and %v",
			b.Elevators[0].Queue, b.Elevators[1].Queue)
	}
}

func TestStopsServedCounter(t *testing.T) {
	b, _ := NewBuilding(5, 1)
	if err := b.Select(1, 3); err != nil {
		t.Fatalf("select: %v", err)
	}
	for i := 0; i < 5; i++ {
		b.Tick()
	}
	if b.Stats.StopsServed != 1 {
		t.Fatalf("expected 1 stop served, got %d", b.Stats.StopsServed)
	}
}
