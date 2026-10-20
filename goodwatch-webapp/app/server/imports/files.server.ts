import { gunzipSync, inflateRawSync } from "node:zlib"
import { SaxesParser, type SaxesTagPlain } from "saxes"
import {
	IMPORT_MAX_BYTES,
	IMPORT_MAX_ROWS,
	type ImportObservation,
	type ImportShowStatus,
	type ImportSource,
	type ParsedImport,
	importInfo,
	isFileImportSource,
} from "../../domain/imports.ts"
import { isTvTimeFile, parseTvTime } from "./tvtime.server.ts"
import { parseWishlistFile } from "./wishlist.server.ts"

const MAX_ARCHIVE_FILES = 200
const MAX_FILTERED_ARCHIVE_FILES = 50_000
const MAX_ENTRY_BYTES = 32 * 1024 * 1024
const MAX_UNCOMPRESSED_BYTES = 64 * 1024 * 1024

export class ImportFileError extends Error {
	code?: string
	constructor(message: string, code?: string) {
		super(message)
		this.code = code
	}
}

interface ArchiveEntry {
	name: string
	data: Uint8Array
}

function parseCsv(value: string, backslashQuotes = false): string[][] {
	const rows: string[][] = []
	let row: string[] = []
	let field = ""
	let quoted = false
	for (
		let index = value.charCodeAt(0) === 0xfeff ? 1 : 0;
		index < value.length;
		index++
	) {
		const char = value[index]
		if (quoted) {
			if (backslashQuotes && char === "\\" && value[index + 1] === "\\") {
				field += "\\"
				index++
			} else if (
				backslashQuotes &&
				char === "\\" &&
				value[index + 1] === '"' &&
				![undefined, ",", "\n", "\r"].includes(value[index + 2])
			) {
				field += '"'
				index++
			} else if (char === '"' && value[index + 1] === '"') {
				field += '"'
				index++
			} else if (char === '"') quoted = false
			else field += char
		} else if (char === '"' && field === "") quoted = true
		else if (char === ",") {
			row.push(field)
			field = ""
		} else if (char === "\n" || char === "\r") {
			if (char === "\r" && value[index + 1] === "\n") index++
			row.push(field)
			if (row.some((cell) => cell.trim())) rows.push(row)
			row = []
			field = ""
		} else field += char
	}
	if (backslashQuotes && quoted) fail("The CSV has an unclosed quote.")
	row.push(field)
	if (row.some((cell) => cell.trim())) rows.push(row)
	return rows
}

function fail(message: string, code?: string): never {
	throw new ImportFileError(message, code)
}

function crc32(bytes: Uint8Array): number {
	let crc = 0xffffffff
	for (const byte of bytes) {
		crc ^= byte
		for (let bit = 0; bit < 8; bit++)
			crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0)
	}
	return (crc ^ 0xffffffff) >>> 0
}

const uploadSizeLabel = `${IMPORT_MAX_BYTES / 1024 / 1024} MB`
const rowLimitLabel = IMPORT_MAX_ROWS.toLocaleString("en-US")
function checkUploadSize(
	bytes: Uint8Array,
	message = `That export is larger than ${uploadSizeLabel}.`,
) {
	if (!bytes.byteLength) fail("That file is empty.")
	if (bytes.byteLength > IMPORT_MAX_BYTES) fail(message)
}

