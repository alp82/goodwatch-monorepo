import { ApiFailure } from './errors';
/** Public explanations only. Incomplete checks must never be described as verified no matches. */
export function recoveryMessage(error: unknown): string {
  if (!(error instanceof ApiFailure)) return error instanceof Error ? error.message : 'This action could not be confirmed. Try again.';
  if (error.code === 'member_required' || error.details?.type === 'access') return 'Continuing shows needs GoodWatch sign-in with saved progress. Sign-in is not connected yet. Choose movies and new shows to continue as a guest.';
  if (error.code === 'needs_context') return 'Confirm the country and usable services for every screen, then try again.';
  const details = error.details;
  if (details?.type === 'catalog') return 'The catalog is still loading. Try the round again in a moment; your country and services are unchanged.';
  if (details?.type === 'deck') {
    switch (details.reason) {
      case 'verified_no_intersection': return 'No titles matched across the selected screens and services. Review the services, or try wider mood and time settings.';
      case 'filtered_catalog_empty': return 'No titles matched these settings. Try widening the mood or time settings, and check the selected services.';
      case 'availability_unknown': return 'Availability could not be verified yet. Try the round again, or review your screen services. This does not mean there are no matches.';
      case 'episode_catalog_unavailable': return 'Episode details could not be checked for new shows yet. Try again, or choose movies in settings.';
      case 'catalog_metadata_missing': return 'Some title details could not be loaded. Try again in a moment, or review your settings.';
      case 'scan_limit': case 'deadline': return 'The search did not finish. Try the round again, or adjust the settings. No complete match check is available yet.';
    }
  }
  if (error.code === 'catalog_unavailable') return 'The catalog could not finish checking this round. Try again in a moment, or review your screen services.';
  if (error.code === 'no_intersection') return 'No shared deck is available yet. Review your screen services and optional settings, then try again.';
  return error.message;
}
