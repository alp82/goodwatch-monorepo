// An in-memory stand-in for the two tables the member's season and episode scores touch: `user_episode_score` and
// the episode catalog. It answers exactly the statements episode-scores.server.ts sends and rejects any other, so a
// changed statement fails its test instead of passing silently.
type Row = Record<string, unknown>

export class EpisodeScoreFakeDb {
	scores: Row[] = []
	episodes: Row[] = []
	/** Answers every statement the way Crate does before the migration ran. */
	missingTable = false
	statements: string[] = []
	/** Runs before each write, as another tab changing the score at that moment would. */
	beforeWrite: ((sql: string) => void) | null = null
	private version = 1

	/** The member changes or clears a score elsewhere: a new version, as Crate gives it. */
	changeElsewhere(key: string, score: number | null, at = new Date()) {
		if (score === null) {
			this.scores = this.scores.filter((x) => x.score_key !== key)
			return
		}
		const row = this.scores.find((x) => x.score_key === key)
		if (row)
			Object.assign(row, { score, updated_at: at, _seq_no: ++this.version })
	}

	addEpisode(
		showId: number,
		tmdbId: number,
		season: number,
		number: number,
		airDate: string | null = "2020-01-01",
	) {
		this.episodes.push({
			show_id: showId,
			tmdb_id: tmdbId,
			season_number: season,
			episode_number: number,
			air_date: airDate,
			removed_at: null,
		})
	}

	private guard(sql: string) {
		this.statements.push(sql)
		if (this.missingTable && sql.includes("user_episode_score"))
			throw new Error(
				"RelationUnknown[Relation 'user_episode_score' unknown. Maybe you meant 'user_score']",
			)
	}

	async select<T extends {}>(sql: string, params: unknown[]): Promise<T[]> {
		const s = sql.replace(/\s+/g, " ").trim()
		this.guard(s)
		if (
			s ===
			"SELECT score_key, scope, season_number, episode_number, episode_tmdb_id, ranges, label, score, updated_at FROM user_episode_score WHERE user_id = ? AND tmdb_id = ? LIMIT 10000"
		)
			return this.scores
				.filter((x) => x.user_id === params[0] && x.tmdb_id === params[1])
				.map((x) => ({ ...x })) as T[]
		if (
			s ===
			"SELECT score_key, scope, season_number, episode_number, episode_tmdb_id, ranges, label, score, updated_at FROM user_episode_score WHERE user_id = ? AND tmdb_id = ? AND score_key = ?"
		)
			return this.scores
				.filter(
					(x) =>
						x.user_id === params[0] &&
						x.tmdb_id === params[1] &&
						x.score_key === params[2],
				)
				.map((x) => ({ ...x })) as T[]
		if (
			s ===
			"SELECT score, updated_at, _seq_no, _primary_term FROM user_episode_score WHERE user_id = ? AND tmdb_id = ? AND score_key = ?"
		)
			return this.scores
				.filter(
					(x) =>
						x.user_id === params[0] &&
						x.tmdb_id === params[1] &&
						x.score_key === params[2],
				)
				.map((x) => ({
					score: x.score,
					updated_at: x.updated_at,
					_seq_no: x._seq_no,
					_primary_term: x._primary_term ?? 1,
				})) as unknown as T[]
		if (
			s ===
			"SELECT score FROM user_episode_score WHERE user_id = ? AND tmdb_id = ? AND score_key = ?"
		)
			return this.scores
				.filter(
					(x) =>
						x.user_id === params[0] &&
						x.tmdb_id === params[1] &&
						x.score_key === params[2],
				)
				.map((x) => ({ score: x.score })) as unknown as T[]
		if (
			s ===
			"SELECT tmdb_id, season_number, episode_number FROM episode WHERE show_id = ? AND tmdb_id = ? AND removed_at IS NULL LIMIT 1"
		)
			return this.episodes
				.filter((x) => x.show_id === params[0] && x.tmdb_id === params[1])
				.slice(0, 1)
				.map((x) => ({ ...x })) as T[]
		if (
			s ===
			"SELECT tmdb_id FROM episode WHERE show_id = ? AND season_number = ? AND removed_at IS NULL LIMIT 1"
		)
			return this.episodes
				.filter((x) => x.show_id === params[0] && x.season_number === params[1])
				.slice(0, 1)
				.map((x) => ({ tmdb_id: x.tmdb_id })) as unknown as T[]
		throw new Error(`Unexpected episode score select: ${s}`)
	}