function zipEntries(
	input: Uint8Array,
	include?: (name: string) => boolean,
): ArchiveEntry[] {
	checkUploadSize(
		input,
		`That ZIP file is too large. GoodWatch accepts files up to ${uploadSizeLabel}.`,
	)
	const bytes = Buffer.from(input.buffer, input.byteOffset, input.byteLength)
	let eocd = -1
	const firstPossible = Math.max(0, bytes.length - 65_557)
	for (let at = bytes.length - 22; at >= firstPossible; at--) {
		if (
			bytes.readUInt32LE(at) === 0x06054b50 &&
			at + 22 + bytes.readUInt16LE(at + 20) === bytes.length
		) {
			eocd = at
			break
		}
	}
	if (eocd < 0) fail("That file isn't a valid ZIP archive.")
	if (bytes.readUInt16LE(eocd + 4) !== 0 || bytes.readUInt16LE(eocd + 6) !== 0)
		fail("Multi-part ZIP archives aren't supported.")
	const count = bytes.readUInt16LE(eocd + 10)
	if (count !== bytes.readUInt16LE(eocd + 8))
		fail("That ZIP archive is incomplete.")
	if (count === 0xffff) fail("ZIP64 archives aren't supported.")
	const maxFiles = include ? MAX_FILTERED_ARCHIVE_FILES : MAX_ARCHIVE_FILES
	if (count > maxFiles)
		fail(
			`That ZIP archive has too many files. GoodWatch accepts up to ${maxFiles}.`,
		)
	const directorySize = bytes.readUInt32LE(eocd + 12)
	const directoryOffset = bytes.readUInt32LE(eocd + 16)
	if (directorySize === 0xffffffff || directoryOffset === 0xffffffff)
		fail("ZIP64 archives aren't supported.")
	if (directoryOffset + directorySize !== eocd)
		fail("That ZIP archive has a malformed directory.")

	const result: ArchiveEntry[] = []
	const paths = new Set<string>()
	const ranges: Array<[number, number]> = []
	let totalSize = 0
	let cursor = directoryOffset
	for (let index = 0; index < count; index++) {
		if (cursor + 46 > eocd || bytes.readUInt32LE(cursor) !== 0x02014b50)
			fail("That ZIP archive has a malformed directory.")
		const flags = bytes.readUInt16LE(cursor + 8)
		const method = bytes.readUInt16LE(cursor + 10)
		const expectedCrc = bytes.readUInt32LE(cursor + 16)
		const compressedSize = bytes.readUInt32LE(cursor + 20)
		const size = bytes.readUInt32LE(cursor + 24)
		const nameLength = bytes.readUInt16LE(cursor + 28)
		const extraLength = bytes.readUInt16LE(cursor + 30)
		const commentLength = bytes.readUInt16LE(cursor + 32)
		const externalAttributes = bytes.readUInt32LE(cursor + 38)
		const localOffset = bytes.readUInt32LE(cursor + 42)
		const next = cursor + 46 + nameLength + extraLength + commentLength
		if (next > eocd) fail("That ZIP archive has a malformed directory.")
		if (flags & 1) fail("Password-protected ZIP files aren't supported.")
		if (flags & 0x40) fail("Encrypted ZIP files aren't supported.")
		if (method !== 0 && method !== 8)
			fail("That ZIP file uses an unsupported compression method.")
		if (
			compressedSize === 0xffffffff ||
			size === 0xffffffff ||
			localOffset === 0xffffffff
		)
			fail("ZIP64 archives aren't supported.")
		const rawName = bytes.subarray(cursor + 46, cursor + 46 + nameLength)
		let name: string
		try {
			name =
				flags & 0x800
					? new TextDecoder("utf-8", { fatal: true }).decode(rawName)
					: rawName.toString("latin1")
		} catch {
			fail("A file name inside that ZIP archive isn't valid UTF-8.")
		}
		if (
			!name ||
			name.includes("\0") ||
			name.includes("\\") ||
			name.startsWith("/") ||
			/^[a-z]:/i.test(name)
		)
			fail("That ZIP archive contains an unsafe file path.")
		const directory = name.endsWith("/")
		const pieces = name.split("/").slice(0, directory ? -1 : undefined)
		if (pieces.some((piece) => piece === "" || piece === "." || piece === ".."))
			fail("That ZIP archive contains an unsafe file path.")
		const pathKey = name
			.replace(/\/$/, "")
			.normalize("NFC")
			.toLocaleLowerCase("en-US")
		if (paths.has(pathKey))
			fail("That ZIP archive contains a duplicate file path.")
		paths.add(pathKey)
		const unixMode = externalAttributes >>> 16
		if ((unixMode & 0xf000) === 0xa000)
			fail("That ZIP archive contains a symbolic link.")

		if (
			localOffset + 30 > directoryOffset ||
			bytes.readUInt32LE(localOffset) !== 0x04034b50
		)
			fail("That ZIP archive has a malformed file entry.")
		const localFlags = bytes.readUInt16LE(localOffset + 6)
		const localMethod = bytes.readUInt16LE(localOffset + 8)
		const localNameLength = bytes.readUInt16LE(localOffset + 26)
		const localExtraLength = bytes.readUInt16LE(localOffset + 28)
		const dataOffset = localOffset + 30 + localNameLength + localExtraLength
		const dataEnd = dataOffset + compressedSize
		if (
			localFlags !== flags ||
			localMethod !== method ||
			dataEnd > directoryOffset
		)
			fail("That ZIP archive has a malformed file entry.")
		if (
			!bytes
				.subarray(localOffset + 30, localOffset + 30 + localNameLength)
				.equals(rawName)
		)
			fail("That ZIP archive has inconsistent file names.")
		ranges.push([localOffset, dataEnd])
		if (directory && size)
			fail("That ZIP archive has a malformed directory entry.")
		if (include && !include(name)) {
			cursor = next
			continue
		}
		if (size > MAX_ENTRY_BYTES)
			fail("A file inside that ZIP archive is too large.")
		totalSize += size
		if (totalSize > MAX_UNCOMPRESSED_BYTES)
			fail("That ZIP archive expands to too much data.")
		const compressed = bytes.subarray(dataOffset, dataEnd)
		let data: Buffer
		try {
			data =
				method === 0
					? Buffer.from(compressed)
					: inflateRawSync(compressed, {
							maxOutputLength: Math.min(size + 1, MAX_ENTRY_BYTES + 1),
						})
		} catch {
			fail("A file inside that ZIP archive is corrupt.")
		}
		if (data.length !== size || crc32(data) !== expectedCrc)
			fail("A file inside that ZIP archive is corrupt.")
		if (directory && data.length)
			fail("That ZIP archive has a malformed directory entry.")
		if (!directory) result.push({ name, data })
		cursor = next
	}
	if (cursor !== eocd) fail("That ZIP archive has a malformed directory.")
	ranges.sort((a, b) => a[0] - b[0])
	for (let i = 1; i < ranges.length; i++)
		if (ranges[i][0] < ranges[i - 1][1])
			fail("That ZIP archive contains overlapping files.")
	return result.sort((a, b) => a.name.localeCompare(b.name, "en"))
}

function text(entry: ArchiveEntry): string {
	try {
		return new TextDecoder("utf-8", { fatal: true }).decode(entry.data)
	} catch {
		return fail(`${entry.name} isn't valid UTF-8 text.`)
	}
}

const validYear = (value: unknown): number | null => {
	const year =
		typeof value === "number" ? value : Number(String(value ?? "").trim())
	return Number.isInteger(year) && year > 1800 && year < 2200 ? year : null
}
const validId = (value: unknown): number | null =>
	typeof value === "number" && Number.isSafeInteger(value) && value > 0
		? value
		: null
const validImdb = (value: unknown): string | null =>
	typeof value === "string" && /^tt\d+$/.test(value) ? value : null
const day = (value: string): string | null => {
	const candidate = value.trim()
	const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(candidate)
	if (!match) return null
	const date = new Date(
		Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])),
	)
	return date.toISOString().slice(0, 10) === candidate ? candidate : null
}
const moment = (value: unknown): string | null => {
	if (
		typeof value !== "string" ||
		!/^\d{4}-\d{2}-\d{2}T/.test(value) ||
		day(value.slice(0, 10)) === null ||
		!Number.isFinite(Date.parse(value))
	)
		return null
	return value
}
const clipped = (value: unknown, max = 300) =>
	typeof value === "string" ? value.trim().slice(0, max) : ""

