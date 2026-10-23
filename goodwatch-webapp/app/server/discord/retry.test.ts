import "../title-filter/test-alias.ts"
import assert from "node:assert/strict"
import { test, mock } from "node:test"
import { routeInteraction, type Dependencies, type Interaction } from "./router.server.ts"
import { defer } from "./respond.server.ts"
import { textCard, type GuestTitle } from "./cards.ts"
import {
	loadRetry,
	parseRetryId,
	retryEntry,
	RETRY_TTL,
	type RetryStore,
} from "./retry.server.ts"

const title: GuestTitle = {
	id: "movie:42",
	name: "A title",
	year: 2024,
	availability: { state: "no_match", offers: [] },
}

function memoryStore() {
	const kept = new Map<string, { value: string; ttl: number }>()
	const store: RetryStore = {
		get: async (key) => kept.get(key)?.value ?? null,
		set: async (key, value, ttl) => {
			kept.set(key, { value, ttl })
		},
	}
	return { kept, store }
}

function harness(fail = 1) {
	const { kept, store } = memoryStore()
	const edits: unknown[] = []
	const outcomes: string[] = []
	let waiting: (() => void) | null = null
	let reads = 0
	const takes: string[] = []
	const deps: Partial<Dependencies> = {
		linkedUser: async () => null,
		getGuild: async () => null,
		unlink: async () => {},
		memberRead: async () => {
			throw new Error("Unexpected member read")
		},
		read: async (_viewer, _origin, name) => {
			if (name === "get_similar_titles" && reads++ < fail)
				throw new Error("private failure")
			return name === "get_similar_titles"
				? { source: { name: "A title" }, items: [title] }
				: { title }
		},
		displays: async () => new Map(),
		emojis: async () => ({}),
		take: async (user) => {
			takes.push(user)
			return { allowed: true, store: "memory" }
		},
		edit: async (_app, _token, body) => {
			edits.push(body)
			waiting?.()
		},
		log: (line) => outcomes.push(line),
		retryStore: async () => store,
	}
	const nextEdit = () =>
		new Promise<void>((resolve) => {
			waiting = resolve
		})
	const run = (value: Interaction) => routeInteraction(value, deps)
	return { kept, store, edits, outcomes, takes, nextEdit, run }
}

const command = (user = "111"): Interaction => ({
	type: 2,
	id: "900000000000000001",
	application_id: "app",
	token: "first-token",
	locale: "en-US",
	user: { id: user },
	data: { name: "similar", options: [{ name: "title", value: "movie:42" }] },
})

const press = (customId: string, user = "111"): Interaction => ({
	type: 3,
	id: "900000000000000002",
	application_id: "app",
	token: "retry-token",
	locale: "en-US",
	user: { id: user },
	message: {
		flags: 64,
		components: [
			{ type: 10, content: "Something went wrong. Please try again." },
			{
				type: 1,
				components: [
					{ type: 2, style: 2, label: "Try again", custom_id: customId },
				],
			},
		],
	},
	data: { custom_id: customId },
})

const retryIdIn = (body: unknown) =>
	/"(gw1:retry:[a-f0-9]{18})"/.exec(JSON.stringify(body))?.[1] ?? null

test("an error card offers Try again and keeps the command and options for 15 minutes", async () => {
	const h = harness()
	const edited = h.nextEdit()
	await h.run(command())
	await edited
	const sent = JSON.stringify(h.edits[0])
	assert.match(sent, /Something went wrong\. Please try again\./)
	assert.match(sent, /"label":"Try again"/)
	assert.doesNotMatch(sent, /private failure/)
	const id = retryIdIn(h.edits[0])
	assert.ok(id && id.length <= 100)
	const [{ ttl }] = [...h.kept.values()]
	assert.equal(ttl, RETRY_TTL)
	const entry = await loadRetry(parseRetryId(id)!, h.store)
	assert.deepEqual(entry, {
		user: "111",
		id: "900000000000000001",
		type: 2,
		data: { name: "similar", options: [{ name: "title", value: "movie:42" }] },
	})
})

