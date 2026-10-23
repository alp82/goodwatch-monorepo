// A member's season and episode scores (#759), from the Episodes section of a show page, and the parts imports keep
// (domain/episode-scores.ts). They live in `user_episode_score`, never in `user_score`: nothing here marks taste
// changed, changes a fingerprint or a recommendation, records a watch, or changes a show's status.
//
// Until the migration (docs/implementation/imports/episode-scores-migration.sql) has run, reads find no scores and
// writes throw EpisodeScoresUnavailable.
import {
	type EpisodeScoreRange,
	type EpisodeScoreTarget,
	type MemberEpisodeScore,
	type RequestedEpisodeScoreTarget,
	episodeScoreKey,
	isEpisodeScore,
} from "../domain/episode-scores.ts"
import { execute, query } from "../utils/crate.ts"
import { canonicalTitleId } from "../utils/title-identity.ts"

type Param = string | number | Date | null
interface EpisodeScoreDb {
	run(sql: string, params: Param[]): Promise<{ rowcount?: number }>
	select<T extends {}>(sql: string, params: Param[]): Promise<T[]>
}
const liveDb: EpisodeScoreDb = {
	run: (sql, params) => execute(sql, params as (string | number | Date)[]),
	select: (sql, params) => query(sql, params as (string | number | Date)[]),
}
let db: EpisodeScoreDb = liveDb
/** Test-only database boundary. Passing no value restores the live Crate adapter. */
export const setEpisodeScoreDbForTest = (replacement?: EpisodeScoreDb) => {
	db = replacement ?? liveDb
}

/** The table doesn't exist yet: the migration hasn't run. */
export class EpisodeScoresUnavailable extends Error {
	constructor() {
		super("Season and episode scores aren't available yet.")
		this.name = "EpisodeScoresUnavailable"
	}
}
/** The season or episode isn't in the show's episode list, or the score isn't from 1 to 10. */
export class EpisodeScoreTargetError extends Error {
	constructor(message: string) {
		super(message)
		this.name = "EpisodeScoreTargetError"
	}
}

export function isMissingEpisodeScoreTable(error: unknown): boolean {
	const message = String(
		(error as { message?: unknown } | null)?.message ?? error,
	)
	return (
		/RelationUnknown|SchemaUnknown/.test(message) &&
		message.includes("user_episode_score")
	)
}

export interface EpisodeScoreRow {
	score_key: string
	scope: "season" | "episode" | "part"
	season_number: number | null
	episode_number: number | null
	episode_tmdb_id: number | null
	ranges: string | null
	label: string | null
	score: number
	updated_at: Date | string | number
}

const parseRanges = (value: string | null): EpisodeScoreRange[] => {
	try {
		const parsed = value ? (JSON.parse(value) as EpisodeScoreRange[]) : []
		return Array.isArray(parsed) ? parsed : []
	} catch {
		return []
	}
}

/** A stored row as the page and the API read it; null for a row that can't be read. */
export function episodeScoreFromRow(
	row: EpisodeScoreRow,
): MemberEpisodeScore | null {
	const common = {
		key: row.score_key,
		score: Number(row.score),
		label: row.label ?? null,
		updatedAt: new Date(row.updated_at).toISOString(),
	}
	const season = Number(row.season_number)
	if (row.scope === "season") return { scope: "season", season, ...common }
	if (row.scope === "episode")
		return row.episode_tmdb_id == null || row.episode_number == null
			? null
			: {
					scope: "episode",
					season,
					episode: Number(row.episode_number),
					episodeTmdbId: Number(row.episode_tmdb_id),
					...common,
				}
	const ranges = parseRanges(row.ranges)
	return ranges.length
		? { scope: "part", season: ranges[0].season, ranges, ...common }
		: null
}

/** The member's scores for parts of one show; none before the migration. */
export async function getEpisodeScores(
	userId: string,
	showId: number,
): Promise<MemberEpisodeScore[]> {
	try {
		const rows = await db.select<EpisodeScoreRow>(
			"SELECT score_key, scope, season_number, episode_number, episode_tmdb_id, ranges, label, score, updated_at FROM user_episode_score WHERE user_id = ? AND tmdb_id = ? LIMIT 10000",
			[userId, canonicalTitleId("show", showId)],
		)
		return rows.flatMap((row) => {
			const score = episodeScoreFromRow(row)
			return score ? [score] : []
		})
	} catch (error) {
		if (isMissingEpisodeScoreTable(error)) return []
		throw error
	}
}

/**
 * One score by its whole key; null when there is none, and before the migration. Crate answers a read by the whole
 * primary key at once, so this sees a write made just before it, unlike getEpisodeScores until the next refresh.
 */
export async function getEpisodeScore(
	userId: string,
	showId: number,
	key: string,
): Promise<MemberEpisodeScore | null> {
	try {
		const [row] = await db.select<EpisodeScoreRow>(
			"SELECT score_key, scope, season_number, episode_number, episode_tmdb_id, ranges, label, score, updated_at FROM user_episode_score WHERE user_id = ? AND tmdb_id = ? AND score_key = ?",
			[userId, canonicalTitleId("show", showId), key],
		)
		return row ? episodeScoreFromRow(row) : null
	} catch (error) {
		if (isMissingEpisodeScoreTable(error)) return null
		throw error
	}
}

