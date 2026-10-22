import { ApiFailure } from './errors';
import type { FailureDetails } from '@goodwatch/yepwatch-contracts';
/** Public explanations only. Incomplete checks must never be described as verified no matches. */
export function recoveryMessage(error: unknown): string {
  if (!(error instanceof ApiFailure))
    return error instanceof Error
      ? error.message
      : 'This action could not be confirmed. Try again.';
  return publicFailureMessage(error.code, error.message, error.details);
}
export function publicFailureMessage(
  code: string,
  message: string,
  details?: FailureDetails
): string {
  if (code === 'member_required' || details?.type === 'access')
    return 'Continuing shows needs GoodWatch sign-in with saved progress. Sign in from your room, or choose movies and new shows to continue as a guest.';
  if (code === 'needs_progress')
    return 'Your group’s saved progress could not be safely aligned. Review progress in GoodWatch, or choose movies and new shows.';
  if (code === 'needs_context')
    return 'Confirm the country and usable services for every screen, then try again.';
  if (details?.type === 'catalog')
    return 'The catalog is still loading. Try again in a moment; your country and services are unchanged.';
  if (details?.type === 'deck') {
    switch (details.reason) {
      case 'verified_no_intersection':
        return 'No titles matched across the selected screens and services. Review the services, or try wider mood and time settings.';
      case 'filtered_catalog_empty':
        return 'No titles matched these settings. Try widening the mood or time settings, and check the selected services.';
      case 'availability_unknown':
        return 'Availability could not be verified yet. Try again, or review your screen services. This does not mean there are no matches.';
      case 'episode_catalog_unavailable':
        return 'Episode details could not be checked for new shows yet. Try again, or choose movies in settings.';
      case 'catalog_metadata_missing':
        return 'Some title details could not be loaded. Try again in a moment, or review your settings.';
      case 'scan_limit':
      case 'deadline':
        return 'The search did not finish. Try again, or adjust the settings. No complete match check is available yet.';
    }
  }
  if (code === 'catalog_unavailable')
    return 'The catalog could not finish checking these options. Try again in a moment, or review your screen services.';
  if (code === 'no_intersection')
    return 'No shared deck is available yet. Review your screen services and optional settings, then try again.';
  return message;
}
