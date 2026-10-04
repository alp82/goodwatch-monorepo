/**
 * Whether the anonymous session recording share keeps this visitor out of session recording.
 * `share` is `POSTHOG_ANONYMOUS_SESSION_RECORDING_SHARE`; `sample` draws a number from 0 to 1 for the visitor.
 */
export function anonymousRecordingBlocked(
	share: number | null,
	sample: () => number,
): boolean {
	if (share === null || share >= 1) return false
	if (share <= 0) return true
	return sample() >= share
}
