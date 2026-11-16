/** Presentation seam. Catalog data is supplied by the API adapter, never a seeded product list. */
export interface GlowTitle {
  id: string;
  title: string;
  kind: 'movie' | 'show_start' | 'show_continue';
  year: number | null;
  overview: string | null;
  posterUrl: string | null;
  backdropUrl: string | null;
  trailerUrl: string | null;
  runtimeMinutes: number | null;
  episodeLabel: string | null;
  score: number | null;
  genres: string[];
}
export interface GlowPerson {
  dropped?: boolean;
  id: string;
  nickname: string;
  self: boolean;
}
export type GesturePhase = 'reach' | 'handle' | 'release';
export function presentationSize(width: number, height: number, wide: boolean) {
  const ph = Math.max(80, Math.min(height - (wide ? 42 : 30), (width - (wide ? 156 : 96)) * 1.5));
  return { width: ph / 1.5, height: ph };
}
/**
 * Friends' colors, most distinct first. Never amber: amber is always you. Eight before a color repeats.
 */
export const PEER_HUES = ['#a78bfa', '#38bdf8', '#f472b6', '#2dd4bf', '#a3e635', '#818cf8', '#e879f9', '#4ade80'] as const;
/**
 * A person's color: by their place in the room's roster (join order; people who left keep their place), so
 * friends never share a color in a room of up to eight and every phone shows them alike. Without a roster
 * (outside a room) a hash of the id picks one.
 */
export function peerColor(id: string, roster?: readonly string[] | null) {
  const at = roster ? roster.indexOf(id) : -1;
  if (at >= 0) return PEER_HUES[at % PEER_HUES.length];
  let hash = 0;
  for (const ch of id) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return PEER_HUES[hash % PEER_HUES.length];
}
