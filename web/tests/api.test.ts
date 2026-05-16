import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api, ApiError } from '../src/api';

type FetchArgs = Parameters<typeof fetch>;

function mockFetch(handler: (...args: FetchArgs) => Response | Promise<Response>): void {
  vi.stubGlobal('fetch', vi.fn(handler));
}

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
}

describe('api', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns parsed JSON on success', async () => {
    mockFetch(() => jsonResponse({ status: 'ok', version: '1.0.0' }));
    const health = await api.health();
    expect(health.status).toBe('ok');
    expect(health.version).toBe('1.0.0');
  });

  it('throws ApiError on 4xx response', async () => {
    mockFetch(() =>
      jsonResponse({ error: 'invalid_floor', message: 'floor must be in range' }, { status: 400 }),
    );
    await expect(api.call(99, 'up')).rejects.toBeInstanceOf(ApiError);
  });

  it('sends correct POST payload for hall calls', async () => {
    const fetchMock = vi.fn<(...args: FetchArgs) => Promise<Response>>(async () =>
      jsonResponse({}),
    );
    vi.stubGlobal('fetch', fetchMock);
    await api.call(5, 'up');
    const call = fetchMock.mock.calls[0];
    expect(call).toBeDefined();
    const [path, init] = call as FetchArgs;
    expect(path).toBe('/api/call');
    expect(init?.method).toBe('POST');
    expect(JSON.parse(String(init?.body))).toEqual({ floor: 5, direction: 'up' });
  });

  it('appends steps query for tick', async () => {
    const fetchMock = vi.fn<(...args: FetchArgs) => Promise<Response>>(async () =>
      jsonResponse({}),
    );
    vi.stubGlobal('fetch', fetchMock);
    await api.tick(7);
    const call = fetchMock.mock.calls[0];
    expect(call).toBeDefined();
    expect((call as FetchArgs)[0]).toBe('/api/tick?steps=7');
  });

  it('falls back to text when response body is not JSON', async () => {
    mockFetch(() => new Response('boom', { status: 500 }));
    await expect(api.state()).rejects.toThrow(/boom|http_error/);
  });
});
