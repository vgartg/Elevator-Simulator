import './style.css';

import { api, ApiError } from './api';
import type { Health, Snapshot } from './types';
import { SIM, TIMING } from './design';
import { Store } from './lib/store';
import { query } from './lib/dom';
import { renderShell } from './views/shell';
import { renderHeader } from './views/header';
import { renderControls } from './views/controls';
import { BuildingView } from './views/building';
import { toast } from './views/toast';

interface AppState {
  health: Health | null;
  snapshot: Snapshot | null;
  running: boolean;
  speedMs: number;
  floors: number;
  cabins: number;
}

const store = new Store<AppState>({
  health: null,
  snapshot: null,
  running: false,
  speedMs: SIM.defaultSpeedMs,
  floors: SIM.defaultFloors,
  cabins: SIM.defaultCabins,
});

const slots = renderShell(query('#app'));
const buildingView = new BuildingView(slots.building, slots.cabinPanels, {
  onHallCall: (floor, direction) =>
    callApi(() => api.call(floor, direction), `Call F${floor} ${direction}`),
  onCabinSelect: (elevatorId, floor) =>
    callApi(() => api.select(elevatorId, floor), `Select F${floor}`),
});

let simulationTimer: number | null = null;
store.subscribe(paint);

void boot();

async function boot(): Promise<void> {
  const health = await tolerate(api.health);
  store.set({ health });

  const config = await tolerate(api.config, {
    floors: SIM.defaultFloors,
    elevators: SIM.defaultCabins,
  });
  store.set({ floors: config.floors, cabins: config.elevators });

  const snapshot = await tolerate(api.state, fallbackSnapshot(config.floors, config.elevators));
  store.set({ snapshot });

  window.setInterval(async () => {
    store.set({ health: await tolerate(api.health) });
  }, TIMING.healthPollMs);
}

function paint(state: Readonly<AppState>): void {
  renderHeader(slots.header, state.health);
  if (!state.snapshot) return;
  renderControls(
    slots.controls,
    {
      running: state.running,
      speedMs: state.speedMs,
      floors: state.floors,
      cabins: state.cabins,
    },
    state.snapshot,
    {
      onToggleRun: () => {
        const running = !store.get().running;
        store.set({ running });
        restartLoop(running, store.get().speedMs);
      },
      onStep: () => callApi(() => api.tick(1), 'Tick'),
      onSpeedChange: (ms) => {
        store.set({ speedMs: ms });
        restartLoop(store.get().running, ms);
      },
      onReset: async (floors, cabins) => {
        store.set({ running: false });
        restartLoop(false, store.get().speedMs);
        try {
          const snapshot = await api.reset(floors, cabins);
          store.set({ snapshot, floors, cabins });
          toast(`Reset · ${floors} floors / ${cabins} cabins`);
        } catch (err) {
          reportError(err, 'Reset');
        }
      },
    },
  );
  buildingView.render(state.snapshot);
}

async function callApi(fn: () => Promise<Snapshot>, label: string): Promise<void> {
  try {
    const snapshot = await fn();
    store.set({ snapshot });
  } catch (err) {
    reportError(err, label);
  }
}

function restartLoop(running: boolean, speedMs: number): void {
  if (simulationTimer !== null) {
    window.clearInterval(simulationTimer);
    simulationTimer = null;
  }
  if (!running) return;
  simulationTimer = window.setInterval(async () => {
    try {
      const snapshot = await api.tick(1);
      store.set({ snapshot });
    } catch (err) {
      store.set({ running: false });
      restartLoop(false, speedMs);
      reportError(err, 'Tick');
    }
  }, speedMs);
}

function reportError(err: unknown, prefix: string): void {
  const detail = err instanceof ApiError ? `${err.code}: ${err.message}` : String(err);
  toast(`${prefix} — ${detail}`, 'error');
}

async function tolerate<T>(fn: () => Promise<T>): Promise<T | null>;
async function tolerate<T>(fn: () => Promise<T>, fallback: T): Promise<T>;
async function tolerate<T>(fn: () => Promise<T>, fallback?: T): Promise<T | null> {
  try {
    return await fn();
  } catch {
    return fallback ?? null;
  }
}

function fallbackSnapshot(floors: number, cabins: number): Snapshot {
  return {
    floors,
    elevators: Array.from({ length: cabins }, (_, index) => ({
      id: index + 1,
      currentFloor: 1,
      direction: 'idle',
      doorsOpen: false,
      queue: [],
    })),
    calls: [],
    stats: { ticks: 0, stopsServed: 0, callsPlaced: 0, callsServed: 0 },
  };
}
