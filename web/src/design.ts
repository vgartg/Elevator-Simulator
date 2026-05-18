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

export const TIMING = { healthPollMs: 5000, toastVisibleMs: 2400 } as const;

const CABIN_DOTS = ['#00ADD8', '#C97921', '#2E8B57', '#7B3F99', '#3E63DD', '#BB3939'] as const;
export const cabinDot = (i: number): string => CABIN_DOTS[i % CABIN_DOTS.length]!;

export const DIRECTION_GLYPH: Record<string, string> = { up: '▲', down: '▼', idle: '·' };
