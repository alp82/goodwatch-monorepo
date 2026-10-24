// The questions an import asks while it runs (stage 2): which questions confirm defers with `ask`, the options it sends,
// the question screens built from the import's live question counts and its held rows, and what Done lists as left to
// decide. Pure, shared by the general and the IMDb flows.
import type { ImdbImportItem, ImdbImportSummary } from "~/domain/imdb-import"
import type {
	ImportAnswer,
	ImportItem,
	ImportKind,
	ImportOptions,
	ImportQuestion,
	ImportSummary,
} from "~/domain/imports"
import { sourceItemLocation } from "./SourceImportPreviewModel"
import { wholeShowCount } from "./import-flow-model"

/**
 * Watches without a date (T5). The UI asks it, but the server refuses it in `ask` until T5 ships, so confirm leaves it
 * out while this is false.
 */
export const ASK_UNDATED = false

/** The questions confirm can defer today. */
const SUPPORTED: readonly ImportQuestion[] = [
	"conflict",
	"rewatch",
	"wholeShow",
	...(ASK_UNDATED ? (["undated"] as const) : []),
]

/** The order the screens come in and Done lists them: per-title scores first, then the yes/no questions. */
export const QUESTION_ORDER: readonly ImportQuestion[] = [
	"conflict",
	"undated",
	"rewatch",
	"wholeShow",
]

/** One question of a confirmed import: rows held for it, rows its answer is writing, and its whole answer if given. */
export interface LiveQuestion {
	kind: ImportQuestion
	waiting: number
	applying: number
	answer: ImportAnswer | null
}

/** Whether a preview carries its question counts, so its questions come while it runs. Older previews don't. */
export const asksWhileRunning = (summary: Pick<ImportSummary, "questions">) =>
	summary.questions !== undefined

/** The rows a preview question holds among the kinds the member left in. */
const waitingIn = (
	question: NonNullable<ImportSummary["questions"]>[number],
	kinds: readonly ImportKind[],
) =>
	question.byKind
		? kinds.reduce((sum, kind) => sum + (question.byKind?.[kind] ?? 0), 0)
		: question.waiting

/** The questions confirm defers: every one the preview counts rows for, among the kinds left in, that the server takes. */
export function askedQuestions(
	summary: Pick<ImportSummary, "questions">,
	kinds: readonly ImportKind[],
): ImportQuestion[] {
	return (summary.questions ?? [])
		.filter(
			(question) =>
				SUPPORTED.includes(question.kind) && waitingIn(question, kinds) > 0,
		)
		.map((question) => question.kind)
}

/**
 * What confirm sends when the questions come while the import runs. Questions in `ask` keep the placeholders (keep,
 * preserve); a wishlist answer goes along only for a question that isn't asked, so nothing is decided for the member.
 */
export function runOptions(
	summary: ImportSummary,
	kinds: readonly ImportKind[],
	wishlistOnly: boolean,
): ImportOptions {
	const sent: ImportKind[] = wishlistOnly ? ["want"] : [...kinds]
	const ask = askedQuestions(summary, sent)
	return {
		kinds: sent,
		conflictChoice: "keep",
		watchDates: "preserve",
		...(ask.length ? { ask } : {}),
		...(ask.includes("rewatch") ? {} : { wishlistRewatch: false }),
		...(ask.includes("wholeShow") || wholeShowCount(summary) === 0
			? {}
			: { wishlistShows: false }),
	}
}

/** Whether starting with these kinds can change anything: something new, or a question to answer while it runs. */
export const runWouldWrite = (summary: ImportSummary, options: ImportOptions) =>
	options.kinds.length > 0 &&
	(summary.counts.new > 0 || (options.ask?.length ?? 0) > 0)

/** The live questions of a confirmed general import, in screen order. */
export const liveQuestions = (
	summary: Pick<ImportSummary, "status" | "questions">,
): LiveQuestion[] =>
	summary.status === "preview" ? [] : sortQuestions(summary.questions ?? [])

