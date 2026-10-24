// Batches of MCP title writes: up to MAX_BATCH_ITEMS titles in one call of rate_title, set_want_to_see,
// set_not_interested, set_show_status or log_watch, and undo_watch with batch_id to take a whole call back.
//
// - Every item is validated, resolved and written on its own. A not found, ambiguous or invalid item writes
//   nothing; the others still go ahead. Each item reports what it did, from the rows read back after the writes.
// - The member's data is read once before and once after, not twice per title. Wishlist and Not interested
//   changes go out as multi-row statements. Ratings, watches and show states go through the site's own writers,
//   one title at a time, since each settles the title's tracking rows; the member-wide refresh their writers
//   end with is held back to one at the end of the call.
// - The call's action_id is its batch_id. The result is stored as the action's receipt, which undo reads back by
//   the calling member and that ID only.
import * as z from "zod4"
import type { UserData } from "../../types/user-data"
import { canonicalTitleId } from "../../utils/title-identity.ts"
import type { CatalogTitle } from "./data.server.ts"
import type { PartTarget, Snapshot, TitleWrite } from "./title-write.server.ts"
import type { ReadArgs } from "./tools.server.ts"
import type { WriteToolName } from "./write-names.ts"
import type { WriteArgs } from "./write-tools.server.ts"

export const MAX_BATCH_ITEMS = 50
/** The page where a member imports a whole history from a file. */
export const IMPORT_PATH = "/settings/imports"
export const BATCH_TOOLS = [
	"rate_title",
	"set_want_to_see",
	"set_not_interested",
	"set_show_status",
	"log_watch",
] as const
export type BatchToolName = (typeof BATCH_TOOLS)[number]
export const isBatchTool = (name: string): name is BatchToolName =>
	(BATCH_TOOLS as readonly string[]).includes(name)
export const splitMessage = (origin: string) =>
	`At most ${MAX_BATCH_ITEMS} items per call. Split the list into calls of ${MAX_BATCH_ITEMS} or fewer. For a whole history (hundreds of titles or more), the member can use the file import: ${new URL(IMPORT_PATH, origin).href}`
/** Ambiguous items list this many catalog matches, so 50 of them stay readable. */
const CANDIDATES = 5

type Data = Record<string, unknown>
type Resolved =
	| { title: CatalogTitle }
	| { result: { status?: unknown; choices?: unknown; more?: unknown } }
type Summary = ReturnType<Ports["summary"]>

export interface Ports {
	/** A title by ID, or by name and optional year as search_titles finds it. A batch passes only names. */
	resolve(selector: ReadArgs, origin: string): Promise<Resolved>
	/** Catalog titles by canonical key ("movie:603"), at most 60 per call; missing keys are absent. */
	titlesById(
		keys: { media_type: "movie" | "show"; tmdb_id: number }[],
	): Promise<Map<string, CatalogTitle>>
	userData(userId: string): Promise<UserData>
	/** With a part, the snapshot also has that part's score as `part_score`. */
	snapshot(
		userId: string,
		title: CatalogTitle,
		user?: UserData,
		part?: PartTarget | null,
	): Promise<Snapshot>
	applyTitleWrite(
		userId: string,
		origin: string,
		name: WriteToolName,
		args: WriteArgs,
		title: CatalogTitle,
		before: Snapshot,
		actionId: string,
	): Promise<TitleWrite>
	wishlistMany(input: {
		user_id: string
		titles: { tmdb_id: number; media_type: "movie" | "show"; addedAt?: Date }[]
		action: "add" | "remove"
	}): Promise<unknown>
	notInterestedMany(input: {
		user_id: string
		titles: { tmdb_id: number; media_type: "movie" | "show" }[]
		action: "add" | "remove"
	}): Promise<unknown>
	/** Runs `work` with member data resets held back to one at its end. */
	deferResets<T>(work: () => Promise<T>): Promise<T>
	resetUserData(userId: string): Promise<unknown>
	markTasteChanged(userId: string): Promise<void>
	summary(
		title: CatalogTitle,
		origin: string,
	): {
		id: string
		name: string
		year: number | null
		url: string
		link: string
	}
	/** The stored result of one of this member's own actions, or null. Never another member's. */
	readReceipt(userId: string, actionId: string): Promise<Data | null>
	updateScores(input: {
		user_id: string
		tmdb_id: number
		media_type: "movie" | "show"
		score: number | null
		review?: string
	}): Promise<unknown>
	/**
	 * Puts a season or episode score back (#759), only while it is still what the batch's write left (`expected`):
	 * "changed" when it was changed since, and then nothing is written. Throws when the part can't be found.
	 */
	restorePartScore(input: {
		user_id: string
		tmdb_id: number
		/** The part's key in user_episode_score: the same episode even after TMDB renumbers it. */
		key: string
		expected: { score: number; updatedAt: string }
		score: number | null
	}): Promise<"restored" | "changed" | "already">
	deleteMovieWatch(
		userId: string,
		movieId: number,
		watchId: string,
	): Promise<{ status: string; refused: string | null }>
	showEvent(
		userId: string,
		showId: number,
		event:
			| { type: "undoGroup"; group: string }
			| { type: "deleteWatch"; watchId: string }
			| { type: "resume" }
			| { type: "hold" }
			| { type: "drop" },
	): Promise<{ status: string; refused: string | null }>
}

