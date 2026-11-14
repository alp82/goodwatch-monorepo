/** The room atmosphere (Backdrop): one vertical gradient over the whole frame. */
export const BACKDROP = { colors: ['#17140e', '#0b0b0e', '#070707'], locations: [0, 0.45, 1] } as const;

type Rgb = readonly [number, number, number];
const rgb = (hex: string): Rgb => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as unknown as Rgb;
const STOPS = BACKDROP.colors.map(rgb);

/** The backdrop's color `t` of the way down the frame (0 top, 1 bottom), unrounded. */
export function backdropAt(t: number): Rgb {
  const { locations } = BACKDROP;
  const y = Math.min(1, Math.max(0, t));
  const k = y <= locations[1] ? 0 : 1;
  const u = (y - locations[k]) / (locations[k + 1] - locations[k]);
  return [0, 1, 2].map((c) => STOPS[k][c] + (STOPS[k + 1][c] - STOPS[k][c]) * u) as unknown as Rgb;
}
