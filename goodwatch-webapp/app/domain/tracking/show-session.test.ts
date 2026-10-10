import assert from "node:assert/strict"
import { test } from "node:test"
import type { ListedEpisode } from "./machine.ts"
import {
	type ActionAnswer,
	type PageAction,
	type ShowCopy,
	applyLocally,
} from "./show-page.ts"
import { FAILED, type SentAction, ShowSession } from "./show-session.ts"

const SHOW = 1399
const TODAY = "2026-10-08"
const NOW = Date.UTC(2026, 9, 8, 19, 30)
const EPISODES: ListedEpisode[] = [
	{ id: 101, season: 1, number: 1, airDate: "2020-01-01" },
	{ id: 102, season: 1, number: 2, airDate: "2020-01-08" },
	{ id: 103, season: 1, number: 3, airDate: "2020-01-15" },
	{ id: 104, season: 1, number: 4, airDate: "2026-10-09" },
]
const EMPTY: ShowCopy = { state: null, log: [] }
const watch = (number: number): PageAction => ({
	type: "watch",
	season: 1,
	number,
})
const ticks = (copy: ShowCopy) =>
	copy.log.map((r) => r.episode_number ?? 0).sort()

/** A server that holds its own copy, runs the same machine, and answers only when the test lets it. */
function server(start: ShowCopy = EMPTY) {
	let stored = start
	const requests: {
		sent: SentAction
		answer: (how?: "fail" | "refuse" | ActionAnswer) => void
	}[] = []
	let open = 0
	let most = 0
	const send = (sent: SentAction) =>
		new Promise<ActionAnswer>((resolve, reject) => {
			open += 1
			most = Math.max(most, open)
			requests.push({
				sent,
				answer: (how) => {
					open -= 1
					if (how === "fail") return reject(new Error("offline"))
					if (how && typeof how !== "string") return resolve(how)
					const before = stored
					const applied =
						how === "refuse"
							? { copy: before, refused: "The server says no." }
							: applyLocally(before, sent.action, sent.actionId, {
									showId: SHOW,
									episodes: EPISODES,
									today: TODAY,
									// The server's clock is not the browser's.
									now: NOW + 5_000,
								})
					stored = applied.copy
					const had = new Map(before.log.map((r) => [r.watch_id, r]))
					resolve({
						status: applied.refused ? "refused" : "applied",
						refused: applied.refused,
						state: stored.state,
						rows: stored.log.filter((r) => had.get(r.watch_id) !== r),
						deleted: before.log
							.filter((r) => !stored.log.includes(r))
							.map((r) => r.watch_id),
						cleared: { wantToSeeAddedAt: null, notInterested: false },
					})
				},
			})
		})
	return { send, requests, stored: () => stored, most: () => most }
}
const settled = () => new Promise((resolve) => setImmediate(resolve))
const options = { today: TODAY, now: NOW }

function open(at = server(), copy: ShowCopy = EMPTY) {
	const changes: number[][] = []
	const errors: string[] = []
	const stale = { count: 0 }
	const session: ShowSession = new ShowSession({
		showId: SHOW,
		episodes: EPISODES,
		copy,
		send: at.send,
		onChange: () => changes.push(ticks(session.shown)),
		onError: (message) => errors.push(message),
		onStale: () => {
			stale.count += 1
		},
	})
	return { session, at, changes, errors, stale }
}

test("an action is shown at once and sent with the id the browser made", async () => {
	const { session, at, changes } = open()
	const acted = session.act(watch(1), { ...options, actionId: "watch-000001" })
	assert.equal(acted.refused, null)
	assert.deepEqual(ticks(session.shown), [1])
	assert.equal(session.shown.state?.state, "watching")
	assert.deepEqual(changes, [[1]])
	assert.equal(session.busy, true)
	await settled()
	assert.deepEqual(
		at.requests.map((r) => r.sent),
		[{ action: watch(1), actionId: "watch-000001", restore: undefined }],
	)
})

test("an action the page refuses is not shown and not sent", async () => {
	const { session, at, changes } = open()
	const acted = session.act(watch(4), { ...options, actionId: "watch-000001" })
	assert.equal(acted.refused, "It has not aired yet.")
	assert.equal(await acted.done, null)
	await settled()
	assert.deepEqual([at.requests.length, changes, session.busy], [0, [], false])
})

test("actions on one show are sent one after the other, in the order they were made", async () => {
	const { session, at } = open()
	session.act(watch(1), { ...options, actionId: "watch-000001" })
	session.act(watch(2), { ...options, actionId: "watch-000002" })
	session.act({ type: "hold" }, options)
	// All three are shown before any is answered.
	assert.deepEqual(
		[ticks(session.shown), session.shown.state?.state],
		[[1, 2], "on_hold"],
	)
	await settled()
	assert.equal(at.requests.length, 1, "the second waits for the first's answer")
	at.requests[0].answer()
	await settled()
	assert.equal(at.requests.length, 2)
	at.requests[1].answer()
	await settled()
	at.requests[2].answer()
	await settled()
	assert.deepEqual(
		at.requests.map((r) => r.sent.actionId ?? r.sent.action.type),
		["watch-000001", "watch-000002", "hold"],
	)
	assert.equal(at.most(), 1, "never two requests at once")
	assert.deepEqual(
		[session.busy, session.shown.state?.state],
		[false, "on_hold"],
	)
})