/** The single-call schema of each tool: every item, with the top-level fields filled in, has to pass it. */
export type ItemSchemas = Record<BatchToolName, z.ZodType<WriteArgs>>

async function mapPool<T, R>(
	items: readonly T[],
	limit: number,
	work: (item: T) => Promise<R>,
): Promise<R[]> {
	const results: R[] = new Array(items.length)
	let next = 0
	await Promise.all(
		Array.from({ length: Math.min(limit, items.length) }, async () => {
			while (next < items.length) {
				const index = next++
				results[index] = await work(items[index])
			}
		}),
	)
	return results
}

const MARKS = [
	"score",
	"part_score",
	"want_to_see",
	"not_interested",
	"status",
	"pass",
	"watch_count",
] as const
type Mark = (typeof MARKS)[number]
const markOf = (s: Snapshot, key: Mark) =>
	key === "watch_count"
		? s.watches.length
		: key === "part_score"
			? (s as { part_score?: number | null }).part_score
			: s[key]
/** The part a rate_title item scores, from its arguments. */
const partArgs = (name: BatchToolName, args: WriteArgs): PartTarget | null =>
	name === "rate_title" && args.season !== undefined
		? {
				season: args.season,
				...(args.episode !== undefined ? { episode: args.episode } : {}),
			}
		: null
const partText = (part: PartTarget) =>
	part.episode === undefined
		? `Season ${part.season}`
		: `S${part.season} E${part.episode}`
/** What differs between two reads of a title, as [before, after] per mark: all a result needs, and all undo uses. */
function changesOf(before: Snapshot, after: Snapshot) {
	const changes: Partial<Record<Mark, [unknown, unknown]>> = {}
	for (const key of MARKS) {
		const was = markOf(before, key)
		const now = markOf(after, key)
		if (was !== now) changes[key] = [was, now]
	}
	return changes
}
const selectorOf = (item: ReadArgs) =>
	Object.fromEntries(
		(["title_id", "title_name", "year"] as const)
			.filter((key) => item[key] !== undefined)
			.map((key) => [key, item[key]]),
	)
const titleKey = (title: CatalogTitle) =>
	`${title.media_type}:${canonicalTitleId(title.media_type, title.tmdb_id)}`

interface Row {
	index: number
	requested: Record<string, unknown>
	args?: WriteArgs
	actionId: string
	title?: CatalogTitle
	status?: "done" | "already_set" | "not_found" | "ambiguous" | "error"
	message?: string
	candidates?: unknown[]
	more_candidates?: boolean
	before?: Snapshot
	write?: TitleWrite | "bulk" | "skipped" | "failed"
}

/** Whether the item asks for what the title already has, so it is reported without a write. */
function alreadySet(name: BatchToolName, args: WriteArgs, before: Snapshot) {
	if (name === "rate_title")
		return partArgs(name, args)
			? (before as { part_score?: number | null }).part_score === args.score
			: before.score === args.score
	if (name === "set_want_to_see") return before.want_to_see === args.want_to_see
	if (name === "set_not_interested")
		return before.not_interested === args.not_interested
	return false
}

/** Two items of one call may not change the same thing: a title once, or for log_watch one episode range once. */
function dedupeKey(name: BatchToolName, args: WriteArgs, title: CatalogTitle) {
	const key = titleKey(title)
	const part = partArgs(name, args)
	return name === "log_watch"
		? `${key}|${args.season ?? ""}|${args.episode ?? ""}|${args.episode_end ?? ""}|${args.whole_season ? "season" : ""}|${args.date ?? ""}`
		: part
			? `${key}|part|${part.season}|${part.episode ?? ""}`
			: key
}

