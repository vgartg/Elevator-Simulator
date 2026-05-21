import type { Config, Direction, Health, Snapshot } from './types';
import { local, LocalError } from './local-simulator';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export const USE_LOCAL = (import.meta.env.VITE_USE_LOCAL as string | undefined) === '1';

const JSON_HEADERS: HeadersInit = { 'Content-Type': 'application/json' };

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, init);
  const text = await res.text();
  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }
  if (!res.ok) {
    const err = body as { error?: string; message?: string } | string | null;
    if (err && typeof err === 'object') {
      throw new ApiError(res.status, err.error ?? 'http_error', err.message ?? res.statusText);
    }
    throw new ApiError(res.status, 'http_error', String(err ?? res.statusText));
  }
  return body as T;
}

function runLocal<T>(fn: () => T): Promise<T> {
  try {
    return Promise.resolve(fn());
  } catch (err) {
    if (err instanceof LocalError) {
      return Promise.reject(new ApiError(400, err.code, err.message));
    }
    return Promise.reject(err);
  }
}

const remote = {
  health: () => request<Health>('/api/health'),
  config: () => request<Config>('/api/config'),
  state: () => request<Snapshot>('/api/state'),
  call: (floor: number, direction: Direction) =>
    request<Snapshot>('/api/call', {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({ floor, direction }),
    }),
  select: (elevatorId: number, floor: number) =>
    request<Snapshot>('/api/select', {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({ elevatorId, floor }),
    }),
  tick: (steps = 1) => request<Snapshot>(`/api/tick?steps=${steps}`, { method: 'POST' }),
  reset: (floors: number, elevators: number) =>
    request<Snapshot>('/api/reset', {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({ floors, elevators }),
    }),
};

const offline = {
  health: () => runLocal(() => local.health() as Health),
  config: () => runLocal(() => local.config()),
  state: () => runLocal(() => local.state()),
  call: (floor: number, direction: Direction) => runLocal(() => local.call(floor, direction)),
  select: (elevatorId: number, floor: number) => runLocal(() => local.select(elevatorId, floor)),
  tick: (steps = 1) => runLocal(() => local.tick(steps)),
  reset: (floors: number, elevators: number) => runLocal(() => local.reset(floors, elevators)),
};

export const api = USE_LOCAL ? offline : remote;