test("the server's answer replaces the guess for that action, and later actions stay shown", async () => {
	const { session, at } = open()
	const first = session.act(watch(1), { ...options, actionId: "watch-000001" })
	session.act(watch(2), { ...options, actionId: "watch-000002" })
	assert.equal(
		session.shown.log[0].watched_at,
		NOW,
		"the guess is dated by the browser's clock",
	)
	await settled()
	at.requests[0].answer()
	const answer = await first.done
	assert.equal(answer?.status, "applied")
	assert.deepEqual(
		ticks(session.shown),
		[1, 2],
		"the action that is still on its way stays shown",
	)
	assert.deepEqual(
		session.shown.log.map((r) => [r.watch_id, r.watched_at]),
		[
			["watch-000001", NOW + 5_000],
			["watch-000002", NOW],
		],
	)
	assert.equal(session.shown.state?.state_changed_at, NOW + 5_000)
	await settled()
	at.requests[1].answer()
	await settled()
	assert.deepEqual(
		session.shown,
		at.stored(),
		"in the end the page holds what the server holds",
	)
})

test("rows the server made and the browser did not expect are taken over", async () => {
	const { session, at } = open()
	const pressed = session.act(
		{ type: "pressSeen", today: TODAY },
		{ ...options, actionId: "press-000001" },
	)
	assert.deepEqual(ticks(session.shown), [1, 2, 3])
	await settled()
	const tomorrows = {
		...session.shown.log[0],
		watch_id: "g-press-000001-104",
		episode_tmdb_id: 104,
		episode_number: 4,
	}
	at.requests[0].answer({
		status: "applied",
		refused: null,
		state: session.shown.state,
		rows: [...session.shown.log, tomorrows],
		deleted: [],
		cleared: { wantToSeeAddedAt: null, notInterested: false },
	})
	await pressed.done
	assert.deepEqual(ticks(session.shown), [1, 2, 3, 4])
})

test("a failed action is taken back with everything made after it, and the page says so", async () => {
	const { session, at, errors, changes } = open()
	const first = session.act(watch(1), { ...options, actionId: "watch-000001" })
	await settled()
	at.requests[0].answer()
	await first.done
	const second = session.act(watch(2), { ...options, actionId: "watch-000002" })
	const third = session.act(watch(3), { ...options, actionId: "watch-000003" })
	assert.deepEqual(ticks(session.shown), [1, 2, 3])
	await settled()
	at.requests[1].answer("fail")
	assert.deepEqual([await second.done, await third.done], [null, null])
	assert.deepEqual(
		ticks(session.shown),
		[1],
		"back to what the server last confirmed",
	)
	assert.equal(session.shown.state?.state, "watching")
	assert.deepEqual(errors, [FAILED])
	assert.deepEqual(changes.at(-1), [1])
	await settled()
	assert.equal(
		at.requests.length,
		2,
		"the action behind the failed one is not sent",
	)
	assert.equal(session.busy, false)
	// The page works on.
	session.act(watch(2), { ...options, actionId: "watch-000004" })
	await settled()
	assert.equal(at.requests[2].sent.actionId, "watch-000004")
})

test("an action the server refuses is taken back with the server's reason and its state", async () => {
	const { session, at, errors } = open()
	const acted = session.act(watch(1), { ...options, actionId: "watch-000001" })
	await settled()
	at.requests[0].answer("refuse")
	assert.equal(await acted.done, null)
	assert.deepEqual([session.shown, errors], [EMPTY, ["The server says no."]])
})

test("a copy read from the server replaces the page's when idle; one that arrives while actions are on their way is read again", async () => {
	const { session, at, stale } = open()
	const other = applyLocally(EMPTY, watch(3), "watch-other", {
		showId: SHOW,
		episodes: EPISODES,
		today: TODAY,
		now: NOW,
	}).copy
	assert.equal(session.load(other), true)
	assert.deepEqual(ticks(session.shown), [3])
	const acted = session.act(watch(1), { ...options, actionId: "watch-000001" })
	assert.equal(
		session.load(EMPTY),
		false,
		"a read that started before the action does not undo it",
	)
	assert.deepEqual(ticks(session.shown), [1, 3])
	assert.equal(stale.count, 0)
	await settled()
	at.requests[0].answer({
		status: "applied",
		refused: null,
		state: session.shown.state,
		rows: session.shown.log.filter((r) => r.watch_id === "watch-000001"),
		deleted: [],
		cleared: { wantToSeeAddedAt: null, notInterested: false },
	})
	await acted.done
	await settled()
	assert.deepEqual(ticks(session.shown), [1, 3])
	assert.equal(stale.count, 1, "once idle, the page is told to read again")
})
