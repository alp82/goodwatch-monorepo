// What a member's AI app changed through the MCP server since a moment: the titles it marked as seen, scored or put on
// Want to See, for the Imports page's "Your AI app" source. Read from the stored results of the member's MCP actions
// (user_mcp_action); this file only reads those results, so it can be tested without a database.
//
// Only additions count: a watch logged, a score set, a title put on Want to See. Removals, Not interested and undo
// calls are not an import. A title changed by several calls appears once, with everything that happened to it.

/** One stored MCP action: its ID, when it was claimed, and its result as JSON. */
export interface AiActionRow {
	action_id: string
	created_at: number
	result: string | null
}

export interface AiTitleChange {
	/** "movie:603" or "show:1399". */
	key: string
	mediaType: "movie" | "show"
	tmdbId: number
	name: string
	year: number | null
	seen: boolean
	scored: boolean
	wanted: boolean
}

export interface AiActivity {
	titles: AiTitleChange[]
	counts: { seen: number; scored: number; wanted: number }
	/** Batch calls that changed something, oldest first: what Undo all takes back. */
	batches: string[]
	/** Batch calls taken back completely (a title changed again since keeps its newer value, as designed). */
	undone: string[]
	/** Batch calls whose undo finished but left titles it couldn't take back, or failed. */
	undoIncomplete: string[]
	/** Single-title calls that changed something. Undo all can't take these back; the AI app can. */
	singles: number
	/** When the newest counted call was made, or null. */
	lastChangeAt: number | null
}

type Data = Record<string, unknown>
type Pair = [unknown, unknown]

/** The prefix of the receipt key a batch undo is stored under (writes.server.ts batchUndoKey). */
export const BATCH_UNDO_PREFIX = "batch-undo:"

const isObject = (value: unknown): value is Data =>
	!!value && typeof value === "object" && !Array.isArray(value)

const parse = (raw: string | null): Data | null => {
	if (!raw) return null
	try {
		const value = JSON.parse(raw)
		return isObject(value) ? value : null
	} catch {
		return null
	}
}

const pairAfter = (value: unknown) =>
	Array.isArray(value) && value.length === 2 ? (value as Pair)[1] : undefined

const titleOf = (value: unknown) => {
	if (!isObject(value) || typeof value.id !== "string") return null
	const [mediaType, id] = value.id.split(":")
	const tmdbId = Number(id)
	if (
		(mediaType !== "movie" && mediaType !== "show") ||
		!Number.isFinite(tmdbId)
	)
		return null
	return {
		key: value.id,
		mediaType: mediaType as "movie" | "show",
		tmdbId,
		name: typeof value.name === "string" ? value.name : "",
		year: typeof value.year === "number" ? value.year : null,
	}
}

const startedShow = (status: unknown) =>
	typeof status === "string" && status !== "not_started"

/** One item of a batch result: what it added to the title. */
function batchItem(item: Data) {
	if (item.status !== "done" || !isObject(item.changes)) return null
	const changes = item.changes
	const status = changes.status
	return {
		seen:
			(typeof item.watches_added === "number" && item.watches_added > 0) ||
			(status !== undefined && startedShow(pairAfter(status))),
		scored:
			pairAfter(changes.score) != null || pairAfter(changes.part_score) != null,
		wanted: pairAfter(changes.want_to_see) === true,
	}
}

/** A single-title call's result: what it added, from its before and after. */
function singleCall(result: Data) {
	const before = isObject(result.before) ? result.before : null
	const after = isObject(result.after) ? result.after : null
	const changes = isObject(result.changes) ? result.changes : {}
	if (!before || !after) return null
	// Watches added by this call, except a score's own watch, which an undo can put back.
	const added = Array.isArray(changes.watches_added)
		? changes.watches_added.filter(
				(watch) => !isObject(watch) || watch.origin !== "score",
			).length
		: 0
	return {
		// A show counts as newly seen only when it wasn't started before, so an undo that moves a finished show back to
		// Watching isn't read as an import.
		seen:
			added > 0 || (!startedShow(before.status) && startedShow(after.status)),
		scored:
			(after.score != null && after.score !== before.score) ||
			(after.part_score != null && after.part_score !== before.part_score),
		wanted: before.want_to_see === false && after.want_to_see === true,
	}
}

export function summarizeAiActions(rows: AiActionRow[]): AiActivity {
	const titles = new Map<string, AiTitleChange>()
	const batches: string[] = []
	const undone: string[] = []
	const undoIncomplete: string[] = []
	let singles = 0
	let lastChangeAt: number | null = null
	const add = (
		title: ReturnType<typeof titleOf>,
		kinds: { seen: boolean; scored: boolean; wanted: boolean } | null,
	) => {
		if (!title || !kinds || !(kinds.seen || kinds.scored || kinds.wanted))
			return false
		const known = titles.get(title.key)
		titles.set(title.key, {
			...title,
			seen: kinds.seen || !!known?.seen,
			scored: kinds.scored || !!known?.scored,
			wanted: kinds.wanted || !!known?.wanted,
		})
		return true
	}
	const sorted = [...rows].sort((a, b) => a.created_at - b.created_at)
	for (const row of sorted) {
		if (row.action_id.startsWith(BATCH_UNDO_PREFIX)) {
			const result = parse(row.result)
			if (!result || result.outcome === "indeterminate") continue
			const id = row.action_id.slice(BATCH_UNDO_PREFIX.length)
			const summary = isObject(result.summary) ? result.summary : null
			const complete =
				!!summary &&
				!summary.error &&
				!summary.partly_undone &&
				!summary.not_undoable
			;(complete ? undone : undoIncomplete).push(id)
			continue
		}
		const result = parse(row.result)
		if (!result) continue
		let counted = false
		if (result.batch === true && Array.isArray(result.items)) {
			for (const item of result.items)
				if (isObject(item) && add(titleOf(item.title), batchItem(item)))
					counted = true
			if (counted && typeof result.batch_id === "string")
				batches.push(result.batch_id)
		} else if (result.outcome === "applied" && result.tool !== "undo_watch") {
			counted = add(titleOf(result.title), singleCall(result))
			if (counted) singles++
		}
		if (counted) lastChangeAt = row.created_at
	}
	const list = [...titles.values()]
	return {
		titles: list,
		counts: {
			seen: list.filter((t) => t.seen).length,
			scored: list.filter((t) => t.scored).length,
			wanted: list.filter((t) => t.wanted).length,
		},
		batches,
		undone: undone.filter((id) => batches.includes(id)),
		undoIncomplete: undoIncomplete.filter((id) => batches.includes(id)),
		singles,
		lastChangeAt,
	}
}
