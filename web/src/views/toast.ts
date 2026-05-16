import { h, mount } from '../lib/dom';
import { TIMING } from '../design';

const HOST_ID = 'toast-host';
const KIND_STYLE: Record<ToastKind, string> = {
  info: 'bg-gopher-500 text-ink-900',
  error: 'bg-rose-500 text-white',
};

export type ToastKind = 'info' | 'error';

let timer: number | null = null;

export function toast(message: string, kind: ToastKind = 'info'): void {
  const host = ensureHost();
  if (timer !== null) window.clearTimeout(timer);

  const card = h(
    'div',
    {
      role: 'status',
      'aria-live': 'polite',
      class: `pointer-events-auto rounded-xl px-4 py-2 text-sm shadow-glow ${KIND_STYLE[kind]}`,
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
    class: 'pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center px-4 sm:bottom-8',
  });
  document.body.appendChild(host);
  return host;
}
