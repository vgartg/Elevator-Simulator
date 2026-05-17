package elevator

// Tick advances the simulation by one discrete step. See the package
// overview for the full tick contract.
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

// advance moves a single cabin one floor toward the head of its queue,
// opens its doors on arrival, and re-sorts the remaining stops so the
// cabin keeps sweeping in its travel direction.
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
	if e.CurrentFloor != target {
		return
	}
	e.DoorsOpen = true
	e.Queue = e.Queue[1:]
	b.Stats.StopsServed++
	if len(e.Queue) == 0 {
		e.Direction = DirectionIdle
		return
	}
	e.sortQueue()
}
