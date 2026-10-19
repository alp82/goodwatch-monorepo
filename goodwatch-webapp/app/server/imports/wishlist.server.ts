import { createHash } from "node:crypto"
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
						"This file may hold only part of your list. Titles that aren't in the file stay as they are in GoodWatch.",
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

/** Watcharr exports its full library; status is the only wishlist intent evidence. */
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
			completeness: "unknown",
			items,
		},
		fail,
	)
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
		} else if (row.status !== "PLANNED") {
			item.kind = "unsupported"
			item.problem = {
				outcome: "unsupported",
				reason:
					"Only titles marked Planned in Watcharr are added to Want to See.",
			}
		} else if (
			object(row.game) ||
			(object(row.content) &&
				(typeof row.content.type !== "string" ||
					!["movie", "tv"].includes(row.content.type)))
		) {
			item.kind = "unsupported"
			item.problem = {
				outcome: "unsupported",
				reason: "Only movies and shows can go on your Wishlist.",
			}
		} else if (!item.tmdbId) {
			item.problem = {
				outcome: "invalid",
				reason: "GoodWatch couldn't read this Watcharr entry.",
			}
		}
		if (
			item.kind !== "want" ||
			item.problem?.outcome === "invalid" ||
			item.problem?.outcome === "unsupported"
		)
			item.wishlistOriginal = undefined
	}
	return parsed
}
