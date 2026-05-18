package elevator

import (
	"errors"
	"math"
	"testing"
)

func TestNewMetricsRejectsBadGeometry(t *testing.T) {
	cases := []struct {
		name           string
		floors, cabins int
		window         int
		want           error
	}{
		{"zero floors", 0, 2, 16, ErrInvalidConfig},
		{"negative floors", -1, 2, 16, ErrInvalidConfig},
		{"zero cabins", 8, 0, 16, ErrInvalidConfig},
		{"zero window", 8, 2, 0, ErrInvalidWindow},
		{"negative window", 8, 2, -5, ErrInvalidWindow},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			_, err := NewMetrics(tc.floors, tc.cabins, tc.window)
			if !errors.Is(err, tc.want) {
				t.Fatalf("got %v, want %v", err, tc.want)
			}
		})
	}
}

func TestEmptyReportIsZeroed(t *testing.T) {
	m, err := NewMetrics(10, 2, 32)
	if err != nil {
		t.Fatalf("setup: %v", err)
	}
	r := m.Report(Stats{})
	if r.Ticks != 0 || r.PeakQueue != 0 || r.AverageQueue != 0 || r.AverageWait != 0 {
		t.Fatalf("empty report should be zeroed, got %+v", r)
	}
	if len(r.Heatmap) != 10 {
		t.Fatalf("heatmap length: got %d want 10", len(r.Heatmap))
	}
	for i, v := range r.Heatmap {
		if v != 0 {
			t.Fatalf("heatmap[%d]: got %d want 0", i, v)
		}
	}
}

func TestObserveTracksQueueDepthAndPeak(t *testing.T) {
	m, _ := NewMetrics(6, 1, 32)
	depths := []int{0, 1, 3, 2, 4, 4, 1}
	for _, d := range depths {
		s := Snapshot{Floors: 6, Elevators: []Elevator{{ID: 1, Direction: DirectionIdle}}, Calls: makeCalls(d)}
		m.Observe(s)
	}
	r := m.Report(Stats{})
	if r.Ticks != len(depths) {
		t.Fatalf("ticks: got %d want %d", r.Ticks, len(depths))
	}
	if r.PeakQueue != 4 {
		t.Fatalf("peak queue: got %d want 4", r.PeakQueue)
	}
	wantAvg := (0 + 1 + 3 + 2 + 4 + 4 + 1) / float64(len(depths))
	if math.Abs(r.AverageQueue-wantAvg) > 1e-6 {
		t.Fatalf("avg queue: got %.4f want %.4f", r.AverageQueue, wantAvg)
	}
}

func TestObserveWaitTimes(t *testing.T) {
	m, _ := NewMetrics(6, 1, 64)

	// Tick 1: a single call arrives at floor 3
	m.Observe(Snapshot{Floors: 6, Elevators: idle(1), Calls: []Call{{Floor: 3, Direction: DirectionUp}}})
	// Tick 2: same call still pending
	m.Observe(Snapshot{Floors: 6, Elevators: idle(1), Calls: []Call{{Floor: 3, Direction: DirectionUp}}})
	// Tick 3: call still pending, plus a new one at floor 5
	m.Observe(Snapshot{Floors: 6, Elevators: idle(1), Calls: []Call{{Floor: 3, Direction: DirectionUp}, {Floor: 5, Direction: DirectionDown}}})
	// Tick 4: floor 3 served, floor 5 still pending
	m.Observe(Snapshot{Floors: 6, Elevators: idle(1), Calls: []Call{{Floor: 5, Direction: DirectionDown}}})
	// Tick 5: floor 5 served
	m.Observe(Snapshot{Floors: 6, Elevators: idle(1), Calls: nil})

	hist := m.WaitHistogram()
	if len(hist) != 2 {
		t.Fatalf("expected two recorded waits, got %d (%v)", len(hist), hist)
	}
	if hist[0] != 2 {
		t.Fatalf("shortest wait: got %d want 2", hist[0])
	}
	if hist[1] != 3 {
		t.Fatalf("longest wait: got %d want 3", hist[1])
	}
	r := m.Report(Stats{})
	if math.Abs(r.AverageWait-2.5) > 1e-6 {
		t.Fatalf("average wait: got %.4f want 2.5", r.AverageWait)
	}
}