function letterboxd(entries: ArchiveEntry[]): ParsedImport {
	const byName = new Map(entries.map((entry) => [entry.name, entry]))
	const warnings: string[] = []
	const observations: ImportObservation[] = []
	let rows = 0
	const tables = new Map<string, Array<Record<string, string>>>()
	for (const [name, entry] of byName) {
		if (!name.toLowerCase().endsWith(".csv")) continue
		const csv = parseCsv(text(entry))
		if (!csv.length) continue
		const headers = csv[0].map((header) =>
			header
				.replace(/^\ufeff/, "")
				.trim()
				.toLowerCase(),
		)
		const data = csv.slice(1).filter((row) => row.some((cell) => cell.trim()))
		rows += data.length
		if (rows > IMPORT_MAX_ROWS)
			fail(
				`That export has more than ${IMPORT_MAX_ROWS.toLocaleString("en-US")} rows.`,
			)
		tables.set(
			name,
			data.map((fields) =>
				Object.fromEntries(
					headers.map((header, index) => [header, fields[index] ?? ""]),
				),
			),
		)
	}
	const sourceIdentity = (row: Record<string, string>) => {
		const uri = row["letterboxd uri"]?.trim()
		if (uri) {
			try {
				const parsed = new URL(uri)
				const parts = parsed.pathname.split("/").filter(Boolean)
				if (
					parsed.hostname === "letterboxd.com" &&
					parts.length === 2 &&
					parts[0] === "film"
				)
					return parts[1].slice(0, 240)
				return `${parsed.hostname}:${parts.join(":")}`.slice(0, 240)
			} catch {
				// Older exports may contain an identifier rather than an absolute URI.
				return uri.replace(/[^a-z0-9._~-]+/gi, ":").slice(0, 240)
			}
		}
		return `${clipped(row.name, 180).toLocaleLowerCase("en-US")}:${validYear(row.year) ?? ""}`
	}
	const base = (row: Record<string, string>) => ({
		mediaType: "movie" as const,
		title: clipped(row.name),
		year: validYear(row.year),
		tmdbId: null,
		imdbId: null,
	})
	const diaryRows = tables.get("diary.csv") ?? []
	const overlapIdentity = (row: Record<string, string>) =>
		`${clipped(row.name).toLocaleLowerCase("en-US")}\0${validYear(row.year) ?? ""}`
	const diaryTitles = new Set(diaryRows.map(overlapIdentity))
	const canonicalRow = (row: Record<string, string>) =>
		Object.keys(row)
			.sort()
			.map((key) => `${key}=${row[key]}`)
			.join("\0")
	const watches = [
		...diaryRows.map((row) => ({ row, source: "diary" })),
		...(tables.get("watched.csv") ?? [])
			.filter((row) => !diaryTitles.has(overlapIdentity(row)))
			.map((row) => ({ row, source: "watched" })),
	].sort((a, b) =>
		`${sourceIdentity(a.row)}\0${a.row["watched date"] ?? a.row.date ?? ""}\0${a.source}\0${canonicalRow(a.row)}`.localeCompare(
			`${sourceIdentity(b.row)}\0${b.row["watched date"] ?? b.row.date ?? ""}\0${b.source}\0${canonicalRow(b.row)}`,
		),
	)
	const occurrences = new Map<string, number>()
	for (const { row, source } of watches) {
		// Letterboxd's Date is when an entry changed. Only Diary's Watched Date describes the viewing day.
		const watchedAt = source === "diary" ? day(row["watched date"] || "") : null
		const identity = sourceIdentity(row)
		const occurrence = (occurrences.get(identity) ?? 0) + 1
		occurrences.set(identity, occurrence)
		observations.push({
			// Diary entry URIs are stable across date edits. Older rows without one use a canonical ordinal;
			// indistinguishable duplicate rows are the one case Letterboxd gives us no permanent identity for.
			key: `letterboxd:watch:${identity}:${occurrence}`,
			kind: "watch",
			...base(row),
			watchedAt,
			precision: watchedAt ? "day" : "unknown",
			// The Rewatch flag says this wasn't the first viewing; it cannot identify a numbered show pass.
			pass: 1,
		})
	}
	for (const row of tables.get("ratings.csv") ?? []) {
		const rating = Number(row.rating)
		observations.push({
			key: `letterboxd:rating:${sourceIdentity(row)}`,
			kind: "rating",
			...base(row),
			score:
				Number.isFinite(rating) && rating >= 0.5 && rating <= 5
					? Math.round(rating * 2)
					: null,
			addedAt: day(row.date),
			...(Number.isFinite(rating) && rating >= 0.5 && rating <= 5
				? {}
				: {
						problem: {
							outcome: "invalid" as const,
							reason: "The Letterboxd rating isn't from 0.5 to 5 stars.",
						},
					}),
		})
	}
	for (const row of tables.get("reviews.csv") ?? [])
		observations.push({
			key: `letterboxd:review:${sourceIdentity(row)}`,
			kind: "review",
			...base(row),
			review: clipped(row.review, 20_000),
			addedAt: day(row.date),
		})
	for (const row of tables.get("watchlist.csv") ?? [])
		observations.push({
			key: `letterboxd:want:${sourceIdentity(row)}`,
			kind: "want",
			...base(row),
			addedAt: day(row.date),
		})
	for (const row of tables.get("likes/films.csv") ?? [])
		observations.push({
			key: `letterboxd:favorite:${sourceIdentity(row)}`,
			kind: "favorite",
			...base(row),
			addedAt: day(row.date),
		})

	const ignored = entries.filter(
		(entry) =>
			![
				"diary.csv",
				"watched.csv",
				"ratings.csv",
				"reviews.csv",
				"watchlist.csv",
				"likes/films.csv",
			].includes(entry.name),
	)
	if (
		ignored.some(
			(entry) =>
				entry.name.startsWith("deleted/") || entry.name.startsWith("orphaned/"),
		)
	)
		warnings.push("Deleted and orphaned Letterboxd entries were left out.")
	if (
		ignored.some(
			(entry) =>
				!entry.name.startsWith("deleted/") &&
				!entry.name.startsWith("orphaned/"),
		)
	)
		warnings.push(
			"Profile, comments, and list likes aren't part of this import.",
		)
	return {
		source: "letterboxd",
		observations,
		warnings: warnings.map(importInfo),
	}
}

type JsonRecord = Record<string, unknown>
const record = (value: unknown): JsonRecord | null =>
	typeof value === "object" && value !== null && !Array.isArray(value)
		? (value as JsonRecord)
		: null

function jsonArray(entry: ArchiveEntry): unknown[] {
	let value: unknown
	try {
		value = JSON.parse(text(entry))
	} catch {
		return fail(`${entry.name} isn't valid JSON.`)
	}
	if (!Array.isArray(value))
		fail(`${entry.name} doesn't contain the expected list.`)
	return value
}

