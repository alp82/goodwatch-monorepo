// Names the source of an export file before it is uploaded, by looking inside it in the browser. Each rule mirrors
// what that source's import already accepts (app/server/imports/files.server.ts, app/server/imdb-import/file.server.ts),
// so a recognized file is one its import can read. A file no live import reads stays unrecognized.
//
// Reading is bounded: a file larger than any import takes is refused unread, a ZIP's directory is read only when its
// end record is sound and the directory is small, and a gzip file is unpacked only as far as its first 64 KB.
import { classifyImdbHeader } from "~/domain/imdb-file"
import { IMDB_IMPORT_MAX_BYTES } from "~/domain/imdb-import"
import { type FileImportSource, IMPORT_MAX_BYTES } from "~/domain/imports"

/** A source on the Imports page that takes a file. IMDb has its own import. */
export type ImportFileTarget = "imdb" | FileImportSource

export type ImportFileRecognition =
	| {
			source: Exclude<ImportFileTarget, "movielens" | "myanimelist">
			label: string
			/** Other imports that read the same file. A member who chose one of them keeps that choice. */
			alsoReads?: ImportFileTarget[]
	  }
	/** MovieLens takes a ratings file and an optional wishlist file together. */
	| { source: "movielens"; label: string; wishlist: boolean }
	/** One import reads both; the file name tells a Kitsu library apart. */
	| { source: "myanimelist"; label: string; kitsu: boolean }
	| { source: null; label: string; hint: string }

export type RecognizedImportFile = Exclude<
	ImportFileRecognition,
	{ source: null }
>

/** What is inside a file, read without uploading it. */
type Peek =
	| { kind: "zip"; entries: string[] }
	| { kind: "xml"; root: string; gzip: boolean }
	| { kind: "csv"; header: string[]; gzip: boolean }
	/** A file that opens as JSON: its first 64 KB, and whether that is the whole file. */
	| { kind: "json"; text: string; whole: boolean }
	| { kind: "unreadable-zip" }
	| { kind: "other" }

const MB = 1024 * 1024
/** Each import's size limit. */
const SIZE_LIMIT: Record<ImportFileTarget, number> = {
	imdb: IMDB_IMPORT_MAX_BYTES,
	letterboxd: IMPORT_MAX_BYTES,
	trakt: IMPORT_MAX_BYTES,
	csv: IMPORT_MAX_BYTES,
	movielens: IMPORT_MAX_BYTES,
	kodi: IMPORT_MAX_BYTES,
	myanimelist: IMPORT_MAX_BYTES,
	wishlist: IMPORT_MAX_BYTES,
	tvtime: IMPORT_MAX_BYTES,
}
const LARGEST_IMPORT = Math.max(...Object.values(SIZE_LIMIT))
const tooLarge = (limit: number): ImportFileRecognition => ({
	source: null,
	label: "file",
	hint: `That file is larger than ${limit / MB} MB, more than an export GoodWatch reads.`,
})

// Confirmed against the owner's real Letterboxd export of 2026-10-09.
const LETTERBOXD_FILES = new Set([
	"diary.csv",
	"watched.csv",
	"ratings.csv",
	"reviews.csv",
	"watchlist.csv",
	"likes/films.csv",
])

/**
 * The JSON files the Trakt import reads; it reads them from the top of the ZIP only.
 * Confirmed against the owner's real Trakt export of 2026-10-09.
 */
const isTraktFile = (entry: string) =>
	/^watched-history(?:-\d+)?\.json$/.test(entry) ||
	/^ratings-(movies|shows|seasons|episodes)\.json$/.test(entry) ||
	/^lists-(?!collaborations\.json$).+\.json$/.test(entry)

/**
 * The files the TV Time import opens, by name: the official export's tracking CSVs and the Liberator and TV Time Out
 * extension files. Mirrors `fileKind` in app/server/imports/tvtime.server.ts, which compares the last path part with
 * case and punctuation removed, so nested folders and hash prefixes still match. Built from the research notes'
 * headers and names; no real export seen yet (docs/implementation/imports/tvtime.md).
 */
