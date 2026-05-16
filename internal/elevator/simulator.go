package elevator

// Tick advances the simulation by one discrete step.
//
// Order of operations:
//  1. Each elevator with open doors closes them
//  2. Pending hall calls are dispatched to the most suitable elevator
//  3. Each elevator moves one floor toward the next target in its queue,
//     opens doors on arrival, and clears that stop
func (b *Building) Tick() {
	b.mu.Lock()
	defer b.mu.Unlock()

	for _, e := range b.Elevators {
		if e.DoorsOpen {
			e.DoorsOpen = false
		}
	}

	b.dispatchCalls()

	for _, e := range b.Elevators {
		b.advance(e)
	}

	b.Stats.Ticks++
}

func (b *Building) advance(e *Elevator) {
	if len(e.Queue) == 0 {
		e.Direction = DirectionIdle
		return
	}
	target := e.Queue[0]
	switch {
	case target > e.CurrentFloor:
		e.Direction = DirectionUp
		e.CurrentFloor++
	case target < e.CurrentFloor:
		e.Direction = DirectionDown
		e.CurrentFloor--
	}
	if e.CurrentFloor == target {
		e.DoorsOpen = true
		e.Queue = e.Queue[1:]
		b.Stats.StopsServed++
		if len(e.Queue) == 0 {
			e.Direction = DirectionIdle
		} else {
			e.sortQueue()
		}
	}
}

// dispatchCalls assigns each pending hall call to the cabin with the
// lowest dispatch cost — closest in distance, with a small penalty when
// the cabin would need to reverse direction.
func (b *Building) dispatchCalls() {
	if len(b.Calls) == 0 || len(b.Elevators) == 0 {
		return
	}
	remaining := b.Calls[:0]
	for _, c := range b.Calls {
		best := -1
		bestCost := 1 << 30
		for i, e := range b.Elevators {
			cost := dispatchCost(e, c, b.Floors)
			if cost < bestCost {
				bestCost = cost
				best = i
			}
		}
		if best == -1 {
			remaining = append(remaining, c)
			continue
		}
		e := b.Elevators[best]
		e.AddStop(c.Floor)
		if e.Direction == DirectionIdle {
			if c.Floor > e.CurrentFloor {
				e.Direction = DirectionUp
			} else if c.Floor < e.CurrentFloor {
				e.Direction = DirectionDown
			} else {
				e.Direction = c.Direction
			}
			e.sortQueue()
		}
		b.Stats.CallsServed++
	}
	b.Calls = remaining
}

func dispatchCost(e *Elevator, c Call, floors int) int {
	abs := func(x int) int {
		if x < 0 {
			return -x
		}
		return x
	}
	distance := abs(e.CurrentFloor - c.Floor)
	switch e.Direction {
	case DirectionIdle:
		return distance
	case DirectionUp:
		if c.Floor >= e.CurrentFloor && c.Direction == DirectionUp {
			return distance
		}
		return distance + floors
	case DirectionDown:
		if c.Floor <= e.CurrentFloor && c.Direction == DirectionDown {
			return distance
		}
		return distance + floors
	default:
		return distance + 2*floors
	}
}