	async run(sql: string, params: unknown[]) {
		const s = sql.replace(/\s+/g, " ").trim()
		this.guard(s)
		this.beforeWrite?.(s)
		const at = (i: number) =>
			this.scores.find(
				(x) =>
					x.user_id === params[i] &&
					x.tmdb_id === params[i + 1] &&
					x.score_key === params[i + 2],
			)
		if (
			s ===
			"UPDATE user_episode_score SET score = ?, updated_at = ? WHERE user_id = ? AND tmdb_id = ? AND score_key = ? AND _seq_no = ? AND _primary_term = ?"
		) {
			const row = at(2)
			if (!row || row._seq_no !== params[5] || row._primary_term !== params[6])
				return { rowcount: 0 }
			Object.assign(row, {
				score: params[0],
				updated_at: params[1],
				_seq_no: ++this.version,
			})
			return { rowcount: 1 }
		}
		if (
			s ===
			"DELETE FROM user_episode_score WHERE user_id = ? AND tmdb_id = ? AND score_key = ? AND _seq_no = ? AND _primary_term = ?"
		) {
			const row = at(0)
			if (!row || row._seq_no !== params[3] || row._primary_term !== params[4])
				return { rowcount: 0 }
			this.scores = this.scores.filter((x) => x !== row)
			return { rowcount: 1 }
		}
		if (
			s ===
			"INSERT INTO user_episode_score (user_id,tmdb_id,score_key,scope,season_number,episode_number,episode_tmdb_id,ranges,label,score,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT (user_id,tmdb_id,score_key) DO UPDATE SET score = excluded.score, season_number = excluded.season_number, episode_number = excluded.episode_number, updated_at = excluded.updated_at"
		) {
			const [user_id, tmdb_id, score_key] = params
			const row = this.scores.find(
				(x) =>
					x.user_id === user_id &&
					x.tmdb_id === tmdb_id &&
					x.score_key === score_key,
			)
			if (row)
				Object.assign(row, {
					score: params[9],
					season_number: params[4],
					episode_number: params[5],
					updated_at: params[11],
					_seq_no: ++this.version,
				})
			else
				this.scores.push({
					user_id,
					tmdb_id,
					score_key,
					scope: params[3],
					season_number: params[4],
					episode_number: params[5],
					episode_tmdb_id: params[6],
					ranges: params[7],
					label: params[8],
					score: params[9],
					created_at: params[10],
					updated_at: params[11],
					_seq_no: ++this.version,
					_primary_term: 1,
				})
			return { rowcount: 1 }
		}
		if (
			s ===
			"UPDATE user_episode_score SET score = ?, updated_at = ? WHERE user_id = ? AND tmdb_id = ? AND score_key = ?"
		) {
			const row = this.scores.find(
				(x) =>
					x.user_id === params[2] &&
					x.tmdb_id === params[3] &&
					x.score_key === params[4],
			)
			if (!row) return { rowcount: 0 }
			Object.assign(row, {
				score: params[0],
				updated_at: params[1],
				_seq_no: ++this.version,
			})
			return { rowcount: 1 }
		}
		if (
			s ===
			"DELETE FROM user_episode_score WHERE user_id = ? AND tmdb_id = ? AND score_key = ?"
		) {
			const before = this.scores.length
			this.scores = this.scores.filter(
				(x) =>
					!(
						x.user_id === params[0] &&
						x.tmdb_id === params[1] &&
						x.score_key === params[2]
					),
			)
			return { rowcount: before - this.scores.length }
		}
		throw new Error(`Unexpected episode score statement: ${s}`)
	}
}

/**
 * The tracking writer's side, as calls: which episodes a score marked watched and which it took back. `watched`
 * holds the episodes some pass has a watch of, and the score's own watches by id.
 */
export class FakeEpisodeScoreWatches {
	calls: string[] = []
	watched = new Map<number, string>()
	failing = false
	async mark(userId: string, showId: number, episodeTmdbId: number) {
		this.calls.push(`mark ${userId} ${showId} ${episodeTmdbId}`)
		if (this.failing) throw new Error("Crate is down")
		if (this.watched.has(episodeTmdbId)) return null
		const id = `score-e${episodeTmdbId}`
		this.watched.set(episodeTmdbId, id)
		return id
	}
	async remove(userId: string, showId: number, episodeTmdbId: number) {
		this.calls.push(`remove ${userId} ${showId} ${episodeTmdbId}`)
		const id = this.watched.get(episodeTmdbId)
		if (id !== `score-e${episodeTmdbId}`) return null
		this.watched.delete(episodeTmdbId)
		return id
	}
}