function trakt(entries: ArchiveEntry[]): ParsedImport {
	const observations: ImportObservation[] = []
	const warnings: string[] = []
	let rows = 0
	const timestampCounts = new Map<string, number>()
	const usedHistoryIds = new Set<string>()
	const unsupportedFiles: string[] = []
	for (const entry of entries) {
		const name = entry.name.toLowerCase()
		if (!name.endsWith(".json")) continue
		const isHistory = /^watched-history(?:-\d+)?\.json$/.test(name)
		const isRating = /^ratings-(movies|shows|seasons|episodes)\.json$/.test(
			name,
		)
		const isList =
			name === "lists-watchlist.json" || name === "lists-favorites.json"
		const isCustomList =
			name === "lists-lists.json" ||
			/^lists-(?!watchlist\.json$|favorites\.json$|collaborations\.json$).+\.json$/.test(
				name,
			)
		if (!isHistory && !isRating && !isList && !isCustomList) continue
		const values = jsonArray(entry)
		rows += values.length
		if (rows > IMPORT_MAX_ROWS)
			fail(
				`That export has more than ${IMPORT_MAX_ROWS.toLocaleString("en-US")} rows.`,
			)
		for (let index = 0; index < values.length; index++) {
			const item = record(values[index])
			if (!item) {
				observations.push({
					key: `trakt:invalid:${name}:${index}`,
					kind: "unsupported",
					mediaType: "movie",
					title: "",
					year: null,
					tmdbId: null,
					imdbId: null,
					problem: {
						outcome: "invalid",
						reason: `${entry.name} contains an invalid row.`,
					},
				})
				continue
			}
			const type =
				item.type === "episode" ||
				item.type === "show" ||
				item.type === "season"
					? item.type
					: "movie"
			const titleObject = record(type === "movie" ? item.movie : item.show)
			const episodeObject = record(item.episode)
			const seasonObject = record(item.season)
			const ids = record(titleObject?.ids)
			const episodeIds = record(episodeObject?.ids)
			const seasonIds = record(seasonObject?.ids)
			const listIds = record(item.ids)
			const mediaType = type === "movie" ? "movie" : "show"
			const base = {
				mediaType: mediaType as "movie" | "show",
				title: clipped(titleObject?.title),
				year: validYear(titleObject?.year),
				tmdbId: validId(ids?.tmdb),
				imdbId: validImdb(ids?.imdb),
			}
			const sourceId = String(
				item.id ??
					(isCustomList
						? (listIds?.trakt ?? listIds?.slug)
						: type === "episode"
							? episodeIds?.trakt
							: type === "season"
								? seasonIds?.trakt
								: ids?.trakt) ??
					`${name}:${index}`,
			)
			if (isHistory) {
				const historyId = String(item.id ?? "")
				const watchedAt = moment(item.watched_at)
				if (historyId && usedHistoryIds.has(historyId))
					fail("That Trakt export contains a duplicate history ID.")
				if (historyId) usedHistoryIds.add(historyId)
				if (watchedAt)
					timestampCounts.set(
						watchedAt,
						(timestampCounts.get(watchedAt) ?? 0) + 1,
					)
				observations.push({
					key: `trakt:watch:${historyId || `${name}:${index}`}`,
					kind: "watch",
					...base,
					...(type === "episode"
						? {
								episodeTmdbId: validId(episodeIds?.tmdb),
								episodeNumbering: "tmdb" as const,
								season:
									validId(episodeObject?.season) ??
									(episodeObject?.season === 0 ? 0 : null),
								episode: validId(episodeObject?.number),
							}
						: {}),
					watchedAt,
					precision: watchedAt ? "moment" : "unknown",
					pass: 1,
				})
			} else if (
				isRating &&
				(name.includes("seasons") || name.includes("episodes"))
			) {
				observations.push({
					key: `trakt:unsupported-rating:${sourceId}`,
					kind: "unsupported",
					...base,
					problem: {
						outcome: "unsupported",
						reason: "GoodWatch doesn't import season or episode ratings yet.",
					},
				})
			} else if (isRating) {
				const score =
					typeof item.rating === "number" &&
					Number.isInteger(item.rating) &&
					item.rating >= 1 &&
					item.rating <= 10
						? item.rating
						: null
				observations.push({
					key: `trakt:rating:${mediaType}:${sourceId}`,
					kind: "rating",
					...base,
					score,
					addedAt: moment(item.rated_at),
					...(score === null
						? {
								problem: {
									outcome: "invalid" as const,
									reason: "The Trakt rating isn't a whole number from 1 to 10.",
								},
							}
						: {}),
				})
			} else if (isCustomList) {
				observations.push({
					key: `trakt:unsupported-list:${name}:${sourceId}`,
					kind: "unsupported",
					...base,
					title: clipped(item.name) || base.title,
					problem: {
						outcome: "unsupported",
						reason: "GoodWatch doesn't import custom Trakt lists yet.",
					},
				})
			} else {
				const favorite = name === "lists-favorites.json"
				observations.push({
					key: `trakt:${favorite ? "favorite" : "want"}:${mediaType}:${sourceId}`,
					kind: favorite ? "favorite" : "want",
					...base,
					addedAt: moment(item.listed_at),
				})
			}
		}
		if (
			(name.includes("seasons") || name.includes("episodes")) &&
			values.length
		)
			unsupportedFiles.push(entry.name)
	}
	const largestCluster = Math.max(0, ...timestampCounts.values())
	if (largestCluster >= 100)
		warnings.push(
			`${largestCluster.toLocaleString("en-US")} watches share one Trakt timestamp. Their original dates were preserved.`,
		)
	if (unsupportedFiles.length)
		warnings.push("Season and episode ratings were kept as unsupported items.")
	if (
		entries.some((entry) => /^watched-(movies|shows)\.json$/i.test(entry.name))
	)
		warnings.push(
			"Trakt's watched summaries were left out because the history files contain the individual watches.",
		)
	if (
		entries.some((entry) =>
			/^(user-|network-|comments-|notes-|hidden-|deleted)/i.test(entry.name),
		)
	)
		warnings.push(
			"Account, social, notes, comments, hidden, and deleted Trakt data aren't part of this import.",
		)
	return { source: "trakt", observations, warnings: warnings.map(importInfo) }
}

/** Reads an import entirely in memory; MovieLens can include a separate wishlist CSV. */
export async function parseImportFile(
	source: ImportSource,
	bytes: Uint8Array,
	wishlist?: Uint8Array,
	fileName?: string,
): Promise<ParsedImport> {
	if (!isFileImportSource(source))
		fail("Use Connect for this source instead of uploading a file.")
	if (source === "wishlist") return parseWishlistFile(bytes, fail)
	if (source === "tvtime") {
		const isZip =
			(bytes[0] === 0x50 && bytes[1] === 0x4b) || /\.zip$/i.test(fileName ?? "")
		try {
			checkUploadSize(bytes)
			const ignored: string[] = []
			const entries = isZip
				? zipEntries(bytes, (name) => {
						if (isTvTimeFile(name)) return true
						if (!name.endsWith("/")) ignored.push(name)
						return false
					})
				: [{ name: fileName ?? "tvtime.csv", data: bytes }]
			return parseTvTime(entries, { readCsvTable, text, fail }, ignored)
		} catch (error) {
			if (error instanceof ImportFileError) {
				if (/password-protected|encrypted/i.test(error.message))
					fail(
						"This TV Time ZIP is password-protected. Open it on your computer with its password, then upload its CSV files in a new ZIP without a password, or upload tracking-prod-records-v2.csv by itself.",
						"tvtime_zip_encrypted",
					)
				if (!error.code && isZip)
					fail(
						"GoodWatch couldn't open this TV Time ZIP. Check the file and try again.",
						"tvtime_zip_unreadable",
					)
				error.code ??= "tvtime_file_invalid"
			}
			throw error
		}
	}
	if (source === "myanimelist") return myanimelist(bytes, fileName)
	if (source === "kodi") return kodi(bytes)
	if (source === "movielens") return movielens(bytes, wishlist)
	if (source === "csv") return genericCsv(bytes)
	const entries = zipEntries(bytes)
	return source === "letterboxd" ? letterboxd(entries) : trakt(entries)
}

