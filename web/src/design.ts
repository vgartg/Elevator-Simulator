export const SIM = {
  defaultFloors: 10,
  defaultCabins: 2,
  floors: { min: 2, max: 20 },
  cabins: { min: 1, max: 6 },
  defaultSpeedMs: 800,
  speedPresets: [
    { id: 'x4', label: '4×', ms: 200 },
    { id: 'x2', label: '2×', ms: 400 },
    { id: 'x1', label: '1×', ms: 800 },
    { id: 'x0.5', label: '½×', ms: 1600 },
  ],
} as const;

export const TIMING = {
  healthPollMs: 5000,
  toastVisibleMs: 2400,
  cabinTravelMs: 380,
  doorCycleMs: 600,
} as const;

export const CABIN_PALETTE = [
  { ring: 'ring-gopher-500/60', dot: 'bg-gopher-500', body: 'bg-gopher-500 text-ink-900' },
  { ring: 'ring-amber-400/60', dot: 'bg-amber-400', body: 'bg-amber-400 text-ink-900' },
  { ring: 'ring-emerald-400/60', dot: 'bg-emerald-400', body: 'bg-emerald-400 text-ink-900' },
  { ring: 'ring-fuchsia-400/60', dot: 'bg-fuchsia-400', body: 'bg-fuchsia-400 text-ink-900' },
  { ring: 'ring-sky-400/60', dot: 'bg-sky-400', body: 'bg-sky-400 text-ink-900' },
  { ring: 'ring-rose-400/60', dot: 'bg-rose-400', body: 'bg-rose-400 text-ink-900' },
] as const;

export function cabinTheme(index: number): (typeof CABIN_PALETTE)[number] {
  return CABIN_PALETTE[index % CABIN_PALETTE.length] as (typeof CABIN_PALETTE)[number];
}

export const DIRECTION_GLYPH: Record<string, string> = {
  up: '▲',
  down: '▼',
  idle: '·',
};
