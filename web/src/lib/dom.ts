type Primitive = string | number;
type Child = Node | Primitive | null | undefined | false;
type AttrValue = string | number | boolean | EventListener | null | undefined;
type Attrs = Record<string, AttrValue>;

const EVENT_PREFIX = 'on';

export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs?: Attrs | null,
  children?: Child[] | Child,
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (attrs) applyAttrs(el, attrs);
  appendChildren(el, children);
  return el;
}

function applyAttrs(el: HTMLElement, attrs: Attrs): void {
  for (const [key, raw] of Object.entries(attrs)) {
    if (raw == null || raw === false) continue;
    if (key === 'class' && typeof raw === 'string') {
      el.className = raw;
      continue;
    }
    if (key.startsWith(EVENT_PREFIX) && typeof raw === 'function') {
      el.addEventListener(key.slice(EVENT_PREFIX.length).toLowerCase(), raw);
      continue;
    }
    if (typeof raw === 'boolean') {
      el.toggleAttribute(key, raw);
      continue;
    }
    el.setAttribute(key, String(raw));
  }
}

function appendChildren(el: HTMLElement, children: Child[] | Child | undefined): void {
  if (children == null || children === false) return;
  if (Array.isArray(children)) {
    children.forEach((child) => appendChildren(el, child));
    return;
  }
  el.appendChild(children instanceof Node ? children : document.createTextNode(String(children)));
}

export function mount(parent: Element, node: Node): void {
  parent.replaceChildren(node);
}

export function query<T extends HTMLElement = HTMLElement>(
  selector: string,
  root: ParentNode = document,
): T {
  const found = root.querySelector<T>(selector);
  if (!found) throw new Error(`dom.query: missing element ${selector}`);
  return found;
}
