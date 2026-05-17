// Package elevator implements a small tick-based simulation of a building
// with one or more elevator cabins and a global hall-call queue.
//
// # Model
//
// A [Building] owns a fixed number of floors and a slice of [Elevator]
// instances. Every cabin tracks its current floor, intended [Direction],
// whether its doors are open, and an ordered queue of pending stops.
// Two kinds of stop sources feed that queue:
//
//   - hall calls, placed from a floor via [Building.Call] with a desired
//     travel direction
//   - in-cabin selections, placed for a specific elevator via
//     [Building.Select] with a destination floor
//
// Hall calls are buffered on the building rather than the cabin so the
// scheduler can choose which cabin should serve them on each tick.
//
// # Tick semantics
//
// [Building.Tick] advances the simulation by one discrete step. Each tick:
//
//  1. Cabins with open doors close them — passengers had exactly one tick
//     to board or disembark
//  2. The dispatcher assigns every pending hall call to the cabin with
//     the lowest cost (see the SCAN/LOOK heuristic below)
//  3. Every cabin moves one floor toward the head of its queue, opens
//     its doors on arrival, and clears that stop from the queue
//
// This ordering means a hall call placed mid-tick never gets served the
// same tick — the test [TestStopsServedCounter] in this package exercises
// the timing.
//
// # Scheduling heuristic
//
// The dispatcher uses a SCAN/LOOK-style cost function defined in
// [dispatcherCost]. A cabin's cost for a call is the absolute floor
// distance plus a "reverse penalty" equal to one full building height
// whenever taking the call would require flipping direction. Idle cabins
// have no penalty. Ties resolve toward the first-found cabin, which is
// stable across ticks for repeatable scheduling.
//
// Once a cabin has more than one stop, its queue is re-sorted in the
// direction of travel so the cabin sweeps without backtracking. This
// is the LOOK variant of SCAN — the cabin only reverses when no further
// stops exist in the current direction.
//
// # Concurrency
//
// Every public method on [Building] takes an internal mutex, so callers
// may safely place calls and select destinations from multiple goroutines.
// [Building.GetSnapshot] returns a deep copy of every cabin queue and call,
// safe to serialize after the lock is released.
//
// # Error sentinels
//
// All validation errors wrap one of the exported sentinels —
// [ErrInvalidFloor], [ErrInvalidElevator], [ErrInvalidDirection], or
// [ErrInvalidConfig] — so callers can branch on failure modes with
// [errors.Is] instead of matching strings.
package elevator
