import { h, mount } from '../lib/dom';

export interface ShellSlots {
  header: HTMLElement;
  controls: HTMLElement;
  building: HTMLElement;
  cabinPanels: HTMLElement;
}

export function renderShell(root: HTMLElement): ShellSlots {
  const header = h('div');
  const controls = h('section', { 'aria-label': 'Controls', class: 'card p-4 sm:p-5' });
  const building = h('div', { class: 'card p-3 sm:p-4' });
  const cabinPanels = h('div');

  mount(
    root,
    h('main', { class: 'frame flex flex-col gap-5 py-6 sm:py-10' }, [
      header,
      controls,
      h(
        'section',
        {
          class: 'grid gap-5 lg:grid-cols-[minmax(0,1fr)_19rem]',
          'aria-label': 'Building',
        },
        [building, cabinPanels],
      ),
      h(
        'footer',
        { class: 'eyebrow pt-2 text-center' },
        'go core · chi router · vite · typescript · tailwind',
      ),
    ]),
  );
  return { header, controls, building, cabinPanels };
}