const isTvTimeFile = (entry: string) => {
	const name = (entry.split("/").at(-1) ?? entry)
		.toLowerCase()
		.replace(/[^a-z0-9]/g, "")
	return (
		["showsjson", "moviesjson", "activityhistorycsv"].includes(name) ||
		/^tvtime(series|movies)\d.*json$/.test(name) ||
		/^tvtime(seriesepisodes|series|movies)\d.*csv$/.test(name) ||
		/(followedtvshow|usertvshowdata|ratingslivevotes|trackingprodrecordsv2|trackingprodrecords)csv$/.test(
			name,
		)
	)
}

/**
 * A TV Time CSV by columns only TV Time files have, as the TV Time import tells its layouts apart. A lone "key" column
 * is too common to name TV Time, so the newer tracking layout also needs its show or episode ID, and an extension
 * file needs a TVDB ID: Title, an IMDb ID and a Status column alone are a generic CSV.
 */
const isTvTimeCsv = (columns: string[]) => {
	const has = (name: string) => columns.includes(name)
	return (
		(has("key") && (has("sid") || has("epid"))) ||
		(has("entitytype") && has("type")) ||
		has("tvshowid") ||
		has("votekey") ||
		(has("title") &&
			(has("tvdbid") || has("seriestvdbid")) &&
			(has("iswatched") || has("status")))
	)
}

export async function recognizeImportFile(
	file: File,
): Promise<ImportFileRecognition> {
	if (file.size > LARGEST_IMPORT) return tooLarge(LARGEST_IMPORT)
	const result = recognize(await peek(file), file.name.toLowerCase())
	return result.source && file.size > SIZE_LIMIT[result.source]
		? tooLarge(SIZE_LIMIT[result.source])
		: result
}

function recognize(peek: Peek, fileName: string): ImportFileRecognition {
	if (peek.kind === "zip") {
		if (peek.entries.some((entry) => LETTERBOXD_FILES.has(entry)))
			return { source: "letterboxd", label: "Letterboxd export" }
		if (peek.entries.some((entry) => isTraktFile(entry.toLowerCase())))
			return { source: "trakt", label: "Trakt export" }
		// UNCONFIRMED: built from synthetic fixtures; no real Kodi export seen yet.
		// See docs/research/imports/kodi-tautulli-exports.md on branch research/kodi-tautulli-exports.
		if (
			peek.entries.filter(
				(entry) => entry.split("/").at(-1)?.toLowerCase() === "videodb.xml",
			).length === 1
		)
			return { source: "kodi", label: "Kodi library export" }
		if (peek.entries.some(isTvTimeFile))
			return { source: "tvtime", label: "TV Time export" }
	}
	if (peek.kind === "xml") {
		// The Kodi import reads plain XML only; the MyAnimeList import also unpacks gzip.
		if (peek.root === "videodb" && !peek.gzip)
			return { source: "kodi", label: "Kodi library export" }
		if (peek.root === "myanimelist") {
			// UNCONFIRMED: the root element and Kitsu's `kitsu-<slug>-anime.xml` name come from the research notes, not
			// a real file. See docs/research/imports/anime-tracker-exports.md on branch research/anime-tracker-exports.
			const kitsu = fileName.startsWith("kitsu-")
			return {
				source: "myanimelist",
				label: kitsu ? "Kitsu anime library" : "MyAnimeList export",
				kitsu,
			}
		}
	}
	if (peek.kind === "json") return recognizeJson(peek, fileName)
	if (peek.kind === "csv") {
		// Only the MyAnimeList import unpacks gzip; every CSV import reads plain text.
		if (peek.gzip)
			return {
				source: null,
				label: "gzip file",
				hint: "GoodWatch reads CSV files as they are, not inside gzip. Unpack it and upload the CSV inside.",
			}
		// Each import finds its columns by name, trimmed and in any case.
		const header = new Set(peek.header.map((name) => name.trim().toLowerCase()))
		const has = (...names: string[]) => names.every((name) => header.has(name))
		if (classifyImdbHeader(peek.header) === "list")
			return { source: "imdb", label: "IMDb Watchlist or custom-list export" }
		if (classifyImdbHeader(peek.header) === "ratings")
			return { source: "imdb", label: "IMDb ratings export" }
		// UNCONFIRMED: built from synthetic fixtures; no real MovieLens export seen yet. See
		// docs/research/imports/criticker-movielens-sofa-exports.md on branch research/criticker-movielens-sofa-exports.
		if (has("movie_id", "imdb_id", "tmdb_id", "title"))
			return header.has("rating")
				? { source: "movielens", label: "MovieLens ratings", wishlist: false }
				: { source: "movielens", label: "MovieLens wishlist", wishlist: true }
		const generic = isGenericCsv(peek.header)
		// Before the generic rule: a TV Time extension CSV also has Title and Rating columns. When the generic import
		// reads it too, a member who chose Generic CSV keeps that choice.
		if (
			isTvTimeFile(fileName) ||
			isTvTimeCsv(
				peek.header.map((name) => name.toLowerCase().replace(/[^a-z0-9]/g, "")),
			)
		)
			return {
				source: "tvtime",
				label: "TV Time export",
				...(generic ? { alsoReads: ["csv" as const] } : {}),
			}
		if (generic)
			return { source: "csv", label: "CSV in Letterboxd's import format" }
		return {
			source: null,
			label: "CSV file",
			hint: "Its columns don't match an export GoodWatch reads. A CSV of your own needs a Title, tmdbID, or imdbID column, and a Rating, Rating10, WatchedDate, or Review column.",
		}
	}
	if (peek.kind === "zip")
		return {
			source: null,
			label: "ZIP file",
			hint: "Nothing in this ZIP matches an export GoodWatch reads. Upload the ZIP as the site gave it to you, without unpacking or repacking it.",
		}
	if (peek.kind === "unreadable-zip")
		return {
			source: null,
			label: "ZIP file",
			hint: "That ZIP file is damaged or in a form GoodWatch can't read. Download the export again.",
		}
	if (peek.kind === "xml")
		return {
			source: null,
			label: "XML file",
			hint: "GoodWatch reads XML exports from Kodi, MyAnimeList, and Kitsu only.",
		}
	return {
		source: null,
		label: "file",
		hint: "GoodWatch reads ZIP, CSV, XML, gzip, and JSON exports. Upload the file as the site gave it to you, without opening or renaming it.",
	}
}