function csvImdb(value: string): string | null {
	const id = value.replace(/^tt/, "")
	return /^\d+$/.test(id) ? `tt${id.padStart(7, "0")}` : null
}

function readCsvTable(
	data: Uint8Array,
	name: string,
	remainingRows = IMPORT_MAX_ROWS,
	compactHeaders = false,
) {
	checkUploadSize(data)
	const table = parseCsv(text({ name, data }), true)
	if (!table.length) fail("That file is empty.")
	const [originalHeaders, ...rows] = table
	if (rows.length > remainingRows)
		fail(`That export has more than ${rowLimitLabel} rows.`)
	const headers = originalHeaders.map((header) => {
		const normalized = header.trim().toLowerCase()
		return compactHeaders ? normalized.replace(/ /g, "") : normalized
	})
	if (new Set(headers).size !== headers.length)
		fail("The CSV has duplicate columns.")
	if (rows.some((row) => row.length !== headers.length))
		fail("A CSV row has the wrong number of fields.")
	return { headers, originalHeaders, rows }
}

function genericCsv(bytes: Uint8Array): ParsedImport {
	const { headers, originalHeaders, rows } = readCsvTable(
		bytes,
		"CSV",
		IMPORT_MAX_ROWS,
		true,
	)
	if (
		!headers.some((header) =>
			["title", "name", "tmdbid", "imdbid", "letterboxduri"].includes(header),
		)
	)
		fail("Include a Title, tmdbID, imdbID or LetterboxdURI column.")
	const known = new Set([
		"letterboxduri",
		"tmdbid",
		"imdbid",
		"title",
		"name",
		"year",
		"directors",
		"rating",
		"rating10",
		"watcheddate",
		"rewatch",
		"tags",
		"review",
	])
	const unknown = originalHeaders.filter(
		(_, index) => !known.has(headers[index]),
	)
	const warnings = unknown.length
		? [`Unknown columns ignored: ${unknown.join(", ")}.`]
		: []
	const observations: ImportObservation[] = []
	const occurrences = new Map<string, number>()
	if (
		headers.includes("tags") ||
		headers.includes("directors") ||
		headers.includes("rewatch")
	)
		warnings.push(
			"Tags, Directors and Rewatch metadata are not applied. Each dated row represents one watch; a rewatch flag does not create extra watches.",
		)
	if (headers.includes("letterboxduri"))
		warnings.push(
			"LetterboxdURI identifies source entries but is not used for catalog matching; include TMDB/IMDb IDs or an exact Title and Year.",
		)
	const dateColumn = headers.indexOf("watcheddate")
	// Process dated rows newest first, so repeated titles use their latest supplied rating.
	const sortedRows = rows.sort((a, b) =>
		(b[dateColumn] ?? "").localeCompare(a[dateColumn] ?? ""),
	)
	for (const fields of sortedRows) {
		const row = Object.fromEntries(
			headers.map((header, index) => [header, fields[index]?.trim() ?? ""]),
		)
		const base = {
			mediaType: "movie" as const,
			title: clipped(row.title || row.name),
			year: validYear(row.year),
			tmdbId: validId(Number(row.tmdbid)),
			imdbId: csvImdb(row.imdbid ?? ""),
		}
		const identity =
			clipped(row.letterboxduri, 240) ||
			(base.tmdbId
				? `tmdb:${base.tmdbId}`
				: base.imdbId || `${base.title.toLowerCase()}:${base.year ?? ""}`)
		const occurrence = (occurrences.get(identity) ?? 0) + 1
		occurrences.set(identity, occurrence)
		const key = `csv:${identity}:${occurrence}`
		if (row.watcheddate) {
			const watchedAt = day(row.watcheddate)
			observations.push({
				...base,
				key: `${key}:watch`,
				kind: "watch",
				watchedAt,
				precision: "day",
				pass: 1,
				...(watchedAt
					? {}
					: {
							problem: {
								outcome: "invalid" as const,
								reason: "WatchedDate must be a calendar date (YYYY-MM-DD).",
							},
						}),
			})
		}
		if (!row.watcheddate && !row.rating10 && !row.rating && !row.review)
			observations.push({
				...base,
				key: `${key}:empty`,
				kind: "unsupported",
				problem: {
					outcome: "invalid",
					reason: "This row has no rating or watched date.",
				},
			})
		if (row.rating10 || row.rating) {
			const rating10 = Number(row.rating10)
			const rating = Number(row.rating) * 2
			const validScore = (value: number) =>
				Number.isInteger(value) && value >= 1 && value <= 10
			const score = validScore(rating10) ? rating10 : rating
			const valid = validScore(score)
			observations.push({
				...base,
				key: `${key}:rating`,
				kind: "rating",
				score: valid ? score : null,
				...(valid
					? {}
					: {
							problem: {
								outcome: "invalid" as const,
								reason:
									"A rating must be 0.5–5 in half steps, or Rating10 a whole number from 1 to 10.",
							},
						}),
			})
		}
		if (row.review)
			observations.push({
				...base,
				key: `${key}:review`,
				kind: "review",
				review: clipped(row.review, 20_000),
			})
	}
	if (observations.length > IMPORT_MAX_ROWS)
		fail(`That export produces more than ${rowLimitLabel} import items.`)
	return { source: "csv", observations, warnings: warnings.map(importInfo) }
}

