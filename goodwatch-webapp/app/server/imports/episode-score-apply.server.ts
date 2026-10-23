// Confirm and Undo of imported season, episode and part scores (#759), through the shared import journal: like a
// title rating (apply.server.ts), each row writes its journal before it changes `user_episode_score`, so a resumed
// import recognizes its own write and Undo puts back exactly what was there. A score the member changed after the
// preview, or after the import, is left as it is.
import type {
	StoredUndoOutcome,
	UndoOutcome,
} from "../../domain/import-result.ts"
import {
	type EpisodeScoreTarget,
	episodeScoreKey,
	importedScoreTarget,
} from "../../domain/episode-scores.ts"
import type { ImportItem } from "../../domain/imports.ts"
import { type Param, recordUndo, run, select } from "./store.server.ts"

type Snapshot = {
	exists: boolean
	score?: number | null
	createdAt?: string
	updatedAt?: string
	seq?: number
	term?: number
}
/** What an episode score row wrote; `key` names the part in `user_episode_score`. */
export type EpisodeScoreJournal = {
	before: Snapshot
	after: Snapshot
	stamp: string
	key: string
}
type JournalItem = ImportItem & { payload: Record<string, unknown> }

async function snapshot(
	userId: string,
	showId: number,
	key: string,
): Promise<Snapshot> {
	await run("REFRESH TABLE user_episode_score")
	const row = (
		await select<{
			score: number
			created_at: Date | string
			updated_at: Date | string
			_seq_no: number
			_primary_term: number
		}>(
			"SELECT score, created_at, updated_at, _seq_no, _primary_term FROM user_episode_score WHERE user_id = ? AND tmdb_id = ? AND score_key = ?",
			[userId, showId, key],
		)
	)[0]
	return row
		? {
				exists: true,
				score: Number(row.score),
				createdAt: new Date(row.created_at).toISOString(),
				updatedAt: new Date(row.updated_at).toISOString(),
				seq: Number(row._seq_no),
				term: Number(row._primary_term),
			}
		: { exists: false }
}
const same = (a: Snapshot, b: Snapshot) =>
	a.exists === b.exists &&
	(!a.exists || (a.score === b.score && a.updatedAt === b.updatedAt))

async function persistJournal(
	importId: string,
	item: JournalItem,
	journal: EpisodeScoreJournal,
) {
	const payload = { ...item.payload, journal }
	await run(
		"UPDATE doc.user_import_item SET payload = ? WHERE import_id = ? AND row_index = ?",
		[JSON.stringify(payload), importId, item.index],
	)
	item.payload = payload
}

const columns = (target: EpisodeScoreTarget) => ({
	season: target.season,
	episode: target.scope === "episode" ? target.episode : null,
	episodeTmdbId: target.scope === "episode" ? target.episodeTmdbId : null,
	ranges: target.scope === "part" ? JSON.stringify(target.ranges) : null,
})

/** Writes one imported score. "kept" when the member changed the score after the preview. */
export async function applyImportedEpisodeScore(
	userId: string,
	importId: string,
	item: JournalItem,
): Promise<"added" | "updated" | "kept" | "failed"> {
	const target = importedScoreTarget(item)
	if (!target || item.tmdbId === null || typeof item.score !== "number")
		return "kept"
	const showId = item.tmdbId
	let journal = item.payload.journal as EpisodeScoreJournal | undefined
	if (!journal) {
		const key = episodeScoreKey(target)
		const before = await snapshot(userId, showId, key)
		const preview = item.payload._preview as
			| { seq: number; term: number }
			| null
			| undefined
		if (
			(preview == null) !== !before.exists ||
			(preview && (preview.seq !== before.seq || preview.term !== before.term))
		)
			return "kept"
		const stamp = new Date().toISOString()
		journal = {
			before,
			after: {
				exists: true,
				score: item.score,
				createdAt: before.createdAt ?? stamp,
				updatedAt: stamp,
			},
			stamp,
			key,
		}
		await persistJournal(importId, item, journal)
	}
	const done = journal.before.exists ? "updated" : "added"
	const now = await snapshot(userId, showId, journal.key)
	if (same(now, journal.after)) return done
	// Changed by the member between this row's journal and its write.
	if (!same(now, journal.before)) return "kept"
	const stamp = new Date(journal.stamp)
	if (!journal.before.exists) {
		const at = columns(target)
		await run(
			"INSERT INTO user_episode_score (user_id,tmdb_id,score_key,scope,season_number,episode_number,episode_tmdb_id,ranges,label,score,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT (user_id,tmdb_id,score_key) DO NOTHING",
			[
				userId,
				showId,
				journal.key,
				target.scope,
				at.season,
				at.episode,
				at.episodeTmdbId,
				at.ranges,
				target.scope === "part" ? (item.scoreLabel ?? null) : null,
				journal.after.score ?? null,
				stamp,
				stamp,
			] as Param[],
		)
	} else
		await run(
			"UPDATE user_episode_score SET score = ?, updated_at = ? WHERE user_id = ? AND tmdb_id = ? AND score_key = ? AND _seq_no = ? AND _primary_term = ?",
			[
				journal.after.score ?? null,
				stamp,
				userId,
				showId,
				journal.key,
				journal.before.seq ?? null,
				journal.before.term ?? null,
			] as Param[],
		)
	return same(await snapshot(userId, showId, journal.key), journal.after)
		? done
		: "failed"
}

/** Takes back one imported score, unless the member changed or removed it after the import. */
export async function undoImportedEpisodeScore(
	userId: string,
	importId: string,
	item: JournalItem & { undoOutcome: StoredUndoOutcome | null },
): Promise<UndoOutcome> {
	const journal = item.payload.journal as EpisodeScoreJournal | undefined
	if (!journal || item.tmdbId === null) return "not_restored"
	const current = await snapshot(userId, item.tmdbId, journal.key)
	// As before the import already: an earlier, interrupted Undo got this far if it marked the row.
	if (
		journal.before.exists
			? current.exists && current.score === (journal.before.score ?? null)
			: !current.exists
	)
		return item.undoOutcome === "reverting" ? "reverted" : "left"
	if (!same(current, journal.after)) return "left"
	if (current.seq === undefined || current.term === undefined) return "left"
	if (
		journal.before.exists &&
		(!journal.before.createdAt || !journal.before.updatedAt)
	)
		return "not_restored"
	await recordUndo(importId, item.index, "reverting")
	const result = journal.before.exists
		? await run(
				"UPDATE user_episode_score SET score = ?, created_at = ?, updated_at = ? WHERE user_id = ? AND tmdb_id = ? AND score_key = ? AND _seq_no = ? AND _primary_term = ?",
				[
					journal.before.score ?? null,
					new Date(journal.before.createdAt ?? ""),
					new Date(journal.before.updatedAt ?? ""),
					userId,
					item.tmdbId,
					journal.key,
					current.seq,
					current.term,
				],
			)
		: await run(
				"DELETE FROM user_episode_score WHERE user_id = ? AND tmdb_id = ? AND score_key = ? AND _seq_no = ? AND _primary_term = ?",
				[userId, item.tmdbId, journal.key, current.seq, current.term],
			)
	return result.rowcount ? "reverted" : "left"
}
