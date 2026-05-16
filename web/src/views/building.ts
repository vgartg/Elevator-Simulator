import { h, mount } from '../lib/dom';
import type { Call, Direction, Elevator, Snapshot } from '../types';
import { cabinTheme, DIRECTION_GLYPH } from '../design';

type HallDirection = Extract<Direction, 'up' | 'down'>;

export interface BuildingHandlers {
  onHallCall(floor: number, direction: HallDirection): void;
  onCabinSelect(elevatorId: number, floor: number): void;
}

interface CabinNodes {
  shell: HTMLElement;
  badge: HTMLElement;
}

interface CabinPanelNodes {
  panel: HTMLElement;
  status: HTMLElement;
  buttons: HTMLButtonElement[];
}

export class BuildingView {
  private floors = 0;
  private cabinCount = 0;
  private cabinNodes = new Map<number, CabinNodes>();
  private hallButtons = new Map<string, HTMLButtonElement>();
  private cabinPanels = new Map<number, CabinPanelNodes>();
  private shaftLayer: HTMLElement | null = null;

  constructor(
    private readonly buildingRoot: HTMLElement,
    private readonly panelRoot: HTMLElement,
    private readonly handlers: BuildingHandlers,
  ) {}

  render(snapshot: Snapshot): void {
    if (this.needsRescaffold(snapshot)) this.scaffold(snapshot);
    this.update(snapshot);
  }

  private needsRescaffold(snapshot: Snapshot): boolean {
    return snapshot.floors !== this.floors || snapshot.elevators.length !== this.cabinCount;
  }

  private scaffold(snapshot: Snapshot): void {
    this.floors = snapshot.floors;
    this.cabinCount = snapshot.elevators.length;
    this.cabinNodes.clear();
    this.hallButtons.clear();
    this.cabinPanels.clear();

    mount(this.buildingRoot, this.buildBuilding(snapshot));
    mount(this.panelRoot, this.buildPanels(snapshot));
  }

  private buildBuilding(snapshot: Snapshot): HTMLElement {
    const floorRows: HTMLElement[] = [];
    for (let floor = snapshot.floors; floor >= 1; floor--) {
      floorRows.push(this.buildFloorRow(floor, snapshot.floors));
    }
    this.shaftLayer = h('div', {
      class:
        'pointer-events-none absolute inset-y-2 left-[var(--label-col)] right-[var(--hall-col)] flex gap-1',
      'aria-hidden': 'true',
    });
    snapshot.elevators.forEach((elevator, index) => {
      const nodes = this.buildCabin(elevator, index, snapshot.floors);
      this.cabinNodes.set(elevator.id, nodes);
      this.shaftLayer!.appendChild(nodes.shell);
    });

    return h(
      'div',
      {
        class: 'relative isolate overflow-hidden rounded-2xl bg-ink-900/50 ring-1 ring-white/5',
        style: `--floors:${snapshot.floors}`,
      },
      [
        h('div', { class: 'building-grid', role: 'grid', 'aria-label': 'Building' }, floorRows),
        this.shaftLayer,
      ],
    );
  }

  private buildFloorRow(floor: number, totalFloors: number): HTMLElement {
    const label = h(
      'div',
      {
        class: 'flex items-center justify-center mono text-[11px] text-slate-400',
        role: 'rowheader',
      },
      `F${floor.toString().padStart(2, '0')}`,
    );
    const shaftBg = h('div', { class: 'border-t border-white/5', role: 'gridcell' });
    const hallBox = h(
      'div',
      { class: 'flex items-center justify-end gap-1 px-2', role: 'gridcell' },
      [
        floor < totalFloors ? this.makeHallButton(floor, 'up') : null,
        floor > 1 ? this.makeHallButton(floor, 'down') : null,
      ],
    );
    return h('div', { class: 'building-row', role: 'row' }, [label, shaftBg, hallBox]);
  }

  private makeHallButton(floor: number, direction: HallDirection): HTMLButtonElement {
    const btn = h(
      'button',
      {
        type: 'button',
        class: 'hall-btn',
        'aria-label': `Call ${direction} from floor ${floor}`,
        onClick: () => this.handlers.onHallCall(floor, direction),
      },
      DIRECTION_GLYPH[direction] ?? '',
    );
    this.hallButtons.set(hallKey(floor, direction), btn);
    return btn;
  }

  private buildCabin(elevator: Elevator, index: number, totalFloors: number): CabinNodes {
    const theme = cabinTheme(index);
    const badge = h('span', { class: 'mono text-[11px] font-semibold' });
    const shell = h(
      'div',
      {
        class: `cabin ${theme.body}`,
        style: shaftStyle(index, this.cabinCount, elevator.currentFloor, totalFloors),
      },
      [badge],
    );
    return { shell, badge };
  }