test("Try again re-runs the same command for the same person, on the error card itself", async () => {
	const h = harness()
	let edited = h.nextEdit()
	await h.run(command())
	await edited
	const id = retryIdIn(h.edits[0])!
	edited = h.nextEdit()
	const answer = await h.run(press(id))
	assert.equal(answer.type, 7)
	assert.match(JSON.stringify(answer.data), /Trying again…/)
	assert.match(JSON.stringify(answer.data), /"disabled":true/)
	await edited
	const sent = JSON.stringify(h.edits[1])
	assert.match(sent, /Similar to A title/)
	assert.doesNotMatch(sent, /Try again|went wrong/)
	// One rate-limit take for the press, none for the re-run.
	assert.deepEqual(h.takes, ["111", "111"])
})

test("a retry that fails again offers another Try again", async () => {
	const h = harness(2)
	let edited = h.nextEdit()
	await h.run(command())
	await edited
	edited = h.nextEdit()
	await h.run(press(retryIdIn(h.edits[0])!))
	await edited
	const again = retryIdIn(h.edits[1])
	assert.ok(again)
	assert.notEqual(again, retryIdIn(h.edits[0]))
})

test("only the person who ran it can try again", async () => {
	const h = harness()
	const edited = h.nextEdit()
	await h.run(command())
	await edited
	const answer = await h.run(press(retryIdIn(h.edits[0])!, "222"))
	assert.equal(answer.type, 4)
	assert.match(
		JSON.stringify(answer.data),
		/Only the person who ran this can try again\./,
	)
	assert.equal(h.edits.length, 1)
})

test("an expired or unknown key asks to run the command again", async () => {
	const h = harness()
	for (const id of ["gw1:retry:0123456789abcdef01", "gw1:retry:nope"]) {
		const answer = await h.run(press(id))
		assert.equal(answer.type, 4)
		assert.match(
			JSON.stringify(answer.data),
			/This can't be retried anymore\. Run the command again\./,
		)
	}
})

test("a failed press keeps its custom ID and selected values", () => {
	const entry = retryEntry({
		type: 3,
		id: "1",
		member: { user: { id: "333" } },
		data: { custom_id: "gw1:open:s:movie:42", values: ["movie:7"] },
	})
	assert.deepEqual(entry, {
		user: "333",
		id: "1",
		type: 3,
		data: { custom_id: "gw1:open:s:movie:42", values: ["movie:7"] },
	})
	assert.equal(
		retryEntry({ type: 3, user: { id: "3" }, data: { custom_id: "gw1:retry:x" } }),
		null,
	)
	assert.equal(retryEntry({ type: 4, user: { id: "3" }, data: {} }), null)
})

test("a timed-out deferral says so and offers Try again", async () => {
	mock.timers.enable({ apis: ["setTimeout"] })
	try {
		const edits: unknown[] = []
		const outcomes: string[] = []
		defer(
			() => new Promise<ReturnType<typeof textCard>>(() => {}),
			async (body) => {
				edits.push(body)
			},
			(outcome) => outcomes.push(outcome),
			{ retry: async () => "gw1:retry:0123456789abcdef01" },
		)
		mock.timers.tick(0)
		mock.timers.tick(12_000)
		for (let i = 0; i < 10 && !edits.length; i++) await Promise.resolve()
		await new Promise((resolve) => setImmediate(resolve))
		assert.match(JSON.stringify(edits[0]), /The search took too long/)
		assert.match(JSON.stringify(edits[0]), /gw1:retry:0123456789abcdef01/)
		assert.deepEqual(outcomes, ["timeout"])
	} finally {
		mock.timers.reset()
	}
})

test("without retry storage, error cards stay as they were", async () => {
	const edits: unknown[] = []
	await new Promise<void>((resolve) =>
		defer(
			async () => {
				throw new Error("x")
			},
			async (body) => {
				edits.push(body)
			},
			() => resolve(),
			{ retry: async () => null },
		),
	)
	assert.deepEqual(edits[0], textCard("Something went wrong. Please try again."))
})
