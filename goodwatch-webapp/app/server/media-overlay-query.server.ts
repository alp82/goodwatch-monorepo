import { query } from "../utils/crate.ts"
import { withBackendTimeout, timeoutSetting } from "../utils/backend-timeout.ts"
import {
	mediaReadFailed,
	noteMediaReadFailure,
} from "./media-read-health.server.ts"
import type { OverlayQuery } from "../utils/media-overlay-core.ts"
export const MEDIA_OVERLAY_TIMEOUT_DEFAULT_MS = 1000
/** Short, cancellable optional reads. Canonical reads/writes retain their existing timeout. */
export function createOverlayQuery(
	read: typeof query,
	timeout = () =>
		timeoutSetting(
			"MEDIA_OVERLAY_TIMEOUT_MS",
			MEDIA_OVERLAY_TIMEOUT_DEFAULT_MS,
		),
): OverlayQuery {
	return async <T extends {}>(
		sql: string,
		params?: (string | number | Date)[],
	): Promise<T[]> => {
		if (mediaReadFailed())
			throw new Error(
				"Media localization reads already failed in this operation",
			)
		const timeoutMs = timeout()
		try {
			return await withBackendTimeout(
				"Media localization",
				timeoutMs,
				(signal) => read<T>(sql, params, { timeoutMs, signal }),
			)
		} catch (error) {
			noteMediaReadFailure()
			throw error
		}
	}
}
export const overlayQuery = createOverlayQuery(query)