function watchChanges(
	name: BatchToolName,
	before: Snapshot,
	after: Snapshot,
	actionId: string,
) {
	return {
		added: after.watches.filter(
			(watch) =>
				!before.watches.some((old) => old.id === watch.id) &&
				(name === "log_watch"
					? watch.id === actionId || watch.group_id === actionId
					: name === "set_show_status"
						? watch.group_id === actionId
						: name === "rate_title" && watch.origin === "score"),
		),
		removed: before.watches.filter(
			(watch) =>
				!after.watches.some((next) => next.id === watch.id) &&
				(name === "log_watch" || name === "rate_title") &&
				watch.origin === "score",
		),
	}
}

/**
 * Writes every item of one batch call and answers with a result per item and a summary. Runs inside the call's
 * action receipt, so a retry with the same action_id replays this answer instead of writing again.
 */
export async function runBatch(
	ports: Ports,
	schemas: ItemSchemas,
	userId: string,
	origin: string,
	name: BatchToolName,
	args: WriteArgs,
	itemActionId: (index: number) => string,
): Promise<Data> {
	const items = args.items ?? []
	if (items.length > MAX_BATCH_ITEMS)
		return { outcome: "refused", message: splitMessage(origin) }
	if (!items.length)
		return { outcome: "refused", message: "The items list is empty." }
	const { items: _items, action_id, ...defaults } = args
	const rows: Row[] = items.map((item, index) => {
		const row: Row = {
			index,
			requested: selectorOf(item),
			actionId: itemActionId(index),
		}
		const parsed = schemas[name].safeParse({ ...defaults, ...item, action_id })
		if (parsed.success) {
			const { title_name: _n, year: _y, ...byId } = parsed.data
			row.args = parsed.data.title_id ? byId : parsed.data
		} else {
			row.status = "error"
			row.message = parsed.error.issues.map((issue) => issue.message).join("; ")
		}
		return row
	})

	// Resolve: IDs in one catalog read per 60, names one by one as search_titles finds them.
	const byId = rows.filter((row) => row.args?.title_id)
	const keys = byId.map((row) => {
		const [type, raw] = String(row.args?.title_id).split(":")
		const media_type = type === "show" ? ("show" as const) : ("movie" as const)
		return { media_type, tmdb_id: canonicalTitleId(media_type, Number(raw)) }
	})
	const found = new Map<string, CatalogTitle>()
	for (let start = 0; start < keys.length; start += 60)
		for (const [key, title] of await ports.titlesById(
			keys.slice(start, start + 60),
		))
			found.set(key, title)
	byId.forEach((row, i) => {
		const title = found.get(`${keys[i].media_type}:${keys[i].tmdb_id}`)
		if (title) row.title = title
		else {
			row.status = "not_found"
			row.message = "No catalog title has this ID."
		}
	})
	await mapPool(
		rows.filter((row) => row.args && !row.args.title_id),
		4,
		async (row) => {
			const resolved = await ports.resolve(
				{ title_name: row.args?.title_name, year: row.args?.year },
				origin,
			)
			if ("title" in resolved) {
				row.title = resolved.title
				return
			}
			const choices = Array.isArray(resolved.result.choices)
				? resolved.result.choices
				: []
			if (resolved.result.status === "ambiguous_title" && choices.length) {
				row.status = "ambiguous"
				row.message =
					"Several catalog titles match. Nothing was written; retry this item with one title_id."
				row.candidates = choices.slice(0, CANDIDATES)
				row.more_candidates =
					choices.length > CANDIDATES || resolved.result.more === true
			} else {
				row.status = "not_found"
				row.message = "No matching catalog title. Nothing was written."
			}
		},
	)

	const seen = new Map<string, number>()
	for (const row of rows) {
		if (!row.title || !row.args || row.status) continue
		const key = dedupeKey(name, row.args, row.title)
		const first = seen.get(key)
		if (first === undefined) seen.set(key, row.index)
		else {
			row.status = "error"
			row.message = `Item ${first} already changes this title in this call. Nothing was written for this item.`
		}
	}

	const live = rows.filter(
		(row): row is Row & { title: CatalogTitle; args: WriteArgs } =>
			Boolean(row.title && row.args && !row.status),
	)
	const before = await ports.userData(userId)
	await mapPool(live, 5, async (row) => {
		row.before = await ports.snapshot(
			userId,
			row.title,
			before,
			partArgs(name, row.args),
		)
	})

	for (const row of live) {
		const snap = row.before as Snapshot
		if (alreadySet(name, row.args, snap)) row.write = "skipped"
		else if (
			name === "set_not_interested" &&
			row.args.not_interested &&
			(snap.score !== null ||
				snap.watches.length > 0 ||
				(row.title.media_type === "show" && snap.status !== "not_started"))
		)
			row.write = {
				refused:
					"Not interested is only available before watching or rating this title. Use Dropped for a started show.",
			}
	}
	const pending = live.filter((row) => row.write === undefined)
	await ports.deferResets(async () => {
		const bulk = async (
			group: typeof pending,
			write: (
				titles: { tmdb_id: number; media_type: "movie" | "show" }[],
			) => Promise<unknown>,
		) => {
			if (!group.length) return
			try {
				await write(
					group.map((row) => ({
						tmdb_id: row.title.tmdb_id,
						media_type: row.title.media_type,
					})),
				)
				for (const row of group) row.write = "bulk"
			} catch {
				for (const row of group) row.write = "failed"
			}
		}
		if (name === "set_want_to_see") {
			// A show's Want to See (or Want to rewatch) goes through its tracking first, as on the site.
			await bulk(
				pending.filter(
					(row) => row.args.want_to_see && row.title.media_type === "movie",
				),
				(titles) =>
					ports.wishlistMany({ user_id: userId, titles, action: "add" }),
			)
			await bulk(
				pending.filter((row) => !row.args.want_to_see),
				(titles) =>
					ports.wishlistMany({ user_id: userId, titles, action: "remove" }),
			)
		}
		if (name === "set_not_interested")
			for (const on of [true, false])
				await bulk(
					pending.filter((row) => row.args.not_interested === on),
					(titles) =>
						ports.notInterestedMany({
							user_id: userId,
							titles,
							action: on ? "add" : "remove",
						}),
				)
		// One title at a time: each settles that title's tracking rows, and two at once would only contend.
		for (const row of pending) {
			if (row.write !== undefined) continue
			try {
				row.write = await ports.applyTitleWrite(
					userId,
					origin,
					name,
					row.args,
					row.title,
					row.before as Snapshot,
					row.actionId,
				)
			} catch {
				row.write = "failed"
			}
		}
		// The deferred scope turns this into the one real reset at its end, before the read-back below.
		if (pending.length) await ports.resetUserData(userId)
	})
	// Season and episode scores change nothing taste reads.
	if (pending.some((row) => !partArgs(name, row.args)))
		await ports.markTasteChanged(userId)

	// Without the shared read, each title reads the member data itself: the items still report what landed.
	const after = pending.length
		? await ports.userData(userId).catch(() => undefined)
		: before
	const results = await mapPool(rows, 5, async (row) => {
		const base: Data = {
			index: row.index,
			...(row.title
				? { title: ports.summary(row.title, origin) }
				: { requested: row.requested }),
		}
		if (row.status)
			return {
				...base,
				status: row.status,
				message: row.message,
				...(row.candidates
					? { candidates: row.candidates, more_candidates: row.more_candidates }
					: {}),
			}
		const title = row.title as CatalogTitle
		const was = row.before as Snapshot
		if (row.write === "skipped") return { ...base, status: "already_set" }
		if (row.write && typeof row.write === "object" && "refused" in row.write)
			return {
				...base,
				status: "error",
				message:
					row.write.refused ?? "This change was refused. Nothing was written.",
			}
		const part = row.args ? partArgs(name, row.args) : null
		const now = await ports
			.snapshot(userId, title, after, part)
			.catch(() => null)
		const unconfirmed = {
			...base,
			status: "error",
			message:
				"Could not confirm this item's outcome. Read the title before retrying it with a new action_id.",
		}
		if (!now) return unconfirmed
		const watches = watchChanges(name, was, now, row.actionId)
		const all = changesOf(was, now)
		// What this item's own part write left. The read-back may already show another page's later change, which
		// isn't this batch's to report or to undo (#759 review).
		const written =
			typeof row.write === "object" && "part_written" in row.write
				? row.write.part_written
				: undefined
		const before = (was as { part_score?: number | null }).part_score ?? null
		// A part score item owns only its part: another item of the call may score the same show as a whole.
		const changes = part
			? written
				? before !== written.score
					? { part_score: [before, written.score] as [unknown, unknown] }
					: {}
				: all.part_score
					? { part_score: all.part_score }
					: {}
			: all
		const landed =
			Object.keys(changes).length > 0 ||
			watches.added.length > 0 ||
			watches.removed.length > 0
		if (!landed)
			return row.write === "failed"
				? unconfirmed
				: { ...base, status: "already_set" }
		const event =
			typeof row.write === "object" && "event" in row.write
				? row.write.event
				: null
		const group = watches.added.some((w) => w.group_id === row.actionId)
		// A movie's score watch goes with its score, but an episode's (#759 follow-up) is removed by id, and only the
		// one this item's own write says it recorded.
		const scoreWatch =
			typeof row.write === "object" && "watch_added" in row.write
				? row.write.watch_added
				: undefined
		const watchIds = watches.added
			.filter(
				(w) =>
					w.group_id !== row.actionId &&
					(w.origin !== "score" || w.id === scoreWatch),
			)
			.map((w) => w.id)
		return {
			...base,
			status: "done",
			// The write failed part way, but these changes landed: they are reported, and undo can take them back.
			...(row.write === "failed"
				? {
						message:
							"The write failed part way; these changes landed. Read the title before retrying it.",
					}
				: {}),
			changes,
			// Undo puts this part's score back, by its key, while it is still what `part_written` says. A clear, or a
			// write that wasn't confirmed, leaves nothing to recognize it by: Undo isn't offered, and the result says so.
			...(part
				? {
						part: partText(part),
						part_target: part,
						...(written?.score != null && written.updatedAt
							? { part_written: written }
							: changes.part_score
								? {
										undo_note: written
											? "Undo can't put back a cleared season or episode score."
											: "This score's write wasn't confirmed, so Undo can't put back the earlier score.",
									}
								: {}),
					}
				: {}),
			// Undo puts a removed Wishlist entry back in its old place.
			...(changes.want_to_see && was.want_to_see
				? { want_to_see_added_at: was.want_to_see_added_at }
				: {}),
			...(watches.added.length ? { watches_added: watches.added.length } : {}),
			...(watches.removed.length
				? { watches_removed: watches.removed.length }
				: {}),
			...(group || watchIds.length || event
				? {
						undo: {
							...(group ? { group: row.actionId } : {}),
							...(watchIds.length ? { watch_ids: watchIds } : {}),
							...(event ? { event } : {}),
						},
					}
				: {}),
		}
	})
	const count = (status: string) =>
		results.filter((item) => item.status === status).length
	const summary = {
		total: rows.length,
		done: count("done"),
		already_set: count("already_set"),
		not_found: count("not_found"),
		ambiguous: count("ambiguous"),
		error: count("error"),
	}
	const unresolved = summary.not_found + summary.ambiguous + summary.error
	return {
		outcome: summary.done
			? "applied"
			: unresolved
				? "not_applied"
				: "unchanged",
		action_id,
		batch: true,
		batch_id: action_id,
		tool: name,
		summary,
		message: [
			`${summary.done} done, ${summary.already_set} already set, ${summary.not_found} not found, ${summary.ambiguous} ambiguous, ${summary.error} with errors.`,
			summary.ambiguous
				? "Retry ambiguous items with one of their candidates' title_id, in a call with a new action_id."
				: "",
			summary.done
				? `To take back this call's changes, use undo_watch with batch_id "${action_id}".`
				: "",
			results.some((item) => "undo_note" in item)
				? "A cleared season or episode score, or a write that wasn't confirmed, can't be taken back; those items say so."
				: "",
		]
			.filter(Boolean)
			.join(" "),
		items: results,
	}
}

