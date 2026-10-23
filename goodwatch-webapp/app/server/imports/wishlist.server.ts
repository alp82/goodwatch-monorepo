import { createHash } from "node:crypto"
import { importInfo } from "../../domain/imports.ts"
import {
	IMPORT_MAX_BYTES,
	IMPORT_MAX_ROWS,
	type ImportObservation,
	type ParsedImport,
} from "../../domain/imports.ts"

type Fail = (message: string) => never
type ObjectValue = Record<string, unknown>
const object = (value: unknown): value is ObjectValue =>
	!!value && typeof value === "object" && !Array.isArray(value)

const text = (value: unknown, max = 2048): value is string =>
	typeof value === "string" &&
	value.trim().length > 0 &&
	value.length <= max &&
	![...value].some((character) => character.charCodeAt(0) < 32)
function date(value: unknown): value is string {
	if (
		typeof value !== "string" ||
		!/^\d{4}-\d{2}-\d{2}(?:T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2}))?$/.test(
			value,
		)
	)
		return false
	const day = value.slice(0, 10)
	const time = Date.parse(value)
	return (
		Number.isFinite(time) &&
		new Date(`${day}T00:00:00Z`).toISOString().slice(0, 10) === day
	)
}

/** The upload boundary supplies its public error type. */
export function parseWishlistFile(bytes: Uint8Array, fail: Fail): ParsedImport {
	if (!bytes.byteLength) fail("That file is empty.")
	if (bytes.byteLength > IMPORT_MAX_BYTES)
		fail("That file is larger than 20 MB.")
	let input: unknown
	try {
		input = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes))
	} catch {
		fail(
			"Choose watcharr-export.json from Watcharr, or a wishlist file made for GoodWatch.",
		)
	}
	if (Array.isArray(input)) return watcharr(input, fail)
	return sharedWishlist(input, fail)
}

