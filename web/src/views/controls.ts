import { h, mount } from '../lib/dom';
import type { Snapshot } from '../types';
import { SIM } from '../design';

export interface ControlState {
  running: boolean;
  speedMs: number;
  floors: number;
  cabins: number;
}

export interface ControlHandlers {
  onToggleRun(): void;
  onStep(): void;
  onSpeedChange(ms: number): void;
  onReset(floors: number, cabins: number): void;
}

export function renderControls(
  root: HTMLElement,
  state: ControlState,
  snapshot: Snapshot,
  handlers: ControlHandlers,
): void {
  mount(
    root,
    h('div', { class: 'flex flex-col gap-4' }, [
      statsRow(snapshot),
      h('div', { class: 'flex flex-wrap items-center gap-2 sm:gap-3' }, [
        runButton(state, handlers),
        stepButton(state, handlers),
        speedGroup(state, handlers),
      ]),
      geometryRow(state, handlers),
    ]),
  );
}

function statsRow(snapshot: Snapshot): HTMLElement {
  const items: Array<[string, number]> = [
    ['tick', snapshot.stats.ticks],
    ['stops', snapshot.stats.stopsServed],
    ['calls', snapshot.stats.callsPlaced],
    ['pending', snapshot.calls.length],
  ];
  return h(
    'dl',
    { class: 'grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:gap-3' },
    items.map(([label, value]) =>
      h('div', { class: 'flex items-baseline gap-2 rounded-lg bg-white/5 px-3 py-1.5' }, [
        h('dt', { class: 'text-[11px] uppercase tracking-wide text-slate-400' }, label),
        h('dd', { class: 'mono text-sm font-semibold text-slate-100' }, String(value)),
      ]),
    ),
  );
}

function runButton(state: ControlState, handlers: ControlHandlers): HTMLElement {
  return h(
    'button',
    {
      type: 'button',
      class: state.running ? 'btn btn-danger' : 'btn btn-primary',
      'aria-pressed': state.running ? 'true' : 'false',
      onClick: handlers.onToggleRun,
    },
    state.running ? '❚❚ Pause' : '▶ Run',
  );
}

function stepButton(state: ControlState, handlers: ControlHandlers): HTMLElement {
  return h(
    'button',
    {
      type: 'button',
      class: 'btn btn-ghost',
      disabled: state.running,
      onClick: handlers.onStep,
    },
    'Step',
  );
}

function speedGroup(state: ControlState, handlers: ControlHandlers): HTMLElement {
  return h(
    'div',
    {
      role: 'group',
      'aria-label': 'Simulation speed',
      class: 'inline-flex overflow-hidden rounded-lg bg-white/5 p-0.5',
    },
    SIM.speedPresets.map((preset) =>
      h(
        'button',
        {
          type: 'button',
          class: `btn-segment ${preset.ms === state.speedMs ? 'btn-segment-active' : ''}`,
          'aria-pressed': preset.ms === state.speedMs ? 'true' : 'false',
          onClick: () => handlers.onSpeedChange(preset.ms),
        },
        preset.label,
      ),
    ),
  );
}

function geometryRow(state: ControlState, handlers: ControlHandlers): HTMLElement {
  const floorsInput = numberInput('floors', state.floors, SIM.floors.min, SIM.floors.max);
  const cabinsInput = numberInput('cabins', state.cabins, SIM.cabins.min, SIM.cabins.max);
  return h('div', { class: 'flex flex-wrap items-end gap-3 border-t border-white/5 pt-3' }, [
    labeledInput('Floors', floorsInput),
    labeledInput('Cabins', cabinsInput),
    h(
      'button',
      {
        type: 'button',
        class: 'btn btn-ghost ml-auto',
        onClick: () => handlers.onReset(Number(floorsInput.value), Number(cabinsInput.value)),
      },
      'Reset simulation',
    ),
  ]);
}

function labeledInput(label: string, input: HTMLInputElement): HTMLElement {
  const id = `field-${label.toLowerCase()}`;
  input.id = id;
  return h('div', { class: 'flex flex-col gap-1' }, [
    h('label', { for: id, class: 'text-[11px] uppercase tracking-wide text-slate-400' }, label),
    input,
  ]);
}

function numberInput(name: string, value: number, min: number, max: number): HTMLInputElement {
  return h('input', {
    type: 'number',
    name,
    min: String(min),
    max: String(max),
    value: String(value),
    inputmode: 'numeric',
    class: 'input w-20',
  });
}
