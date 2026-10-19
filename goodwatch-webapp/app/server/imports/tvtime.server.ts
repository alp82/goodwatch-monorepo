import {
	IMPORT_MAX_ROWS,
	type ImportObservation,
	type ParsedImport,
} from "../../domain/imports.ts"

type Entry = { name: string; data: Uint8Array }
type Row = Record<string, unknown>
const record = (v: unknown): Row =>
	v !== null && typeof v === "object" && !Array.isArray(v) ? (v as Row) : {}
const array = (v: unknown): unknown[] => (Array.isArray(v) ? v : [])
interface Readers {
	readCsvTable(
		data: Uint8Array,
		name: string,
		remainingRows?: number,
	): { headers: string[]; rows: string[][] }
	text(entry: Entry): string
	fail(message: string, code?: string): never
}
const basename = (name: string) => name.split("/").at(-1) ?? name
const normalized = (value: string) =>
	value.toLowerCase().replace(/[^a-z0-9]/g, "")
const string = (value: unknown) =>
	typeof value === "string" ? value.trim().slice(0, 1000) : ""
const id = (value: unknown): number | null => {
	const n =
		typeof value === "number" ||
		(typeof value === "string" && /^\d+$/.test(value.trim()))
			? Number(value)
			: Number.NaN
	return Number.isSafeInteger(n) && n > 0 ? n : null
}
const yes = (value: unknown) =>
	value === true || value === 1 || value === "true" || value === "1"
const boolean = (value: unknown) =>
	value === true ||
	value === false ||
	value === 0 ||
	value === 1 ||
	value === "true" ||
	value === "false" ||
	value === "0" ||
	value === "1"
const coordinate = (value: unknown) =>
	value !== "" &&
	value != null &&
	Number.isSafeInteger(Number(value)) &&
	Number(value) >= 0
		? Number(value)
		: null
const year = (value: unknown) => {
	const n =
		typeof value === "number" ? value : Number(string(value).slice(0, 4))
	return Number.isInteger(n) && n >= 1800 && n <= 9999 ? n : null
}
function date(
	value: unknown,
): Pick<ImportObservation, "watchedAt" | "precision"> {
	const raw = string(value)
	const d = raw.slice(0, 10)
	if (
		!/^\d{4}-\d{2}-\d{2}$/.test(d) ||
		!Number.isFinite(Date.parse(d)) ||
		new Date(d).toISOString().slice(0, 10) !== d ||
		d.startsWith("0001")
	)
		return { watchedAt: null, precision: "unknown" }
	if (
		/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(
			raw,
		) &&
		Number.isFinite(Date.parse(raw))
	)
		return { watchedAt: new Date(raw).toISOString(), precision: "moment" }
	if (
		/^\d{4}-\d{2}-\d{2}(?:[ T]\d{2}:\d{2}:\d{2}(?:\.\d+)?)?$/.test(raw) &&
		(raw.length === 10 ||
			Number.isFinite(Date.parse(`${raw.replace(" ", "T")}Z`)))
	)
		return { watchedAt: d, precision: "day" }
	return { watchedAt: null, precision: "unknown" }
}
function fileKind(name: string) {
	const n = normalized(basename(name))
	if (n === "showsjson" || /^tvtimeseries\d.*json$/.test(n)) return "showsJson"
	if (n === "moviesjson" || /^tvtimemovies\d.*json$/.test(n))
		return "moviesJson"
	if (/followedtvshowcsv$/.test(n) || /usertvshowdatacsv$/.test(n))
		return "followed"
	if (/ratingslivevotescsv$/.test(n)) return "votes"
	if (/trackingprodrecordsv2csv$/.test(n)) return "v2"
	if (/trackingprodrecordscsv$/.test(n)) return "v1"
	if (
		/^tvtime(seriesepisodes|series|movies)\d.*csv$/.test(n) ||
		n === "activityhistorycsv"
	)
		return "extension"
	return null
}
export const isTvTimeFile = (name: string) => fileKind(name) !== null

