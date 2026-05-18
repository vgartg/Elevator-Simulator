package elevator

import (
	"errors"
	"sort"
)

// ErrInvalidWindow is returned by NewMetrics when the rolling window
// size is smaller than one, which would leave the aggregator without
// any history to average over.
var ErrInvalidWindow = errors.New("elevator: metrics window must be >= 1")

// Metrics is an out-of-band observer that derives running statistics
// from successive snapshots of a Building. It is intentionally
// decoupled from the simulator core — anything that can hand it a
// Snapshot (the in-process Building, a replay file, an HTTP poller)
// can drive it without touching the dispatcher's hot path.
//
// Metrics is not safe for concurrent use; callers should serialise
// Observe and Report calls behind their own lock when crossing
// goroutines.
type Metrics struct {
	floors      int
	cabins      int
	window      int
	ticks       int
	queueDepth  []int
	idleCabins  []int
	movingCab   []int
	servedStops []int
	heatmap     []int
	pending     map[callKey]int
	waitSamples []int
}

type callKey struct {
	floor int
	dir   Direction
}

// NewMetrics returns a Metrics aggregator sized for a building of the
// given geometry. The window parameter caps the rolling history kept
// for queue depth and cabin states so long-running simulations don't
// grow unbounded; pass a large value (e.g. 4096) to disable trimming
// for short runs.
func NewMetrics(floors, cabins, window int) (*Metrics, error) {
	if floors < 1 || cabins < 1 {
		return nil, ErrInvalidConfig
	}
	if window < 1 {
		return nil, ErrInvalidWindow
	}
	return &Metrics{
		floors:      floors,
		cabins:      cabins,
		window:      window,
		queueDepth:  make([]int, 0, window),
		idleCabins:  make([]int, 0, window),
		movingCab:   make([]int, 0, window),
		servedStops: make([]int, 0, window),
		heatmap:     make([]int, floors),
		pending:     make(map[callKey]int),
		waitSamples: make([]int, 0, 64),
	}, nil
}

// Observe folds a fresh Snapshot into the running aggregates. The
// caller is expected to invoke Observe once per simulated tick — the
// internal tick counter is incremented unconditionally so a missed
// call shifts every downstream average.
func (m *Metrics) Observe(s Snapshot) {
	m.ticks++

	// Hall calls: record their arrival tick the first time we see them
	// so we can compute wait-time histograms later. Anything previously
	// in the pending map but absent from this snapshot was served.
	seen := make(map[callKey]struct{}, len(s.Calls))
	for _, c := range s.Calls {
		k := callKey{c.Floor, c.Direction}
		seen[k] = struct{}{}
		if _, ok := m.pending[k]; !ok {
			m.pending[k] = m.ticks
		}
	}
	for k, arrived := range m.pending {
		if _, still := seen[k]; still {
			continue
		}
		m.waitSamples = append(m.waitSamples, m.ticks-arrived)
		delete(m.pending, k)
	}

	idle, moving := 0, 0
	for _, e := range s.Elevators {
		switch {
		case e.Direction == DirectionIdle && !e.DoorsOpen:
			idle++
		case e.Direction != DirectionIdle || e.DoorsOpen:
			moving++
		}
		if e.DoorsOpen && e.CurrentFloor >= 1 && e.CurrentFloor <= m.floors {
			m.heatmap[e.CurrentFloor-1]++
		}
	}

	m.queueDepth = appendCapped(m.queueDepth, len(s.Calls), m.window)
	m.idleCabins = appendCapped(m.idleCabins, idle, m.window)
	m.movingCab = appendCapped(m.movingCab, moving, m.window)
	m.servedStops = appendCapped(m.servedStops, s.Stats.StopsServed, m.window)
}

// Report is the derived view of everything Metrics has accumulated.
// All ratios are in the closed interval [0, 1]; averages are reported
// as floats rounded to four decimal places by callers when needed.
type Report struct {
	Ticks         int     `json:"ticks"`
	Cabins        int     `json:"cabins"`
	Floors        int     `json:"floors"`
	PeakQueue     int     `json:"peakQueue"`
	AverageQueue  float64 `json:"averageQueue"`
	AverageWait   float64 `json:"averageWait"`
	IdleRatio     float64 `json:"idleRatio"`
	StopsPerTick  float64 `json:"stopsPerTick"`
	BusiestFloor  int     `json:"busiestFloor"`
	BusiestVisits int     `json:"busiestVisits"`
	Heatmap       []int   `json:"heatmap"`
}

// Report folds the accumulated state into a Report. It is safe to call
// before any Observe — in that case every numeric field is the zero
// value and slices are empty rather than nil.
func (m *Metrics) Report(stats Stats) Report {
	r := Report{
		Ticks:   m.ticks,
		Cabins:  m.cabins,
		Floors:  m.floors,
		Heatmap: append([]int(nil), m.heatmap...),
	}
	if len(m.queueDepth) > 0 {
		sum, peak := 0, 0
		for _, q := range m.queueDepth {
			sum += q
			if q > peak {
				peak = q
			}
		}
		r.PeakQueue = peak
		r.AverageQueue = float64(sum) / float64(len(m.queueDepth))
	}
	if len(m.idleCabins) > 0 && m.cabins > 0 {
		sum := 0
		for _, n := range m.idleCabins {
			sum += n
		}
		r.IdleRatio = float64(sum) / float64(len(m.idleCabins)*m.cabins)
	}
	if m.ticks > 0 {
		r.StopsPerTick = float64(stats.StopsServed) / float64(m.ticks)
	}
	if len(m.waitSamples) > 0 {
		sum := 0
		for _, w := range m.waitSamples {
			sum += w
		}
		r.AverageWait = float64(sum) / float64(len(m.waitSamples))
	}
	r.BusiestFloor, r.BusiestVisits = busiest(m.heatmap)
	return r
}

// WaitHistogram returns a copy of the recorded per-call wait times,
// sorted ascending. Useful for printing percentiles (p50, p95) in a
// human-readable trace.
func (m *Metrics) WaitHistogram() []int {
	out := append([]int(nil), m.waitSamples...)
	sort.Ints(out)
	return out
}

// appendCapped behaves like append but trims the slice from the head
// once it grows beyond cap, preserving a sliding window.
func appendCapped(s []int, v, cap int) []int {
	s = append(s, v)
	if len(s) > cap {
		s = s[len(s)-cap:]
	}
	return s
}

// busiest returns the 1-indexed floor with the highest visit count and
// the count itself. Ties are broken by the lower floor number.
func busiest(heatmap []int) (int, int) {
	best, idx := 0, 0
	for i, v := range heatmap {
		if v > best {
			best, idx = v, i
		}
	}
	if best == 0 {
		return 0, 0
	}
	return idx + 1, best
}
