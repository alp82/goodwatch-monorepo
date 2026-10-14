import { randomUUID } from "node:crypto"
import { execute, query, upsert } from "../utils/crate.ts"
import {
	parseLocalizationRecord,
	type LocalizationPair,
	type LocalizationRecord,
	type LocalizationWriter,
} from "../utils/media-language.ts"

export const MEDIA_PREFERENCES_KEY = "media_preferences_v1"
export class MediaPreferencesConflict extends Error {
	constructor() {
		super("Preferences changed. Reload the saved pair before retrying.")
	}
}

const memberReads = new Map<
	string,
	{ expires: number; pending: ReturnType<typeof readMediaPreferences> }
>()
export function invalidateMediaPreferencesRead(userId: string) {
	memberReads.delete(userId)
}
/** Only presentation reads are briefly memoized; save/CAS/conflict/adoption reads remain real-time. */
export function readEffectiveMediaPreferences(userId: string) {
	const remembered = memberReads.get(userId)
	if (remembered && remembered.expires > Date.now()) return remembered.pending
	memberReads.delete(userId)
	while (memberReads.size >= 2048)
		memberReads.delete(memberReads.keys().next().value!)
	const entry = {
		expires: Date.now() + 15_000,
		pending: readMediaPreferences(userId).then((value) => ({
			...value,
			raw: null,
		})),
	}
	memberReads.set(userId, entry)
	entry.pending.catch(() => {
		if (memberReads.get(userId) === entry) memberReads.delete(userId)
	})
	return entry.pending
}

/** Full primary-key lookup: Crate real-time reads, independent of refresh and settings caches. */
export async function readMediaPreferences(userId: string): Promise<{
	raw: string | null
	record: LocalizationRecord | null
	seqNo: number | null
	primaryTerm: number | null
}> {
	const rows = await query<{
		value: string
		seq_no: number
		primary_term: number
	}>(
		"SELECT value, _seq_no AS seq_no, _primary_term AS primary_term FROM user_setting WHERE user_id = ? AND key = ?",
		[userId, MEDIA_PREFERENCES_KEY],
	)
	const raw = rows[0]?.value ?? null
	return {
		raw,
		record: parseLocalizationRecord(raw),
		seqNo: rows[0]?.seq_no ?? null,
		primaryTerm: rows[0]?.primary_term ?? null,
	}
}

/** Exactly one row, including Keep, Undo and first sign-in adoption. No legacy row is deleted. */
export async function writeMediaPreferences(
	userId: string,
	pair: LocalizationPair,
	options: {
		expectedVersion?: string | null
		/** Adoption must not replace a pair another device saved meanwhile. */
		adoptOnly?: boolean
		writer?: LocalizationWriter
	} = {},
): Promise<LocalizationRecord> {
	const before = await readMediaPreferences(userId)
	if (options.adoptOnly && before.record) return before.record
	const ownPrior =
		!!options.writer &&
		before.record?.writer?.clientId === options.writer.clientId
	if (ownPrior && before.record && options.writer) {
		const previous = before.record.writer!
		if (options.writer.sequence < previous.sequence)
			throw new MediaPreferencesConflict()
		if (options.writer.sequence === previous.sequence) {
			if (
				pair.country === before.record.country &&
				pair.language === before.record.language
			)
				return before.record
			throw new MediaPreferencesConflict()
		}
	}
	if (
		options.expectedVersion !== undefined &&
		options.expectedVersion !== (before.record?.version ?? null) &&
		!ownPrior
	)
		throw new MediaPreferencesConflict()
	const record: LocalizationRecord = {
		...pair,
		schemaVersion: 1,
		version: randomUUID(),
		...(options.writer
			? { writer: options.writer }
			: before.record?.writer
				? { writer: before.record.writer }
				: {}),
	}
	const raw = JSON.stringify(record)
	if (
		(options.adoptOnly ||
			options.expectedVersion !== undefined ||
			options.writer) &&
		before.raw !== null
	) {
		try {
			const result = await execute(
				"UPDATE user_setting SET value = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ? AND key = ? AND _seq_no = ? AND _primary_term = ?",
				[
					raw,
					userId,
					MEDIA_PREFERENCES_KEY,
					before.seqNo!,
					before.primaryTerm!,
				],
			)
			if (result.rowcount !== 1) {
				const current = await readMediaPreferences(userId)
				if (options.adoptOnly && current.record) return current.record
				throw new MediaPreferencesConflict()
			}
		} catch (error) {
			// A timed-out write may have landed: accept only this exact record on read-back.
			if ((await readMediaPreferences(userId)).raw !== raw) throw error
		}
	} else {
		await upsert({
			table: "user_setting",
			data: [{ user_id: userId, key: MEDIA_PREFERENCES_KEY, value: raw }],
			conflictColumns: ["user_id", "key"],
			ignoreUpdate: !!(
				options.adoptOnly ||
				options.expectedVersion !== undefined ||
				options.writer
			),
		})
	}
	invalidateMediaPreferencesRead(userId)
	const stored = await readMediaPreferences(userId)
	if (options.adoptOnly && stored.record) return stored.record
	if (stored.raw !== raw) throw new MediaPreferencesConflict()
	return record
}