/** The requested season or episode, in TMDB's numbering, as the catalog has it now. */
async function resolveTarget(
	showId: number,
	target: RequestedEpisodeScoreTarget,
): Promise<EpisodeScoreTarget> {
	if (target.scope === "season") {
		const found = await db.select<{ tmdb_id: number }>(
			"SELECT tmdb_id FROM episode WHERE show_id = ? AND season_number = ? AND removed_at IS NULL LIMIT 1",
			[showId, target.season],
		)
		if (!found.length)
			throw new EpisodeScoreTargetError(
				"That season isn't in this show's episode list.",
			)
		return { scope: "season", season: target.season }
	}
	const [episode] = await db.select<{
		tmdb_id: number
		season_number: number
		episode_number: number
	}>(
		"SELECT tmdb_id, season_number, episode_number FROM episode WHERE show_id = ? AND tmdb_id = ? AND removed_at IS NULL LIMIT 1",
		[showId, target.episodeTmdbId],
	)
	if (!episode)
		throw new EpisodeScoreTargetError(
			"That episode isn't in this show's episode list.",
		)
	return {
		scope: "episode",
		season: Number(episode.season_number),
		episode: Number(episode.episode_number),
		episodeTmdbId: Number(episode.tmdb_id),
	}
}

export interface SetEpisodeScoreResult {
	status: "saved" | "cleared" | "unchanged"
	/** The score as stored now; null once cleared. */
	score: MemberEpisodeScore | null
	/** The score before this change; null when there was none. */
	previous: number | null
}

/**
 * Sets, changes or clears the member's score for a season or an episode. A change keeps when the score was first
 * given. Throws EpisodeScoreTargetError for a target or score that isn't valid, and EpisodeScoresUnavailable before
 * the migration.
 */
export async function setEpisodeScore(
	userId: string,
	showId: number,
	requested: RequestedEpisodeScoreTarget,
	score: number | null,
): Promise<SetEpisodeScoreResult> {
	if (score !== null && !isEpisodeScore(score))
		throw new EpisodeScoreTargetError("A score is a whole number from 1 to 10.")
	const show = canonicalTitleId("show", showId)
	try {
		const target = await resolveTarget(show, requested)
		const key = episodeScoreKey(target)
		const [before] = await db.select<{ score: number }>(
			"SELECT score FROM user_episode_score WHERE user_id = ? AND tmdb_id = ? AND score_key = ?",
			[userId, show, key],
		)
		const previous = before ? Number(before.score) : null
		if (score === null) {
			const removed = await db.run(
				"DELETE FROM user_episode_score WHERE user_id = ? AND tmdb_id = ? AND score_key = ?",
				[userId, show, key],
			)
			return {
				status: removed.rowcount ? "cleared" : "unchanged",
				score: null,
				previous,
			}
		}
		const now = new Date()
		await db.run(
			"INSERT INTO user_episode_score (user_id,tmdb_id,score_key,scope,season_number,episode_number,episode_tmdb_id,ranges,label,score,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT (user_id,tmdb_id,score_key) DO UPDATE SET score = excluded.score, season_number = excluded.season_number, episode_number = excluded.episode_number, updated_at = excluded.updated_at",
			[
				userId,
				show,
				key,
				target.scope,
				target.season,
				target.scope === "episode" ? target.episode : null,
				target.scope === "episode" ? target.episodeTmdbId : null,
				null,
				null,
				score,
				now,
				now,
			],
		)
		return {
			status: "saved",
			score: {
				...target,
				key,
				score,
				label: null,
				updatedAt: now.toISOString(),
			},
			previous,
		}
	} catch (error) {
		if (isMissingEpisodeScoreTable(error)) throw new EpisodeScoresUnavailable()
		throw error
	}
}

/** A part's key as the store writes it: "p:s1e1-12", ranges joined by commas. */
export const isPartScoreKey = (value: unknown): value is string =>
	typeof value === "string" &&
	value.length <= 400 &&
	/^p:s\d+e\d+-\d+(,s\d+e\d+-\d+)*$/.test(value)

/**
 * Changes or clears a part score an import brought, such as an anime cour's (S1 E1–12). Only imports create parts:
 * a key that names no stored part throws EpisodeScoreTargetError. The range and the source's name stay as they are.
 */
export async function setPartScore(
	userId: string,
	showId: number,
	key: string,
	score: number | null,
): Promise<SetEpisodeScoreResult> {
	if (score !== null && !isEpisodeScore(score))
		throw new EpisodeScoreTargetError("A score is a whole number from 1 to 10.")
	if (!isPartScoreKey(key))
		throw new EpisodeScoreTargetError("That part score isn't there anymore.")
	const show = canonicalTitleId("show", showId)
	try {
		const [row] = await db.select<EpisodeScoreRow>(
			"SELECT score_key, scope, season_number, episode_number, episode_tmdb_id, ranges, label, score, updated_at FROM user_episode_score WHERE user_id = ? AND tmdb_id = ? AND score_key = ?",
			[userId, show, key],
		)
		const stored = row ? episodeScoreFromRow(row) : null
		if (!stored || stored.scope !== "part")
			throw new EpisodeScoreTargetError("That part score isn't there anymore.")
		if (score === null) {
			const removed = await db.run(
				"DELETE FROM user_episode_score WHERE user_id = ? AND tmdb_id = ? AND score_key = ?",
				[userId, show, key],
			)
			return {
				status: removed.rowcount ? "cleared" : "unchanged",
				score: null,
				previous: stored.score,
			}
		}
		const now = new Date()
		await db.run(
			"UPDATE user_episode_score SET score = ?, updated_at = ? WHERE user_id = ? AND tmdb_id = ? AND score_key = ?",
			[score, now, userId, show, key],
		)
		return {
			status: "saved",
			score: { ...stored, score, updatedAt: now.toISOString() },
			previous: stored.score,
		}
	} catch (error) {
		if (isMissingEpisodeScoreTable(error)) throw new EpisodeScoresUnavailable()
		throw error
	}
}