func TestIdleRatioAndStopsPerTick(t *testing.T) {
	m, _ := NewMetrics(8, 2, 32)

	// Three ticks: cabin 1 idle, cabin 2 moving each time
	for i := 0; i < 3; i++ {
		m.Observe(Snapshot{
			Floors: 8,
			Elevators: []Elevator{
				{ID: 1, Direction: DirectionIdle},
				{ID: 2, Direction: DirectionUp},
			},
			Stats: Stats{StopsServed: i + 1},
		})
	}
	r := m.Report(Stats{StopsServed: 6})
	if math.Abs(r.IdleRatio-0.5) > 1e-6 {
		t.Fatalf("idle ratio: got %.4f want 0.5", r.IdleRatio)
	}
	if math.Abs(r.StopsPerTick-2) > 1e-6 {
		t.Fatalf("stops/tick: got %.4f want 2", r.StopsPerTick)
	}
}

func TestHeatmapAndBusiestFloor(t *testing.T) {
	m, _ := NewMetrics(5, 1, 32)
	// Door opens at floor 2, 4, 4, 4, 1, 2  →  busiest is floor 4 with 3 visits
	floors := []int{2, 4, 4, 4, 1, 2}
	for _, f := range floors {
		m.Observe(Snapshot{
			Floors: 5,
			Elevators: []Elevator{
				{ID: 1, CurrentFloor: f, Direction: DirectionIdle, DoorsOpen: true},
			},
		})
	}
	r := m.Report(Stats{})
	if r.BusiestFloor != 4 {
		t.Fatalf("busiest floor: got %d want 4", r.BusiestFloor)
	}
	if r.BusiestVisits != 3 {
		t.Fatalf("busiest visits: got %d want 3", r.BusiestVisits)
	}
	wantHeat := []int{1, 2, 0, 3, 0}
	for i, v := range wantHeat {
		if r.Heatmap[i] != v {
			t.Fatalf("heatmap[%d]: got %d want %d", i, r.Heatmap[i], v)
		}
	}
}

func TestWindowTrimsOldHistory(t *testing.T) {
	m, _ := NewMetrics(4, 1, 4)
	// Push depths well past the window — older entries should fall off
	// so peak comes only from the last four observations.
	for _, d := range []int{9, 8, 7, 6, 5, 4, 3} {
		m.Observe(Snapshot{Floors: 4, Elevators: idle(1), Calls: makeCalls(d)})
	}
	r := m.Report(Stats{})
	if r.PeakQueue != 6 {
		t.Fatalf("trimmed peak: got %d want 6 (window=4)", r.PeakQueue)
	}
}

func TestIntegrationWithBuilding(t *testing.T) {
	// End-to-end: drive a real Building, observe each tick, sanity-check
	// the resulting report matches the underlying simulator stats.
	b, err := NewBuilding(8, 2)
	if err != nil {
		t.Fatalf("new building: %v", err)
	}
	if err := b.Call(5, DirectionDown); err != nil {
		t.Fatalf("call: %v", err)
	}
	if err := b.Select(1, 7); err != nil {
		t.Fatalf("select: %v", err)
	}
	m, _ := NewMetrics(8, 2, 64)
	for i := 0; i < 12; i++ {
		b.Tick()
		m.Observe(b.GetSnapshot())
	}
	r := m.Report(b.GetSnapshot().Stats)
	if r.Ticks != 12 {
		t.Fatalf("ticks: got %d want 12", r.Ticks)
	}
	if r.StopsPerTick <= 0 {
		t.Fatalf("expected at least one stop served, got rate %.4f", r.StopsPerTick)
	}
	if r.AverageWait < 0 {
		t.Fatalf("negative wait time: %.4f", r.AverageWait)
	}
}

// — helpers —

func idle(n int) []Elevator {
	out := make([]Elevator, n)
	for i := range out {
		out[i] = Elevator{ID: i + 1, Direction: DirectionIdle}
	}
	return out
}

func makeCalls(n int) []Call {
	out := make([]Call, n)
	for i := range out {
		out[i] = Call{Floor: i + 1, Direction: DirectionUp}
	}
	return out
}
