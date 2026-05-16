import type { Config, Direction, Health, Snapshot } from './types';

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

export const api = {
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