function sharedWishlist(input: unknown, fail: Fail): ParsedImport {
	if (!object(input) || input.format !== "goodwatch-wishlist")
		fail(
			"Choose watcharr-export.json from Watcharr, or a wishlist file made for GoodWatch.",
		)
	if (typeof input.version === "string")
		fail(
			"This wishlist file's version must be a number. Ask the maker of the tool that saved it for a file GoodWatch can read.",
		)
	if (input.version !== 1 && input.version !== 1.1)
		fail(
			"This wishlist file uses a newer layout than GoodWatch reads. Ask the maker of the tool that saved it for a file GoodWatch can read.",
		)
	if (
		!text(input.source, 200) ||
		typeof input.completeness !== "string" ||
		!["complete", "partial", "unknown"].includes(input.completeness) ||
		!Array.isArray(input.items) ||
		(input.profileLabel !== undefined && !text(input.profileLabel, 200)) ||
		(input.country !== undefined &&
			(typeof input.country !== "string" ||
				!/^[A-Z]{2}$/.test(input.country))) ||
		(input.exportedAt !== undefined && !date(input.exportedAt))
	)
		fail(
			"This wishlist file is missing details GoodWatch needs, or has details it can't read. Save it again with the tool that made it.",
		)
	if (input.items.length > IMPORT_MAX_ROWS)
		fail(
			"That file has more than 50,000 titles. GoodWatch imports up to 50,000 at a time.",
		)
	const data = input as ObjectValue & { items: ObjectValue[] }
	const v11 = data.version === 1.1
	const metadata = {
		source: data.source as string,
		completeness: data.completeness as "complete" | "partial" | "unknown",
		...(data.profileLabel !== undefined
			? { profileLabel: data.profileLabel as string }
			: {}),
		...(data.country !== undefined ? { country: data.country as string } : {}),
		...(data.exportedAt !== undefined
			? { exportedAt: data.exportedAt as string }
			: {}),
	}
	return {
		source: "wishlist",
		warnings:
			data.completeness === "complete"
				? []
				: [
						importInfo(
							"This file may hold only part of your list. Titles that aren't in the file stay as they are in GoodWatch.",
						),
					],
		observations: data.items.map((value) => {
			const item = object(value) ? value : {}
			const mediaType =
				item.mediaType === "movie" ||
				item.mediaType === "show" ||
				(v11 && (item.mediaType === "season" || item.mediaType === "episode"))
					? item.mediaType
					: "unknown"
			const validTmdb = (id: unknown): id is number =>
				typeof id === "number" && Number.isSafeInteger(id) && id > 0
			const validImdb = (id: unknown): id is string =>
				typeof id === "string" && /^tt\d{7,10}$/.test(id)
			const validUrl = (url: unknown): url is string => {
				if (!text(url)) return false
				try {
					const parsed = new URL(url)
					return (
						["https:", "http:"].includes(parsed.protocol) &&
						!parsed.username &&
						!parsed.password
					)
				} catch {
					return false
				}
			}
			const validCoordinate = (value: unknown, minimum: number) =>
				typeof value === "number" &&
				Number.isSafeInteger(value) &&
				value >= minimum &&
				value <= 10_000
			const invalidCoordinates =
				v11 &&
				((mediaType === "season" || mediaType === "episode"
					? !validCoordinate(item.season, 0)
					: item.season !== undefined) ||
					(mediaType === "episode"
						? !validCoordinate(item.episode, 1)
						: item.episode !== undefined))
			const invalid =
				invalidCoordinates ||
				!object(value) ||
				!text(item.title, 1000) ||
				typeof item.mediaType !== "string" ||
				!(
					v11
						? ["movie", "show", "unknown", "season", "episode"]
						: ["movie", "show", "unknown"]
				).includes(item.mediaType) ||
				(item.tmdbId !== undefined && !validTmdb(item.tmdbId)) ||
				(item.imdbId !== undefined && !validImdb(item.imdbId)) ||
				(item.year !== undefined &&
					(typeof item.year !== "number" ||
						!Number.isInteger(item.year) ||
						item.year < 1800 ||
						item.year > 9999)) ||
				(item.addedAt !== undefined && !date(item.addedAt)) ||
				(v11 &&
					item.sourceSeen !== undefined &&
					typeof item.sourceSeen !== "boolean") ||
				(v11 &&
					item.sourceSeenAt !== undefined &&
					(item.sourceSeen !== true || !date(item.sourceSeenAt))) ||
				(item.sourceId !== undefined && !text(item.sourceId)) ||
				(item.sourceUrl !== undefined && !validUrl(item.sourceUrl))
			const observation: ImportObservation = {
				key: `wishlist:want:${createHash("sha256")
					.update(
						JSON.stringify([
							...(v11 && (mediaType === "season" || mediaType === "episode")
								? [item.season, item.episode ?? null]
								: []),
							metadata.source,
							metadata.profileLabel ?? null,
							mediaType,
							text(item.sourceId) ? item.sourceId : null,
							validTmdb(item.tmdbId) ? item.tmdbId : null,
							validImdb(item.imdbId) ? item.imdbId : null,
							!item.tmdbId && !item.imdbId && !item.sourceId
								? [
										text(item.title, 1000) ? item.title : null,
										typeof item.year === "number" ? item.year : null,
									]
								: null,
						]),
					)
					.digest("hex")}`,
				kind: "want",
				// Storage requires a supported type. An unknown scope is always blocked by problem below.
				mediaType: ["show", "season", "episode"].includes(mediaType)
					? "show"
					: "movie",
				...(v11 && (mediaType === "season" || mediaType === "episode")
					? {
							season: validCoordinate(item.season, 0)
								? (item.season as number)
								: null,
							...(mediaType === "episode"
								? {
										episode: validCoordinate(item.episode, 1)
											? (item.episode as number)
											: null,
									}
								: {}),
						}
					: {}),
				title: text(item.title, 1000) ? item.title : "",
				year:
					typeof item.year === "number" && Number.isInteger(item.year)
						? item.year
						: null,
				tmdbId: validTmdb(item.tmdbId) ? item.tmdbId : null,
				imdbId: validImdb(item.imdbId) ? item.imdbId : null,
				addedAt: date(item.addedAt) ? item.addedAt : null,
				wishlistEvidence: {
					...metadata,
					mediaType,
					...(v11 && typeof item.sourceSeen === "boolean"
						? { sourceSeen: item.sourceSeen }
						: {}),
					...(v11 && date(item.sourceSeenAt)
						? { sourceSeenAt: item.sourceSeenAt }
						: {}),
					...(text(item.sourceId) ? { sourceId: item.sourceId } : {}),
					...(validUrl(item.sourceUrl)
						? {
								sourceUrl:
									new URL(item.sourceUrl).origin +
									new URL(item.sourceUrl).pathname,
							}
						: {}),
				},
			}
			if (invalid)
				observation.problem = {
					outcome: "invalid",
					reason: "GoodWatch couldn't read this entry.",
				}
			else if (mediaType === "unknown")
				observation.problem = {
					outcome: "unmatched",
					reason:
						"The file doesn't say whether this is a movie or a show, so GoodWatch can't match it. Search for it to add it.",
				}
			else if (
				!observation.tmdbId &&
				!observation.imdbId &&
				observation.year === null
			)
				observation.problem = {
					outcome: "unmatched",
					reason:
						"This entry has no ID or year, so GoodWatch can't match it safely. Search for it to add it.",
				}
			if (!invalid && observation.wishlistEvidence)
				observation.wishlistOriginal = {
					...(v11 && (mediaType === "season" || mediaType === "episode")
						? {
								season: observation.season as number,
								...(mediaType === "episode"
									? { episode: observation.episode as number }
									: {}),
							}
						: {}),
					key: observation.key,
					kind: "want",
					mediaType,
					title: observation.title,
					year: observation.year,
					tmdbId: observation.tmdbId,
					imdbId: observation.imdbId,
					addedAt: observation.addedAt,
					wishlistEvidence: structuredClone(observation.wishlistEvidence),
					...(observation.problem
						? { problem: structuredClone(observation.problem) }
						: {}),
				}
			return observation
		}),
	}
}