/** The live question of a confirmed IMDb import. IMDb's "use theirs" answer is called `imdb`. */
export const imdbLiveQuestions = (
	summary: Pick<ImdbImportSummary, "status" | "questions">,
): LiveQuestion[] =>
	summary.status === "preview"
		? []
		: (summary.questions ?? []).map((question) => ({
				kind: "conflict",
				waiting: question.waiting,
				applying: question.applying,
				answer:
					question.answer === "imdb" ? "source" : (question.answer ?? null),
			}))

const sortQuestions = (questions: readonly LiveQuestion[]) =>
	[...questions]
		.filter((question) => QUESTION_ORDER.includes(question.kind))
		.sort(
			(a, b) => QUESTION_ORDER.indexOf(a.kind) - QUESTION_ORDER.indexOf(b.kind),
		)
		.map(({ kind, waiting, applying, answer }) => ({
			kind,
			waiting,
			applying,
			answer,
		}))

/* ------------------------------------------------------------------------------------------------------------------ */
/* Held rows                                                                                                          */

/** One row held for a question, as both import APIs list it. */
export interface HeldRow {
	index: number
	/** The title, and for an episode or season score, which one: rows with the same key are one screen. */
	key: string
	/** The title's poster key, `movie:949`. */
	posterKey: string
	title: string
	/** "S1 E3", "Season 2", or null for the whole title. */
	part: string | null
	kind: ImportKind | "unsupported"
	/** The member's score in GoodWatch, and the source's. Null for rows without a score. */
	yours: number | null
	theirs: number | null
}

const titleKey = (mediaType: string | null, tmdbId: number | null) =>
	tmdbId === null ? null : `${mediaType ?? "movie"}:${tmdbId}`

/** A general import's held row. */
export function heldFromItem(item: ImportItem): HeldRow {
	const posterKey = titleKey(item.mediaType, item.tmdbId) ?? `row:${item.index}`
	const part =
		item.kind === "episode_rating" ? sourceItemLocation(item, false) : null
	return {
		index: item.index,
		key: part ? `${posterKey}:${part}` : posterKey,
		posterKey,
		title: item.title,
		part,
		kind: item.kind,
		yours: item.currentScore ?? null,
		theirs: item.score ?? null,
	}
}

/** An IMDb ratings import's held row. Rows without an index can't be answered one by one and are left out. */
export function heldFromImdbItem(item: ImdbImportItem): HeldRow | null {
	if (item.index === undefined) return null
	const posterKey = titleKey(item.mediaType, item.tmdbId) ?? `row:${item.index}`
	const part = item.episode
		? `S${item.episode.season} E${item.episode.number}`
		: null
	return {
		index: item.index,
		key: part ? `${posterKey}:${part}` : posterKey,
		posterKey,
		title: item.title,
		part,
		kind: item.episode ? "episode_rating" : "rating",
		yours: item.currentScore,
		theirs: item.imdbScore,
	}
}

/** One title's held rows: one conflict screen. */
export interface HeldTitle {
	key: string
	posterKey: string
	title: string
	part: string | null
	rows: number[]
	/** The scored row's two scores, when the title has one. */
	yours: number | null
	theirs: number | null
	kinds: (ImportKind | "unsupported")[]
}

const SCORED: (ImportKind | "unsupported")[] = ["rating", "episode_rating"]

/** Held rows by title, in the order the file has them. */
export function groupHeld(rows: readonly HeldRow[]): HeldTitle[] {
	const byKey = new Map<string, HeldTitle>()
	for (const row of rows) {
		const found = byKey.get(row.key)
		const scored =
			SCORED.includes(row.kind) && row.yours !== null && row.theirs !== null
		if (!found) {
			byKey.set(row.key, {
				key: row.key,
				posterKey: row.posterKey,
				title: row.title,
				part: row.part,
				rows: [row.index],
				yours: scored ? row.yours : null,
				theirs: scored ? row.theirs : null,
				kinds: [row.kind],
			})
			continue
		}
		found.rows.push(row.index)
		if (!found.kinds.includes(row.kind)) found.kinds.push(row.kind)
		if (scored && found.yours === null) {
			found.yours = row.yours
			found.theirs = row.theirs
		}
	}
	return [...byKey.values()]
}