/**
 * The generic import compares names without spaces, refuses duplicate columns, and skips a row with no rating, watch
 * date, or review. Its own rating in "Your Rating" would be lost, so such a file isn't offered.
 */
function isGenericCsv(header: string[]) {
	const compact = header.map((name) =>
		name.trim().toLowerCase().replace(/ /g, ""),
	)
	const usable = (names: string[]) =>
		names.some((name) => compact.includes(name))
	return (
		new Set(compact).size === compact.length &&
		!compact.includes("yourrating") &&
		usable(["title", "name", "tmdbid", "imdbid", "letterboxduri"]) &&
		usable(["rating", "rating10", "watcheddate", "review"])
	)
}

const WATCHARR_STATUSES = ["PLANNED", "WATCHING", "FINISHED", "HOLD", "DROPPED"]

/**
 * Names a JSON file by its shape. A file within the first 64 KB is parsed whole; a longer one is judged by the start
 * of its text. Either way this only routes the file: the wishlist import validates every field.
 */
function recognizeJson(
	peek: Extract<Peek, { kind: "json" }>,
	fileName: string,
): ImportFileRecognition {
	const parsed = peek.whole ? parseJson(peek.text) : undefined
	const head = peek.text.replace(/^\uFEFF/, "").trimStart()
	const shared = peek.whole
		? isObject(parsed) && parsed.format === "goodwatch-wishlist"
		: head.startsWith("{") &&
			/"format"\s*:\s*"goodwatch-wishlist"/.test(peek.text)
	if (shared) {
		const version = peek.whole
			? (parsed as Record<string, unknown>).version
			: Number(/"version"\s*:\s*(\d+)/.exec(peek.text)?.[1])
		return version === 1
			? { source: "wishlist", label: "wishlist file" }
			: {
					source: null,
					label: "wishlist file",
					hint: "This wishlist file uses a newer layout than GoodWatch reads. Ask the maker of the tool that saved it for a file GoodWatch can read.",
				}
	}
	// Validated against Watcharr's source and a running pinned backend with synthetic accounts; no real member export tested.
	// See docs/research/wishlist-exploration/watcharr-validation.md.
	const first = peek.whole
		? Array.isArray(parsed)
			? parsed[0]
			: undefined
		: undefined
	const watcharr = peek.whole
		? Array.isArray(parsed) &&
			isObject(first) &&
			typeof first.status === "string" &&
			WATCHARR_STATUSES.includes(first.status) &&
			(isObject(first.content) || isObject(first.game))
		: head.startsWith("[") &&
			new RegExp(`"status"\\s*:\\s*"(${WATCHARR_STATUSES.join("|")})"`).test(
				peek.text,
			) &&
			/"(content|game)"\s*:\s*\{/.test(peek.text)
	// Watcharr refuses to export an empty list, so an empty array is taken only under its own file name.
	const emptyWatcharr =
		Array.isArray(parsed) &&
		parsed.length === 0 &&
		fileName === "watcharr-export.json"
	if (watcharr || emptyWatcharr)
		return { source: "wishlist", label: "Watcharr export" }
	// TV Time's extension exports: shows.json, movies.json, or a renamed array of titles with TVDB or IMDb IDs.
	const tvtime = peek.whole
		? Array.isArray(parsed) &&
			isObject(first) &&
			isObject(first.id) &&
			("tvdb" in first.id || "imdb" in first.id)
		: head.startsWith("[") &&
			/"id"\s*:\s*\{[^{}]*"(tvdb|imdb)"\s*:/.test(peek.text)
	if (isTvTimeFile(fileName) || tvtime)
		return { source: "tvtime", label: "TV Time export" }
	return {
		source: null,
		label: "JSON file",
		hint: "GoodWatch reads JSON exports from Watcharr, TV Time, and wishlist files made for GoodWatch. Upload the file as you got it, without editing it.",
	}
}

const isObject = (value: unknown): value is Record<string, unknown> =>
	!!value && typeof value === "object" && !Array.isArray(value)

function parseJson(text: string): unknown {
	try {
		return JSON.parse(text.replace(/^\uFEFF/, ""))
	} catch {
		return undefined
	}
}

async function peek(file: File): Promise<Peek> {
	const head = new Uint8Array(await file.slice(0, 4).arrayBuffer())
	if (head[0] === 0x50 && head[1] === 0x4b) {
		const entries = await zipEntries(file)
		return entries ? { kind: "zip", entries } : { kind: "unreadable-zip" }
	}
	if (head[0] === 0x1f && head[1] === 0x8b)
		return peekText(await gunzipHead(file), true)
	const text = await file.slice(0, TEXT_HEAD_BYTES).text()
	if (/^\uFEFF?\s*[[{]/.test(text))
		return { kind: "json", text, whole: file.size <= TEXT_HEAD_BYTES }
	return peekText(text)
}

/** Enough of a file to hold its CSV header or its XML root element. */
const TEXT_HEAD_BYTES = 64 * 1024

function peekText(text: string, gzip = false): Peek {
	const start = text
		.replace(/^﻿/, "")
		.replace(/^(\s*(<\?[\s\S]*?\?>|<!--[\s\S]*?-->|<!DOCTYPE[^>]*>))*/i, "")
		.trimStart()
	const root = /^<([A-Za-z_][\w.:-]*)/.exec(start)?.[1]
	if (root) return { kind: "xml", root, gzip }
	const header = csvHeader(text.replace(/^﻿/, ""))
	if (header.length > 1) return { kind: "csv", header, gzip }
	return { kind: "other" }
}

/**
 * The first non-blank row of comma-separated text, read as the generic import reads it: a quote opens only at the
 * start of a field, and doubled or backslash-escaped quotes stay in the field.
 */
function csvHeader(text: string): string[] {
	let fields: string[] = []
	let field = ""
	let quoted = false
	for (let at = 0; at < text.length; at++) {
		const char = text[at]
		if (quoted) {
			if (char === "\\" && text[at + 1] === "\\") {
				field += "\\"
				at++
			} else if (
				char === "\\" &&
				text[at + 1] === '"' &&
				![undefined, ",", "\n", "\r"].includes(text[at + 2])
			) {
				field += '"'
				at++
			} else if (char === '"' && text[at + 1] === '"') {
				field += '"'
				at++
			} else if (char === '"') quoted = false
			else field += char
		} else if (char === '"' && field === "") quoted = true
		else if (char === ",") {
			fields.push(field)
			field = ""
		} else if (char === "\n" || char === "\r") {
			fields.push(field)
			if (fields.some((cell) => cell.trim())) return fields
			fields = []
			field = ""
		} else field += char
	}
	fields.push(field)
	return fields.some((cell) => cell.trim()) ? fields : []
}

/** The start of a gzip file's content, without unpacking the rest. */
async function gunzipHead(file: File): Promise<string> {
	const reader = file
		.stream()
		.pipeThrough(new DecompressionStream("gzip"))
		.getReader()
	const chunks: Uint8Array[] = []
	let size = 0
	try {
		while (size < TEXT_HEAD_BYTES) {
			const { done, value } = await reader.read()
			if (done) break
			chunks.push(value)
			size += value.byteLength
		}
	} catch {
		// A corrupt gzip file shows as unrecognized; its import would refuse it too.
	} finally {
		reader.cancel().catch(() => {})
	}
	const bytes = new Uint8Array(size)
	let at = 0
	for (const chunk of chunks) {
		bytes.set(chunk, at)
		at += chunk.byteLength
	}
	return new TextDecoder().decode(bytes.subarray(0, TEXT_HEAD_BYTES))
}

/** The end record can carry a comment of up to 64 KB, so it is within this many bytes of the end. */
const END_RECORD_SEARCH = 22 + 0xffff
/** A directory this size lists far more files than any import reads (the most is 50,000). */
const MAX_DIRECTORY_BYTES = 4 * MB
const MAX_ENTRIES = 50_000

/**
 * The file names in a ZIP's central directory, so nothing needs unpacking. Null when the ZIP is one the server's
 * reader refuses: an end record that doesn't close the file, a multi-part or ZIP64 archive, or a directory that
 * doesn't end where the end record starts. A directory too large to be an export is refused unread.
 */
async function zipEntries(file: File): Promise<string[] | null> {
	const tailSize = Math.min(file.size, END_RECORD_SEARCH)
	const tail = new DataView(
		await file.slice(file.size - tailSize).arrayBuffer(),
	)
	let end = -1
	for (let at = tail.byteLength - 22; at >= 0; at--)
		if (
			tail.getUint32(at, true) === 0x06054b50 &&
			at + 22 + tail.getUint16(at + 20, true) === tail.byteLength
		) {
			end = at
			break
		}
	if (end < 0) return null
	const count = tail.getUint16(end + 10, true)
	const size = tail.getUint32(end + 12, true)
	const offset = tail.getUint32(end + 16, true)
	if (
		tail.getUint16(end + 4, true) !== 0 ||
		tail.getUint16(end + 6, true) !== 0 ||
		count !== tail.getUint16(end + 8, true) ||
		count === 0xffff ||
		count > MAX_ENTRIES ||
		size > MAX_DIRECTORY_BYTES ||
		offset + size !== file.size - tailSize + end
	)
		return null
	const directory = new DataView(
		await file.slice(offset, offset + size).arrayBuffer(),
	)
	const decoder = new TextDecoder()
	const names: string[] = []
	let at = 0
	while (
		names.length < count &&
		at + 46 <= directory.byteLength &&
		directory.getUint32(at, true) === 0x02014b50
	) {
		const nameLength = directory.getUint16(at + 28, true)
		if (at + 46 + nameLength > directory.byteLength) return null
		names.push(
			decoder.decode(
				new Uint8Array(
					directory.buffer,
					directory.byteOffset + at + 46,
					nameLength,
				),
			),
		)
		at +=
			46 +
			nameLength +
			directory.getUint16(at + 30, true) +
			directory.getUint16(at + 32, true)
	}
	return names.length === count ? names : null
}
