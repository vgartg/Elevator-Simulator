import { h, mount } from '../lib/dom';
import type { Health } from '../types';

const STATUS_STYLE = {
  ok: 'bg-emerald-400/15 text-emerald-300 ring-emerald-400/30',
  off: 'bg-rose-500/15 text-rose-300 ring-rose-400/30',
} as const;

export function renderHeader(root: HTMLElement, health: Health | null): void {
  mount(
    root,
    h('header', { class: 'flex flex-wrap items-center justify-between gap-4' }, [
      h('div', { class: 'flex items-center gap-3' }, [
        logoMark(),
        h('div', { class: 'flex flex-col' }, [
          h(
            'h1',
            { class: 'text-xl font-semibold tracking-tight sm:text-2xl' },
            'Elevator Simulator',
          ),
          h(
            'p',
            { class: 'text-xs text-slate-400 sm:text-sm' },
            'Tick-based dispatcher with a SCAN scheduler and live building view',
          ),
        ]),
      ]),
      healthBadge(health),
    ]),
  );
}

function logoMark(): HTMLElement {
  return h(
    'div',
    {
      class:
        'grid h-10 w-10 place-items-center rounded-xl bg-gopher-500/15 text-gopher-300 ring-1 ring-gopher-500/40',
      'aria-hidden': 'true',
    },
    [h('span', { class: 'text-lg font-bold leading-none' }, '▤')],
  );
}

function healthBadge(health: Health | null): HTMLElement {
  const tone = health ? STATUS_STYLE.ok : STATUS_STYLE.off;
  const text = health ? `API ok · v${health.version}` : 'API offline';
  return h(
    'span',
    {
      class: `inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ring-1 ${tone}`,
      role: 'status',
    },
    [h('span', { class: 'inline-block h-1.5 w-1.5 rounded-full bg-current' }), text],
  );
}
