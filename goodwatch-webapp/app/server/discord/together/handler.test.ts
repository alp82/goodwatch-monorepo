// Dev prerequisite: lua. Set TOGETHER_SKIP_LUA=1 only to explicitly skip Lua agreement tests.
import assert from "node:assert/strict"
import { test } from "node:test"
import {
	routeInteraction,
	type Interaction,
	type Dependencies,
} from "../router.server.ts"
import { EPHEMERAL, IS_COMPONENTS_V2 } from "../cards.ts"
import { togetherCustomId } from "../custom-id.ts"
import { createSessionStore, EXPIRED } from "./store.server.ts"
import { LuaValkey, hasLua } from "./test-valkey.ts"
import { commands } from "../commands.ts"
import { publicSignature } from "./cards.ts"
import { resolveViewerPlace } from "../place.server.ts"
const interaction = (data: Interaction["data"], type = 2): Interaction => ({
	type,
	data,
	application_id: "app",
	token: "token",
	guild_id: "guild",
	locale: "de",
	user: { id: "a" },
	authorizing_integration_owners: { "0": "guild" },
	app_permissions: "51200",
})
function fixture(
	overrides: Partial<NonNullable<Dependencies["together"]>> = {},
) {
	const store = createSessionStore(new LuaValkey(), (p) => p)
	const posts: unknown[] = [],
		edits: unknown[] = [],
		changes: string[] = [],
		published: string[] = []
	let resolve: () => void = () => {}
	let finished = new Promise<void>((r) => {
		resolve = r
	})
	let candidateCalls = 0
	const deps: Partial<Dependencies> = {
		take: async () => ({ allowed: true, store: "memory" }),
		linkedUser: async () => {
			throw new Error("Never personalize together")
		},
		log: () => resolve(),
		getGuild: async () => null,
		together: {
			emojis: async () => ({}),
			expireAt: () => {},
			store: async () => store,
			candidates: async (meta) => {
				candidateCalls++
				assert.deepEqual(meta.place, { country: "DE", services: [] })
				return Array.from({ length: 120 }, (_, i) => `movie:${i + 1}`)
					.filter((id) => !meta.deck.includes(id))
					.slice(0, 31)
			},
			title: async (id, place) => {
				assert.equal(place.country, "DE")
				return { id, name: `Title ${id.split(":")[1]}`, year: 2026 }
			},
			post: async (_app, _token, body) => {
				posts.push(body)
				return { id: "public-message", channel_id: "public-channel" }
			},
			edit: async (_app, _token, body) => {
				edits.push(body)
			},
			changed: async (id) => {
				changes.push(id)
			},
			published: async (_id, signature) => {
				published.push(signature)
			},
			...overrides,
		},
	}
	return {
		store,
		deps,
		posts,
		edits,
		changes,
		published,
		candidateCalls: () => candidateCalls,
		run: async (i: Interaction) => {
			finished = new Promise<void>((r) => {
				resolve = r
			})
			const response = await routeInteraction(i, deps)
			return { response, finished }
		},
	}
}
test("registration is guild-only with discover's static choices; place resolver uses locale", async () => {
	const together = commands.find((c) => c.name === "together")!
	assert.deepEqual(together.integration_types, [0])
	assert.deepEqual(together.contexts, [0])
	const discover = commands.find((c) => c.name === "discover")!
	for (const name of ["type", "mood"])
		assert.deepEqual(
			together.options.find((o) => o.name === name),
			discover.options.find((o) => o.name === name),
		)
	assert.deepEqual(await resolveViewerPlace({ type: 2, locale: "de" }, {}), {
		country: "DE",
	})
})
test("not installed path answers ephemerally with an install link before storage or deferral", async () => {
	for (const patch of [
		{ authorizing_integration_owners: {} },
		{ app_permissions: undefined },
		{ guild_id: undefined },
		{ authorizing_integration_owners: { "0": "different-guild" } },
	] as Partial<Interaction>[]) {
		const i = { ...interaction({ name: "together" }), ...patch }
		const response = await routeInteraction(i, {
			take: async () => ({ allowed: true, store: "memory" }),
			log: () => {},
			getGuild: async () => null,
			together: {
				emojis: async () => ({}),
				store: async () => {
					throw new Error("Unexpected storage")
				},
			},
		})
		assert.equal(response.type, 4)
		assert.match(JSON.stringify(response), /Add GoodWatch to this server/)
		assert.equal(
			(response.data as { flags: number }).flags & EPHEMERAL,
			EPHEMERAL,
		)
	}
})
test(
	"start binds the public message; Join is ephemeral; votes update the same private card; Leave removes votes",
	{ skip: !hasLua },
	async () => {
		const f = fixture()
		const start = await f.run(
			interaction({
				name: "together",
				options: [
					{ name: "type", value: "movie" },
					{ name: "mood", value: "funny" },
				],
			}),
		)
		assert.deepEqual(start.response, { type: 5, data: { flags: 0 } })
		await start.finished
		const post = f.posts[0] as { flags: number }
		assert.equal(post.flags, IS_COMPONENTS_V2)
		const id = f.changes[0]
		let session = (await f.store.load(id))!
		assert.equal(session.meta.messageId, "public-message")
		assert.equal(session.meta.channelId, "public-channel")
		assert.equal(session.meta.mood, "funny")
		assert.equal(session.deck.length, 30)
		assert.equal(f.published[0], publicSignature(session))
		const join = await f.run(
			interaction({ custom_id: togetherCustomId("join", id) }, 3),
		)
		assert.deepEqual(join.response, { type: 5, data: { flags: EPHEMERAL } })
		await join.finished
		assert.equal(
			(f.edits.at(-1) as { flags: number }).flags,
			EPHEMERAL | IS_COMPONENTS_V2,
		)
		assert.equal((await f.store.load(id))!.summary.participantCount, 0)
		const voted = await f.run(
			interaction({ custom_id: togetherCustomId("yep", id, "movie:1") }, 3),
		)
		assert.deepEqual(voted.response, { type: 6 })
		await voted.finished
		assert.match(JSON.stringify(f.edits.at(-1)), /Title 2/)
		assert.equal((f.edits.at(-1) as { flags: number }).flags, IS_COMPONENTS_V2)
		session = (await f.store.load(id))!
		assert.deepEqual(session.summary.matches, ["movie:1"])
		const undo = await f.run(
			interaction({ custom_id: togetherCustomId("undo", id, "movie:1") }, 3),
		)
		await undo.finished
		assert.equal((await f.store.load(id))!.summary.participantCount, 0)
		const votedAgain = await f.run(
			interaction({ custom_id: togetherCustomId("nope", id, "movie:1") }, 3),
		)
		await votedAgain.finished
		const leave = await f.run(
			interaction({ custom_id: togetherCustomId("leave", id) }, 3),
		)
		await leave.finished
		assert.match(JSON.stringify(f.edits.at(-1)), /You left this session/)
		assert.deepEqual((await f.store.load(id))!.votes, {})
	},
)
test(
	"growth at vote 25 is shared and append-only; late Join resumes at title one",
	{ skip: !hasLua },
	async () => {
		const f = fixture(),
			started = await f.run(interaction({ name: "together" }))
		await started.finished
		const id = f.changes[0],
			deck = (await f.store.load(id))!.deck
		for (let n = 1; n <= 24; n++)
			await f.store.act(id, {
				kind: "vote",
				user: "a",
				titleId: `movie:${n}`,
				vote: "yep",
			})
		const vote = await f.run(
			interaction({ custom_id: togetherCustomId("yep", id, "movie:25") }, 3),
		)
		await vote.finished
		const session = (await f.store.load(id))!
		assert.equal(session.deck.length, 60)
		assert.deepEqual(session.deck.slice(0, 30), deck)
		assert.equal(f.candidateCalls(), 2)
		const join = await f.run({
			...interaction({ custom_id: togetherCustomId("join", id) }, 3),
			user: { id: "b" },
		})
		await join.finished
		assert.match(JSON.stringify(f.edits.at(-1)), /Title 1/)
		assert.equal((await f.store.load(id))!.summary.participantCount, 1)
	},
)
test(
	"evicted session gives the exact recovery message",
	{ skip: !hasLua },
	async () => {
		const f = fixture(),
			join = await f.run(
				interaction({ custom_id: togetherCustomId("join", "a".repeat(24)) }, 3),
			)
		await join.finished
		assert.match(
			JSON.stringify(f.edits),
			new RegExp(EXPIRED.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
		)
	},
)

test(
	"a full session refuses Join and an already-open nonparticipant's first vote",
	{ skip: !hasLua },
	async () => {
		const f = fixture(),
			start = await f.run(interaction({ name: "together" }))
		await start.finished
		const id = f.changes[0]
		for (let i = 0; i < 12; i++)
			await f.store.act(id, {
				kind: "vote",
				user: String(i),
				titleId: "movie:1",
				vote: "yep",
			})
		for (const action of ["join", "yep"] as const) {
			const press = await f.run(
				interaction(
					{
						custom_id: togetherCustomId(
							action,
							id,
							action === "yep" ? "movie:1" : undefined,
						),
					},
					3,
				),
			)
			await press.finished
			assert.match(JSON.stringify(f.edits.at(-1)), /This session is full/)
		}
		assert.equal((await f.store.load(id))!.summary.participantCount, 12)
	},
)

test(
	"publication bookkeeping failures preserve the public card; a press recovers binding from the original webhook",
	{ skip: !hasLua },
	async () => {
		for (const step of ["bind", "published", "changed"] as const) {
			const f = fixture()
			let id = ""
			const create = f.store.create
			f.store.create = async (meta) => {
				id = meta.id
				assert.ok(
					meta.createdAt <= Date.now() && meta.createdAt > Date.now() - 1000,
				)
				return create(meta)
			}
			const bind = f.store.bind
			const fail = async () => {
				throw new Error("Unavailable")
			}
			if (step === "bind") f.store.bind = fail
			else f.deps.together![step] = fail
			const started = await f.run(interaction({ name: "together" }))
			await started.finished
			assert.equal(f.posts.length, 1)
			assert.equal(f.edits.length, 0)
			assert.doesNotMatch(JSON.stringify(f.posts), /Something went wrong/)
			if (step !== "bind") continue
			f.store.bind = bind
			let reads = 0
			f.deps.together!.original = async (app, token) => {
				reads++
				assert.equal(app, "app")
				assert.equal(token, "token")
				return { id: "recovered-message", channel_id: "public-channel" }
			}
			const press = await f.run({
				...interaction({ custom_id: togetherCustomId("join", id) }, 3),
				token: "press-token",
			})
			await press.finished
			assert.equal(reads, 1)
			assert.equal(
				(await f.store.load(id))!.meta.messageId,
				"recovered-message",
			)
			assert.equal(f.posts.length, 1)
		}
	},
)

test(
	"cross-server presses cannot act or recover binding; expired original tokens are not used",
	{ skip: !hasLua },
	async () => {
		const f = fixture()
		let id = ""
		const create = f.store.create
		f.store.create = async (meta) => {
			id = meta.id
			return create({ ...meta, createdAt: Date.now() - 15 * 60 * 1000 })
		}
		f.store.bind = async () => {
			throw new Error("Unavailable")
		}
		let originalReads = 0
		f.deps.together!.original = async () => {
			originalReads++
			return { id: "unexpected", channel_id: "unexpected" }
		}
		const started = await f.run(interaction({ name: "together" }))
		await started.finished
		const act = f.store.act
		f.store.act = async () => {
			assert.fail("Must not mutate cross-server session")
		}
		const other = await f.run({
			...interaction({ custom_id: togetherCustomId("yep", id, "movie:1") }, 3),
			guild_id: "other",
		})
		await other.finished
		assert.match(JSON.stringify(f.edits.at(-1)), /another server/)
		f.store.act = act
		const joined = await f.run(
			interaction({ custom_id: togetherCustomId("join", id) }, 3),
		)
		await joined.finished
		assert.match(JSON.stringify(f.edits.at(-1)), /Title 1/)
		assert.equal(originalReads, 0)
	},
)

test(
	"a guild deck uses server settings before the starter's personal place",
	{ skip: !hasLua },
	async () => {
		const f = fixture()
		f.deps.getGuild = async () => ({
			guild_id: "guild",
			country: "FR",
			service_ids: [8],
			updated_by: "a",
			updated_at: Date.now(),
			digest_channel_id: null,
		})
		f.deps.resolveMemberPlace = async () => {
			assert.fail("Together must use the server place")
		}
		f.deps.together!.candidates = async (meta) => {
			assert.deepEqual(meta.place, { country: "FR", services: [8] })
			return ["movie:1"]
		}
		const started = await f.run(interaction({ name: "together" }))
		await started.finished
		assert.equal(f.posts.length, 1)
	},
)

test(
	"public picks reply privately; a fresh availability failure keeps the decision and known title",
	{ skip: !hasLua },
	async () => {
		let freshCalls = 0
		const f = fixture({
			title: async (id, place) => {
				freshCalls++
				assert.deepEqual(place, { country: "DE", services: [] })
				throw new Error("Availability down")
			},
		})
		const start = await f.run(interaction({ name: "together" }))
		await start.finished
		const id = f.changes[0]
		const outsider = await f.run({
			...interaction(
				{ custom_id: togetherCustomId("pick", id), values: ["movie:1"] },
				3,
			),
			user: { id: "outsider" },
		})
		assert.deepEqual(outsider.response, {
			type: 5,
			data: { flags: EPHEMERAL },
		})
		await outsider.finished
		assert.match(JSON.stringify(f.edits.at(-1)), /Join to pick/)
		await f.store.act(id, {
			kind: "vote",
			user: "a",
			titleId: "movie:1",
			vote: "yep",
		})
		await f.store.remember(id, [
			{ id: "movie:1", name: "Known title", year: 2001, goodwatch_score: 92 },
		])
		const picked = await f.run(
			interaction(
				{ custom_id: togetherCustomId("pick", id), values: ["movie:1"] },
				3,
			),
		)
		await picked.finished
		const decided = (await f.store.load(id))!
		assert.equal(decided.meta.status, "decided")
		assert.equal(decided.meta.decisionTitle?.name, "Known title")
		assert.equal(decided.meta.availabilityFailed, true)
		assert.equal(freshCalls, 1)
		assert.match(JSON.stringify(f.edits.at(-1)), /Decided/)
		for (const action of ["join", "pick", "yep"] as const) {
			const press = await f.run(
				interaction(
					{
						custom_id: togetherCustomId(
							action,
							id,
							action === "yep" ? "movie:2" : undefined,
						),
						values: ["movie:1"],
					},
					3,
				),
			)
			await press.finished
			assert.match(
				JSON.stringify(f.edits.at(-1)),
				/Decided\. See the title in the channel\./,
			)
		}
		assert.equal(freshCalls, 1)
	},
)

test(
	"decision checks the deck place again and stores new offers",
	{ skip: !hasLua },
	async () => {
		let reads = 0
		const f = fixture({
			title: async (id, place) => {
				reads++
				assert.deepEqual(place, { country: "DE", services: [] })
				return {
					id,
					name: "Fresh title",
					year: 2026,
					availability: {
						state: "available",
						offers: [
							{
								name: "New provider",
								stream_link: "https://example.com/",
								offer_type: "flatrate",
							},
						],
					},
				}
			},
		})
		const started = await f.run(interaction({ name: "together" }))
		await started.finished
		const id = f.changes[0]
		await f.store.act(id, {
			kind: "vote",
			user: "a",
			titleId: "movie:1",
			vote: "yep",
		})
		const picked = await f.run(
			interaction(
				{ custom_id: togetherCustomId("pick", id), values: ["movie:1"] },
				3,
			),
		)
		await picked.finished
		assert.equal(reads, 1)
		const m = (await f.store.load(id))!.meta
		assert.equal(m.availabilityFailed, false)
		assert.equal(m.decisionTitle?.availability?.offers[0].name, "New provider")
	},
)

test(
	"End, remove, and exhausted choice require both the session guild and starter",
	{ skip: !hasLua },
	async () => {
		const f = fixture()
		const start = await f.run(interaction({ name: "together" }))
		await start.finished
		const id = f.changes[0]
		await f.store.act(
			id,
			{ kind: "vote", user: "b", titleId: "movie:1", vote: "yep" },
			"Bee",
		)
		for (const action of ["end", "remove", "choose"] as const) {
			for (const patch of [{ guild_id: "other" }, { user: { id: "b" } }]) {
				const press = await f.run({
					...interaction(
						{ custom_id: togetherCustomId(action, id), values: ["b"] },
						3,
					),
					...patch,
				})
				assert.deepEqual(press.response, {
					type: 5,
					data: { flags: EPHEMERAL },
				})
				await press.finished
				assert.match(
					JSON.stringify(f.edits.at(-1)),
					patch.guild_id ? /another server/ : /Only the starter/,
				)
				assert.equal((await f.store.load(id))!.meta.status, "open")
				assert.equal((await f.store.load(id))!.summary.participantCount, 1)
			}
		}
		const removed = await f.run(
			interaction(
				{ custom_id: togetherCustomId("remove", id), values: ["b"] },
				3,
			),
		)
		await removed.finished
		assert.equal((await f.store.load(id))!.summary.participantCount, 0)
		const ended = await f.run(
			interaction({ custom_id: togetherCustomId("end", id) }, 3),
		)
		await ended.finished
		assert.equal((await f.store.load(id))!.meta.status, "ended")
		assert.match(JSON.stringify(f.edits.at(-1)), /Ended by the starter/)
	},
)

test(
	"expired presses answer the fixed expiry copy and request a public update",
	{ skip: !hasLua },
	async () => {
		const f = fixture()
		const id = "e".repeat(24)
		await f.store.create({
			id,
			createdAt: Date.now() - 86400_000,
			guildId: "guild",
			starterId: "a",
			type: "any",
			deck: [],
			status: "open",
			place: { country: "DE", services: [] },
		})
		const press = await f.run(
			interaction(
				{ custom_id: togetherCustomId("pick", id), values: ["movie:1"] },
				3,
			),
		)
		await press.finished
		assert.match(
			JSON.stringify(f.edits.at(-1)),
			/This session expired\. Start a new one with \/together\./,
		)
		assert.ok(f.changes.includes(id))
	},
)

test(
	"the fourth guild session gets an ephemeral limit reply before public deferral",
	{ skip: !hasLua },
	async () => {
		const f = fixture()
		for (let n = 0; n < 3; n++) {
			const start = await f.run(interaction({ name: "together" }))
			await start.finished
		}
		const fourth = await f.run(interaction({ name: "together" }))
		await fourth.finished
		assert.equal(fourth.response.type, 4)
		assert.equal(
			(fourth.response.data as { flags: number }).flags & EPHEMERAL,
			EPHEMERAL,
		)
		assert.match(JSON.stringify(fourth.response), /3 open sessions/)
		assert.equal(f.posts.length, 3)
		assert.equal(f.candidateCalls(), 3)
	},
)

test(
	"decision detail failures still publish the committed decision",
	{ skip: !hasLua },
	async () => {
		for (const failure of ["reject", "null"] as const) {
			const f = fixture({
				title: async () => {
					throw new Error("Catalog down")
				},
			})
			const start = await f.run(interaction({ name: "together" }))
			await start.finished
			const id = f.changes[0]
			await f.store.act(id, {
				kind: "vote",
				user: "a",
				titleId: "movie:1",
				vote: "yep",
			})
			f.store.details = async () => {
				if (failure === "reject") throw new Error("Storage down")
				return null
			}
			const changes = f.changes.length
			const press = await f.run(
				interaction(
					{ custom_id: togetherCustomId("pick", id), values: ["movie:1"] },
					3,
				),
			)
			await press.finished
			assert.equal((await f.store.load(id))!.meta.status, "decided")
			assert.deepEqual(f.changes.slice(changes), [id])
			assert.match(
				JSON.stringify(f.edits.at(-1)),
				/Decided\. See the title in the channel\./,
			)
		}
	},
)

test(
	"a concurrent decision reloads the status and publishes it",
	{ skip: !hasLua },
	async () => {
		const f = fixture()
		const start = await f.run(interaction({ name: "together" }))
		await start.finished
		const id = f.changes[0]
		await f.store.act(id, {
			kind: "vote",
			user: "a",
			titleId: "movie:1",
			vote: "yep",
		})
		const act = f.store.act
		f.store.act = async () => {
			await act(id, { kind: "pick", user: "a", titleId: "movie:1" })
			throw new Error("ERR This session is closed")
		}
		const changes = f.changes.length
		const press = await f.run(
			interaction(
				{ custom_id: togetherCustomId("pick", id), values: ["movie:1"] },
				3,
			),
		)
		await press.finished
		assert.deepEqual(f.changes.slice(changes), [id])
		assert.match(
			JSON.stringify(f.edits.at(-1)),
			/Decided\. See the title in the channel\./,
		)
	},
)
test(
	"private voting presses show the loading card in place; the same press on a public message answers privately",
	{ skip: !hasLua },
	async () => {
		const f = fixture()
		const start = await f.run(interaction({ name: "together" }))
		await start.finished
		const id = f.changes[0]
		const join = await f.run(
			interaction({ custom_id: togetherCustomId("join", id) }, 3),
		)
		await join.finished
		const card = f.edits.at(-1) as { components: unknown[] }
		const press = (
			action: "yep" | "undo" | "leave",
			flags: number,
			titleId?: string,
		) =>
			f.run({
				...interaction({ custom_id: togetherCustomId(action, id, titleId) }, 3),
				message: { id: "m", flags, components: card.components as never },
			})
		const voted = await press("yep", EPHEMERAL | IS_COMPONENTS_V2, "movie:1")
		assert.equal(voted.response.type, 7)
		const loading = JSON.stringify(voted.response)
		assert.match(loading, /Saving your vote…/)
		assert.doesNotMatch(loading, /"disabled":false/)
		await voted.finished
		assert.match(JSON.stringify(f.edits.at(-1)), /Title 2/)
		const undo = await press("undo", EPHEMERAL | IS_COMPONENTS_V2, "movie:1")
		assert.match(JSON.stringify(undo.response), /Undoing your last vote…/)
		await undo.finished
		const leave = await press("leave", IS_COMPONENTS_V2)
		assert.deepEqual(leave.response, { type: 5, data: { flags: EPHEMERAL } })
		await leave.finished
		assert.match(JSON.stringify(f.edits.at(-1)), /You left this session/)
	},
)
