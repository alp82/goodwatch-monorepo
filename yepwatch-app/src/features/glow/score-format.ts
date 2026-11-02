/**
 * Scores the way goodwatch.app shows them (goodwatch-webapp `utils/ratings.ts`, `ui/details/hero/RatingChips.tsx`,
 * `ui/poster-card/ScorePill.tsx`): the GoodWatch score in whole points rounded down, colored by its band of ten;
 * IMDb with one decimal, Rotten Tomatoes in percent, the Metascore as a whole number. Zero or missing is unknown.
 */
import type { Candidate } from '@goodwatch/yepwatch-contracts/proposal';
import { getFingerprintMeta } from '@goodwatch/yepwatch-contracts/fingerprint';

/** The website's `--color-vibe-*` tokens (goodwatch-webapp `app/tailwind.css`), by band of ten. */
const VIBE: Record<number, string> = {
  0: '#7f1d1d', 10: '#991b1b', 20: '#b91c1c', 30: '#c2410c', 40: '#d97706', 50: '#ca8a04',
  60: '#a3a323', 70: '#65a32d', 80: '#16934a', 90: '#15803d', 100: '#166534',
};
/** Brand colors of the source chips. */
export const BRAND = { imdb: '#f6c800', metacritic: '#010101', rotten: '#f83309' } as const;

const known = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && n > 0;

/** A GoodWatch score as shown everywhere: whole points, rounded down; null when there's none. */
export const gwScore = (percent: number | null | undefined): number | null => (known(percent) ? Math.floor(Math.min(100, percent)) : null);
/** The color of a GoodWatch score (0 to 100). */
export const vibeColor = (percent: number) => VIBE[Math.min(100, Math.max(0, Math.floor(percent / 10) * 10))];

const WORDS = ['Unwatchable', 'Terrible', 'Bad', 'Weak', 'Mediocre', 'Decent', 'Good', 'Great', 'Excellent', 'Masterpiece'];
/** The verdict word for a GoodWatch score, as on title pages: the nearest band, so 92 is Excellent, 95 Masterpiece. */
export const scoreWord = (percent: number) => WORDS[Math.min(10, Math.max(1, Math.round(percent / 10))) - 1];

export interface SourceScores { imdb: string | null; metacritic: string | null; rt: string | null; rtAudience: string | null }
/** The source scores as their sites print them; null for each one that's unknown. */
export function sourceScores(scores: Candidate['scores']): SourceScores | null {
  if (!scores) return null;
  const out = {
    imdb: known(scores.imdb) ? (Math.min(100, scores.imdb) / 10).toFixed(1) : null,
    metacritic: known(scores.metacritic) ? String(Math.floor(scores.metacritic)) : null,
    rt: known(scores.rtCritics) ? `${Math.floor(scores.rtCritics)}%` : null,
    rtAudience: known(scores.rtAudience) ? `${Math.floor(scores.rtAudience)}%` : null,
  };
  return out.imdb || out.metacritic || out.rt || out.rtAudience ? out : null;
}

// Fingerprint colors are translucent on a near-black surface: pick the text color for the color the chip shows
// (goodwatch-webapp `ui/title-card/ReasonChips.tsx`).
const SURFACE = [3, 7, 18];
export function textColorOn(rgba: string): string {
  const [r = 0, g = 0, b = 0, a = 1] = (rgba.match(/[\d.]+/g) ?? []).map(Number);
  const [lr, lg, lb] = [r, g, b].map((c, i) => {
    const s = (c * a + SURFACE[i] * (1 - a)) / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  const luminance = 0.2126 * lr + 0.7152 * lg + 0.0722 * lb;
  return 1.05 / (luminance + 0.05) >= (luminance + 0.05) / 0.05 ? '#ffffff' : '#030712';
}
/** Up to three fingerprint highlights with the website's chip colors. */
export function highlightChips(highlights: Candidate['highlights']) {
  return (highlights ?? []).filter((h) => h.key && h.label).slice(0, 3).map((h) => {
    const { color } = getFingerprintMeta(h.key);
    return { key: h.key, label: h.label, background: color, color: textColorOn(color) };
  });
}

/** "Director" / "Directors" for movies, "Created by" for shows; up to two names, three cast. */
export function credits(c: Pick<Candidate, 'people' | 'identity'>) {
  const directors = (c.people?.directors ?? []).filter(Boolean).slice(0, 2);
  const cast = (c.people?.cast ?? []).filter(Boolean).slice(0, 3);
  const lead = c.identity.kind === 'movie' ? (directors.length > 1 ? 'Directors' : 'Director') : 'Created by';
  return [
    ...(directors.length ? [{ label: lead, names: directors.join(', ') }] : []),
    ...(cast.length ? [{ label: 'Cast', names: cast.join(', ') }] : []),
  ];
}

/** A value worth showing: trimmed text, or null. */
export const text = (s: string | null | undefined) => (s && s.trim() ? s.trim() : null);