function movielens(bytes: Uint8Array, wishlist?: Uint8Array): ParsedImport {
	if (bytes.byteLength + (wishlist?.byteLength ?? 0) > IMPORT_MAX_BYTES)
		fail(`The combined export is larger than ${uploadSizeLabel}.`)
	const warnings = [
		"MovieLens tags and activity logs are not applied. Activity logs record rating times, not watch times. Ratings and wishlist entries have no viewing dates.",
	]
	const observations: ImportObservation[] = []
	for (const [kind, data] of [
		["rating", bytes],
		["want", wishlist],
	] as const) {
		if (!data) continue
		const { headers, rows } = readCsvTable(
			data,
			`MovieLens ${kind}`,
			IMPORT_MAX_ROWS - observations.length,
		)
		const required = [
			"movie_id",
			"imdb_id",
			"tmdb_id",
			"title",
			...(kind === "rating" ? ["rating"] : []),
		]
		if (required.some((header) => !headers.includes(header)))
			fail(
				`MovieLens ${kind} CSV is missing required columns: ${required.join(", ")}. Use your personal export from Settings, not a GroupLens dataset.`,
			)
		if (kind === "want" && headers.includes("rating"))
			fail(
				"Choose the wishlist CSV for the optional file, not the ratings columns.",
			)
		const identities = new Set<number>()
		const known = new Set([
			"movie_id",
			"imdb_id",
			"tmdb_id",
			"rating",
			"average_rating",
			"title",
		])
		const unknown = headers.filter((header) => !known.has(header))
		if (unknown.length)
			warnings.push(
				`Unknown MovieLens ${kind} columns ignored: ${unknown.join(", ")}.`,
			)
		for (const [index, fields] of rows.entries()) {
			const row = Object.fromEntries(
				headers.map((header, index) => [header, fields[index]?.trim() ?? ""]),
			)
			const movieId = validId(Number(row.movie_id))
			if (movieId !== null && identities.has(movieId))
				fail("The MovieLens file contains a duplicate movie_id.")
			if (movieId !== null) identities.add(movieId)
			const score = Number(row.rating) * 2
			const validScore = Number.isInteger(score) && score >= 1 && score <= 10
			const problem =
				movieId === null
					? {
							outcome: "invalid" as const,
							reason: "MovieLens movie_id must be a positive integer.",
						}
					: kind === "rating" && !validScore
						? {
								outcome: "invalid" as const,
								reason: "MovieLens rating must be 0.5–5 in half-star steps.",
							}
						: undefined
			const title = /^(.*) \((\d{4})\)$/.exec(row.title)
			observations.push({
				key: `movielens:${kind}:${movieId ?? `invalid-row:${index}`}`,
				kind,
				mediaType: "movie",
				title: clipped(title?.[1] ?? row.title),
				year: validYear(title?.[2]),
				tmdbId: validId(Number(row.tmdb_id)),
				imdbId: csvImdb(row.imdb_id),
				...(kind === "rating" ? { score: validScore ? score : null } : {}),
				...(problem ? { problem } : {}),
			})
		}
	}
	return {
		source: "movielens",
		observations,
		warnings: warnings.map(importInfo),
	}
}

const MAX_XML_ELEMENTS = 1_000_000
const MAX_XML_DEPTH = 64

/** Saxes cannot fetch entities; XML adapters share these mandatory bounds. */
export function boundedXml(
	value: string,
	source: string,
	handlers: {
		open: (tag: SaxesTagPlain) => void
		text: (value: string) => void
		close: () => void
	},
) {
	const parser = new SaxesParser()
	let depth = 0
	let elements = 0
	parser.on("doctype", () =>
		fail(`${source} XML must not contain a DOCTYPE or entity declarations.`),
	)
	parser.on("error", () => fail(`That ${source} file isn't valid XML.`))
	parser.on("opentag", (tag) => {
		if (++elements > MAX_XML_ELEMENTS || depth >= MAX_XML_DEPTH)
			fail(`That ${source} XML is too complex.`)
		depth++
		handlers.open(tag)
	})
	parser.on("text", handlers.text)
	parser.on("cdata", handlers.text)
	parser.on("closetag", () => {
		handlers.close()
		depth--
	})
	parser.write(value).close()
}
const KODI_FIELDS = new Set([
	"title",
	"year",
	"premiered",
	"uniqueid",
	"id",
	"userrating",
	"playcount",
	"lastplayed",
	"season",
	"episode",
])

interface KodiElement {
	name: string
	attributes: Record<string, string>
	value: string
	children: KodiElement[]
}

/** Saxes never fetches entities. Reject DTDs entirely, and bound tree allocation. */
function kodiXml(value: string): KodiElement {
	const stack: Array<KodiElement | null> = []
	let root: KodiElement | undefined
	let rows = 0
	const open = (tag: SaxesTagPlain) => {
		if (
			["movie", "tvshow", "episodedetails", "musicvideo"].includes(tag.name) &&
			++rows > IMPORT_MAX_ROWS
		)
			fail(`That export has more than ${rowLimitLabel} rows.`)
		const parent = stack.at(-1)
		const keep =
			stack.length === 0 ||
			(parent &&
				((stack.length === 1 &&
					["movie", "tvshow", "musicvideo"].includes(tag.name)) ||
					(parent.name === "tvshow" && tag.name === "episodedetails") ||
					(["movie", "tvshow", "musicvideo", "episodedetails"].includes(
						parent.name,
					) &&
						KODI_FIELDS.has(tag.name))))
		// Keep a depth marker but no object or text for artwork, actors and other unused subtrees.
		if (!keep) {
			stack.push(null)
			return
		}
		const element: KodiElement = {
			name: tag.name,
			attributes:
				tag.name === "uniqueid" ? { type: tag.attributes.type ?? "" } : {},
			value: "",
			children: [],
		}
		if (parent) parent.children.push(element)
		else root = element
		stack.push(element)
	}
	const append = (value: string) => {
		const current = stack.at(-1)
		if (current && KODI_FIELDS.has(current.name)) current.value += value
	}
	boundedXml(value, "Kodi", {
		open,
		text: append,
		close: () => {
			stack.pop()
		},
	})
	if (!root || root.name !== "videodb")
		fail(
			"Choose Kodi's Single file export (videodb.xml), not separate .nfo files.",
		)
	return root
}

type KodiTitle = Pick<
	ImportObservation,
	"mediaType" | "title" | "year" | "tmdbId" | "imdbId"
>

