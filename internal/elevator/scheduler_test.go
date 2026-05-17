package elevator

import "testing"

func TestDispatcherCostIdleCabinReturnsDistance(t *testing.T) {
	e := &Elevator{ID: 1, CurrentFloor: 3, Direction: DirectionIdle}
	call := Call{Floor: 7, Direction: DirectionUp}
	if got := dispatcherCost(e, call, 10); got != 4 {
		t.Fatalf("expected distance 4, got %d", got)
	}
}

func TestDispatcherCostUpwardSameDirectionNoPenalty(t *testing.T) {
	e := &Elevator{ID: 1, CurrentFloor: 2, Direction: DirectionUp}
	call := Call{Floor: 6, Direction: DirectionUp}
	if got := dispatcherCost(e, call, 10); got != 4 {
		t.Fatalf("expected distance 4 (same direction, ahead), got %d", got)
	}
}

func TestDispatcherCostUpwardReversePenalised(t *testing.T) {
	e := &Elevator{ID: 1, CurrentFloor: 8, Direction: DirectionUp}
	call := Call{Floor: 3, Direction: DirectionDown}
	got := dispatcherCost(e, call, 10)
	want := 5 + 10
	if got != want {
		t.Fatalf("expected distance %d (with reverse penalty), got %d", want, got)
	}
}

func TestDispatcherCostDownwardSameDirectionNoPenalty(t *testing.T) {
	e := &Elevator{ID: 1, CurrentFloor: 9, Direction: DirectionDown}
	call := Call{Floor: 4, Direction: DirectionDown}
	if got := dispatcherCost(e, call, 10); got != 5 {
		t.Fatalf("expected distance 5 (same direction, ahead), got %d", got)
	}
}

func TestDispatcherPicksCabinAlreadyHeadingTowardsCall(t *testing.T) {
	b, _ := NewBuilding(10, 2)
	b.Elevators[0].CurrentFloor = 1
	b.Elevators[0].Direction = DirectionIdle
	b.Elevators[1].CurrentFloor = 4
	b.Elevators[1].Direction = DirectionUp
	b.Elevators[1].Queue = []int{8}

	if err := b.Call(7, DirectionUp); err != nil {
		t.Fatalf("call: %v", err)
	}
	b.Tick()

	queued := false
	for _, f := range b.Elevators[1].Queue {
		if f == 7 {
			queued = true
		}
	}
	if !queued {
		t.Fatalf("expected the up-bound cabin to own the call, queues=%v %v",
			b.Elevators[0].Queue, b.Elevators[1].Queue)
	}
}

func TestDispatcherPrefersIdleCabinWhenOtherWouldReverse(t *testing.T) {
	b, _ := NewBuilding(10, 2)
	b.Elevators[0].CurrentFloor = 5
	b.Elevators[0].Direction = DirectionIdle
	b.Elevators[1].CurrentFloor = 6
	b.Elevators[1].Direction = DirectionUp
	b.Elevators[1].Queue = []int{9}

	if err := b.Call(3, DirectionDown); err != nil {
		t.Fatalf("call: %v", err)
	}
	b.Tick()

	picked := -1
	for i, e := range b.Elevators {
		for _, f := range e.Queue {
			if f == 3 {
				picked = i
			}
		}
	}
	if picked != 0 {
		t.Fatalf("expected idle cabin #1 to take the call, picked index=%d", picked)
	}
}

func TestDispatcherSurvivesEmptyCabinList(t *testing.T) {
	b, _ := NewBuilding(10, 1)
	b.Elevators = nil
	b.Calls = []Call{{Floor: 4, Direction: DirectionUp}}
	b.dispatchCalls()
	if len(b.Calls) != 1 {
		t.Fatalf("expected call to remain queued, got %v", b.Calls)
	}
}

func TestReversePenaltyScoreAddsHeightOnReverse(t *testing.T) {
	p := reversePenalty{floors: 12}
	if got := p.score(3, false); got != 3 {
		t.Fatalf("expected distance 3, got %d", got)
	}
	if got := p.score(3, true); got != 15 {
		t.Fatalf("expected distance 15 (with penalty), got %d", got)
	}
}