const markValue = z.union([z.number(), z.string(), z.boolean(), z.null()])
const receiptItem = z.object({
	index: z.number(),
	status: z.string(),
	title: z
		.object({
			id: z.string().regex(/^(movie|show):[1-9]\d{0,9}$/),
			name: z.string(),
			year: z.number().nullable(),
		})
		.optional(),
	changes: z
		.partialRecord(z.enum(MARKS), z.tuple([markValue, markValue]))
		.optional(),
	want_to_see_added_at: z.unknown().optional(),
	part_target: z
		.object({
			season: z.number().int().min(1),
			episode: z.number().int().min(1).optional(),
		})
		.optional(),
	part_written: z
		.object({
			key: z.string().regex(/^(s|e)\d{1,10}$/),
			score: z.number().int().min(1).max(10),
			updatedAt: z.string().max(40),
		})
		.optional(),
	undo: z
		.object({
			group: z.string().max(100).optional(),
			watch_ids: z.array(z.string().max(100)).max(1000).optional(),
			event: z.string().max(40).optional(),
		})
		.optional(),
})
const receiptSchema = z.object({
	batch: z.literal(true),
	tool: z.enum(BATCH_TOOLS),
	items: z.array(receiptItem).max(MAX_BATCH_ITEMS),
})

/**
 * undo_watch with batch_id: takes back what each done item of one of the member's own batch calls changed, through
 * the site's own undo writers. A field the member changed again since the batch is left as it is and reported.
 */