function kodi(bytes: Uint8Array): ParsedImport {
	checkUploadSize(
		bytes,
		`That export is larger than ${uploadSizeLabel}. Upload videodb.xml by itself.`,
	)
	let data = bytes
	if (bytes[0] === 0x50 && bytes[1] === 0x4b) {
		const libraries = zipEntries(
			bytes,
			(name) => name.split("/").at(-1)?.toLowerCase() === "videodb.xml",
		)
		if (libraries.length !== 1)
			fail(
				"Choose a ZIP containing exactly one videodb.xml from Kodi's Single file export.",
			)
		data = libraries[0].data
	}
	const root = kodiXml(text({ name: "videodb.xml", data }))
	const observations: ImportObservation[] = []
	const warnings = [
		"Kodi play counts produce one watch per movie or episode, not a play history. Show play counts, partial plays and library dates are ignored.",
	]
	const value = (node: KodiElement, name: string) =>
		node.children.find((child) => child.name === name)?.value.trim() ?? ""
	const id = (node: KodiElement, type: string) =>
		node.children
			.find(
				(child) => child.name === "uniqueid" && child.attributes.type === type,
			)
			?.value.trim() ?? ""
	const baseFor = (
		node: KodiElement,
		mediaType: "movie" | "show",
	): KodiTitle => ({
		mediaType,
		title: clipped(value(node, "title")),
		year: validYear(
			value(node, "year") || value(node, "premiered").slice(0, 4),
		),
		tmdbId: validId(Number(id(node, "tmdb"))),
		imdbId: validImdb(id(node, "imdb")) ?? validImdb(value(node, "id")),
	})
	const reference = (base: KodiTitle) =>
		base.tmdbId
			? `tmdb:${base.tmdbId}`
			: (base.imdbId ?? `${base.title.toLowerCase()}:${base.year}`)
	const emit = (
		node: KodiElement,
		base: KodiTitle,
		ref: string,
		episode = false,
	) => {
		const score = Number(value(node, "userrating"))
		const validScore = Number.isInteger(score) && score >= 1 && score <= 10
		if (value(node, "userrating") && score !== 0)
			observations.push({
				...base,
				key: `kodi:rating:${base.mediaType}:${ref}`,
				kind: episode ? "unsupported" : "rating",
				...(episode
					? {
							problem: {
								outcome: "unsupported" as const,
								reason:
									"GoodWatch doesn't import season or episode ratings yet.",
							},
						}
					: validScore
						? { score }
						: {
								score: null,
								problem: {
									outcome: "invalid" as const,
									reason:
										"The Kodi rating must be a whole number from 1 to 10.",
								},
							}),
			})
		if (node.name !== "tvshow" && Number(value(node, "playcount")) > 0) {
			const watchedAt = day(value(node, "lastplayed"))
			if (!watchedAt && value(node, "lastplayed"))
				warnings.push(
					"An invalid Kodi last-played date was imported without a date.",
				)
			const season = value(node, "season")
			observations.push({
				...base,
				key: `kodi:watch:${base.mediaType}:${ref}`,
				kind: "watch",
				watchedAt,
				precision: watchedAt ? "day" : "unknown",
				pass: 1,
				...(episode
					? {
							episodeTmdbId: validId(Number(id(node, "tmdb"))),
							episodeTvdbId: validId(Number(id(node, "tvdb"))),
							episodeName: clipped(value(node, "title")),
							episodeNumbering: "unknown" as const,
							season: season === "0" ? 0 : validId(Number(season)),
							episode: validId(Number(value(node, "episode"))),
						}
					: {}),
			})
		}
	}
	// Kodi versions can omit one of the IDs. Only unambiguous pairs from this export unify identities.
	const movieIds = new Map<string, number | null>()
	for (const node of root.children) {
		if (node.name !== "movie") continue
		const { tmdbId, imdbId } = baseFor(node, "movie")
		if (tmdbId && imdbId)
			movieIds.set(
				imdbId,
				!movieIds.has(imdbId) || movieIds.get(imdbId) === tmdbId
					? tmdbId
					: null,
			)
	}
	for (const node of root.children) {
		if (node.name === "movie" || node.name === "tvshow") {
			const base = baseFor(node, node.name === "movie" ? "movie" : "show")
			if (node.name === "movie" && !base.tmdbId && base.imdbId)
				base.tmdbId = movieIds.get(base.imdbId) ?? null
			const ref = reference(base)
			emit(node, base, ref)
			for (const episode of node.children.filter(
				(child) => child.name === "episodedetails",
			)) {
				const episodeRef = id(episode, "tmdb")
					? `tmdb:${id(episode, "tmdb")}`
					: id(episode, "tvdb")
						? `tvdb:${id(episode, "tvdb")}`
						: `${value(episode, "season")}:${value(episode, "episode")}`
				emit(episode, base, `${ref}:episode:${episodeRef}`, true)
			}
		} else if (node.name === "musicvideo")
			observations.push({
				...baseFor(node, "movie"),
				key: `kodi:unsupported:musicvideo:${observations.length}`,
				kind: "unsupported",
				problem: {
					outcome: "unsupported",
					reason: "GoodWatch doesn't import music videos.",
				},
			})
	}
	if (observations.length > IMPORT_MAX_ROWS)
		fail(`That export produces more than ${rowLimitLabel} import items.`)
	const unique = deduplicateKodi(observations)
	const clusterWarning = kodiSameDayWarning(unique)
	if (clusterWarning) warnings.push(clusterWarning)
	return {
		source: "kodi",
		observations: unique,
		warnings: [...new Set(warnings)].map(importInfo),
	}
}

function deduplicateKodi(
	observations: ImportObservation[],
): ImportObservation[] {
	const unique = new Map<string, ImportObservation>()
	for (const observation of observations) {
		const previous = unique.get(observation.key)
		if (
			!previous ||
			(observation.kind === "watch" &&
				(observation.watchedAt ?? "") > (previous.watchedAt ?? ""))
		)
			unique.set(observation.key, observation)
	}
	return [...unique.values()]
}

function kodiSameDayWarning(observations: ImportObservation[]): string | null {
	const days = new Map<string, number>()
	for (const row of observations)
		if (row.kind === "watch" && row.watchedAt)
			days.set(row.watchedAt, (days.get(row.watchedAt) ?? 0) + 1)
	const largest = Math.max(0, ...days.values())
	return largest >= 100
		? `${largest} Kodi watches share one day. This may be a mark-as-watched date; you can import without dates.`
		: null
}

const MAL_FIELDS = new Set([
	"series_animedb_id",
	"series_title",
	"series_type",
	"series_episodes",
	"my_watched_episodes",
	"my_status",
	"my_score",
	"my_start_date",
	"my_finish_date",
])
const MAL_STATUSES: Record<string, ImportShowStatus> = {
	Watching: "watching",
	Completed: "completed",
	"On-Hold": "on_hold",
	"On Hold": "on_hold",
	Dropped: "dropped",
	"Plan to Watch": "plan_to_watch",
}

