import { h, mount } from '../lib/dom';
import type { Health } from '../types';

export function renderHeader(root: HTMLElement, health: Health | null): void {
  const ok = health !== null;
  mount(
    root,
    h('header', { class: 'flex flex-wrap items-center justify-between gap-4' }, [
      h('div', { class: 'flex items-center gap-3' }, [
        h(
          'div',
          { class: 'card grid h-11 w-11 place-items-center', 'aria-hidden': 'true' },
          h('span', { class: 'mono text-base font-semibold' }, '▤'),
        ),
        h('div', null, [
          h('div', { class: 'eyebrow' }, '— elevator dispatch · schematic'),
          h(
            'h1',
            { class: 'text-xl font-semibold tracking-tight sm:text-2xl' },
            'Elevator Simulator',
          ),
        ]),
      ]),
      h(
        'span',
        {
          class: `pill ${ok ? 'ok' : 'off'}`,
          role: 'status',
          style: ok ? 'color:#2E8B57' : 'color:#BB3939',
        },
        [h('span', { class: 'dot' }), ok ? statusLabel(health) : 'API offline'],
      ),
    ]),
  );
}

function statusLabel(health: Health): string {
  return health.status === 'demo'
    ? 'static demo · runs in your browser'
    : `API ok · v${health.version}`;
}