export function parseTvTime(
	entries: Entry[],
	readers: Readers,
	ignored: string[] = [],
): ParsedImport {
	const observations: ImportObservation[] = []
	if (!entries.some((entry) => isTvTimeFile(entry.name)) && ignored.length)
		readers.fail(
			"That TV Time archive has no supported tracking data.",
			"tvtime_no_tracking",
		)
	const families = new Set(
		entries
			.map((e) => fileKind(e.name))
			.filter(Boolean)
			.map((k) =>
				["v1", "v2", "followed", "votes"].includes(k ?? "")
					? "official"
					: "extension",
			),
	)
	if (families.size > 1)
		readers.fail(
			"These files come from different TV Time export variants. Upload one export at a time.",
			"tvtime_variants_mixed",
		)
	const warnings = ignored.map((name) => `TV Time file not imported: ${name}.`)
	const add = (row: ImportObservation) => {
		if (observations.length >= IMPORT_MAX_ROWS)
			readers.fail(
				"That TV Time export has more than 50,000 observations.",
				"tvtime_limit",
			)
		if (row.kind === "watch" && row.mediaType === "show" && !row.episodeTvdbId)
			row.problem = {
				outcome: "unmatched",
				code: "tvtime_episode_identity_missing",
				reason:
					"This TV Time episode has no TVDB episode ID. TVDB season and episode numbers alone cannot identify a TMDB episode.",
			}
		observations.push(row)
	}
	let rowsRead = 0
	let sourceRows = 0
	let unwatchedEpisodes = 0
	const countSourceRow = () => {
		if (++sourceRows > 500_000)
			readers.fail(
				"That TV Time export has more than 500,000 source rows.",
				"tvtime_limit",
			)
	}
	const countRow = () => {
		if (++rowsRead > IMPORT_MAX_ROWS)
			readers.fail(
				"That TV Time export has more than 50,000 rows.",
				"tvtime_limit",
			)
	}
	const followedRows = new Set<ImportObservation>()
	const legacyFollowRows = new Set<ImportObservation>()
	const v2Shows = new Set<number>()
	const follow = (base: ImportObservation, legacy = false) => {
		const row: ImportObservation = {
			...base,
			kind: "want",
			wishlistEvidence: {
				source: "tvtime",
				sourceId: base.key,
				mediaType: base.mediaType,
				completeness: "unknown",
			},
		}
		followedRows.add(row)
		if (legacy) legacyFollowRows.add(row)
		add(row)
	}
	const plays = new Map<string, ImportObservation>()
	const undatedMoviePlays = new Map<string, number>()
	const undatedEpisodePlays = new Map<string, number>()
	const addPlay = (row: ImportObservation, stamp: unknown) => {
		const raw = string(stamp)
		const identity =
			row.mediaType === "show"
				? row.episodeTvdbId
					? String(row.episodeTvdbId)
					: row.key
				: row.key.split(":").slice(0, 3).join(":")
		const ref = raw ? `${row.mediaType}:${identity}:${raw}` : row.key
		if (raw && row.precision === "unknown")
			warnings.push(
				"A TV Time watch date is invalid or records a bulk mark; the watch is imported without a date.",
			)
		const prior = plays.get(ref)
		if (prior) {
			if (!prior.showTvdbId && row.showTvdbId) prior.showTvdbId = row.showTvdbId
			if (row.key < prior.key) prior.key = row.key
			warnings.push(
				raw
					? "TV Time plays with a shared timestamp were imported as one watch."
					: "Repeated undated TV Time records for the same item were imported as one watch.",
			)
			return
		}
		plays.set(ref, row)
		add(row)
	}
	const jsonMovies = entries.some((e) => fileKind(e.name) === "moviesJson")
	const jsonShows = entries.some((e) => fileKind(e.name) === "showsJson")
	const extension = (
		row: Row,
		hint: string,
		csv = false,
		verifiedMovieScale = false,
	) => {
		countSourceRow()
		const episode = hint === "episode" || row.type === "episode"
		const movie = hint === "movie" || row.type === "movie"
		const hasRating =
			row.rating != null &&
			row.rating !== "" &&
			row.rating !== 0 &&
			row.rating !== "0"
		if (
			episode &&
			boolean(row.iswatched) &&
			!yes(row.iswatched) &&
			!hasRating
		) {
			unwatchedEpisodes++
			return
		}
		countRow()
		if (csv && (movie ? jsonMovies : jsonShows)) {
			warnings.push(
				"TV Time JSON and CSV contain the same export. The JSON representation is used once.",
			)
			return
		}
		const imdb = string(episode ? row.seriesimdbid : row.imdbid)
		const identity = string(row.uuid) || String(id(row.tvdbid) ?? "") || imdb
		const base: ImportObservation = {
			key: `tvtime:${movie ? "movie" : "show"}:${identity}`,
			kind: "watch",
			mediaType: movie ? "movie" : "show",
			title: string(row.title) || "TV Time title",
			year: year(row.year),
			tmdbId: null,
			imdbId: /^tt\d{7,10}$/.test(imdb) ? imdb : null,
		}
		if (!movie) base.showTvdbId = id(episode ? row.seriestvdbid : row.tvdbid)
		if (
			!identity ||
			!string(row.title) ||
			((episode || movie) && !boolean(row.iswatched))
		) {
			add({
				...base,
				key: `${base.key}:invalid:${observations.length}`,
				problem: {
					outcome: "invalid",
					code: "tvtime_row_invalid",
					reason:
						"This TV Time row is missing an identity, title or valid watched flag.",
				},
			})
			return
		}
		if (episode) {
			if (yes(row.iswatched))
				addPlay(
					{
						...base,
						key: `tvtime:episode:${id(row.tvdbid) ?? `${identity}:${row.season}:${row.episode}`}:${string(row.watchedat) || "undated"}`,
						episodeTvdbId: id(row.tvdbid),
						season: coordinate(row.season),
						episode: id(row.episode),
						episodeNumbering: "unknown",
						...date(row.watchedat),
						pass: 1,
					},
					row.watchedat,
				)
		} else if (movie) {
			if (yes(row.iswatched))
				addPlay(
					{
						...base,
						key: `${base.key}:watch:${string(row.watchedat) || "undated"}`,
						...date(row.watchedat),
						pass: 1,
					},
					row.watchedat,
				)
			else unwatchedMovieIntention(base)
		} else if (row.status === "not_started_yet") want(base)
		else if (
			["continuing", "up_to_date", "stopped"].includes(string(row.status))
		)
			add({
				...base,
				kind: "show_status",
				showStatus: row.status === "stopped" ? "dropped" : "watching",
			})
		else
			add({
				...base,
				kind: "unsupported",
				problem: {
					outcome: "unsupported",
					code: "tvtime_status_unknown",
					reason: "This TV Time show status is unknown and was not applied.",
				},
			})
		if (
			row.rating !== undefined &&
			row.rating !== "" &&
			row.rating !== null &&
			row.rating !== 0 &&
			row.rating !== "0"
		) {
			const score = Number(row.rating)
			if (!episode && (!movie || !verifiedMovieScale)) {
				add({
					...base,
					key: `${base.key}:rating`,
					kind: "unsupported",
					score,
					problem: {
						outcome: "unsupported",
						code: movie
							? "tvtime_rating_scale_unknown"
							: "tvtime_show_rating_unsupported",
						reason: movie
							? "This export's rating scale isn't known, so this rating wasn't imported."
							: "TV Time show ratings haven't been verified, so this rating wasn't imported.",
					},
				})
			} else {
				add({
					...base,
					key: `${base.key}:${episode ? `episode:${row.tvdbid}:` : ""}rating`,
					kind: episode ? "unsupported" : "rating",
					score,
					...(episode
						? {
								problem: {
									outcome: "unsupported",
									code: "tvtime_episode_rating",
									reason: "TV Time episode ratings are not applied.",
								},
							}
						: ![2, 4, 6, 8, 10].includes(score)
							? {
									problem: {
										outcome: "invalid",
										code: "tvtime_rating_invalid",
										reason:
											"This value isn't on TV Time's rating scale, so it wasn't imported.",
									},
								}
							: {}),
				})
			}
		}
		if (id(row.rewatchcount))
			warnings.push(
				"TV Time rewatch counts do not add watches: only one viewing date is available.",
			)
	}
	const want = (base: ImportObservation) =>
		add({
			...base,
			kind: "want",
			wishlistEvidence: {
				source: "tvtime",
				sourceId: base.key,
				mediaType: base.mediaType,
				completeness: "unknown",
			},
		})
	// Owner decision Q16 (2026-10-19): unwatched extension movies become Want to See, like For later.
	const unwatchedMovieIntention = (base: ImportObservation) => want(base)
	for (const entry of entries) {
		const format = fileKind(entry.name)
		const content = readers.text(entry)
		if (
			format === "showsJson" ||
			format === "moviesJson" ||
			entry.name.toLowerCase().endsWith(".json") ||
			content.trimStart().startsWith("[")
		) {
			let json: unknown
			try {
				json = JSON.parse(content)
			} catch {
				readers.fail(
					"That TV Time JSON file is malformed.",
					"tvtime_json_invalid",
				)
			}
			if (!Array.isArray(json))
				readers.fail(
					"Choose a TV Time shows or movies JSON array.",
					"tvtime_json_shape",
				)
			for (const item of json) {
				const r = record(item)
				const ids = record(r.id)
				const movie =
					format === "moviesJson" || (!format && !Array.isArray(r.seasons))
				extension(
					{
						...r,
						tvdbid: ids.tvdb,
						imdbid: ids.imdb,
						iswatched: r.is_watched,
						watchedat: r.watched_at,
						rewatchcount: r.rewatch_count,
					},
					movie ? "movie" : "show",
					false,
					/^(?:shows|movies)\.json$/i.test(basename(entry.name)),
				)
				if (!movie)
					for (const season of array(r.seasons)) {
						const s = record(season)
						for (const ep of array(s.episodes)) {
							const e = record(ep)
							extension(
								{
									title: r.title,
									seriestvdbid: ids.tvdb,
									seriesimdbid: ids.imdb,
									tvdbid: record(e.id).tvdb,
									season: s.number,
									episode: e.number,
									iswatched: e.is_watched,
									watchedat: e.watched_at,
									rewatchcount: e.rewatch_count,
									rating: e.rating,
								},
								"episode",
							)
						}
					}
			}
			continue
		}
		const table = readers.readCsvTable(entry.data, entry.name, 500_000)
		const columns = table.headers.map(normalized)
		if (new Set(columns).size !== columns.length)
			readers.fail(
				"The TV Time CSV has duplicate columns.",
				"tvtime_columns_duplicate",
			)
		if (
			columns.includes("mediatype") ||
			columns.includes("ts") ||
			columns.includes("showname")
		)
			readers.fail(
				"This older TV Time or Data Extractor layout is not supported. Use a Trakt export if you moved your history there.",
				"tvtime_variant_unsupported",
			)
		const kind = columns.includes("key")
			? "v2"
			: columns.includes("entitytype") && columns.includes("type")
				? "v1"
				: columns.includes("tvshowid")
					? "followed"
					: columns.includes("votekey")
						? "votes"
						: columns.includes("title") &&
								(columns.includes("tvdbid") || columns.includes("imdbid")) &&
								(columns.includes("iswatched") || columns.includes("status"))
							? "extension"
							: null
		if (!kind)
			readers.fail(
				"The TV Time export columns are not recognized.",
				"tvtime_format_unknown",
			)
		for (const cells of table.rows) {
			if (kind !== "extension") {
				countSourceRow()
				countRow()
			}
			const row: Row = Object.fromEntries(
				table.headers.map((h, i) => [normalized(h), cells[i]]),
			)
			if (kind === "followed") {
				const base: ImportObservation = {
					key: `tvtime:show:${string(row.tvshowid)}`,
					kind: "want",
					mediaType: "show",
					title: string(row.tvshowname) || "TV Time show",
					year: null,
					tmdbId: null,
					imdbId: null,
					showTvdbId: id(row.tvshowid),
				}
				if (yes(row.archived)) {
					const archived: ImportObservation = {
						...base,
						kind: "show_status",
						showStatus: "dropped",
					}
					legacyFollowRows.add(archived)
					add(archived)
				} else if (yes(row.active) || yes(row.isfollowed)) follow(base, true)
				continue
			}
			if (kind === "votes") {
				add({
					key: `tvtime:vote:${string(row.uuid)}:${string(row.votekey)}`,
					kind: "unsupported",
					mediaType: id(row.episodeid) ? "show" : "movie",
					title: string(row.moviename) || "TV Time episode",
					year: null,
					tmdbId: null,
					imdbId: null,
					score: null,
					problem: {
						outcome: "unsupported",
						code: "tvtime_vote_scale_unknown",
						reason:
							"TV Time official vote keys have no verified rating scale. Ratings are not applied.",
					},
				})
				continue
			}
			if (kind === "extension") {
				extension(
					row,
					columns.includes("seriestvdbid")
						? "episode"
						: columns.includes("status") || columns.includes("type")
							? "show"
							: "movie",
					true,
					basename(entry.name).toLowerCase() === "activity_history.csv" ||
						(!/^tvtime-/i.test(basename(entry.name)) &&
							columns.includes("type") &&
							columns.includes("iswatchlisted")),
				)
				continue
			}
			const base: ImportObservation = {
				key: `tvtime:${string(row.key) || string(row.uuid)}`,
				kind: "watch",
				mediaType:
					kind === "v1" && row.entitytype === "movie" ? "movie" : "show",
				title:
					string(row.seriesname) || string(row.moviename) || "TV Time show",
				year: year(row.releasedate),
				tmdbId: null,
				imdbId: null,
			}
			if (base.mediaType === "show")
				base.showTvdbId = id(row.sid) ?? id(row.seriesid)
			else {
				base.title = string(row.moviename) || "TV Time movie"
				base.tvtimeMovie = {
					...(string(row.uuid) ? { sourceId: string(row.uuid) } : {}),
					releaseDate: string(row.releasedate) || null,
				}
				if (!string(row.moviename))
					base.problem = {
						outcome: "unmatched",
						code: "tvtime_movie_title_missing",
						reason:
							"This TV Time movie has no title in the export. It wasn't matched.",
					}
			}
			if (
				(kind === "v2" &&
					/^(?:watch|rewatch)-episode-/.test(string(row.key))) ||
				(kind === "v1" &&
					row.entitytype === "episode" &&
					["watch", "rewatch"].includes(string(row.type)))
			) {
				if (kind === "v1") {
					const identity = `${id(row.episodeid) ?? string(row.uuid)}:${string(row.type)}`
					const ordinal = (undatedEpisodePlays.get(identity) ?? 0) + 1
					undatedEpisodePlays.set(identity, ordinal)
					base.key = `tvtime:episode:${identity}:${string(row.typeuuidn) || string(row.createdat) || `undated:${ordinal}`}`
				}
				addPlay(
					{
						...base,
						episodeTvdbId: id(row.epid) ?? id(row.episodeid),
						season:
							coordinate(row.sno) === 0 && id(row.seasonnumber)
								? id(row.seasonnumber)
								: (coordinate(row.sno) ?? coordinate(row.seasonnumber)),
						episode: id(row.epno) ?? id(row.episodenumber),
						episodeNumbering: "unknown",
						...(row.bulktype
							? { watchedAt: null, precision: "unknown" as const }
							: date(row.createdat)),
						pass: 1,
					},
					row.createdat,
				)
			} else if (kind === "v2" && string(row.key).startsWith("user-series-")) {
				if (base.showTvdbId) v2Shows.add(base.showTvdbId)
				if (yes(row.isarchived))
					add({ ...base, kind: "show_status", showStatus: "dropped" })
				else if (yes(row.isforlater)) want(base)
				else if (yes(row.isfollowed)) follow(base)
			} else if (kind === "v1" && base.mediaType === "movie") {
				if (row.type === "towatch" || row.type === "follow") want(base)
				else if (row.type === "watch" || row.type === "rewatch") {
					const stamp = /^watch-date-(\d+)$/.exec(string(row.watchdaterangekey))
					const seconds = stamp ? Number(stamp[1]) : Number.NaN
					const instant =
						Number.isFinite(seconds) && seconds > 0 && seconds < 253402300800
							? new Date(seconds * 1000).toISOString()
							: row.createdat
					const movieIdentity = `${string(row.uuid)}:${string(row.type)}`
					const ordinal = (undatedMoviePlays.get(movieIdentity) ?? 0) + 1
					undatedMoviePlays.set(movieIdentity, ordinal)
					const playIdentity =
						string(row.typeuuidn) || string(instant) || `undated:${ordinal}`
					addPlay(
						{
							...base,
							key: `tvtime:movie:${movieIdentity}:${playIdentity}`,
							...date(instant),
							pass: 1,
						},
						instant,
					)
				}
			}
		}
	}
	const watchedShows = new Set(
		observations
			.filter((row) => row.kind === "watch" && row.mediaType === "show")
			.map((row) => row.showTvdbId)
			.filter(Boolean),
	)
	for (const row of followedRows) {
		if (row.showTvdbId && watchedShows.has(row.showTvdbId)) {
			row.kind = "show_status"
			row.showStatus = "watching"
			row.wishlistEvidence = undefined
		}
	}
	// Snapshot only after collapsing repeated source plays, before catalog matching.
	if (unwatchedEpisodes)
		warnings.push(
			`${unwatchedEpisodes} unwatched TV Time episode rows were left out before counting import items.`,
		)
	for (const row of observations) {
		if (
			row.tvtimeMovie &&
			row.title.trim() &&
			(row.kind === "watch" || row.kind === "want" || row.kind === "rating") &&
			!row.problem
		) {
			const evidence = {
				source: "tvtime",
				mediaType: "movie" as const,
				completeness: "unknown" as const,
				...(row.tvtimeMovie.sourceId
					? { sourceId: row.tvtimeMovie.sourceId }
					: {}),
			}
			if (row.kind === "want") row.wishlistEvidence = evidence
			row.wishlistOriginal = {
				key: row.key,
				kind: row.kind,
				mediaType: "movie",
				title: row.title,
				year: row.year,
				tmdbId: null,
				imdbId: null,
				manualMatchScope: "tvtime_movie",
				tvtimeMovie: structuredClone(row.tvtimeMovie),
				wishlistEvidence: evidence,
				...(row.watchedAt !== undefined
					? {
							watchedAt: row.watchedAt,
							precision: row.precision,
							pass: row.pass,
						}
					: {}),
				...(row.score !== undefined ? { score: row.score } : {}),
			}
		}
	}

	return {
		source: "tvtime",
		observations: observations.filter(
			(row) =>
				!(
					legacyFollowRows.has(row) &&
					row.showTvdbId &&
					v2Shows.has(row.showTvdbId)
				),
		),
		warnings: [...new Set(warnings)],
	}
}
