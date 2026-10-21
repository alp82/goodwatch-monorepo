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
