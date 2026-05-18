import { h, mount } from '../lib/dom';
import { TIMING } from '../design';

export type ToastKind = 'info' | 'error';

const HOST_ID = 'toast-host';
let timer: number | null = null;

export function toast(message: string, kind: ToastKind = 'info'): void {
  const host = ensureHost();
  if (timer !== null) window.clearTimeout(timer);
  const card = h(
    'div',
    {
      role: 'status',
      'aria-live': 'polite',
      class: 'card pointer-events-auto px-4 py-2 text-sm',
      style: kind === 'error' ? 'color:#BB3939' : 'color:#016883',
    },
    message,
  );
  mount(host, card);
  timer = window.setTimeout(() => host.replaceChildren(), TIMING.toastVisibleMs);
}

function ensureHost(): HTMLElement {
  const existing = document.getElementById(HOST_ID);
  if (existing) return existing;
  const host = h('div', {
    id: HOST_ID,
    class: 'pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center px-4',
  });
  document.body.appendChild(host);
  return host;
}
