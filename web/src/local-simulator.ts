import type { Call, Direction, Snapshot } from './types';

const MIN_FLOORS = 2;
const MAX_FLOORS = 50;
const MIN_CABINS = 1;
const MAX_CABINS = 8;

export class LocalError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'LocalError';
  }
}

interface Cabin {
  id: number;
  currentFloor: number;
  direction: Direction;
  doorsOpen: boolean;
  queue: number[];
}

interface SimState {
  floors: number;
  cabins: Cabin[];
  calls: Call[];
  stats: { ticks: number; stopsServed: number; callsPlaced: number; callsServed: number };
}

let state = build(10, 2);

function build(floors: number, cabins: number): SimState {
  if (floors < MIN_FLOORS || floors > MAX_FLOORS) {
    throw new LocalError('invalid_config', `floors must be in [${MIN_FLOORS},${MAX_FLOORS}]`);
  }
  if (cabins < MIN_CABINS || cabins > MAX_CABINS) {
    throw new LocalError('invalid_config', `elevators must be in [${MIN_CABINS},${MAX_CABINS}]`);
  }
  return {
    floors,
    cabins: Array.from({ length: cabins }, (_, i) => ({
      id: i + 1,
      currentFloor: 1,
      direction: 'idle',
      doorsOpen: false,
      queue: [],
    })),
    calls: [],
    stats: { ticks: 0, stopsServed: 0, callsPlaced: 0, callsServed: 0 },
  };
}

function snap(): Snapshot {
  return {
    floors: state.floors,
    elevators: state.cabins.map((c) => ({ ...c, queue: [...c.queue] })),
    calls: state.calls.map((c) => ({ ...c })),
    stats: { ...state.stats },
  };
}

function sortQueue(c: Cabin): void {
  if (c.queue.length < 2) return;
  c.queue.sort((a, b) => (c.direction === 'down' ? b - a : a - b));
}

function addStop(c: Cabin, floor: number): void {
  if (floor === c.currentFloor || c.queue.includes(floor)) return;
  c.queue.push(floor);
  sortQueue(c);
}

function dispatchCost(e: Cabin, c: Call, floors: number): number {
  const distance = Math.abs(e.currentFloor - c.floor);
  switch (e.direction) {
    case 'idle':
      return distance;
    case 'up':
      return c.floor >= e.currentFloor && c.direction === 'up' ? distance : distance + floors;
    case 'down':
      return c.floor <= e.currentFloor && c.direction === 'down' ? distance : distance + floors;
    default:
      return distance + 2 * floors;
  }
}

function dispatchCalls(): void {
  if (state.calls.length === 0 || state.cabins.length === 0) return;
  const remaining: Call[] = [];
  for (const call of state.calls) {
    let winner: Cabin | null = null;
    let bestCost = Number.POSITIVE_INFINITY;
    for (const c of state.cabins) {
      const cost = dispatchCost(c, call, state.floors);
      if (cost < bestCost) {
        bestCost = cost;
        winner = c;
      }
    }
    if (!winner) {
      remaining.push(call);
      continue;
    }
    addStop(winner, call.floor);
    if (winner.direction === 'idle') {
      winner.direction =
        call.floor > winner.currentFloor
          ? 'up'
          : call.floor < winner.currentFloor
            ? 'down'
            : call.direction;
      sortQueue(winner);
    }
    state.stats.callsServed++;
  }
  state.calls = remaining;
}

function advance(c: Cabin): void {
  if (c.queue.length === 0) {
    c.direction = 'idle';
    return;
  }
  const target = c.queue[0]!;
  if (target > c.currentFloor) {
    c.direction = 'up';
    c.currentFloor++;
  } else if (target < c.currentFloor) {
    c.direction = 'down';
    c.currentFloor--;
  }
  if (c.currentFloor !== target) return;
  c.doorsOpen = true;
  c.queue.shift();
  state.stats.stopsServed++;
  if (c.queue.length === 0) c.direction = 'idle';
  else sortQueue(c);
}

function tickOnce(): void {
  for (const c of state.cabins) if (c.doorsOpen) c.doorsOpen = false;
  dispatchCalls();
  for (const c of state.cabins) advance(c);
  state.stats.ticks++;
}

export const local = {
  health: () => ({ status: 'demo', version: '1.0.0' }),
  config: () => ({ floors: state.floors, elevators: state.cabins.length }),
  state: () => snap(),
  call(floor: number, direction: Direction): Snapshot {
    if (!Number.isInteger(floor) || floor < 1 || floor > state.floors) {
      throw new LocalError('invalid_floor', 'invalid floor');
    }
    if (direction !== 'up' && direction !== 'down') {
      throw new LocalError('invalid_direction', 'invalid direction');
    }
    if ((floor === 1 && direction === 'down') || (floor === state.floors && direction === 'up')) {
      throw new LocalError('invalid_direction', 'invalid direction');
    }
    if (!state.calls.some((c) => c.floor === floor && c.direction === direction)) {
      state.calls.push({ floor, direction });
      state.stats.callsPlaced++;
    }
    return snap();
  },
  select(elevatorId: number, floor: number): Snapshot {
    if (!Number.isInteger(floor) || floor < 1 || floor > state.floors) {
      throw new LocalError('invalid_floor', 'invalid floor');
    }
    const e = state.cabins.find((c) => c.id === elevatorId);
    if (!e) throw new LocalError('invalid_elevator', 'invalid elevator id');
    if (floor === e.currentFloor) return snap();
    addStop(e, floor);
    if (e.direction === 'idle') {
      e.direction = floor > e.currentFloor ? 'up' : 'down';
      sortQueue(e);
    }
    return snap();
  },
  tick(steps: number): Snapshot {
    if (!Number.isInteger(steps) || steps < 1 || steps > 200) {
      throw new LocalError('invalid_steps', 'steps must be an integer in [1,200]');
    }
    for (let i = 0; i < steps; i++) tickOnce();
    return snap();
  },
  reset(floors: number, elevators: number): Snapshot {
    state = build(floors || state.floors, elevators || state.cabins.length);
    return snap();
  },
};