  private buildPanels(snapshot: Snapshot): HTMLElement {
    const grid = h('div', { class: 'grid gap-3 sm:grid-cols-2 xl:grid-cols-1' });
    snapshot.elevators.forEach((elevator, index) => {
      const panel = this.buildCabinPanel(elevator, index, snapshot.floors);
      this.cabinPanels.set(elevator.id, panel);
      grid.appendChild(panel.panel);
    });
    return grid;
  }

  private buildCabinPanel(elevator: Elevator, index: number, totalFloors: number): CabinPanelNodes {
    const theme = cabinTheme(index);
    const status = h('span', { class: 'mono text-xs text-slate-300' });
    const buttons: HTMLButtonElement[] = [];

    const grid = h(
      'div',
      { class: 'grid grid-cols-5 gap-1.5 sm:grid-cols-6 lg:grid-cols-5' },
      Array.from({ length: totalFloors }, (_, i) => {
        const floor = i + 1;
        const btn = h(
          'button',
          {
            type: 'button',
            class: 'cabin-key',
            'data-floor': floor,
            onClick: () => this.handlers.onCabinSelect(elevator.id, floor),
          },
          String(floor),
        );
        buttons.push(btn);
        return btn;
      }),
    );

    const panel = h('article', { class: 'card p-4', 'aria-label': `Cabin #${elevator.id}` }, [
      h('header', { class: 'mb-3 flex items-center justify-between' }, [
        h('div', { class: 'flex items-center gap-2' }, [
          h('span', { class: `inline-block h-2.5 w-2.5 rounded-full ${theme.dot}` }),
          h('span', { class: 'text-sm font-semibold text-slate-100' }, `Cabin #${elevator.id}`),
        ]),
        status,
      ]),
      grid,
    ]);

    return { panel, status, buttons };
  }

  private update(snapshot: Snapshot): void {
    this.updateCabins(snapshot);
    this.updateHallButtons(snapshot.calls);
    this.updateCabinPanels(snapshot);
  }

  private updateCabins(snapshot: Snapshot): void {
    snapshot.elevators.forEach((elevator, index) => {
      const nodes = this.cabinNodes.get(elevator.id);
      if (!nodes) return;
      nodes.shell.style.cssText = shaftStyle(
        index,
        snapshot.elevators.length,
        elevator.currentFloor,
        snapshot.floors,
      );
      nodes.shell.classList.toggle('cabin-open', elevator.doorsOpen);
      nodes.shell.classList.toggle(
        'cabin-moving',
        elevator.direction !== 'idle' && !elevator.doorsOpen,
      );
      nodes.badge.textContent = `#${elevator.id} ${DIRECTION_GLYPH[elevator.direction] ?? ''}`;
    });
  }

  private updateHallButtons(calls: Call[]): void {
    const pending = new Set(calls.map((c) => hallKey(c.floor, c.direction as HallDirection)));
    for (const [key, btn] of this.hallButtons) {
      btn.classList.toggle('hall-btn-pending', pending.has(key));
    }
  }

  private updateCabinPanels(snapshot: Snapshot): void {
    snapshot.elevators.forEach((elevator) => {
      const panel = this.cabinPanels.get(elevator.id);
      if (!panel) return;
      const door = elevator.doorsOpen ? ' · doors open' : '';
      panel.status.textContent = `F${elevator.currentFloor} · ${elevator.direction}${door}`;
      const queued = new Set(elevator.queue);
      panel.buttons.forEach((btn) => {
        const floor = Number(btn.dataset.floor);
        const here = floor === elevator.currentFloor;
        btn.classList.toggle('cabin-key-here', here);
        btn.classList.toggle('cabin-key-queued', !here && queued.has(floor));
        btn.disabled = here;
      });
    });
  }
}

function hallKey(floor: number, direction: HallDirection): string {
  return `${floor}-${direction}`;
}

function shaftStyle(
  index: number,
  total: number,
  currentFloor: number,
  totalFloors: number,
): string {
  const widthPct = 100 / total;
  const bottomPct = ((currentFloor - 1) / totalFloors) * 100;
  return [
    `left:calc(${index} * ${widthPct}% + 2px)`,
    `width:calc(${widthPct}% - 4px)`,
    `bottom:calc(${bottomPct}% + 2px)`,
    `height:calc(100% / var(--floors) - 4px)`,
  ].join(';');
}
