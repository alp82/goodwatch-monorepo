import { GUEST_CANDIDATE_KINDS, type RoomSnapshot } from '@goodwatch/yepwatch-contracts';
/** A locale is a suggestion for the playback country, never confirmation or a subscription. */
export function countryHint(locale: string): string | null {
  try { return new Intl.Locale(locale).region ?? null; } catch { return null; }
}
export function guestKinds() { return [...GUEST_CANDIDATE_KINDS]; }
export function canHostStart(snapshot: RoomSnapshot) {
  const { shared, own } = snapshot;
  const me = shared.participants.find(p => p.participantId === own.participantId);
  return own.canHost && !shared.constraints.kinds.includes('show_continue') && Boolean(me?.screenId) && shared.screens.length > 0 && shared.screens.every(s => s.confirmed && s.country && s.serviceIds.length > 0) && shared.participants.every(p => p.participantId === own.participantId || p.ready);
}
/** Mirrors the current API policy for active rounds that actually contain continuation candidates. */
export function needsSavedProgressRestart(snapshot: RoomSnapshot) {
  const { shared } = snapshot;
  return Boolean(shared.round) && (shared.phase === 'voting' || shared.phase === 'shortlist') && shared.candidates.some(c => c.identity.kind === 'show_continue');
}

/** Same curated country priority as GoodWatch's country picker; remaining countries stay available. */
const commonCountries = ['US', 'GB', 'DE', 'FR', 'ES', 'IT', 'CA', 'AU', 'BR', 'JP', 'IN', 'MX', 'NL'];
export function rankedCountries<T extends { code: string; name: string }>(countries: readonly T[], current?: string, suggested?: string | null): T[] {
  const priority = [...new Set([current, suggested, ...commonCountries].filter((code): code is string => Boolean(code)))];
  const rank = (code: string) => { const index = priority.indexOf(code); return index < 0 ? priority.length : index; };
  return [...countries].sort((a, b) => rank(a.code) - rank(b.code) || a.name.localeCompare(b.name));
}
/** Region from the device's configured locale, without GPS or permission requests. */
export function deviceCountryHint(): string | null {
  try {
    const locales = typeof navigator !== 'undefined' && navigator.languages?.length
      ? navigator.languages : [Intl.DateTimeFormat().resolvedOptions().locale];
    for (const locale of locales) {
      const region = countryHint(locale);
      if (region && /^[A-Z]{2}$/.test(region)) return region;
    }
  } catch { /* A missing locale leaves country selection explicit. */ }
  return null;
}