function entryObservations(
	row: Record<string, string>,
	rowNumber: number,
	remaining: number,
): ImportObservation[] {
	const observations: ImportObservation[] = []
	const id = Number(row.series_animedb_id)
	const progress = Number(row.my_watched_episodes || 0)
	const total = Number(row.series_episodes || 0)
	const status = Object.prototype.hasOwnProperty.call(
		MAL_STATUSES,
		row.my_status,
	)
		? MAL_STATUSES[row.my_status]
		: undefined
	const base = {
		mediaType: "show" as const,
		title: row.series_title || `MyAnimeList #${id}`,
		year: null,
		tmdbId: null,
		imdbId: null,
		animeEntry: {
			source: "myanimelist" as const,
			id,
			progress,
			startedAt: day(row.my_start_date || ""),
			finishedAt: day(row.my_finish_date || ""),
			completed: status === "completed",
			...(total > 0 ? { episodeCount: total } : {}),
		},
	}
	let invalid: string | null = null
	if (
		!/^\d+$/.test(row.series_animedb_id ?? "") ||
		!Number.isSafeInteger(id) ||
		id <= 0
	)
		invalid = "This entry has no valid MyAnimeList id."
	else if (
		!/^\d+$/.test(row.my_watched_episodes || "0") ||
		!Number.isSafeInteger(progress)
	)
		invalid = "This entry has invalid episode progress."
	else if (
		!/^\d+$/.test(row.series_episodes || "0") ||
		!Number.isSafeInteger(total)
	)
		invalid = "This entry has an invalid episode count."
	const unsupported =
		row.series_type &&
		!["TV", "OVA", "ONA", "Special", "TV Special"].includes(row.series_type)
			? `${row.series_type} entries are not supported by the anime-to-show mapping.`
			: null
	if (invalid || unsupported) {
		observations.push({
			...base,
			key: `myanimelist:invalid:${rowNumber}`,
			kind: "unsupported",
			problem: {
				outcome: invalid ? "invalid" : "unsupported",
				reason: invalid || unsupported || "Unsupported entry.",
			},
		})
		if (observations.length > remaining)
			fail(`That export has more than ${rowLimitLabel} observations.`)
		return observations
	}
	observations.push({
		...base,
		key: `myanimelist:status:${id}`,
		kind: "show_status",
		showStatus: status,
		...(!status
			? {
					problem: {
						outcome: "invalid" as const,
						reason: "This entry has an unknown show status.",
					},
				}
			: {}),
		...(status === "completed" ? { completionScope: "part" as const } : {}),
	})
	const score = Number(row.my_score || 0)
	if (score !== 0)
		observations.push({
			...base,
			key: `myanimelist:rating:${id}`,
			kind: "unsupported",
			score: Number.isFinite(score) ? score : null,
			...(!/^\d+$/.test(row.my_score) ||
			!Number.isInteger(score) ||
			score < 1 ||
			score > 10
				? {
						problem: {
							outcome: "invalid" as const,
							reason:
								"The score must be a whole number from 1 to 10 (0 means no score).",
						},
					}
				: {
						problem: {
							outcome: "unsupported" as const,
							reason:
								"This season score is kept for later and not applied as a show rating.",
						},
					}),
		})
	if (progress > IMPORT_MAX_ROWS || observations.length + progress > remaining)
		fail(`That export has more than ${rowLimitLabel} observations.`)
	for (let episode = 1; episode <= progress; episode++)
		observations.push({
			...base,
			key: `myanimelist:watch:${id}:1:${episode}`,
			kind: "watch",
			episode,
			episodeNumbering: "unknown",
			pass: 1,
			watchedAt: null,
			precision: "unknown",
		})
	return observations
}

/** MAL and Kitsu share this format. Retain only direct, supported fields of one entry at a time. */
function myanimelist(bytes: Uint8Array, fileName?: string): ParsedImport {
	checkUploadSize(bytes)
	let data = bytes
	if (bytes[0] === 0x1f && bytes[1] === 0x8b) {
		try {
			data = gunzipSync(bytes, { maxOutputLength: MAX_ENTRY_BYTES })
		} catch {
			fail(
				`That gzip export is corrupt or expands beyond ${MAX_ENTRY_BYTES / 1024 / 1024} MB.`,
			)
		}
	}
	const observations: ImportObservation[] = []
	const stack: string[] = []
	let row: Record<string, string> = {}
	let exportType = ""
	let rows = 0
	const ids = new Set<number>()
	let hasMalIdentity = false
	let hasTitle = false
	const append = (value: string) => {
		if (stack.length === 3 && stack[1] === "anime" && MAL_FIELDS.has(stack[2]))
			row[stack[2]] = (row[stack[2]] ?? "") + value
		if (stack.join("/") === "myanimelist/myinfo/user_export_type")
			exportType += value
	}
	const open = (tag: SaxesTagPlain) => {
		if (!stack.length && tag.name !== "myanimelist")
			fail("Choose a MyAnimeList or Kitsu anime XML export.")
		if (
			stack.length === 2 &&
			stack[1] === "myinfo" &&
			["user_id", "user_name"].includes(tag.name)
		)
			hasMalIdentity = true
		if (stack.length === 1 && tag.name === "manga")
			fail("Manga lists are not supported. Export your Anime List instead.")
		if (
			stack.length === 2 &&
			stack[1] === "anime" &&
			MAL_FIELDS.has(tag.name)
		) {
			if (Object.prototype.hasOwnProperty.call(row, tag.name))
				fail("The anime export contains a duplicate field.")
			row[tag.name] = ""
		}
		if (stack.length === 1 && tag.name === "anime") {
			if (++rows > IMPORT_MAX_ROWS)
				fail(`That export has more than ${rowLimitLabel} rows.`)
			row = {}
		}
		stack.push(tag.name)
	}
	const close = () => {
		if (stack.length === 2 && stack[1] === "anime") {
			for (const key of Object.keys(row)) row[key] = row[key].trim()
			if (row.series_title) hasTitle = true
			const id = Number(row.series_animedb_id)
			if (ids.has(id))
				fail("The anime export contains a duplicate MyAnimeList id.")
			if (Number.isSafeInteger(id) && id > 0) ids.add(id)
			observations.push(
				...entryObservations(row, rows, IMPORT_MAX_ROWS - observations.length),
			)
		}
		stack.pop()
	}
	boundedXml(text({ name: "animelist.xml", data }), "MyAnimeList", {
		open,
		text: append,
		close,
	})
	if (exportType.trim() === "2")
		fail("Manga lists are not supported. Export your Anime List instead.")
	if (exportType.trim() !== "1")
		fail(
			"Choose a MyAnimeList or Kitsu Anime List export (user_export_type 1).",
		)
	const days = new Map<string, number>()
	for (const observation of observations) {
		const entry = observation.animeEntry
		if (
			observation.kind === "show_status" &&
			entry?.startedAt &&
			entry.startedAt === entry.finishedAt
		) {
			days.set(entry.startedAt, (days.get(entry.startedAt) ?? 0) + 1)
		}
	}
	const largestDay = Math.max(0, ...days.values())
	const kitsu =
		/^kitsu-.+-anime\.xml(?:\.gz)?$/i.test(fileName ?? "") ||
		(rows > 0 && !hasMalIdentity && !hasTitle)
	if (kitsu) {
		for (const observation of observations) {
			if (!observation.animeEntry) continue
			observation.animeEntry.startedAt = null
			observation.animeEntry.finishedAt = null
		}
	}
	return {
		source: "myanimelist",
		observations,
		warnings: [
			...(largestDay >= 100
				? [
						`${largestDay} anime entries share one start and finish day. These may be click or migration dates; you can import without dates.`,
					]
				: []),
			...(kitsu
				? [
						"Kitsu start and finish dates can be completion click times. All Kitsu episode watches are imported undated.",
					]
				: []),
			"Comments and tags are not imported. Rewatch counts do not add watches.",
			"MyAnimeList episode dates are unknown unless a completed entry has matching full start and finish dates, establishing one viewing day. Dates are never spread across episodes.",
			"Season scores are kept for later and not applied as show ratings. Completed parts never mark the whole show Seen; only reported episode progress is imported.",
		].map(importInfo),
	}
}
