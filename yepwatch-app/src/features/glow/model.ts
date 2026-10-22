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
  id: string;
  nickname: string;
  self: boolean;
}
export interface GlowMatch {
  title: GlowTitle;
  pickCount: number;
}
export type GlowView = 'voting' | 'matches';
export type GesturePhase = 'reach' | 'handle' | 'release';
/** UI receives only authenticated, unexpired ephemeral events through the realtime adapter. */
export interface GlowActivity {
  participantId: string;
  sessionId: string;
  sequence: number;
  view: 'voting' | 'matches' | 'trailer' | 'away';
  gesture?: GesturePhase;
  beat?: 'answer';
  expiresAt: number;
  serverTime: number;
}
export function presentationSize(width: number, height: number, wide: boolean) {
  const ph = Math.max(80, Math.min(height - (wide ? 42 : 30), (width - (wide ? 156 : 96)) * 1.5));
  return { width: ph / 1.5, height: ph };
}
export function boundedMatch(ids: string[], active: string | null, pick: string | null) {
  return (
    (active && ids.includes(active) ? active : pick && ids.includes(pick) ? pick : ids[0]) ?? null
  );
}
export function peerColor(id: string) {
  const hues = ['#a78bfa', '#38bdf8', '#fbbf24', '#f472b6', '#2dd4bf'];
  let hash = 0;
  for (const ch of id) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return hues[hash % hues.length];
}