/** Watcharr exports the full library through GET /watched. */
function watcharr(rows: unknown[], fail: Fail): ParsedImport {
	if (rows.length > IMPORT_MAX_ROWS)
		fail(
			"That file has more than 50,000 titles. GoodWatch imports up to 50,000 at a time.",
		)
	const items = rows.map((value) => {
		const row = object(value) ? value : {}
		const content = object(row.content) ? row.content : {}
		const game = object(row.game) ? row.game : {}
		return {
			title: content.title ?? game.name,
			mediaType:
				content.type === "movie"
					? "movie"
					: content.type === "tv"
						? "show"
						: "unknown",
			...(content.tmdbId !== undefined ? { tmdbId: content.tmdbId } : {}),
			...(content.imdb_id !== undefined && content.imdb_id !== ""
				? { imdbId: content.imdb_id }
				: {}),
			...(content.release_date !== undefined
				? {
						year: date(content.release_date)
							? Number(content.release_date.slice(0, 4))
							: "invalid",
					}
				: {}),
			...(typeof row.id === "number" &&
			Number.isSafeInteger(row.id) &&
			row.id > 0
				? { sourceId: String(row.id) }
				: {}),
		}
	})
	const parsed = sharedWishlist(
		{
			format: "goodwatch-wishlist",
			version: 1,
			source: "watcharr",
			completeness: "complete",
			items,
		},
		fail,
	)
	const observations: ImportObservation[] = []
	let rounded = false
	for (let index = 0; index < rows.length; index++) {
		const candidate = rows[index]
		const row = object(candidate) ? candidate : {}
		const item = parsed.observations[index]
		if (
			typeof row.status !== "string" ||
			!["PLANNED", "FINISHED", "WATCHING", "HOLD", "DROPPED"].includes(
				row.status,
			) ||
			(!object(row.content) && !object(row.game))
		) {
			item.problem = {
				outcome: "invalid",
				reason: "GoodWatch couldn't read this Watcharr entry.",
			}
		} else if (
			object(row.game) ||
			(object(row.content) &&
				!["movie", "tv"].includes(String(row.content.type)))
		) {
			item.kind = "unsupported"
			item.problem = {
				outcome: "unsupported",
				reason: "Only movies and shows can be imported into GoodWatch.",
			}
		} else if (!item.tmdbId) {
			item.problem = {
				outcome: "invalid",
				reason: "GoodWatch couldn't read this Watcharr entry.",
			}
		}
		if (item.problem) {
			item.wishlistOriginal = undefined
			observations.push(item)
			continue
		}
		const rowStart = observations.length
		const base = { ...item, wishlistOriginal: undefined }
		const add = (suffix: string, fields: Partial<ImportObservation>) => {
			if (observations.length >= IMPORT_MAX_ROWS)
				fail("That file produces more than 50,000 import items.")
			observations.push({
				...base,
				key: `watcharr:${item.key}:${suffix}`,
				...fields,
			})
		}
		const activities = Array.isArray(row.activity)
			? row.activity.filter(object)
			: []
		const plays = activities.filter(
			(activity) =>
				activity.deletedAt == null &&
				activity.countAsPlay === true &&
				!String(activity.type).startsWith("EPISODE_") &&
				!String(activity.type).startsWith("SEASON_"),
		)
		const seenActivities = new Set<string>()
		const ordinals = new Map<string, number>()
		for (const activity of plays) {
			const id =
				typeof activity.id === "number" &&
				Number.isSafeInteger(activity.id) &&
				activity.id > 0
					? activity.id
					: null
			// Old exports can lack IDs. Equal ID-less rows keep their multiplicity, independently of array order.
			const signature = createHash("sha256")
				.update(
					JSON.stringify([
						activity.type,
						activity.data,
						activity.customDate ?? activity.createdAt,
					]),
				)
				.digest("hex")
			const ordinal = (ordinals.get(signature) ?? 0) + 1
			ordinals.set(signature, ordinal)
			const identity = id === null ? `${signature}:${ordinal}` : String(id)
			if (seenActivities.has(identity)) continue
			seenActivities.add(identity)
			const supplied = activity.customDate ?? activity.createdAt
			const validDate = date(supplied) && !supplied.startsWith("0001-")
			add(`play:${identity}`, {
				kind: "watch",
				watchedAt: validDate ? supplied : null,
				precision: validDate
					? supplied.includes("T")
						? "moment"
						: "day"
					: "unknown",
			})
			if (supplied != null && !validDate)
				parsed.warnings.push(
					importInfo(
						"A Watcharr play has an invalid date. Its watch is kept without a date.",
					),
				)
		}
		if (item.mediaType === "show") {
			const coordinate = (value: unknown, minimum: number): value is number =>
				typeof value === "number" &&
				Number.isSafeInteger(value) &&
				value >= minimum &&
				value <= 10_000
			const scope = (
				season: unknown,
				episode?: unknown,
			): Partial<ImportObservation> => ({
				season: coordinate(season, 0) ? season : null,
				...(episode !== undefined
					? { episode: coordinate(episode, 1) ? episode : null }
					: {}),
				episodeNumbering: "tmdb",
				...(!coordinate(season, 0) ||
				(episode !== undefined && !coordinate(episode, 1))
					? {
							problem: {
								outcome: "invalid",
								reason:
									"This Watcharr record has invalid season or episode numbers.",
							},
						}
					: {}),
			})
			const scopedIds = new Set<string>()
			for (const activity of activities) {
				if (
					activity.deletedAt != null ||
					activity.createdBy === 1 ||
					![
						"EPISODE_ADDED",
						"EPISODE_STATUS_CHANGED",
						"SEASON_ADDED",
						"SEASON_STATUS_CHANGED",
					].includes(String(activity.type))
				)
					continue
				let data: unknown
				try {
					data = JSON.parse(String(activity.data))
				} catch {
					data = null
				}
				if (!object(data)) {
					add(`invalid-activity:${activity.id ?? scopedIds.size}`, {
						kind: "unsupported",
						problem: {
							outcome: "invalid",
							reason:
								"GoodWatch couldn't read this Watcharr season or episode activity.",
						},
					})
					continue
				}
				if (data.status !== "FINISHED") continue
				const episode = String(activity.type).startsWith("EPISODE_")
				const coordinates = scope(
					data.season,
					episode ? (data.episode ?? null) : undefined,
				)
				const identity =
					typeof activity.id === "number"
						? String(activity.id)
						: createHash("sha256")
								.update(
									JSON.stringify([
										activity.type,
										activity.data,
										activity.customDate ?? activity.createdAt,
									]),
								)
								.digest("hex")
				if (scopedIds.has(identity)) continue
				scopedIds.add(identity)
				const supplied = activity.customDate ?? activity.createdAt
				const validDate = date(supplied) && !supplied.startsWith("0001-")
				add(`scope-play:${identity}`, {
					kind: "watch",
					...coordinates,
					watchedAt: validDate ? supplied : null,
					precision: validDate
						? supplied.includes("T")
							? "moment"
							: "day"
						: "unknown",
				})
				if (supplied != null && !validDate)
					parsed.warnings.push(
						importInfo(
							"A Watcharr play has an invalid date. Its watch is kept without a date.",
						),
					)
			}
			for (const [field, episode] of [
				["watchedSeasons", false],
				["watchedEpisodes", true],
			] as const) {
				const records = Array.isArray(row[field])
					? (row[field] as unknown[])
					: []
				for (const [index, value] of records.entries()) {
					const record = object(value) ? value : {}
					const coordinates = scope(
						record.seasonNumber,
						episode ? (record.episodeNumber ?? null) : undefined,
					)
					const suffix = `${field}:${record.seasonNumber ?? index}:${episode ? record.episodeNumber : "season"}`
					if (record.status === "FINISHED")
						add(`${suffix}:snapshot`, {
							kind: "watch",
							...coordinates,
							watchedAt: null,
							precision: "unknown",
							watcharrSnapshot: true,
						})
					else
						add(`${suffix}:status`, {
							kind: "unsupported",
							...coordinates,
							problem: coordinates.problem ?? {
								outcome: "unsupported",
								reason:
									"Season and episode statuses are not applied separately. Finished creates episode watches; the show status is imported separately.",
							},
						})
					if (record.rating !== undefined && record.rating !== 0)
						add(`${suffix}:rating`, {
							kind: "unsupported",
							...coordinates,
							score: typeof record.rating === "number" ? record.rating : null,
							problem: coordinates.problem ?? {
								outcome: "unsupported",
								reason:
									"Season and episode scores are kept here, not applied as whole-show ratings.",
							},
						})
				}
			}
		}

		if (row.status === "PLANNED") {
			if (
				(plays.length ||
					observations
						.slice(rowStart)
						.some(
							(observation) =>
								observation.tmdbId === item.tmdbId &&
								observation.kind === "watch" &&
								!observation.problem,
						)) &&
				item.wishlistEvidence
			) {
				item.wishlistEvidence.sourceSeen = true
				if (item.wishlistOriginal)
					item.wishlistOriginal.wishlistEvidence.sourceSeen = true
			}
			observations.push(item)
		} else if (item.mediaType === "show") {
			const statuses = {
				FINISHED: "completed",
				WATCHING: "watching",
				HOLD: "on_hold",
				DROPPED: "dropped",
			} as const
			add("status", {
				kind: "show_status",
				showStatus: statuses[row.status as keyof typeof statuses],
				...(row.status === "FINISHED" ? { completionScope: "show" } : {}),
			})
		} else if (row.status === "FINISHED" && !plays.length) {
			add("seen", { kind: "watch", watchedAt: null, precision: "unknown" })
		} else if (row.status !== "FINISHED")
			add("status", {
				kind: "unsupported",
				problem: {
					outcome: "unsupported",
					reason:
						"Movies have no Watching, On hold or Dropped status in GoodWatch.",
				},
			})
		if (row.pinned === true)
			add("pinned", {
				kind: "unsupported",
				problem: {
					outcome: "unsupported",
					reason:
						"Pinned in Watcharr is a list position, not a Favorite. It isn't applied.",
				},
			})
		if (Array.isArray(row.tags) && row.tags.length)
			add("tags", {
				kind: "unsupported",
				problem: {
					outcome: "unsupported",
					reason: "Watcharr tags aren't imported as lists.",
				},
			})
		if (observations.length > IMPORT_MAX_ROWS)
			fail("That file produces more than 50,000 import items.")
		if (row.rating !== undefined && row.rating !== 0) {
			const valid =
				typeof row.rating === "number" &&
				Number.isFinite(row.rating) &&
				row.rating > 0 &&
				row.rating <= 10
			const score = valid ? Math.max(1, Math.round(row.rating as number)) : null
			rounded ||= valid && score !== row.rating
			add("rating", {
				kind: "rating",
				score,
				...(!valid
					? {
							problem: {
								outcome: "invalid",
								reason:
									"Watcharr scores must be numbers greater than 0 and at most 10; 0 means no score.",
							},
						}
					: {}),
			})
		}
		if (row.thoughts !== undefined && row.thoughts !== "") {
			const valid =
				typeof row.thoughts === "string" &&
				row.thoughts.trim().length > 0 &&
				row.thoughts.length <= 100_000
			add("review", {
				kind: "review",
				review: valid ? (row.thoughts as string) : null,
				...(!valid
					? {
							problem: {
								outcome: "invalid",
								reason: "GoodWatch couldn't read these Watcharr thoughts.",
							},
						}
					: {}),
			})
		}
	}
	if (observations.length > IMPORT_MAX_ROWS)
		fail("That file produces more than 50,000 import items.")
	if (rounded)
		parsed.warnings.push(
			importInfo(
				"Watcharr scores are out of 10. Decimal scores are rounded to the nearest whole number, with a minimum of 1.",
			),
		)
	return { ...parsed, observations }
}
