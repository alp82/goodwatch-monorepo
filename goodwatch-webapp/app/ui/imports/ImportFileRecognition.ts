// Names the source of an export file before it is uploaded, by looking inside it in the browser. Each rule mirrors
// what that source's import already accepts (app/server/imports/files.server.ts, app/server/imdb-import/file.server.ts),
// so a recognized file is one its import can read. A file no live import reads stays unrecognized.
import type { FileImportSource } from "~/domain/imports"

/** A source on the Imports page that takes a file. IMDb has its own import. */
export type ImportFileTarget = "imdb" | FileImportSource

export type ImportFileRecognition =
	| { source: Exclude<ImportFileTarget, "movielens">; label: string }
	/** MovieLens takes a ratings file and an optional wishlist file together. */
	| { source: "movielens"; label: string; wishlist: boolean }
	| { source: null; label: string; hint: string }

export type RecognizedImportFile = Exclude<
	ImportFileRecognition,
	{ source: null }
>

/** What is inside a file, read without uploading it. */
type Peek =
	| { kind: "zip"; entries: string[] }
	| { kind: "xml"; root: string; gzip: boolean }
	| { kind: "csv"; header: string[] }
	| { kind: "other" }

const LETTERBOXD_FILES = new Set([
	"diary.csv",
	"watched.csv",
	"ratings.csv",
	"reviews.csv",
	"watchlist.csv",
	"likes/films.csv",
])

export async function recognizeImportFile(
	file: File,
): Promise<ImportFileRecognition> {
	return recognize(await peek(file), file.name.toLowerCase())
}

/** The JSON files the Trakt import reads; it reads them from the top of the ZIP only. */
const isTraktFile = (entry: string) =>
	/^watched-history(?:-\d+)?\.json$/.test(entry) ||
	/^ratings-(movies|shows|seasons|episodes)\.json$/.test(entry) ||
	/^lists-(?!collaborations\.json$).+\.json$/.test(entry)

function recognize(peek: Peek, fileName: string): ImportFileRecognition {
	if (peek.kind === "zip") {
		if (peek.entries.some((entry) => LETTERBOXD_FILES.has(entry)))
			return { source: "letterboxd", label: "Letterboxd export" }
		if (peek.entries.some((entry) => isTraktFile(entry.toLowerCase())))
			return { source: "trakt", label: "Trakt export" }
		if (
			peek.entries.filter(
				(entry) => entry.split("/").at(-1)?.toLowerCase() === "videodb.xml",
			).length === 1
		)
			return { source: "kodi", label: "Kodi library export" }
	}
	if (peek.kind === "xml") {
		// The Kodi import reads plain XML only; the MyAnimeList import also unpacks gzip.
		if (peek.root === "videodb" && !peek.gzip)
			return { source: "kodi", label: "Kodi library export" }
		if (peek.root === "myanimelist")
			return {
				source: "myanimelist",
				label: fileName.startsWith("kitsu-")
					? "Kitsu anime library"
					: "MyAnimeList export",
			}
	}
	if (peek.kind === "csv") {
		// Each import finds its columns by name, trimmed and in any case.
		const header = new Set(peek.header.map((name) => name.trim().toLowerCase()))
		const has = (...names: string[]) => names.every((name) => header.has(name))
		if (has("const", "your rating", "title type"))
			return { source: "imdb", label: "IMDb ratings export" }
		if (has("movie_id", "imdb_id", "tmdb_id", "title"))
			return header.has("rating")
				? { source: "movielens", label: "MovieLens ratings", wishlist: false }
				: { source: "movielens", label: "MovieLens wishlist", wishlist: true }
		// The generic import compares names without spaces, refuses duplicate columns, and skips a row with no
		// rating, watch date, or review. Its own rating in "Your Rating" would be lost, so such a file isn't offered.
		const compact = peek.header.map((name) =>
			name.trim().toLowerCase().replace(/ /g, ""),
		)
		const usable = (names: string[]) =>
			names.some((name) => compact.includes(name))
		if (
			new Set(compact).size === compact.length &&
			!compact.includes("yourrating") &&
			usable(["title", "name", "tmdbid", "imdbid", "letterboxduri"]) &&
			usable(["rating", "rating10", "watcheddate", "review"])
		)
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
	if (peek.kind === "xml")
		return {
			source: null,
			label: "XML file",
			hint: "GoodWatch reads XML exports from Kodi, MyAnimeList, and Kitsu only.",
		}
	return {
		source: null,
		label: "file",
		hint: "GoodWatch reads ZIP, CSV, XML, and gzip exports. Upload the file as the site gave it to you, without opening or renaming it.",
	}
}

async function peek(file: File): Promise<Peek> {
	const head = new Uint8Array(await file.slice(0, 4).arrayBuffer())
	if (head[0] === 0x50 && head[1] === 0x4b)
		return { kind: "zip", entries: await zipEntries(file) }
	if (head[0] === 0x1f && head[1] === 0x8b)
		return peekText(await gunzipHead(file), true)
	return peekText(await file.slice(0, TEXT_HEAD_BYTES).text())
}

/** Enough of a file to hold its CSV header or its XML root element. */
const TEXT_HEAD_BYTES = 64 * 1024

function peekText(text: string, gzip = false): Peek {
	const start = text
		.replace(/^\ufeff/, "")
		.replace(/^(\s*(<\?[\s\S]*?\?>|<!--[\s\S]*?-->|<!DOCTYPE[^>]*>))*/i, "")
		.trimStart()
	const root = /^<([A-Za-z_][\w.:-]*)/.exec(start)?.[1]
	if (root) return { kind: "xml", root, gzip }
	const header = csvHeader(start)
	if (header.length > 1) return { kind: "csv", header }
	return { kind: "other" }
}

/** The first row of comma-separated text. Quoted names may hold commas and doubled quotes. */
function csvHeader(text: string): string[] {
	const fields: string[] = []
	let field = ""
	let quoted = false
	for (let at = 0; at < text.length; at++) {
		const char = text[at]
		if (quoted) {
			if (char === '"' && text[at + 1] === '"') {
				field += '"'
				at++
			} else if (char === '"') quoted = false
			else field += char
		} else if (char === '"') quoted = true
		else if (char === ",") {
			fields.push(field)
			field = ""
		} else if (char === "\n" || char === "\r") break
		else field += char
	}
	fields.push(field)
	return fields
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

// The central directory at the end of a ZIP lists every file name, so nothing needs unpacking.
async function zipEntries(file: File): Promise<string[]> {
	const tailSize = Math.min(file.size, 65_557)
	const tail = new DataView(
		await file.slice(file.size - tailSize).arrayBuffer(),
	)
	let end = -1
	for (let at = tail.byteLength - 22; at >= 0; at--)
		if (tail.getUint32(at, true) === 0x06054b50) {
			end = at
			break
		}
	if (end < 0) return []
	const size = tail.getUint32(end + 12, true)
	const offset = tail.getUint32(end + 16, true)
	const directory = new DataView(
		await file.slice(offset, offset + size).arrayBuffer(),
	)
	const decoder = new TextDecoder()
	const names: string[] = []
	let at = 0
	while (
		at + 46 <= directory.byteLength &&
		directory.getUint32(at, true) === 0x02014b50
	) {
		const nameLength = directory.getUint16(at + 28, true)
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
	return names
}
