// Where a kept pair goes, and what the server says is saved. The header pair saves through one `save` call, for Keep
// and for the toast's Undo alike, and takes the pair the server answers with as the saved one.
//
// The thin edge to the backend's contract (branch feat/media-language, `app/utils/media-language.ts` and
// `app/server/media-context.server.ts`). Its shapes are mirrored here, not imported, while that contract is revised;
// once it lands, replace the mirrored types with imports and `isCurrent` with `isCurrentLocalizationResponse`.
//   POST /api/user-settings/set  { pair: { country, language }, sequence, expectedVersion }
//     -> 200 { pair, version, sequence, effectiveContext, destination: "device" | "account" }
//     -> 409 { current: { country, language, version } } (ASSUMED shape; `record` is read too): saved meanwhile
//        elsewhere. The page adopts that record as saved, keeps the preview and offers Retry with its version.
//     -> 503 (save not confirmed): a failed save, the preview stays for Retry
// The root loader exposes `locale` (the effective context) and `mediaPreferences` (the saved record, or null).
import type { PreferencePair } from "./machine"

export interface SavedPreference {
	pair: PreferencePair
	version: string
	destination?: "device" | "account"
}

export interface PreferenceSaver {
	/** `expectedVersion`: the version of the saved record the save replaces; null when nothing is saved. */
	save(
		pair: PreferencePair,
		options: { expectedVersion: string | null },
	): Promise<SavedPreference>
}

/** The save was refused: `current` had been saved meanwhile elsewhere. */
export class PreferenceConflict extends Error {
	readonly current: SavedRecord
	constructor(current: SavedRecord) {
		super("The country and language were saved elsewhere meanwhile")
		this.current = current
	}
}

const asRecord = (value: unknown): SavedRecord | null => {
	const r = value as Partial<SavedRecord> | null | undefined
	return typeof r?.country === "string" &&
		typeof r.language === "string" &&
		typeof r.version === "string"
		? { country: r.country, language: r.language, version: r.version }
		: null
}

/** Mirrors `LocalizationRecord`. */
export interface SavedRecord extends PreferencePair {
	version: string
}

/** Mirrors the parts of `EffectiveMediaContext` the pair reads. */
export interface EffectiveContext {
	country: string
	language: string
	languageSetting: string
	languageProvenance: "explicit" | "browser" | "default"
}

/** What the root loader says, read defensively: a root without the backend's fields answers nulls. */
export function serverPreference(root: unknown): {
	record: SavedRecord | null
	context: EffectiveContext | null
} {
	const data = (root ?? {}) as { locale?: unknown; mediaPreferences?: unknown }
	const record = data.mediaPreferences as
		| Partial<SavedRecord>
		| null
		| undefined
	const context = data.locale as Partial<EffectiveContext> | undefined
	return {
		record: asRecord(record),
		context:
			typeof context?.languageSetting === "string" &&
			typeof context.language === "string" &&
			typeof context.country === "string"
				? (context as EffectiveContext)
				: null,
	}
}

/** An answer for the latest save sent, not an older one. */
const isCurrent = (sequence: unknown, latest: number) =>
	Number.isSafeInteger(sequence) &&
	(sequence as number) >= 0 &&
	sequence === latest

/**
 * Saves one at a time, in the order asked: each waits for the one before (the server writes a cookie per save). An
 * answer must carry the sequence of the save it answers.
 */
export function endpointSaver(
	path = "/api/user-settings/set",
): PreferenceSaver {
	let sequence = 0
	let queue: Promise<unknown> = Promise.resolve()
	const send = async (
		pair: PreferencePair,
		expectedVersion: string | null,
	): Promise<SavedPreference> => {
		sequence += 1
		const sent = sequence
		const response = await fetch(path, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ pair, sequence: sent, expectedVersion }),
		})
		if (response.status === 409) {
			const body = await response.json().catch(() => null)
			const current = asRecord(body?.current ?? body?.record)
			if (current) throw new PreferenceConflict(current)
		}
		if (!response.ok)
			throw new Error(
				`Could not save the country and language (${response.status})`,
			)
		const body = await response.json()
		if (
			!isCurrent(body?.sequence, sent) ||
			typeof body.pair?.country !== "string"
		)
			throw new Error("The save's answer is not for this save")
		return {
			pair: body.pair,
			version: body.version,
			destination: body.destination,
		}
	}
	return {
		save(pair, { expectedVersion }) {
			const result = queue.then(() => send(pair, expectedVersion))
			queue = result.catch(() => {})
			return result
		},
	}
}
