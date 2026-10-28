// The "Your AI app" import's reading of stored MCP results: batches and single calls, additions only, one entry per
// title, and undo receipts. Made-up titles only.
import assert from "node:assert/strict"
import { test } from "node:test"
import { type AiActionRow, summarizeAiActions } from "./ai-activity.ts"

const title = (id: string, name: string) => ({ id, name, year: 2001 })
const row = (
	action_id: string,
	created_at: number,
	result: unknown,
): AiActionRow => ({
	action_id,
	created_at,
	result: result === null ? null : JSON.stringify(result),
})

test("a log_watch batch marks its done items as seen and skips the rest", () => {
	const activity = summarizeAiActions([
		row("b1", 10, {
			outcome: "applied",
			batch: true,
			batch_id: "b1",
			tool: "log_watch",
			items: [
				{
					index: 0,
					status: "done",
					title: title("movie:1", "Alpha"),
					changes: {},
					watches_added: 1,
				},
				{ index: 1, status: "already_set", title: title("movie:2", "Beta") },
				{ index: 2, status: "not_found", requested: { title_name: "Gamma" } },
			],
		}),
	])
	assert.deepEqual(
		activity.titles.map((t) => t.name),
		["Alpha"],
	)
	assert.deepEqual(activity.counts, { seen: 1, scored: 0, wanted: 0 })
	assert.deepEqual(activity.batches, ["b1"])
	assert.equal(activity.lastChangeAt, 10)
})

test("scores and Want to See from batches merge into one entry per title", () => {
	const activity = summarizeAiActions([
		row("b2", 20, {
			batch: true,
			batch_id: "b2",
			items: [
				{
					status: "done",
					title: title("movie:1", "Alpha"),
					changes: { score: [null, 9] },
				},
			],
		}),
		row("b1", 10, {
			batch: true,
			batch_id: "b1",
			items: [
				{
					status: "done",
					title: title("movie:1", "Alpha"),
					changes: {},
					watches_added: 1,
				},
				{
					status: "done",
					title: title("show:5", "Delta"),
					changes: { want_to_see: [false, true] },
				},
			],
		}),
	])
	assert.deepEqual(
		activity.titles.map((t) => [t.key, t.seen, t.scored, t.wanted]),
		[
			["movie:1", true, true, false],
			["show:5", false, false, true],
		],
	)
	assert.deepEqual(activity.counts, { seen: 1, scored: 1, wanted: 1 })
	assert.deepEqual(activity.batches, ["b1", "b2"])
})

test("removals, clears and Not interested are not counted", () => {
	const activity = summarizeAiActions([
		row("b1", 10, {
			batch: true,
			batch_id: "b1",
			items: [
				{
					status: "done",
					title: title("movie:1", "Alpha"),
					changes: { want_to_see: [true, false] },
				},
				{
					status: "done",
					title: title("movie:2", "Beta"),
					changes: { score: [7, null] },
				},
				{
					status: "done",
					title: title("movie:3", "Gamma"),
					changes: { not_interested: [false, true] },
				},
			],
		}),
	])
	assert.equal(activity.titles.length, 0)
	assert.deepEqual(activity.batches, [])
})

test("a show set to Watching counts as seen", () => {
	const activity = summarizeAiActions([
		row("b1", 10, {
			batch: true,
			batch_id: "b1",
			items: [
				{
					status: "done",
					title: title("show:9", "Epsilon"),
					changes: { status: ["not_started", "watching"] },
				},
			],
		}),
	])
	assert.equal(activity.counts.seen, 1)
})

test("single calls count from before and after, and don't join Undo all", () => {
	const activity = summarizeAiActions([
		row("s1", 10, {
			outcome: "applied",
			title: title("movie:1", "Alpha"),
			before: { score: null, want_to_see: false, status: null },
			after: { score: 8, want_to_see: false, status: null },
			changes: { watches_added: [{ id: "w" }], watches_removed: [] },
		}),
		row("s2", 11, {
			outcome: "applied",
			title: title("movie:2", "Beta"),
			before: { score: null, want_to_see: false, status: null },
			after: { score: null, want_to_see: true, status: null },
			changes: { watches_added: [], watches_removed: [] },
		}),
		// An undo of one watch: nothing added.
		row("s3", 12, {
			outcome: "applied",
			title: title("movie:3", "Gamma"),
			before: { score: null, want_to_see: false, status: null },
			after: { score: null, want_to_see: false, status: null },
			changes: { watches_added: [], watches_removed: [{ id: "x" }] },
		}),
		row("s4", 13, {
			outcome: "unchanged",
			title: title("movie:4", "Delta"),
			before: {},
			after: {},
		}),
	])
	assert.deepEqual(activity.counts, { seen: 1, scored: 1, wanted: 1 })
	assert.equal(activity.singles, 2)
	assert.deepEqual(activity.batches, [])
})

test("a batch undo receipt marks its batch undone; a pending one doesn't", () => {
	const batch = (id: string, at: number) =>
		row(id, at, {
			batch: true,
			batch_id: id,
			items: [
				{
					status: "done",
					title: title(`movie:${at}`, id),
					changes: {},
					watches_added: 1,
				},
			],
		})
	const activity = summarizeAiActions([
		batch("b1", 1),
		batch("b2", 2),
		row("batch-undo:b1", 3, { outcome: "applied" }),
		row("batch-undo:b2", 4, { outcome: "indeterminate" }),
		row("batch-undo:other", 5, { outcome: "applied" }),
	])
	assert.deepEqual(activity.undone, ["b1"])
	assert.equal(activity.lastChangeAt, 2)
})

test("unreadable and pending results are skipped", () => {
	const activity = summarizeAiActions([
		row("x", 1, null),
		{ action_id: "y", created_at: 2, result: "{not json" },
		row("z", 3, { outcome: "indeterminate", message: "still running" }),
	])
	assert.equal(activity.titles.length, 0)
	assert.equal(activity.lastChangeAt, null)
})
