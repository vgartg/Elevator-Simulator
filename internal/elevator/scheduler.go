package elevator

// reversePenalty is the cost added to a cabin's bid for a hall call when
// taking the call would require the cabin to flip direction. It is set
// to one full building height so a cabin already heading the right way
// always beats a cabin that would have to reverse, even from one floor
// closer.
type reversePenalty struct{ floors int }

func (p reversePenalty) score(distance int, mustReverse bool) int {
	if mustReverse {
		return distance + p.floors
	}
	return distance
}

// dispatchCalls assigns each pending hall call to the cabin with the
// lowest dispatch cost, then drops the served calls from the queue.
//
// Each iteration recomputes costs against the current cabin state — a
// cabin that was awarded an earlier call this tick may now be the best
// pick for a subsequent call because its direction has changed.
func (b *Building) dispatchCalls() {
	if len(b.Calls) == 0 || len(b.Elevators) == 0 {
		return
	}
	remaining := b.Calls[:0]
	for _, c := range b.Calls {
		if winner := b.pickCabin(c); winner != nil {
			b.assignCallTo(winner, c)
			b.Stats.CallsServed++
			continue
		}
		remaining = append(remaining, c)
	}
	b.Calls = remaining
}

// pickCabin returns the lowest-cost cabin for a hall call, or nil if the
// building has no cabins at all.
func (b *Building) pickCabin(c Call) *Elevator {
	const sentinel = 1 << 30
	bestCost := sentinel
	var winner *Elevator
	for _, e := range b.Elevators {
		cost := dispatcherCost(e, c, b.Floors)
		if cost < bestCost {
			bestCost = cost
			winner = e
		}
	}
	return winner
}

// assignCallTo enqueues c on the cabin and updates the cabin's intended
// direction if it was previously idle.
func (b *Building) assignCallTo(e *Elevator, c Call) {
	e.AddStop(c.Floor)
	if e.Direction != DirectionIdle {
		return
	}
	switch {
	case c.Floor > e.CurrentFloor:
		e.Direction = DirectionUp
	case c.Floor < e.CurrentFloor:
		e.Direction = DirectionDown
	default:
		e.Direction = c.Direction
	}
	e.sortQueue()
}

// dispatcherCost is the SCAN/LOOK heuristic. See the package overview
// for the rationale.
func dispatcherCost(e *Elevator, c Call, floors int) int {
	penalty := reversePenalty{floors: floors}
	distance := absInt(e.CurrentFloor - c.Floor)
	switch e.Direction {
	case DirectionIdle:
		return distance
	case DirectionUp:
		sameWay := c.Floor >= e.CurrentFloor && c.Direction == DirectionUp
		return penalty.score(distance, !sameWay)
	case DirectionDown:
		sameWay := c.Floor <= e.CurrentFloor && c.Direction == DirectionDown
		return penalty.score(distance, !sameWay)
	default:
		return distance + 2*floors
	}
}

func absInt(x int) int {
	if x < 0 {
		return -x
	}
	return x
}