export async function undoBatch(
	ports: Ports,
	userId: string,
	origin: string,
	args: WriteArgs & { batch_id: string },
): Promise<Data> {
	const stored = await ports.readReceipt(userId, args.batch_id)
	if (!stored)
		return {
			outcome: "refused",
			message:
				"No batch with this batch_id in your history. Use the batch_id of a batch result.",
		}
	if (stored.outcome === "indeterminate")
		return {
			outcome: "refused",
			message:
				"That batch has no recorded outcome yet. Read the titles before undoing them one by one.",
		}
	const parsed = receiptSchema.safeParse(stored)
	if (!parsed.success)
		return {
			outcome: "refused",
			message:
				"This action ID is not a batch of title writes. Undo a single change with undo_watch and a title, or call the tool again with the previous value.",
		}
	const tool = parsed.data.tool
	type DoneItem = z.infer<typeof receiptItem> & {
		title: NonNullable<z.infer<typeof receiptItem>["title"]>
	}
	const done = parsed.data.items.filter(
		(item): item is DoneItem =>
			item.status === "done" && item.title !== undefined,
	)
	const titleOf = (
		id: string,
		name: string,
		year: number | null,
	): CatalogTitle => {
		const [type, raw] = id.split(":")
		const media_type = type === "show" ? ("show" as const) : ("movie" as const)
		return {
			media_type,
			tmdb_id: canonicalTitleId(media_type, Number(raw)),
			title: name,
			release_year: year,
		}
	}
	const user = await ports.userData(userId)
	const rows = await mapPool(done, 5, async (item) => {
		const title = titleOf(item.title.id, item.title.name, item.title.year)
		return {
			item,
			title,
			current: await ports.snapshot(userId, title, user, item.part_target),
		}
	})
	const outcomes = new Map<
		number,
		{
			skipped: string[]
			failed: boolean
			notes: string[]
			/** A part score Undo put back: [what the batch left, what it is now]. */
			part?: [unknown, unknown]
		}
	>()
	let wrote = false
	let tasteWrite = false
	await ports.deferResets(async () => {
		for (const { item, title, current } of rows) {
			const changes = item.changes ?? {}
			const removed = new Set<string>()
			const result: {
				skipped: string[]
				failed: boolean
				notes: string[]
				part?: [unknown, unknown]
			} = { skipped: [], failed: false, notes: [] }
			outcomes.set(item.index, result)
			// What to do with one mark the batch changed: nothing, put it back, or keep the member's newer value.
			const field = (
				key:
					| "score"
					| "part_score"
					| "want_to_see"
					| "not_interested"
					| "status",
			) => {
				const change = changes[key]
				if (!change) return "same"
				const now = markOf(current, key)
				return now === change[0]
					? "same"
					: now === change[1]
						? "revert"
						: "changed"
			}
			const was = (key: Mark) => changes[key]?.[0]
			try {
				// 1. Watches the item added, through the native undo of their group or watch.
				const undo = item.undo
				if (
					undo?.group &&
					current.watches.some((w) => w.group_id === undo.group)
				) {
					wrote = tasteWrite = true
					const answer = await ports.showEvent(userId, title.tmdb_id, {
						type: "undoGroup",
						group: undo.group,
					})
					if (answer.status !== "applied")
						result.notes.push(answer.refused ?? "Could not remove its watches.")
					else
						for (const w of current.watches)
							if (w.group_id === undo.group) removed.add(w.id)
				}
				for (const watchId of undo?.watch_ids ?? []) {
					const watch = current.watches.find((w) => w.id === watchId)
					if (!watch) continue
					// An episode score's watch that the member dated since is theirs now, as on the site.
					if (watchId.startsWith("score-") && watch.origin !== "score") {
						result.skipped.push("watch")
						continue
					}
					wrote = tasteWrite = true
					const answer =
						title.media_type === "movie"
							? await ports.deleteMovieWatch(userId, title.tmdb_id, watchId)
							: await ports.showEvent(userId, title.tmdb_id, {
									type: "deleteWatch",
									watchId,
								})
					if (answer.status !== "applied")
						result.notes.push(answer.refused ?? "Could not remove a watch.")
					else removed.add(watchId)
				}
				// 2. A show state change that made no watches: its native opposite.
				if (
					undo?.event &&
					["hold", "drop", "resume", "watchAgain"].includes(undo.event)
				) {
					const state = field("status")
					if (undo.event === "watchAgain")
						result.notes.push(
							"Watching again can't be taken back here; set the show status yourself.",
						)
					else if (state === "revert") {
						wrote = tasteWrite = true
						const answer = await ports.showEvent(userId, title.tmdb_id, {
							type:
								undo.event === "resume"
									? was("status") === "dropped"
										? "drop"
										: "hold"
									: "resume",
						})
						if (answer.status !== "applied")
							result.notes.push(
								answer.refused ?? "Could not restore the show status.",
							)
					} else if (state === "changed") result.skipped.push("status")
				}
				// 3. A season or episode score (#759), apart from the title's score.
				// Only while the part is still exactly what the batch's write left, by its key, checked and written in one
				// optimistic step: a change made elsewhere since, even the same score set again, stays (#759 review).
				const partChange = changes.part_score
				if (partChange && item.part_target) {
					const oldPart = partChange[0]
					if (!item.part_written)
						result.notes.push(
							partChange[1] === null
								? "Undo can't put back a cleared season or episode score. Set it again with rate_title."
								: "This score's write wasn't confirmed, so Undo can't tell it from a later change. Set it again with rate_title.",
						)
					else if (
						oldPart === null ||
						(typeof oldPart === "number" &&
							Number.isInteger(oldPart) &&
							oldPart >= 1 &&
							oldPart <= 10)
					) {
						const restored = await ports.restorePartScore({
							user_id: userId,
							tmdb_id: title.tmdb_id,
							key: item.part_written.key,
							expected: item.part_written,
							score: oldPart,
						})
						if (restored === "restored") {
							wrote = true
							result.part = [item.part_written.score, oldPart]
						} else if (restored === "changed") result.skipped.push("part_score")
					}
				}
				// 3. The score.
				const score = field("score")
				const oldScore = was("score")
				if (
					score === "revert" &&
					(oldScore === null ||
						(typeof oldScore === "number" &&
							Number.isInteger(oldScore) &&
							oldScore >= 1 &&
							oldScore <= 10))
				) {
					wrote = tasteWrite = true
					await ports.updateScores({
						user_id: userId,
						tmdb_id: title.tmdb_id,
						media_type: title.media_type,
						score: oldScore,
						review: current.review ?? undefined,
					})
				} else if (score === "changed") result.skipped.push("score")
				// 4. Not interested before Want to See: putting a title on the Wishlist clears Not interested.
				// Put back only where the single tool would allow it: unrated, unwatched, and a show still Not started.
				const hidden = field("not_interested")
				const scoreAfter = score === "revert" ? oldScore : current.score
				const statusAfter =
					field("status") === "revert" ? was("status") : current.status
				const allowed =
					scoreAfter === null &&
					!result.notes.length &&
					!current.watches.some(
						(w) => !removed.has(w.id) && w.origin !== "score",
					) &&
					(title.media_type === "movie" || statusAfter === "not_started")
				if (hidden === "revert" && was("not_interested") && !allowed)
					result.notes.push(
						"Not interested isn't put back on a title you have rated, watched or started.",
					)
				else if (hidden === "revert") {
					wrote = tasteWrite = true
					await ports.notInterestedMany({
						user_id: userId,
						titles: [{ tmdb_id: title.tmdb_id, media_type: title.media_type }],
						action: was("not_interested") ? "add" : "remove",
					})
				} else if (hidden === "changed") result.skipped.push("not_interested")
				// A watch or score of the batch may have taken the title off the Wishlist: it goes back at its old time.
				const wanted = field("want_to_see")
				if (wanted === "revert") {
					const addedAt =
						typeof item.want_to_see_added_at === "string"
							? new Date(item.want_to_see_added_at)
							: null
					wrote = tasteWrite = true
					await ports.wishlistMany({
						user_id: userId,
						titles: [
							{
								tmdb_id: title.tmdb_id,
								media_type: title.media_type,
								...(addedAt && addedAt.getTime() <= Date.now()
									? { addedAt }
									: {}),
							},
						],
						action: was("want_to_see") ? "add" : "remove",
					})
				} else if (wanted === "changed") result.skipped.push("want_to_see")
			} catch {
				result.failed = true
			}
		}
		if (wrote) await ports.resetUserData(userId)
	})
	// A season or episode score alone changes nothing taste reads.
	if (tasteWrite) await ports.markTasteChanged(userId)
	const fresh = wrote
		? await ports.userData(userId).catch(() => undefined)
		: user
	const items = await mapPool(rows, 5, async ({ item, title, current }) => {
		const now = await ports
			.snapshot(userId, title, fresh, item.part_target)
			.catch(() => null)
		const outcome = outcomes.get(item.index) ?? {
			skipped: [],
			failed: true,
			notes: [],
		}
		const changes = item.changes ?? {}
		const all = now ? changesOf(current, now) : {}
		// A part score item reports only its part, from what Undo did by the part's key: the title's read names the
		// part by season and episode, which a renumbering may have moved.
		const undone: Partial<Record<Mark, [unknown, unknown]>> = item.part_target
			? outcome.part
				? { part_score: outcome.part }
				: {}
			: all
		const base = {
			index: item.index,
			title: ports.summary(title, origin),
			...(Object.keys(undone).length ? { changes: undone } : {}),
		}
		if (outcome.failed || !now)
			return {
				...base,
				status: "error",
				message:
					"Could not confirm this item's undo. Read the title before trying again.",
			}
		const watchesLeft = now.watches.some(
			(w) =>
				(item.undo?.group && w.group_id === item.undo.group) ||
				item.undo?.watch_ids?.includes(w.id),
		)
		// Only what the batch changed counts: the member may have changed other marks of the title since.
		const mismatched = (
			[
				"score",
				"part_score",
				"want_to_see",
				"not_interested",
				"status",
			] as const
		).filter(
			(key) =>
				changes[key] !== undefined &&
				!outcome.skipped.includes(key) &&
				// A part's undo is judged by its key above, not by the title's read.
				!(key === "part_score" && item.part_target) &&
				markOf(now, key) !== changes[key]?.[0],
		)
		const nothingDone = !Object.keys(undone).length
		const problems =
			outcome.skipped.length +
			mismatched.length +
			outcome.notes.length +
			(watchesLeft ? 1 : 0)
		const status = !problems
			? nothingDone
				? "already_undone"
				: "undone"
			: !nothingDone
				? "partly_undone"
				: outcome.skipped.length
					? "changed_since"
					: "not_undoable"
		return {
			...base,
			status,
			...(outcome.skipped.length
				? {
						kept: outcome.skipped,
						message: "Changed again since the batch, so kept as it is now.",
					}
				: {}),
			...(mismatched.length ? { differs_from_before_batch: mismatched } : {}),
			...(outcome.notes.length ? { notes: outcome.notes } : {}),
		}
	})
	const count = (status: string) =>
		items.filter((item) => item.status === status).length
	const summary = {
		total: rows.length,
		undone: count("undone"),
		partly_undone: count("partly_undone"),
		already_undone: count("already_undone"),
		changed_since: count("changed_since"),
		not_undoable: count("not_undoable"),
		error: count("error"),
		not_done_in_batch: parsed.data.items.length - rows.length,
	}
	return {
		outcome:
			summary.undone + summary.partly_undone
				? "applied"
				: summary.error || summary.changed_since || summary.not_undoable
					? "not_applied"
					: "unchanged",
		batch_id: args.batch_id,
		undone_tool: tool,
		summary,
		message: `${summary.undone} undone, ${summary.partly_undone} partly undone, ${summary.already_undone} already undone, ${summary.changed_since} changed since, ${summary.not_undoable} not undoable, ${summary.error} with errors.`,
		items,
	}
}
