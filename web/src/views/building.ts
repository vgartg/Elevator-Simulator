import { h, mount } from '../lib/dom';
import type { Call, Direction, Elevator, Snapshot } from '../types';
import { cabinDot, DIRECTION_GLYPH } from '../design';

type Hall = Extract<Direction, 'up' | 'down'>;

export interface BuildingHandlers {
  onHallCall(floor: number, direction: Hall): void;
  onCabinSelect(elevatorId: number, floor: number): void;
}

interface CabinNodes {
  shell: HTMLElement;
  badge: HTMLElement;
}
interface PanelNodes {
  panel: HTMLElement;
  status: HTMLElement;
  buttons: HTMLButtonElement[];
}

export class BuildingView {
  private floors = 0;
  private cabinCount = 0;
  private cabins = new Map<number, CabinNodes>();
  private halls = new Map<string, HTMLButtonElement>();
  private panels = new Map<number, PanelNodes>();
  private shaft: HTMLElement | null = null;

  constructor(
    private readonly root: HTMLElement,
    private readonly panelRoot: HTMLElement,
    private readonly handlers: BuildingHandlers,
  ) {}

  render(s: Snapshot): void {
    if (s.floors !== this.floors || s.elevators.length !== this.cabinCount) this.scaffold(s);
    this.update(s);
  }

  private scaffold(s: Snapshot): void {
    this.floors = s.floors;
    this.cabinCount = s.elevators.length;
    this.cabins.clear();
    this.halls.clear();
    this.panels.clear();

    const rows: HTMLElement[] = [];
    for (let f = s.floors; f >= 1; f--) rows.push(this.row(f, s.floors));

    this.shaft = h('div', {
      class: 'pointer-events-none absolute inset-y-2 flex gap-1',
      style: 'left:var(--label-col);right:var(--hall-col)',
      'aria-hidden': 'true',
    });
    s.elevators.forEach((e, i) => {
      const nodes = this.cabin(e, i, s.floors);
      this.cabins.set(e.id, nodes);
      this.shaft!.appendChild(nodes.shell);
    });

    mount(
      this.root,
      h(
        'div',
        {
          class: 'schematic',
          style: `--floors:${s.floors}`,
        },
        [
          h('div', { class: 'building-grid', role: 'grid', 'aria-label': 'Building' }, rows),
          this.shaft,
        ],
      ),
    );
    mount(this.panelRoot, this.allPanels(s));
  }

  private row(floor: number, total: number): HTMLElement {
    return h('div', { class: 'building-row', role: 'row' }, [
      h('div', { class: 'floor-label', role: 'rowheader' }, `F${String(floor).padStart(2, '0')}`),
      h('div', { class: 'floor-cell', role: 'gridcell' }),
      h('div', { class: 'hall-cell floor-cell', role: 'gridcell' }, [
        floor < total ? this.hallBtn(floor, 'up') : null,
        floor > 1 ? this.hallBtn(floor, 'down') : null,
      ]),
    ]);
  }

  private hallBtn(floor: number, dir: Hall): HTMLButtonElement {
    const btn = h(
      'button',
      {
        type: 'button',
        class: 'hall-btn',
        'aria-label': `Call ${dir} from floor ${floor}`,
        onClick: () => this.handlers.onHallCall(floor, dir),
      },
      DIRECTION_GLYPH[dir] ?? '',
    );
    this.halls.set(`${floor}-${dir}`, btn);
    return btn;
  }

  private cabin(e: Elevator, i: number, total: number): CabinNodes {
    const badge = h('span', { class: 'mono text-[11px]' });
    const shell = h(
      'div',
      { class: 'cabin', style: shaftStyle(i, this.cabinCount, e.currentFloor, total) },
      [badge],
    );
    return { shell, badge };
  }

  private allPanels(s: Snapshot): HTMLElement {
    const grid = h('div', { class: 'grid gap-3 sm:grid-cols-2 lg:grid-cols-1' });
    s.elevators.forEach((e, i) => {
      const p = this.panel(e, i, s.floors);
      this.panels.set(e.id, p);
      grid.appendChild(p.panel);
    });
    return grid;
  }

  private panel(e: Elevator, i: number, total: number): PanelNodes {
    const status = h('span', { class: 'eyebrow' });
    const buttons: HTMLButtonElement[] = [];
    const grid = h(
      'div',
      { class: 'grid grid-cols-5 gap-1.5 sm:grid-cols-6 lg:grid-cols-5' },
      Array.from({ length: total }, (_, k) => {
        const floor = k + 1;
        const btn = h(
          'button',
          {
            type: 'button',
            class: 'cabin-key',
            'data-floor': floor,
            onClick: () => this.handlers.onCabinSelect(e.id, floor),
          },
          String(floor),
        );
        buttons.push(btn);
        return btn;
      }),
    );
    const panel = h('article', { class: 'card p-4', 'aria-label': `Cabin #${e.id}` }, [
      h('header', { class: 'mb-3 flex items-center justify-between' }, [
        h('div', { class: 'flex items-center gap-2' }, [
          h('span', {
            class: 'inline-block h-2.5 w-2.5 rounded-full',
            style: `background:${cabinDot(i)}`,
          }),
          h('span', { class: 'text-sm font-semibold' }, `Cabin #${e.id}`),
        ]),
        status,
      ]),
      grid,
    ]);
    return { panel, status, buttons };
  }

  private update(s: Snapshot): void {
    s.elevators.forEach((e, i) => {
      const n = this.cabins.get(e.id);
      if (n) {
        n.shell.style.cssText = shaftStyle(i, s.elevators.length, e.currentFloor, s.floors);
        n.shell.classList.toggle('cabin-open', e.doorsOpen);
        n.shell.classList.toggle('cabin-moving', e.direction !== 'idle' && !e.doorsOpen);
        n.badge.textContent = `#${e.id} ${DIRECTION_GLYPH[e.direction] ?? ''}`;
      }
    });
    const pending = new Set(s.calls.map((c: Call) => `${c.floor}-${c.direction}`));
    for (const [k, btn] of this.halls) btn.classList.toggle('hall-btn-pending', pending.has(k));
    s.elevators.forEach((e) => {
      const p = this.panels.get(e.id);
      if (!p) return;
      const door = e.doorsOpen ? ' · doors open' : '';
      p.status.textContent = `f${e.currentFloor} · ${e.direction}${door}`;
      const queued = new Set(e.queue);
      p.buttons.forEach((btn) => {
        const f = Number(btn.dataset.floor);
        const here = f === e.currentFloor;
        btn.classList.toggle('cabin-key-here', here);
        btn.classList.toggle('cabin-key-queued', !here && queued.has(f));
        btn.disabled = here;
      });
    });
  }
}

function shaftStyle(i: number, total: number, floor: number, totalFloors: number): string {
  const w = 100 / total;
  const b = ((floor - 1) / totalFloors) * 100;
  return `left:calc(${i} * ${w}% + 2px);width:calc(${w}% - 4px);bottom:calc(${b}% + 2px);height:calc(100% / var(--floors) - 4px)`;
}
