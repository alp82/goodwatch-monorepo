// The header pair's edge to the server: the private read of what is saved, and the one save call for Keep and for the
// toast's Undo alike. The contract lives in `~/utils/media-language` and docs/implementation/media-language-decisions.md:
//   GET  /api/media-preferences -> { effectiveContext, mediaPreferences, destination } (private, never in root data)
//   POST /api/user-settings/set   { clientId, pair, sequence, expectedVersion }
//     -> 200 { pair, version, sequence, effectiveContext, destination }, and the `gw_loc` cookie
//     -> 409 { error, sequence, current: { pair, version, sequence } | null }: saved meanwhile elsewhere
//     -> 400 / 503, no answer within SAVE_TIMEOUT_MS, or no network: not confirmed (the write may have landed)
import {
	type GetMediaPreferencesResponse,
	type LocalizationPair,
	type SaveLocalizationConflictResponse,
	type SaveLocalizationRequest,
	type SaveLocalizationResponse,
	isCurrentLocalizationResponse,
} from "~/utils/media-language"
import type { PreferencePair } from "./machine"

export interface PreferenceSaver {
	/** `expectedVersion`: the revision of the saved record the save replaces; null when nothing is on record. */
	save(
		pair: PreferencePair,
		options: { expectedVersion: string | null },
	): Promise<SaveLocalizationResponse>
}

/** The save was refused: `current` had been saved meanwhile elsewhere, or nothing is on record any more (null). */
export class PreferenceConflict extends Error {
	readonly current: SaveLocalizationConflictResponse["current"]
	constructor(current: SaveLocalizationConflictResponse["current"]) {
		super("The country and language were saved elsewhere meanwhile")
		this.current = current
	}
}

/** What is saved for this device or member, with its revision and where a save goes. */
export async function readMediaPreferences(
	signal?: AbortSignal,
): Promise<GetMediaPreferencesResponse> {
	const response = await fetch("/api/media-preferences", {
		cache: "no-store",
		signal,
	})
	if (!response.ok)
		throw new Error("Could not read the saved country and language")
	return response.json()
}

/** A save without an answer by then is given up as not confirmed, so the pair and Retry do not stay locked. */
export const SAVE_TIMEOUT_MS = 10_000

/**
 * Saves one at a time, in the order asked: each waits for the one before (every save writes the cookie). The
 * sequence counts within this saver's client id, a fresh one per page load, as the server expects. An answer, a
 * conflict included, must carry the sequence of the save it answers.
 */
export function endpointSaver(
	path = "/api/user-settings/set",
	timeoutMs = SAVE_TIMEOUT_MS,
): PreferenceSaver {
	let clientId: string | null = null
	let sequence = 0
	let queue: Promise<unknown> = Promise.resolve()
	const send = async (
		pair: PreferencePair,
		expectedVersion: string | null,
	): Promise<SaveLocalizationResponse> => {
		clientId ??= crypto.randomUUID()
		sequence += 1
		const sent = sequence
		const request: SaveLocalizationRequest = {
			clientId,
			pair: pair as LocalizationPair,
			sequence: sent,
			expectedVersion,
		}
		const abort = new AbortController()
		const timer = setTimeout(() => abort.abort(), timeoutMs)
		const response = await fetch(path, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(request),
			signal: abort.signal,
		}).finally(() => clearTimeout(timer))
		const body = await response.json().catch(() => null)
		if (
			response.status === 409 &&
			body &&
			isCurrentLocalizationResponse(body, sent)
		)
			throw new PreferenceConflict(
				(body as SaveLocalizationConflictResponse).current ?? null,
			)
		if (!response.ok)
			throw new Error(
				`Could not save the country and language (${response.status})`,
			)
		if (
			!body ||
			!isCurrentLocalizationResponse(body, sent) ||
			typeof body.pair?.country !== "string"
		)
			throw new Error("The save's answer is not for this save")
		return body as SaveLocalizationResponse
	}
	return {
		save(pair, { expectedVersion }) {
			const result = queue.then(() => send(pair, expectedVersion))
			queue = result.catch(() => {})
			return result
		},
	}
}
