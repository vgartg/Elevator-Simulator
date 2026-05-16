import { h, mount } from '../lib/dom';

export interface ShellSlots {
  header: HTMLElement;
  controls: HTMLElement;
  building: HTMLElement;
  cabinPanels: HTMLElement;
}

export function renderShell(root: HTMLElement): ShellSlots {
  const header = h('div');
  const controls = h('section', {
    'aria-label': 'Simulation controls',
    class: 'card p-4 sm:p-5',
  });
  const building = h('div', { class: 'card p-3 sm:p-4' });
  const cabinPanels = h('div');

  const layout = h(
    'main',
    {
      class: 'mx-auto flex max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-10',
    },
    [
      header,
      controls,
      h(
        'section',
        {
          class: 'grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]',
          'aria-label': 'Building',
        },
        [building, cabinPanels],
      ),
      h(
        'footer',
        { class: 'pt-4 text-center text-xs text-slate-500' },
        'Go core · chi router · Vite + TypeScript + Tailwind',
      ),
    ],
  );

  mount(root, layout);
  return { header, controls, building, cabinPanels };
}
