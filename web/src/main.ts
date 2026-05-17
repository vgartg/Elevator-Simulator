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
  await refreshHealth();
  try {
    const config = await api.config();
    store.set({ floors: config.floors, cabins: config.elevators });
    store.set({ snapshot: await api.state() });
  } catch (err) {
    reportError(err, 'Boot');
  }
  window.setInterval(refreshHealth, TIMING.healthPollMs);
}

async function refreshHealth(): Promise<void> {
  try {
    store.set({ health: await api.health() });
  } catch {
    store.set({ health: null });
  }
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
    store.set({ snapshot: await fn() });
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
      store.set({ snapshot: await api.tick(1) });
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
