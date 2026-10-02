// Reads the ratings CSV that IMDb exports. Pure: no database, no catalog.
// The file is not an official contract, so columns are found by header name and anything unexpected is reported
// per row instead of failing the whole file. See docs/research/imdb-ratings-import.md.

export type ImportMediaType = "movie" | "show"

/** A rejected request, with the HTTP status to answer and a message written for the member. */
export class ImdbImportError extends Error {
	constructor(
		readonly status: 400 | 404 | 409 | 413 | 503,
		message: string,
	) {
		super(message)
	}
}

/** The most data rows one file may hold. A 10 MB export holds about this many. */
export const MAX_ROWS = 50_000

/** One data row of the file, read but not yet matched against the catalog. */
export interface FileRow {
	/** Position among the data rows, from 0. */
	index: number
	/** `tt…`, or whatever the row holds when it isn't one. */
	imdbId: string
	title: string
	year: number | null
	/** The `Title Type` label as written in the file. */
	titleType: string
	/** `Your Rating` as written in the file. */
	rawRating: string
	/** The member's rating, 1 to 10, or null when the row has none. */
	score: number | null
	dateRated: string | null
	/** Where to look the title up, or null when the row can't be imported. */
	mediaType: ImportMediaType | null
	/** Why the row can't be imported. Null for a row that goes on to matching. */
	problem: { outcome: "invalid" | "unsupported"; reason: string } | null
}

/**
 * Splits CSV text into rows of fields. Quoted fields may hold commas, line breaks and doubled quotes.
 * Lenient: a quote inside an unquoted field is kept as is, and an unclosed quote runs to the end of the text.
 */
export function parseCsv(text: string): string[][] {
	const rows: string[][] = []
	const length = text.length
	let i = text.charCodeAt(0) === 0xfeff ? 1 : 0
	let row: string[] = []
	while (i < length) {
		let field: string
		if (text[i] === '"') {
			field = ""
			i++
			for (;;) {
				const close = text.indexOf('"', i)
				if (close === -1) {
					field += text.slice(i)
					i = length
					break
				}
				field += text.slice(i, close)
				if (text[close + 1] === '"') {
					field += '"'
					i = close + 2
					continue
				}
				i = close + 1
				break
			}
			// Anything between the closing quote and the next separator belongs to the field.
			const from = i
			while (i < length && text[i] !== "," && text[i] !== "\n" && text[i] !== "\r") i++
			field += text.slice(from, i)
		} else {
			const from = i
			while (i < length && text[i] !== "," && text[i] !== "\n" && text[i] !== "\r") i++
			field = text.slice(from, i)
		}
		row.push(field)
		if (i >= length) break
		if (text[i] === ",") {
			i++
			// A trailing comma ends the row with an empty field.
			if (i >= length) row.push("")
			continue
		}
		if (text[i] === "\r" && text[i + 1] === "\n") i++
		i++
		rows.push(row)
		row = []
	}
	if (row.length) rows.push(row)
	// Blank lines aren't rows.
	return rows.filter((fields) => fields.length > 1 || fields[0].trim() !== "")
}

const MOVIE_TYPES = new Set(["movie", "tvmovie", "video", "tvspecial"])
const SHOW_TYPES = new Set(["tvseries", "tvminiseries"])
const UNSUPPORTED_TYPES = new Set([
	"tvepisode",
	"short",
	"tvshort",
	"videogame",
	"musicvideo",
	"podcastseries",
	"podcastepisode",
])

/** "TV Mini Series", "tvMiniSeries" and "TV Mini-Series" are the same type. */
const normalizeType = (label: string) => label.toLowerCase().replace(/[^a-z]/g, "")

const clip = (value: string | undefined, max: number) => (value ?? "").trim().slice(0, max)

const NOT_A_RATINGS_EXPORT =
	"This doesn't look like an IMDb ratings export. Export your ratings from the Your ratings page on IMDb and choose that file. A watchlist or list export has no ratings in it."

/** Reads the file into rows, or rejects it when it isn't a ratings export at all. */
export function readRatingsFile(text: string): FileRow[] {
	const table = parseCsv(text)
	if (!table.length) throw new ImdbImportError(400, "That file is empty.")

	const header = table[0].map((name) => name.trim().toLowerCase())
	const column = (name: string) => header.indexOf(name)
	const at = {
		id: column("const"),
		rating: column("your rating"),
		type: column("title type"),
		title: column("title"),
		originalTitle: column("original title"),
		year: column("year"),
		dateRated: column("date rated"),
	}
	if (at.id < 0 || at.rating < 0 || at.type < 0) throw new ImdbImportError(400, NOT_A_RATINGS_EXPORT)

	const data = table.slice(1)
	if (!data.length) throw new ImdbImportError(400, "That file has no ratings in it.")
	if (data.length > MAX_ROWS)
		throw new ImdbImportError(
			413,
			`That file has ${data.length.toLocaleString("en-US")} rows. GoodWatch imports up to ${MAX_ROWS.toLocaleString("en-US")} at a time.`,
		)

	return data.map((fields, index): FileRow => {
		const get = (position: number, max: number) => (position < 0 ? "" : clip(fields[position], max))
		const imdbId = get(at.id, 40)
		const titleType = get(at.type, 60)
		const rawRating = get(at.rating, 20)
		const year = Number(get(at.year, 10))
		const dateRated = get(at.dateRated, 20)
		// "7" and "7.0" are both seven. The public average in `IMDb Rating` is never read.
		const whole = /^(\d{1,2})(\.0+)?$/.exec(rawRating)
		const score = whole && Number(whole[1]) >= 1 && Number(whole[1]) <= 10 ? Number(whole[1]) : null
		const type = normalizeType(titleType)
		const mediaType = MOVIE_TYPES.has(type) ? "movie" : SHOW_TYPES.has(type) ? "show" : null

		let problem: FileRow["problem"] = null
		if (!imdbId) problem = { outcome: "invalid", reason: "The row has no IMDb ID." }
		else if (!/^tt\d+$/.test(imdbId)) problem = { outcome: "invalid", reason: "The IMDb ID isn't a title ID like tt0133093." }
		else if (!mediaType)
			problem = {
				outcome: "unsupported",
				reason: !titleType
					? "The row has no title type."
					: UNSUPPORTED_TYPES.has(type)
						? `GoodWatch rates movies and shows, not titles of the type "${titleType}".`
						: `GoodWatch doesn't know the title type "${titleType}".`,
			}
		else if (score === null)
			problem = {
				outcome: "invalid",
				reason: rawRating ? "The rating isn't a whole number from 1 to 10." : "The row has no rating.",
			}

		return {
			index,
			imdbId,
			title: get(at.title, 300) || get(at.originalTitle, 300),
			year: Number.isInteger(year) && year > 1800 && year < 2200 ? year : null,
			titleType,
			rawRating,
			score,
			dateRated: /^\d{4}-\d{2}-\d{2}$/.test(dateRated) ? dateRated : null,
			mediaType: problem ? null : mediaType,
			problem,
		}
	})
}

/** One CSV line. Cells a spreadsheet would run as a formula are written as text. */
export function csvLine(cells: (string | number | null)[]): string {
	return cells
		.map((cell) => {
			let value = cell === null ? "" : String(cell)
			if (/^[=+\-@\t\r]/.test(value) && typeof cell === "string") value = `'${value}`
			return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
		})
		.join(",")
}