/* ------------------------------------------------------------------------------------------------------------------ */
/* Screens                                                                                                            */

/** One question screen: a title whose score differs, or a whole yes/no question. */
export type QuestionScreen =
	| { q: "conflict"; key: string; title: HeldTitle }
	| { q: "undated" | "rewatch" | "wholeShow"; key: string }

/** What the screens are built from: the live questions, the held rows loaded per question, and what was answered. */
export interface ScreenInput {
	questions: readonly LiveQuestion[]
	/** Held rows loaded for a question; undefined while they load (or for undated, which lists none). */
	held: Partial<Record<ImportQuestion, readonly HeldRow[]>>
	/** Screens answered on this visit. Their rows can still show in a list that hasn't caught up. */
	answered: ReadonlySet<string>
}

const open = (question: LiveQuestion | undefined) =>
	!!question && question.waiting > 0 && question.answer === null

/** The screens still waiting on the member, in order. A conflict title shows once its held rows have loaded. */
export function openScreens(input: ScreenInput): QuestionScreen[] {
	const out: QuestionScreen[] = []
	for (const question of input.questions) {
		if (!open(question)) continue
		if (question.kind === "conflict") {
			for (const title of groupHeld(input.held.conflict ?? []))
				if (!input.answered.has(`conflict:${title.key}`))
					out.push({ q: "conflict", key: `conflict:${title.key}`, title })
		} else if (!input.answered.has(question.kind))
			out.push({ q: question.kind, key: question.kind })
	}
	return out
}

/**
 * Conflict screens not built yet: held rows beyond the loaded page, each counted as a title. Exact once every held row
 * is loaded.
 */
export function unloadedConflicts(input: ScreenInput) {
	const question = input.questions.find((item) => item.kind === "conflict")
	if (!open(question) || !question) return 0
	const shown = groupHeld(input.held.conflict ?? []).filter(
		(title) => !input.answered.has(`conflict:${title.key}`),
	)
	const rows = shown.reduce((sum, title) => sum + title.rows.length, 0)
	return Math.max(0, question.waiting - rows)
}

/** Conflict titles still to answer, the shown one included: what "Same answer for all N" counts. */
export const conflictTitlesLeft = (input: ScreenInput) =>
	openScreens(input).filter((screen) => screen.q === "conflict").length +
	unloadedConflicts(input)

/** How many titles a yes/no question covers: distinct titles once its rows are loaded, else its held rows. */
export function questionSize(input: ScreenInput, kind: ImportQuestion) {
	const question = input.questions.find((item) => item.kind === kind)
	if (!question) return 0
	if (kind === "conflict") return conflictTitlesLeft(input)
	const rows = input.held[kind]
	return rows && rows.length >= question.waiting
		? new Set(rows.map((row) => row.posterKey)).size
		: question.waiting
}

/** "Question 3 of 5": the screen's place among those answered on this visit and those still open. */
export function questionCounter(
	input: ScreenInput,
	order: readonly string[],
	key: string,
) {
	const openKeys = openScreens(input).map((screen) => screen.key)
	const all = [...order.filter((item) => !openKeys.includes(item)), ...openKeys]
	return {
		number: all.indexOf(key) + 1,
		of: all.length + unloadedConflicts(input),
	}
}

/** The questions Done lists as left to decide, in order. */
export const leftToDecide = (questions: readonly LiveQuestion[]) =>
	questions.filter(open).map((question) => question.kind)

/** Rows the member's answers are writing now. */
export const applyingCount = (questions: readonly LiveQuestion[]) =>
	questions.reduce((sum, question) => sum + question.applying, 0)

/** Whether every held row of a conflict title is a score, so the copy can say "score". */
export const isScoreTitle = (title: HeldTitle) =>
	title.yours !== null && title.theirs !== null

/** "an 8", "an 11", "a 9": the article as the number is said. */
export const scoreArticle = (score: number) =>
	/^(8|1[18](\D|$))/.test(String(score)) ? "an" : "a"
