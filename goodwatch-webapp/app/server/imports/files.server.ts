import { inflateRawSync } from "node:zlib"
import {
	IMPORT_MAX_BYTES,
	IMPORT_MAX_ROWS,
	type ImportObservation,
	type ImportSource,
	type ParsedImport,
} from "../../domain/imports.ts"

const MAX_ARCHIVE_FILES = 200
const MAX_ENTRY_BYTES = 32 * 1024 * 1024
const MAX_UNCOMPRESSED_BYTES = 64 * 1024 * 1024

export class ImportFileError extends Error {}

interface ArchiveEntry {
	name: string
	data: Uint8Array
}

function parseCsv(value: string): string[][] {
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
			if (char === '"' && value[index + 1] === '"') {
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
	row.push(field)
	if (row.some((cell) => cell.trim())) rows.push(row)
	return rows
}

function fail(message: string): never {
	throw new ImportFileError(message)
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

function zipEntries(input: Uint8Array): ArchiveEntry[] {
	if (input.byteLength === 0) fail("That file is empty.")
	if (input.byteLength > IMPORT_MAX_BYTES)
		fail("That ZIP file is too large. GoodWatch accepts files up to 20 MB.")
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
	if (count > MAX_ARCHIVE_FILES)
		fail(
			`That ZIP archive has too many files. GoodWatch accepts up to ${MAX_ARCHIVE_FILES}.`,
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
		if (size > MAX_ENTRY_BYTES)
			fail("A file inside that ZIP archive is too large.")
		totalSize += size
		if (totalSize > MAX_UNCOMPRESSED_BYTES)
			fail("That ZIP archive expands to too much data.")
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
		if (ranges.some(([from, to]) => localOffset < to && dataEnd > from))
			fail("That ZIP archive contains overlapping files.")
		ranges.push([localOffset, dataEnd])
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
	return { source: "letterboxd", observations, warnings }
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
	return { source: "trakt", observations, warnings }
}

/** Reads a native Letterboxd or Trakt ZIP entirely in memory. */
export async function parseImportFile(
	source: ImportSource,
	bytes: Uint8Array,
): Promise<ParsedImport> {
	const entries = zipEntries(bytes)
	return source === "letterboxd" ? letterboxd(entries) : trakt(entries)
}
