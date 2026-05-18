import { h, mount } from '../lib/dom';
import type { Snapshot } from '../types';
import { SIM } from '../design';

export interface ControlState { running: boolean; speedMs: number; floors: number; cabins: number; }
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
  mount(root, h('div', { class: 'flex flex-col gap-4' }, [
    stats(snapshot),
    h('div', { class: 'flex flex-wrap items-center gap-2 sm:gap-3' }, [
      runBtn(state, handlers),
      h('button', { type: 'button', class: 'btn', disabled: state.running, onClick: handlers.onStep }, 'Step'),
      speedGroup(state, handlers),
    ]),
    geometry(state, handlers),
  ]));
}

function stats(s: Snapshot): HTMLElement {
  const items: Array<[string, number]> = [
    ['tick', s.stats.ticks],
    ['stops', s.stats.stopsServed],
    ['calls', s.stats.callsPlaced],
    ['pending', s.calls.length],
  ];
  return h('dl', { class: 'grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:gap-2' },
    items.map(([label, value]) => h('div', { class: 'stat' }, [
      h('dt', null, label),
      h('dd', null, String(value)),
    ])));
}

function runBtn(state: ControlState, handlers: ControlHandlers): HTMLElement {
  return h('button', {
    type: 'button',
    class: state.running ? 'btn btn-danger' : 'btn btn-primary',
    'aria-pressed': state.running ? 'true' : 'false',
    onClick: handlers.onToggleRun,
  }, state.running ? '❚❚ Pause' : '▶ Run');
}

function speedGroup(state: ControlState, handlers: ControlHandlers): HTMLElement {
  return h('div', { role: 'group', 'aria-label': 'Speed', class: 'inline-flex rounded-md overflow-hidden', style: 'border:1px solid var(--rule)' },
    SIM.speedPresets.map((p) => h('button', {
      type: 'button',
      class: `btn-segment ${p.ms === state.speedMs ? 'btn-segment-active' : ''}`,
      'aria-pressed': p.ms === state.speedMs ? 'true' : 'false',
      onClick: () => handlers.onSpeedChange(p.ms),
    }, p.label)));
}

function geometry(state: ControlState, handlers: ControlHandlers): HTMLElement {
  const floors = numInput('floors', state.floors, SIM.floors.min, SIM.floors.max);
  const cabins = numInput('cabins', state.cabins, SIM.cabins.min, SIM.cabins.max);
  return h('div', { class: 'flex flex-wrap items-end gap-3 pt-3', style: 'border-top:1px solid var(--rule)' }, [
    field('Floors', floors),
    field('Cabins', cabins),
    h('button', {
      type: 'button',
      class: 'btn ml-auto',
      onClick: () => handlers.onReset(Number(floors.value), Number(cabins.value)),
    }, 'Reset simulation'),
  ]);
}

function field(label: string, input: HTMLInputElement): HTMLElement {
  const id = `field-${label.toLowerCase()}`;
  input.id = id;
  return h('div', { class: 'flex flex-col gap-1' }, [
    h('label', { for: id, class: 'eyebrow' }, label),
    input,
  ]);
}

function numInput(name: string, value: number, min: number, max: number): HTMLInputElement {
  return h('input', {
    type: 'number', name, min: String(min), max: String(max), value: String(value),
    inputmode: 'numeric', class: 'input w-20',
  });
}
