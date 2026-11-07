/** Below this width the page uses the whole window with 16 px gutters. */
export const PHONE_MAX = 700;
/** From this width, screens that have two columns show them side by side. */
export const WIDE_MIN = 900;
/** Short windows (phones in landscape) get a compact header. */
const SHORT_MAX = 480;

export interface Layout {
  width: number;
  height: number;
  /** Narrower than 700 px: full width, 16 px gutters, no scaling. */
  phone: boolean;
  /** 900 px and wider: two columns where a screen has them. */
  wide: boolean;
  /** Lower than 480 px (phones in landscape): compact header, the main action stays pinned. */
  short: boolean;
  /** Scale for type, tiles, posters and cards: 1 on phones, up to 1.45 on big windows. */
  k: number;
  /** Space between the window edge and the page container. */
  gutter: number;
  /** The page container's width; the header's content uses the same width. */
  max: number;
  /** Height of the sticky app header (without the status bar inset). */
  header: number;
  /** A size scaled by `k` (rounded); phones keep the number as it is. */
  z: (n: number) => number;
}

/**
 * The one layout every screen shares (YepWatch UX journey, direction D): `k = clamp(width / 1300, 1, 1.45)`,
 * container `min(width - 64, 1100 * k)`, phones use the full width with 16 px gutters.
 */
export function layoutFor(width: number, height: number): Layout {
  const phone = width < PHONE_MAX;
  const k = phone ? 1 : Math.max(1, Math.min(1.45, width / 1300));
  const gutter = phone ? 16 : 32;
  const max = Math.max(0, phone ? width - gutter * 2 : Math.min(width - gutter * 2, Math.round(1100 * k)));
  const short = height < SHORT_MAX;
  const header = short ? 48 : phone ? 60 : Math.round(60 + 26 * (k - 1));
  const z = (n: number) => (phone ? n : Math.round(n * k));
  return { width, height, phone, wide: width >= WIDE_MIN, short, k, gutter, max, header, z };
}
