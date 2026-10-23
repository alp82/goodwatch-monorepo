import "../title-filter/test-alias.ts"
import assert from "node:assert/strict"
import { test } from "node:test"
import {
	hotTitles,
	routeInteraction,
	type Dependencies,
	type Interaction,
} from "./router.server.ts"
import {
	titleListCard,
	titleSelect,
	personCard,
	hotCard,
	linkPromptCard,
	linkedCard,
	titleCard,
	type HotPost,
	type HotTitle,
	textCard,
	message,
	componentCount,
	EPHEMERAL,
	IS_COMPONENTS_V2,
	type Component,
	type GuestTitle,
} from "./cards.ts"
import { listCustomId, parseListId, formatCustomId } from "./custom-id.ts"
import { rankSearchResults } from "./search.server.ts"
const { saveDiscoverState, loadDiscoverState } = await import(
	"./discover-state.server.ts"
)
const { commands } = await import("./commands.ts")
const title: GuestTitle = { id: "movie:42", name: "A title", year: 2024 }
const titles = Array.from({ length: 30 }, (_, i) => ({
	...title,
	id: `movie:${i + 1}`,
	name: "@everyone _title_".repeat(30),
}))
const person = {
	person_id: 12,
	name: "A person",
	url: "https://goodwatch.app/person/12-a-person",
	profile_url: "https://image.tmdb.org/t/p/w185/profile.jpg",
	known_for: titles,
}
const key = "k0123456789abcdefab"
function fixture() {
	const reads: {
		viewer: unknown
		name: string
		args: Parameters<Dependencies["read"]>[3]
	}[] = []
	const edits: ReturnType<typeof textCard>[] = []
	const states = new Map()
	let done!: () => void
	const finished = new Promise<void>((resolve) => {
		done = resolve
	})
	const deps: Dependencies = {
		linkedUser: async () => null,
		getGuild: async () => null,
		unlink: async () => {},
		memberRead: async () => {
			throw new Error("Unexpected member read")
		},
		read: async (viewer, _origin, name, args) => {
			reads.push({ viewer, name, args })
			if (name === "search_people") return { items: [person] }
			if (name === "get_person") return { person }
			if (name === "get_title")
				return { title: { ...title, id: String(args.title_id ?? title.id) } }
			if (name === "get_discover_filters")
				return {
					genres: ["Comedy"],
					providers: [{ id: 119, name: "Prime Video" }],
				}
			return {
				items: titles,
				next_cursor: args.cursor === "offset:20" ? null : "offset:10",
			}
		},
		hot: async () => titles,
		searchTitles: async (query) => {
			reads.push({ viewer: null, name: "searchTitles", args: { query } })
			return { titles }
		},
		displays: async () => new Map(),
		take: async () => ({ allowed: true, store: "memory" }),
		saveState: async (state) => {
			states.set(key, state)
			return key
		},
		loadState: async (key) => states.get(key) ?? null,
		edit: async (_app, _token, body) => {
			edits.push(body as ReturnType<typeof textCard>)
		},
		log: () => done(),
	}
	const run = (
		type: number,
		data: Interaction["data"],
		publicMessage = false,
		components?: Component[],
	) =>
		routeInteraction(
			{
				type,
				data,
				locale: "de",
				application_id: "app",
				token: "token",
				user: { id: "user" },
				message: {
					flags: publicMessage
						? IS_COMPONENTS_V2
						: IS_COMPONENTS_V2 | EPHEMERAL,
					...(components ? { components } : {}),
				},
			},
			deps,
		)
	return { deps, reads, edits, states, run, finished }
}
/** Every component in a tree, depth first, so tests don't depend on container nesting. */
function all(components: Component[]): Component[] {
	return components.flatMap((c) => [
		c,
		...all(c.components ?? []),
		...(c.accessory ? all([c.accessory]) : []),
	])
}
const selectIn = (components: Component[]) =>
	all(components).find((c) => c.type === 3)!
const buttonsIn = (components: Component[]) =>
	all(components).filter((c) => c.type === 2)
function assertLimits(components: Component[]) {
	assert.ok(componentCount(components) <= 40)
	function visit(items: Component[]) {
		for (const c of items) {
			if (c.label) assert.ok(String(c.label).length <= 80)
			if (c.custom_id) assert.ok(String(c.custom_id).length <= 100)
			if (c.type === 1) {
				assert.ok(c.components!.length <= 5)
				if (c.components!.some((x) => x.type === 3))
					assert.equal(c.components!.length, 1)
			}
			if (c.type === 3) {
				const options = c.options as { label: string; description: string }[]
				assert.ok(options.length <= 25)
				for (const o of options) {
					assert.ok(o.label.length <= 100)
					assert.ok((o.description ?? "").length <= 100)
				}
			}
			visit(c.components ?? [])
			if (c.accessory) visit([c.accessory])
		}
	}
	visit(components)
}
test("every builder stays within component, button, select and text limits", () => {
	for (const shared of [true, false]) {
		for (const card of [
			titleListCard("Similar", titles, {
				share: shared,
				shareId: listCustomId("similar-share", title.id),
			}),
			titleListCard("Discover", titles, {
				page: 1,
				stateKey: key,
				next: true,
				share: shared,
				shareId: listCustomId("discover-share", `${key}:1`),
			}),
			titleListCard("Hot", titles, {
				share: shared,
				url: "https://goodwatch.app/hot-on-socials",
			}),
			personCard(person, shared),
			personCard({ ...person, profile_url: null, known_for: [] }, shared),
			titleCard(title, "DE", { share: shared }),
			textCard("A message"),
		])
			assertLimits(card.components)
		assertLimits(titleSelect(titles, shared))
	}
	assert.equal(titleSelect(titles).length, 1)
	assert.equal(
		(titleSelect(titles)[0].components![0].options as unknown[]).length,
		25,
	)
	assertLimits(titleListCard("Empty", []).components)
})
test("builders reject invalid row, label and select lengths", () => {
	for (const components of [
		[{ type: 1, components: Array.from({ length: 6 }, () => ({ type: 2 })) }],
		[{ type: 1, components: [{ type: 3, options: [] }, { type: 2 }] }],
		[{ type: 2, label: "x".repeat(81) }],
		[
			{
				type: 3,
				options: Array.from({ length: 26 }, () => ({
					label: "title",
					value: "movie:1",
				})),
			},
		],
		[{ type: 3, options: [{ label: "x".repeat(101), value: "movie:1" }] }],
		[
			{
				type: 3,
				options: [
					{ label: "title", description: "x".repeat(101), value: "movie:1" },
				],
			},
		],
	])
		assert.throws(() => message(components), /limit/)
})
for (const name of ["similar", "person", "hot", "discover"])
	test(`${name} defers ephemerally and renders a guest result`, async () => {
		const f = fixture()
		const response = await f.run(2, {
			name,
			options: [
				{ name: "title", value: "movie:42" },
				{ name: "name", value: "12" },
			],
		})
		assert.deepEqual(response, { type: 5, data: { flags: EPHEMERAL } })
		assert.equal(f.edits.length, 0)
		await f.finished
		assert.equal(f.edits[0].flags, IS_COMPONENTS_V2 | EPHEMERAL)
		assertLimits(f.edits[0].components)
		assert.match(JSON.stringify(f.edits), /Share to channel/)
	})
for (const name of ["similar", "person"]) {
	for (const query of ["", "a", " \t "])
		test(`${name} blank/short autocomplete skips reads: ${JSON.stringify(
			query,
		)}`, async () => {
			const f = fixture()
			assert.deepEqual(
				await f.run(4, {
					name,
					options: [
						{
							name: name === "person" ? "name" : "title",
							value: query,
							focused: true,
						},
					],
				}),
				{ type: 8, data: { choices: [] } },
			)
			assert.equal(f.reads.length, 0)
		})
	test(`${name} autocomplete uses guest search and caps choices`, async () => {
		const f = fixture()
		const response = await f.run(4, {
			name,
			options: [
				{
					name:
						name === "person" ? "name" : name === "search" ? "query" : "title",
					value: " query ",
					focused: true,
				},
			],
		})
		const choices = (
			response as { data: { choices: { name: string; value: string }[] } }
		).data.choices
		assert.equal(choices.length, name === "person" ? 1 : 25)
		assert.equal(choices[0].value, name === "person" ? "12" : "movie:1")
		assert.ok(choices.every((c) => c.name.length <= 100))
		assert.equal(
			f.reads[0].name,
			name === "person" ? "search_people" : "search_titles",
		)
		assert.deepEqual(f.reads[0].args, { query: "query", limit: 25 })
	})
}
test("person autocomplete has a two-second budget and safely handles failed reads", async () => {
	for (const read of [
		() => new Promise<Record<string, unknown>>(() => {}),
		async () => {
			throw new Error("private")
		},
	]) {
		const f = fixture()
		f.deps.read = read
		const start = Date.now()
		assert.deepEqual(
			await f.run(4, {
				name: "person",
				options: [{ name: "name", value: "person", focused: true }],
			}),
			{ type: 8, data: { choices: [] } },
		)
		assert.ok(Date.now() - start < 2800)
	}
})
for (const [action, value] of [
	["similar-share", "movie:42"],
	["person-share", "12"],
	["hot-share", "now"],
	["discover-share", `${key}:0`],
] as const)
	test(`${action} rebuilds public guest content from its ID`, async () => {
		const f = fixture()
		f.states.set(key, { args: { type: "movie" } })
		assert.deepEqual(
			await f.run(3, { custom_id: listCustomId(action, value) }),
			{ type: 5, data: { flags: 0 } },
		)
		await f.finished
		assert.equal(f.edits[0].flags, IS_COMPONENTS_V2)
		assert.doesNotMatch(
			JSON.stringify(f.edits),
			/Share to channel|member|taste_match/,
		)
		assertLimits(f.edits[0].components)
		assert.ok(
			f.reads.every((r) => JSON.stringify(r.viewer) === '{"country":"DE"}'),
		)
	})
for (const publicMessage of [false, true])
	test(`title select opens privately: public=${publicMessage}`, async () => {
		const f = fixture()
		assert.deepEqual(
			await f.run(
				3,
				{
					custom_id: listCustomId("open", publicMessage ? "public" : "private"),
					values: ["movie:42"],
				},
				publicMessage,
			),
			publicMessage ? { type: 5, data: { flags: EPHEMERAL } } : { type: 6 },
		)
		await f.finished
		assert.equal(f.reads[0].name, "get_title")
		assert.deepEqual(f.reads[0].args, { title_id: "movie:42" })
		assert.match(JSON.stringify(f.edits), /A title/)
		assert.equal(JSON.stringify(f.edits).includes("Share to channel"), true)
	})
test("title Similar button shows the disabled card with a loading line and reads similar titles", async () => {
	const f = fixture()
	const card = titleCard(title, "DE").components
	const buttons = buttonsIn(card).filter((b) => b.style !== 5 || !b.emoji)
	assert.deepEqual(buttons.map((b) => b.label).slice(-3), [
		"Similar",
		"Open on GoodWatch",
		"Share to channel",
	])
	const answer = (await f.run(
		3,
		{ custom_id: formatCustomId("similar", title.id) },
		false,
		card,
	)) as { type: number; data: { components: Component[] } }
	assert.equal(answer.type, 7)
	assert.equal(answer.data.components.at(-1)!.content, "-# Loading Similar…")
	assert.ok(buttonsIn(answer.data.components).every((b) => b.disabled === true))
	// Without the pressed message's components there's nothing to show, so the press updates silently.
	assert.deepEqual(
		await f.run(3, { custom_id: formatCustomId("similar", title.id) }),
		{ type: 6 },
	)
	await f.finished
	assert.equal(f.reads[0].name, "get_similar_titles")
	assert.deepEqual(f.reads[0].args, { title_id: title.id, limit: 10 })
})
test("discover applies local service IDs, filters and ten-title pagination", async () => {
	const f = fixture()
	await f.run(2, {
		name: "discover",
		options: Object.entries({
			type: "show",
			mood: "funny",
			genre: "Comedy",
			service: "119",
			sort: "score",
		}).map(([name, value]) => ({ name, value })),
	})
	await f.finished
	const state = f.states.get(key)
	assert.deepEqual(state, {
		args: {
			type: "show",
			moods: ["funny"],
			genres: ["Comedy"],
			providers: [119],
			order: "score",
			for_you: false,
		},
	})
	assert.deepEqual(f.reads.at(-1)!.args, {
		...state.args,
		limit: 10,
		cursor: "offset:0",
	})
	const g = fixture()
	g.states.set(key, state)
	assert.deepEqual(
		await g.run(3, { custom_id: listCustomId("discover", `${key}:2`) }),
		{ type: 6 },
	)
	await g.finished
	assert.equal(g.reads[0].args.cursor, "offset:20")
	assert.equal(g.reads[0].args.limit, 10)
	const buttons = buttonsIn(g.edits[0].components)
	assert.equal(buttons.find((b) => b.label === "Next")!.disabled, true)
	assert.equal(buttons.find((b) => b.label === "Previous")!.disabled, false)
	assert.ok(buttons.every((b) => String(b.custom_id).length <= 100))
})
test("expired discovery and unavailable local service explain how to recover", async () => {
	const f = fixture()
	await f.run(3, { custom_id: listCustomId("discover", `${key}:1`) })
	await f.finished
	assert.match(JSON.stringify(f.edits), /expired/)
	assert.equal(f.reads.length, 0)
	const g = fixture()
	await g.run(2, {
		name: "discover",
		options: [{ name: "service", value: "Missing" }],
	})
	await g.finished
	assert.match(JSON.stringify(g.edits), /unavailable in DE/)
	assert.equal(
		g.reads.some((r) => r.name === "discover_titles"),
		false,
	)
})
test("small discovery state round trips inline; invalid IDs are rejected", async () => {
	const state = { args: {} }
	const inline = await saveDiscoverState(state)
	assert.equal(inline[0], "i")
	assert.deepEqual(await loadDiscoverState(inline), state)
	assert.ok(listCustomId("discover-share", `${inline}:999999`).length <= 100)
	for (const id of [
		"gw1:open:movie:1",
		"gw1:person-share:0",
		`gw1:discover:${key}:-1`,
		"x".repeat(101),
	])
		assert.equal(parseListId(id), null)
})
test("static registration pins choices to the real domain definitions", async () => {
	const { MOODS } = await import("../../domain/moods.ts")
	const { discoverFilters } = await import("../mcp/discover-filters.ts")
	const options = commands.find((c) => c.name === "discover")!.options
	for (const name of ["genre", "service"]) {
		const option = options.find((o) => o.name === name)!
		assert.equal("choices" in option, false)
		assert.equal("autocomplete" in option && option.autocomplete, true)
	}
	const choices = (name: string) =>
		(
			options.find((o) => o.name === name) as {
				choices: { name: string; value: string }[]
			}
		).choices
	assert.deepEqual(
		choices("type").map((c) => c.value),
		[
			...discoverFilters.type.unwrap().options.filter((t) => t !== "all"),
			"any",
		],
	)
	assert.deepEqual(
		choices("mood"),
		MOODS.map((m) => ({ name: m.name, value: m.key })),
	)
	assert.deepEqual(
		choices("sort").map((c) => c.value),
		discoverFilters.order.unwrap().options,
	)
})
for (const action of ["similar", "watch", "open", "previous", "next"]) {
	test(`public ${action} creates a private card`, async () => {
		const f = fixture()
		f.states.set(key, { args: {} })
		const data =
			action === "open"
				? { custom_id: listCustomId("open", "public"), values: ["movie:42"] }
				: action === "previous" || action === "next"
					? {
							custom_id: listCustomId(
								"discover",
								`${key}:${action === "previous" ? 0 : 2}`,
							),
						}
					: {
							custom_id: formatCustomId(
								action as "similar" | "watch",
								"movie:42",
							),
						}
		assert.deepEqual(await f.run(3, data, true), {
			type: 5,
			data: { flags: EPHEMERAL },
		})
		await f.finished
		assert.equal(f.edits[0].flags, IS_COMPONENTS_V2 | EPHEMERAL)
		assert.match(JSON.stringify(f.edits), /Share to channel/)
	})
}
for (const name of ["genre", "service"]) {
	test(`discover ${name} autocomplete uses country IDs, small queries, and the 25 choice cap`, async () => {
		const f = fixture()
		f.deps.read = async (viewer, _origin, tool) => {
			assert.deepEqual(viewer, { country: "DE" })
			assert.equal(tool, "get_discover_filters")
			return {
				genres: Array.from({ length: 30 }, (_, i) => `Genre ${i}`),
				providers: Array.from({ length: 30 }, (_, i) => ({
					id: i + 1,
					name: `Service ${i}`,
				})),
			}
		}
		const result = await f.run(4, {
			name: "discover",
			options: [{ name, value: "", focused: true }],
		})
		const choices = (
			result.data as { choices: { name: string; value: string }[] }
		).choices
		assert.equal(result.type, 8)
		assert.equal(choices.length, 25)
		assert.equal(choices[0].value, name === "genre" ? "Genre 0" : "1")
	})
	test(`discover rejects free text ${name} and handles startup`, async () => {
		for (const unavailable of [false, true]) {
			const f = fixture()
			if (unavailable)
				f.deps.read = async () => ({ status: "data_unavailable" })
			await f.run(2, { name: "discover", options: [{ name, value: "fake" }] })
			await f.finished
			assert.match(
				JSON.stringify(f.edits),
				unavailable
					? /Discover is starting up. Try again in a minute./
					: /unavailable in DE/,
			)
			assert.equal(f.states.size, 0)
		}
	})
}
for (const command of ["search", "similar", "person"]) {
	test(`${command} trims and caps execution input and guards missing input`, async () => {
		for (const value of [undefined, "   ", "  " + "x".repeat(200)]) {
			const f = fixture()
			await f.run(2, {
				name: command,
				options: [{ name: command === "person" ? "name" : "title", value }],
			})
			await f.finished
			if (value?.trim()) assert.equal(f.reads[0].args.query, "x".repeat(120))
			else assert.equal(f.reads.length, 0)
		}
	})
}

for (const name of ["genre", "service"]) {
	test(`discover ${name} autocomplete filters names and handles timeouts`, async () => {
		const f = fixture()
		const result = await f.run(4, {
			name: "discover",
			options: [{ name, value: "zz", focused: true }],
		})
		assert.deepEqual(result, { type: 8, data: { choices: [] } })
		for (const read of [
			() => new Promise<Record<string, unknown>>(() => {}),
			async () => {
				throw new Error("private")
			},
		]) {
			const g = fixture()
			g.deps.read = read
			const start = Date.now()
			assert.deepEqual(
				await g.run(4, {
					name: "discover",
					options: [{ name, value: "", focused: true }],
				}),
				{ type: 8, data: { choices: [] } },
			)
			assert.ok(Date.now() - start < 2800)
		}
	})
}

test("a linked member opens a discover title with match_label and shares a fresh guest card", async () => {
	const memberCalls: string[] = []
	const configure = (f: ReturnType<typeof fixture>) => {
		f.deps.linkedUser = async () => "linked-member"
		f.deps.memberRead = async (user, name, args) => {
			assert.equal(user, "linked-member")
			memberCalls.push(name)
			if (name === "discover_titles") {
				assert.equal(args.exclude_seen, true)
				assert.equal(args.order, "for_you")
				assert.equal(args.for_you, true)
				assert.deepEqual(args.providers, [8])
				return { items: [title], next_cursor: "offset:10" }
			}
			return name === "get_settings"
				? { country: "FR", service_ids: [8] }
				: {
						title: {
							...title,
							id: String(args.title_id),
							match: 93,
							match_label: "Excellent taste fit",
						},
						member: { score: 9, want_to_see: true },
					}
		}
		return f
	}
	const discovery = configure(fixture())
	await discovery.run(2, { name: "discover" })
	await discovery.finished
	assert.equal(discovery.reads.length, 0)
	assert.match(
		JSON.stringify(discovery.edits[0]),
		/For you · streaming in France/,
	)
	const next = buttonsIn(discovery.edits[0].components).find(
		(c) => c.label === "Next",
	)!
	const paging = configure(fixture())
	paging.deps.loadState = discovery.deps.loadState
	await paging.run(3, { custom_id: String(next.custom_id) })
	await paging.finished
	assert.equal(paging.reads.length, 0)
	assert.match(JSON.stringify(paging.edits[0]), /page 2/)
	const select = selectIn(discovery.edits[0].components)
	const selected = (select.options as { value: string }[])[0].value
	const opened = configure(fixture())
	assert.deepEqual(
		await opened.run(3, {
			custom_id: String(select.custom_id),
			values: [selected],
		}),
		{ type: 6 },
	)
	await opened.finished
	const personal = JSON.stringify(opened.edits[0])
	assert.match(personal, /Excellent taste fit/)
	assert.doesNotMatch(personal, /93%/)
	assert.match(personal, /You rated it|Wishlist/)
	// The top block is the share place (locale Germany); the member's France is in the member block.
	assert.match(personal, /Not on a subscription service in Germany/)
	assert.match(personal, /Excellent taste fit/)
	const shareButton = buttonsIn(opened.edits[0].components).find(
		(c) => c.label === "Share to channel",
	)!
	const shared = configure(fixture())
	const callsBefore = memberCalls.length
	assert.deepEqual(
		await shared.run(3, {
			custom_id: String(shareButton.custom_id),
		}),
		{ type: 5, data: { flags: 0 } },
	)
	await shared.finished
	assert.equal(memberCalls.length, callsBefore)
	assert.deepEqual(
		shared.reads.map((r) => [r.name, r.args]),
		[["get_title", { title_id: selected }]],
	)
	assert.equal(shared.edits[0].flags, IS_COMPONENTS_V2)
	assert.doesNotMatch(
		JSON.stringify(shared.edits[0]),
		/Excellent taste fit|You rated|Wishlist|93%/,
	)
	assert.match(
		JSON.stringify(shared.edits[0]),
		/Not on a subscription service in Germany/,
	)
})

for (const source of ["similar", "person", "hot", "similar-button"]) {
	for (const publicMessage of [false, true]) {
		test(`linked member opens a personal title from ${source}: public=${publicMessage}`, async () => {
			const f = fixture()
			f.deps.linkedUser = async () => "linked-member"
			if (source === "similar-button")
				await f.run(
					3,
					{ custom_id: formatCustomId("similar", title.id) },
					publicMessage,
				)
			else
				await f.run(2, {
					name: source,
					options: [
						{ name: "title", value: title.id },
						{ name: "name", value: "12" },
					],
				})
			await f.finished
			const select = selectIn(f.edits[0].components)
			const g = fixture()
			g.deps.linkedUser = async () => "linked-member"
			g.deps.memberRead = async (_user, name) =>
				name === "get_settings"
					? { country: "FR" }
					: {
							title: {
								...title,
								match: 93,
								match_label: "Excellent taste fit",
							},
							member: {},
						}
			assert.deepEqual(
				await g.run(
					3,
					{
						custom_id: String(select.custom_id),
						values: [title.id],
					},
					publicMessage,
				),
				publicMessage ? { type: 5, data: { flags: EPHEMERAL } } : { type: 6 },
			)
			await g.finished
			assert.match(JSON.stringify(g.edits[0]), /Excellent taste fit/)
			// The top block is a guest read for the share place, as Share would post it.
			assert.deepEqual(
				g.reads.map((r) => [r.viewer, r.name]),
				[[{ country: "DE" }, "get_title"]],
			)
		})
	}
}

test("hot adapter maps the Hot on socials row into /hot titles with their posts", () => {
	// The shape getHotOnSocials returns: catalog poster paths, social items, curves.
	const item = (i: number, source: "bluesky" | "youtube" | "rss") => ({
		id: `post-${i}`,
		image: source === "bluesky" ? `/api/social/image/post-${i}` : null,
		source,
		url: `https://example.com/post/${i}`,
		author: `author${i}`,
		publisher: source === "rss" ? "Deadline" : `author${i}`,
		at: "2026-10-22T10:00:00.000Z",
		text: `What people say ${i}`,
		sourceId: null,
		...(source === "youtube" ? { video: "dQw4w9WgXcQ" } : {}),
		english: true,
	})
	const row = {
		day: "2026-10-22",
		titles: Array.from({ length: 14 }, (_, i) => ({
			mediaType: i % 2 ? ("show" as const) : ("movie" as const),
			tmdbId: 100 + i,
			title: `Buzz ${i}`,
			year: 2026,
			poster: i === 1 ? null : `/p${i}.jpg`,
			backdrop: `/b${i}.jpg`,
			rank: i + 1,
			lift: 3.2,
			views: 50_000,
			usual: 9_000,
			curve: [1, 2, 3],
			reason: null,
			move: i === 0 ? ("new" as const) : i,
			items:
				i === 0 ? [item(1, "bluesky"), item(2, "youtube"), item(3, "rss")] : [],
		})),
	}
	const titles = hotTitles(row)
	assert.equal(titles.length, 12)
	assert.deepEqual(titles[0], {
		id: "movie:100",
		name: "Buzz 0",
		year: 2026,
		poster_url: "https://image.tmdb.org/t/p/w342/p0.jpg",
		backdrop_url: "https://image.tmdb.org/t/p/w780/b0.jpg",
		rank: 1,
		move: "new",
		reason: null,
		posts: [
			{
				url: "https://example.com/post/1",
				author: "author1",
				platform: "Bluesky",
				kind: "post",
				text: "What people say 1",
				image: "https://goodwatch.app/api/social/image/post-1",
				at: "2026-10-22T10:00:00.000Z",
			},
			{
				url: "https://example.com/post/2",
				author: "author2",
				platform: "YouTube",
				kind: "video",
				text: "What people say 2",
				image: "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
				at: "2026-10-22T10:00:00.000Z",
			},
			{
				url: "https://example.com/post/3",
				author: "author3",
				platform: "Deadline",
				kind: "article",
				text: "What people say 3",
				image: null,
				at: "2026-10-22T10:00:00.000Z",
			},
		],
	})
	assert.equal(titles[1].poster_url, null)
	assert.deepEqual(hotTitles(null), [])
})

test("/hot puts what people say first: three titles a page with quotes, post images, and links to the posts", () => {
	const post = (i: number, platform = "Bluesky"): HotPost => ({
		url: `https://bsky.app/profile/a/post/${i}`,
		author: `critic${i}.bsky.social`,
		platform,
		kind: "post",
		text: `Just watched it https://t.co/x and wow, ${"the third act is something else ".repeat(
			8,
		)}`,
		image: `https://goodwatch.app/api/social/image/p${i}`,
		at: "2026-10-22T10:00:00.000Z",
	})
	const hot: HotTitle[] = Array.from({ length: 12 }, (_, i) => ({
		id: `movie:${i + 1}`,
		name: `Hot ${i + 1}`,
		year: 2026,
		poster_url: `https://image.tmdb.org/t/p/w342/p${i}.jpg`,
		goodwatch_score: 81,
		rank: i + 1,
		move: i === 0 ? "new" : -2,
		posts: [post(i * 2), post(i * 2 + 1)],
	}))
	for (const page of [0, 1, 3]) {
		const card = hotCard(hot, { page })
		assertLimits(card.components)
		const sent = JSON.stringify(card)
		assert.match(sent, new RegExp(`page ${page + 1} of 4`))
		const blocks = card.components.filter((c) => c.type === 17)
		assert.equal(blocks.length, 3)
		const [first] = blocks
		assert.equal(first.components![0].accessory?.type, 11)
		const gallery = first.components!.find((c) => c.type === 12)!
		assert.equal((gallery.items as unknown[]).length, 2)
		const links = buttonsIn([first]).filter((b) => b.style === 5)
		assert.deepEqual(
			links.map((b) => b.label),
			[
				`critic${page * 6}.bsky.social on Bluesky`,
				`critic${page * 6 + 1}.bsky.social on Bluesky`,
			],
		)
		assert.equal(selectIn(card.components).custom_id, `gw1:open:h:${page}`)
		assert.doesNotMatch(sent, /t\.co|—|!/)
		assert.match(sent, /<t:\d+:R>/)
	}
	const first = JSON.stringify(hotCard(hot))
	assert.match(first, /No\. 1 on socials, new today/)
	assert.match(
		JSON.stringify(
			hotCard([{ ...hot[0], reason: { kind: "trailer", day: "2026-10-20" } }]),
		),
		/No\. 1 on socials, new today, trailer Oct 20/,
	)
	const quiet = hotCard([
		{
			...hot[0],
			posts: [],
			backdrop_url: "https://image.tmdb.org/t/p/w780/b.jpg",
		},
	])
	assert.match(JSON.stringify(quiet), /No posts picked for it yet/)
	assert.match(JSON.stringify(quiet), /w780\/b\.jpg/)
	assert.match(first, /No\. 2 on socials, down 2 since yesterday/)
	assert.match(first, /gw1:hot:1/)
	assert.match(first, /gw1:hot-share:0/)
	const single = hotCard([{ ...hot[0], posts: [post(1, "Mastodon")] }], {
		share: true,
	})
	assert.doesNotMatch(JSON.stringify(single), /Share to channel|Previous/)
	assert.match(JSON.stringify(single), /View post on Mastodon/)
	assertLimits(hotCard([{ ...hot[0], posts: [], poster_url: null }]).components)
})

test("/hot pages and shares by page, and old hot-share buttons still open the first page", async () => {
	for (const [id, page, flags] of [
		["gw1:hot:2", 2, null],
		["gw1:hot-share:1", 1, 0],
		["gw1:hot-share:now", 0, 0],
	] as const) {
		const f = fixture()
		f.deps.hot = async () =>
			Array.from({ length: 12 }, (_, i) => ({
				id: `movie:${i + 1}`,
				name: `Hot ${i + 1}`,
				year: 2026,
			}))
		const response = await f.run(3, { custom_id: id })
		assert.deepEqual(
			response,
			flags === null ? { type: 6 } : { type: 5, data: { flags } },
		)
		await f.finished
		assert.match(JSON.stringify(f.edits), new RegExp(`Hot ${page * 3 + 1}\\b`))
	}
})

test("a title opened from a list goes Back to the same list page", async () => {
	const f = fixture()
	f.states.set(key, { args: { type: "movie" } })
	for (const [ref, read] of [
		[`d:${key}:2`, "discover_titles"],
		["s:movie:42", "get_similar_titles"],
		["p:12", "get_person"],
		["h:1", null],
	] as const) {
		const g = fixture()
		g.states.set(key, { args: { type: "movie" } })
		await g.run(3, { custom_id: `gw1:open:${ref}`, values: ["movie:7"] })
		await g.finished
		const back = buttonsIn(g.edits[0].components).find(
			(b) => b.label === "Back",
		)
		assert.equal(back?.custom_id, `gw1:back:${ref}`)
		assert.equal(buttonsIn(g.edits[0].components)[0].label, "Back")
		const h = fixture()
		h.states.set(key, { args: { type: "movie" } })
		assert.deepEqual(await h.run(3, { custom_id: String(back!.custom_id) }), {
			type: 6,
		})
		await h.finished
		if (read) assert.equal(h.reads[0].name, read)
		if (ref.startsWith("d:")) {
			assert.equal(h.reads[0].args.cursor, "offset:20")
			assert.match(JSON.stringify(h.edits), /gw1:open:d:k0123456789abcdefab:2/)
		}
		if (ref === "h:1") assert.match(JSON.stringify(h.edits), /page 2 of/)
	}
	// Old menus without a list keep opening titles, without Back.
	await f.run(3, { custom_id: "gw1:open:private", values: ["movie:7"] })
	await f.finished
	assert.equal(
		buttonsIn(f.edits[0].components).some((b) => b.label === "Back"),
		false,
	)
})

test("/search with free text answers with a ranked results list that pages and opens titles with Back", async () => {
	const f = fixture()
	await f.run(2, {
		name: "search",
		options: [{ name: "query", value: "dune" }],
	})
	await f.finished
	assert.deepEqual(
		f.reads.map((r) => r.name),
		["searchTitles"],
	)
	assertLimits(f.edits[0].components)
	const sent = JSON.stringify(f.edits[0])
	assert.match(sent, /Results for dune/)
	assert.match(sent, /Page 1 of 3/)
	const select = selectIn(f.edits[0].components)
	assert.match(String(select.custom_id), /^gw1:open:q:k0123456789abcdefab:0$/)
	const next = buttonsIn(f.edits[0].components).find((b) => b.label === "Next")!
	const g = fixture()
	for (const [k, v] of f.states) g.states.set(k, v)
	// The fixture keeps one key for every state, like a Valkey key.
	await g.run(3, { custom_id: String(next.custom_id) })
	await g.finished
	assert.match(JSON.stringify(g.edits), /Page 2 of 3/)
	assert.deepEqual(
		g.reads,
		[],
		"paging uses the stored ranked IDs without a second search",
	)
	const opened = fixture()
	for (const [k, v] of f.states) opened.states.set(k, v)
	await opened.run(3, {
		custom_id: String(select.custom_id),
		values: ["movie:7"],
	})
	await opened.finished
	assert.equal(
		buttonsIn(opened.edits[0].components).some(
			(b) => b.label === "Where to watch",
		),
		false,
	)
	// An old Where to watch button still opens the card, with its links and Back.
	const watched = fixture()
	for (const [k, v] of f.states) watched.states.set(k, v)
	await watched.run(3, { custom_id: `gw1:watch:movie:7:q:${key}:0` })
	await watched.finished
	const back = buttonsIn(watched.edits[0].components).find(
		(b) => b.label === "Back",
	)!
	assert.equal(back.custom_id, `gw1:back:q:${key}:0`)
	assert.equal(
		buttonsIn(opened.edits[0].components).find((b) => b.label === "Back")
			?.custom_id,
		back.custom_id,
	)
	const returned = fixture()
	for (const [k, v] of f.states) returned.states.set(k, v)
	await returned.run(3, { custom_id: String(back.custom_id) })
	await returned.finished
	assert.match(JSON.stringify(returned.edits), /Results for dune/)
	assert.deepEqual(returned.reads, [])
	const empty = fixture()
	empty.deps.searchTitles = async () => ({ titles: [] })
	await empty.run(2, {
		name: "search",
		options: [{ name: "title", value: "zzzz" }],
	})
	await empty.finished
	assert.match(
		JSON.stringify(empty.edits),
		/No titles match zzzz. Try another search./,
	)
})

test("search ranking: better known titles first, led by how closely the name matches", () => {
	const t = (
		name: string,
		votes: number,
		year = 2000,
	): GuestTitle & { votes: number } => ({
		id: `movie:${votes}`,
		name,
		year,
		votes,
	})
	assert.deepEqual(
		rankSearchResults("Dune", [
			t("A Dune Story", 5),
			t("Dune: Part Two", 900, 2024),
			t("Dunes of Mars", 2000),
			t("Dune", 1000, 2021),
			t("Dune", 300, 1984),
		]).map((r) => [r.name, r.year]),
		[
			["Dune", 2021],
			["Dune", 1984],
			["Dunes of Mars", 2000],
			["Dune: Part Two", 2024],
			["A Dune Story", 2000],
		],
	)
})

test("members and guests pass the Discord identity to free-text search and show the cap note", async () => {
	for (const member of [false, true]) {
		const f = fixture()
		f.deps.linkedUser = async () => (member ? "goodwatch-member" : null)
		f.deps.memberRead = async () => ({ country: "DE" })
		f.deps.searchTitles = async (query, user) => {
			assert.equal(query, "dark vibes")
			assert.equal(user, "user")
			return {
				titles: [title],
				note: "Showing title matches. Mood searches reset tomorrow.",
			}
		}
		await f.run(2, {
			name: "search",
			options: [{ name: "query", value: "dark vibes" }],
		})
		await f.finished
		assert.match(
			JSON.stringify(f.edits),
			/Showing title matches\. Mood searches reset tomorrow\./,
		)
	}
})

test("8B link prompt and linked cards obey component limits and use only the GoodWatch handle", () => {
	const prompt = linkPromptCard("https://goodwatch.app/discord/link?n=nonce")
	assert.equal(prompt.flags, IS_COMPONENTS_V2 | EPHEMERAL)
	assert.equal(prompt.components[0].type, 17)
	assert.deepEqual(prompt.components[0].components![0], {
		type: 10,
		content:
			"## Link GoodWatch\n- Your taste match on every title\n- Picks from your own services\n- Rate, log, and add to your Wishlist without leaving Discord",
	})
	assert.equal(
		prompt.components[0].components![1].components![0].label,
		"Link GoodWatch",
	)
	for (const body of [prompt, linkedCard("goodwatch_member"), linkedCard()])
		assertLimits(body.components)
	assert.match(
		JSON.stringify(linkedCard("goodwatch_member")),
		/＠goodwatch|@goodwatch/,
	)
	assert.equal(
		linkedCard().components[0].components![0].content,
		"## Linked to GoodWatch",
	)
})

for (const failure of ["reject", "unavailable"] as const) {
	test(`member title card keeps the guest title when get_title ${
		failure === "reject" ? "rejects" : "is unavailable"
	}`, async () => {
		const f = fixture()
		f.deps.linkedUser = async () => "linked-member"
		f.deps.memberRead = async (_user, name) => {
			if (name === "get_settings") return { country: "FR", service_ids: [8] }
			assert.equal(name, "get_title")
			if (failure === "reject") throw new Error("private backend failure")
			return { status: "data_unavailable" }
		}
		await f.run(3, {
			custom_id: listCustomId("open", "private"),
			values: ["show:42"],
		})
		await f.finished
		assert.match(JSON.stringify(f.edits), /A title/)
		assert.doesNotMatch(
			JSON.stringify(f.edits),
			/private backend failure|You rated|Wishlist|taste fit/,
		)
		assert.deepEqual(
			f.reads.map(({ viewer, name, args }) => ({ viewer, name, args })),
			[
				{
					viewer: { country: "DE" },
					name: "get_title",
					args: { title_id: "show:42" },
				},
			],
		)
	})
}

test("title card guest reads come from the five-minute cache; the member's own read never does", async () => {
	const values = new Map<string, string>()
	const store = {
		get: async (k: string) => values.get(k) ?? null,
		set: async (k: string, v: string) => {
			values.set(k, v)
		},
	}
	let memberReads = 0
	let guestReads = 0
	for (const member of [false, false, true, true]) {
		const f = fixture()
		f.deps.titleStore = async () => store
		if (member) {
			f.deps.linkedUser = async () => "linked-member"
			f.deps.memberRead = async (_user, name) => {
				if (name === "get_title") memberReads++
				return name === "get_settings"
					? { country: "DE" }
					: { title, member: { want_to_see: true } }
			}
		}
		await f.run(3, { custom_id: "gw1:open:private", values: ["movie:7"] })
		await f.finished
		await new Promise((resolve) => setImmediate(resolve))
		guestReads += f.reads.filter((r) => r.name === "get_title").length
		assert.match(JSON.stringify(f.edits), /Open on GoodWatch/)
		if (member) assert.match(JSON.stringify(f.edits), /In your Wishlist/)
	}
	assert.equal(guestReads, 1, "only the first view reads the catalog")
	assert.equal(memberReads, 2, "every member view reads the member's own state")
	assert.equal(values.size, 1)
	assert.doesNotMatch([...values.values()][0], /want_to_see|linked-member/)
	assert.match([...values.keys()][0], /^discord:title:v1:movie:7:DE:all$/)
})

test("/search shows its reading while ranking, then preserves reading and three reasons through Open and Back", async () => {
	const f = fixture()
	const reading = [
		{ text: "Funny", kind: "want" as const },
		{ text: "Family", kind: "attribute" as const },
		{ text: "Forest", kind: "attribute" as const },
		{ text: "Not horror", kind: "excluded" as const },
	]
	const reasons = [
		{ text: "but scare only 1", kind: "mismatch" as const },
		{ text: "Funny 9", kind: "dimension" as const },
		{ text: "Family", kind: "attribute" as const },
		{ text: "Forest", kind: "attribute" as const },
		{ text: "Fourth chip", kind: "attribute" as const },
	]
	let ranked!: () => void
	const ranking = new Promise<void>((resolve) => {
		ranked = resolve
	})
	let progressed!: () => void
	const progress = new Promise<void>((resolve) => {
		progressed = resolve
	})
	const edit = f.deps.edit
	f.deps.edit = async (...args) => {
		await edit(...args)
		progressed()
	}
	f.deps.searchTitles = async (_query, _user, onReading) => {
		onReading?.(reading)
		await ranking
		return { titles: [{ ...title, reasons }], reading }
	}
	const ack = await f.run(2, {
		name: "search",
		options: [{ name: "query", value: "funny family forest" }],
	})
	assert.equal(ack.type, 5)
	await progress
	assert.equal(f.edits.length, 1)
	assert.match(JSON.stringify(f.edits[0]), /Results for funny family forest/)
	assert.match(
		JSON.stringify(f.edits[0]),
		/Reads as: Funny · Family · Forest · not horror/,
	)
	assert.match(JSON.stringify(f.edits[0]), /Finding matching movies and shows…/)
	await new Promise((resolve) => setTimeout(resolve, 30))
	assert.equal(f.edits.length, 1, "loading stays visible throughout ranking")
	ranked()
	await f.finished
	const final = f.edits.at(-1)!
	assertLimits(final.components)
	assert.match(
		JSON.stringify(final),
		/Reads as: Funny · Family · Forest · not horror/,
	)
	assert.match(JSON.stringify(final), /Matches: Funny · Family · Forest/)
	assert.doesNotMatch(
		JSON.stringify(final),
		/Finding matching|Fourth chip|but scare/,
	)
	const select = selectIn(final.components)
	const opened = fixture()
	for (const [k, v] of f.states) opened.states.set(k, v)
	await opened.run(3, {
		custom_id: String(select.custom_id),
		values: [title.id],
	})
	await opened.finished
	assert.match(JSON.stringify(opened.edits), /Matches: Funny · Family · Forest/)
	assert.doesNotMatch(JSON.stringify(opened.edits), /Fourth chip|but scare/)
	const back = buttonsIn(opened.edits[0].components).find(
		(b) => b.label === "Back",
	)!
	const returned = fixture()
	for (const [k, v] of f.states) returned.states.set(k, v)
	await returned.run(3, { custom_id: String(back.custom_id) })
	await returned.finished
	assert.match(
		JSON.stringify(returned.edits),
		/Reads as: Funny · Family · Forest · not horror/,
	)
	assert.match(
		JSON.stringify(returned.edits),
		/Matches: Funny · Family · Forest/,
	)
	assert.deepEqual(returned.reads, [])
})

test("/search waits for an in-flight progress PATCH before applying results", async () => {
	const f = fixture()
	let release!: () => void
	const pending = new Promise<void>((resolve) => {
		release = resolve
	})
	let built!: () => void
	const resultsBuilt = new Promise<void>((resolve) => {
		built = resolve
	})
	let signal: AbortSignal | undefined
	const edit = f.deps.edit
	f.deps.edit = async (app, token, body, abort) => {
		if (abort) {
			signal = abort
			await pending
		}
		await edit(app, token, body)
	}
	const save = f.deps.saveState!
	f.deps.saveState = async (...args) => {
		const result = await save(...args)
		built()
		return result
	}
	f.deps.searchTitles = async (_q, _u, onReading) => {
		onReading?.([{ text: "Funny", kind: "want" }])
		return { titles: [title] }
	}
	await f.run(2, {
		name: "search",
		options: [{ name: "query", value: "funny" }],
	})
	await resultsBuilt
	await new Promise((resolve) => setTimeout(resolve, 30))
	assert.ok(signal)
	assert.equal(
		signal.aborted,
		false,
		"final results wait before aborting progress",
	)
	assert.equal(f.edits.length, 0, "results must not overtake progress")
	release()
	await f.finished
	assert.equal(f.edits.length, 2)
	assert.match(JSON.stringify(f.edits[0]), /Finding matching/)
	assert.match(JSON.stringify(f.edits.at(-1)), /A title/)
	assert.doesNotMatch(JSON.stringify(f.edits.at(-1)), /Finding matching/)
})

test("/search progress and results escape the same query heading", async () => {
	const f = fixture()
	f.deps.searchTitles = async (_q, _u, onReading) => {
		onReading?.([{ text: "Funny", kind: "want" }])
		return { titles: [title] }
	}
	await f.run(2, {
		name: "search",
		options: [{ name: "query", value: "* # | @everyone" }],
	})
	await f.finished
	const heading = (body: ReturnType<typeof textCard>) =>
		String(all(body.components).find((c) => c.type === 10)?.content).split(
			"\n",
		)[0]
	assert.equal(heading(f.edits[0]), "### Results for \\* \\# \\| ＠everyone")
	assert.equal(heading(f.edits[0]), heading(f.edits.at(-1)!))
})

test("a type 7 search retry lets the loading answer arrive before the reading PATCH", async () => {
	const f = fixture()
	let ranked!: () => void
	const ranking = new Promise<void>((resolve) => {
		ranked = resolve
	})
	const applied: unknown[] = []
	const edit = f.deps.edit
	f.deps.edit = async (...args) => {
		applied.push(args[2])
		await edit(...args)
		if (args[3]) ranked()
	}
	f.deps.searchTitles = async (_q, _u, onReading) => {
		onReading?.([{ text: "Funny", kind: "want" }])
		await ranking
		return { titles: [title] }
	}
	const ack = await routeInteraction(
		{
			type: 2,
			application_id: "app",
			token: "token",
			user: { id: "user" },
			data: { name: "search", options: [{ name: "query", value: "funny" }] },
			message: {
				flags: EPHEMERAL,
				components: textCard("Please try again.").components,
			},
		},
		f.deps,
		{ retrying: true },
	)
	assert.equal(ack.type, 7)
	await new Promise<void>((resolve) =>
		setTimeout(() => {
			applied.push(ack.data)
			resolve()
		}, 50),
	)
	await f.finished
	assert.equal(applied[0], ack.data)
	assert.match(JSON.stringify(applied[1]), /Reads as: Funny/)
	assert.match(JSON.stringify(applied.at(-1)), /A title/)
})

for (const failure of ["reject", "hang", "late"] as const) {
	test(`/search progress edit can ${failure} without blocking or failing the final edit indefinitely`, async () => {
		const f = fixture()
		let signal: AbortSignal | undefined
		let release!: () => void
		let lateDone!: () => void
		const late = new Promise<void>((resolve) => {
			lateDone = resolve
		})
		const original = f.deps.edit
		f.deps.edit = async (app, token, body, abort) => {
			if (abort) {
				signal = abort
				if (failure === "reject") throw new Error("Webhook is unavailable")
				await new Promise<void>((resolve) => {
					release = resolve
				})
				await original(app, token, body)
			} else {
				await original(app, token, body)
				if (f.edits.length === 3) lateDone()
			}
		}
		f.deps.searchTitles = async (_q, _user, onReading) => {
			onReading?.([{ text: "Funny", kind: "want" }])
			return { titles: [title] }
		}
		await f.run(2, {
			name: "search",
			options: [{ name: "query", value: "funny" }],
		})
		await f.finished
		assert.equal(signal?.aborted, true)
		assert.match(JSON.stringify(f.edits), /Results for funny/)
		assert.doesNotMatch(JSON.stringify(f.edits), /Finding matching/)
		if (failure === "late") {
			release()
			await late
			assert.doesNotMatch(JSON.stringify(f.edits.at(-1)), /Finding matching/)
		}
	})
}

test("search cards keep reading and reason copy within Discord limits and hide raw identifiers", () => {
	const reasons = Array.from({ length: 5 }, () => ({
		kind: "attribute" as const,
		text: "very_long **movie:42** ".repeat(20),
	}))
	const list = titleListCard(
		"Results for a long query".repeat(20),
		titles.map((t) => ({
			...t,
			name: "x".repeat(180),
			goodwatch_score: 99,
			year: 2026,
			runtime_minutes: 180,
			reasons,
		})),
		{
			emojis: { GoodWatchScore10: "12345678901234567890" },
			subtitle: "Reads as: ".repeat(50),
			total: 100,
			page: 0,
			stateKey: key,
			pageAction: "search",
		},
	)
	assertLimits(list.components)
	const ranked = all(list.components)
		.filter((c) => c.type === 10)
		.map((c) => String(c.content))
		.join("\n")
	assert.equal((ranked.match(/Matches:/g) ?? []).length, 10)
	for (const line of ranked
		.split("\n")
		.filter((line) => line.startsWith("-# Matches:")))
		assert.ok(line.length <= 83)
	const opened = titleCard({ ...title, reasons }, "DE", {
		back: { kind: "search", key, page: 0 },
	})
	assertLimits(opened.components)
	const copy = all([...list.components, ...opened.components])
		.filter((c) => c.type === 10)
		.map((c) => c.content)
		.join("\n")
	assert.doesNotMatch(copy, /_|movie:42/)
})

test("opening a search title still works when its optional reason snapshot is unavailable", async () => {
	const f = fixture()
	f.deps.loadState = async () => {
		throw new Error("Storage is unavailable")
	}
	await f.run(3, { custom_id: `gw1:open:q:${key}:0`, values: [title.id] })
	await f.finished
	assert.match(JSON.stringify(f.edits), /A title/)
	assert.equal(
		buttonsIn(f.edits[0].components).find((b) => b.label === "Back")?.custom_id,
		`gw1:back:q:${key}:0`,
	)
})

test("country custom IDs round trip with Back and sharing country; invalid IDs are rejected", async () => {
	const { parseCustomId } = await import("./custom-id.ts")
	const back = { kind: "discover" as const, key, page: 999999 }
	for (const action of ["country", "share"] as const) {
		const id = formatCustomId(action, "movie:9999999999", back, "DE")
		assert.ok(id.length <= 100)
		assert.deepEqual(parseCustomId(id), {
			action,
			titleId: "movie:9999999999",
			back,
			country: "DE",
		})
	}
	for (const id of [
		"gw1:country:movie:0",
		"gw1:country:movie:42:garbage",
		"gw1:share:movie:42:cZZZ",
		"x".repeat(101),
	])
		assert.equal(parseCustomId(id), null)
})

for (const publicMessage of [false, true])
	test(`country switch keeps Back, uses country-wide subscriptions and ${publicMessage ? "answers privately" : "updates in place"}`, async () => {
		const f = fixture()
		const back = { kind: "discover" as const, key, page: 2 }
		const original = titleCard(title, "DE", { back, share: publicMessage })
		const custom_id = formatCustomId("country", title.id, back)
		const response = await f.run(
			3,
			{ custom_id, values: ["GB"] },
			publicMessage,
			original.components,
		)
		assert.equal(response.type, publicMessage ? 5 : 7)
		if (publicMessage)
			assert.equal((response.data as { flags: number }).flags, EPHEMERAL)
		await f.finished
		assert.deepEqual(f.reads.find((r) => r.name === "get_title")?.viewer, {
			country: "GB",
			services: [],
		})
		const card = f.edits.at(-1)!
		assertLimits(card.components)
		assert.match(
			JSON.stringify(card),
			/Not on a subscription service in the United Kingdom/,
		)
		assert.ok(
			buttonsIn(card.components).some(
				(c) => c.custom_id === listCustomId("back", `d:${key}:2`),
			),
		)
		assert.ok(
			buttonsIn(card.components).some(
				(c) => c.custom_id === formatCustomId("share", title.id, back, "GB"),
			),
		)
		const share = fixture()
		await share.run(3, {
			custom_id: formatCustomId("share", title.id, back, "GB"),
		})
		await share.finished
		assert.deepEqual(share.reads.find((r) => r.name === "get_title")?.viewer, {
			country: "GB",
			services: [],
		})
	})

test("country switch preserves a member match, marks, and a watch pick's Another button", async () => {
	const { watchCard } = await import("./watch-cards.ts")
	const original = watchCard(
		{ ...title, match: 93, match_label: "Excellent taste fit" },
		"DE",
		{
			another: "gw1:another:any:none:m42",
			origin: "https://goodwatch.app",
			member: { score: 9 },
			episode: { code: "S1 E2", name: "The next chapter" },
		},
	)
	const f = fixture()
	f.deps.linkedUser = async () => "member"
	f.deps.memberRead = async (_user, name) =>
		name === "get_settings"
			? { country: "DE" }
			: { title, member: { score: 9 } }
	await f.run(
		3,
		{ custom_id: formatCustomId("country", title.id), values: ["FR"] },
		false,
		original.components,
	)
	await f.finished
	assert.match(JSON.stringify(f.edits[0]), /Excellent taste fit/)
	assert.match(JSON.stringify(f.edits[0]), /You rated it/)
	assert.match(JSON.stringify(f.edits[0]), /The next chapter/)
	assert.ok(
		buttonsIn(f.edits[0].components).some(
			(c) => c.custom_id === "gw1:another:any:none:m42",
		),
	)
})

test("new Discover options map to read args and survive paging, Back and Share", async () => {
	const f = fixture()
	await f.run(2, {
		name: "discover",
		options: Object.entries({
			theme: "future",
			style: "slow",
			released: "recent",
			score: "80",
			anime: "none",
			length: "short",
		}).map(([name, value]) => ({ name, value })),
	})
	await f.finished
	const expected = {
		themes: ["future"],
		styles: ["slow"],
		released: "recent",
		minimum_score: 80,
		anime: "none",
		max_runtime: 99,
	}
	const saved = await f.deps.loadState!(key)
	for (const [name, value] of Object.entries(expected))
		assert.deepEqual(saved?.args[name as keyof typeof saved.args], value)
	assert.match(
		JSON.stringify(f.edits[0]),
		/Future · Slow burn · Last 3 years · GoodWatch 80\+ · No anime · Under 100 min/,
	)
	for (const custom_id of [
		listCustomId("discover", `${key}:1`),
		listCustomId("back", `d:${key}:0`),
		listCustomId("discover-share", `${key}:0`),
	]) {
		const g = fixture()
		g.deps.loadState = f.deps.loadState
		await g.run(3, { custom_id })
		await g.finished
		const args = g.reads.find((r) => r.name === "discover_titles")!.args
		for (const [name, value] of Object.entries(expected))
			assert.deepEqual(args[name as keyof typeof args], value)
	}
})

test("registered filter choices use site keys and labels; Want to see stays a button", async () => {
	const { THEMES, STYLES } = await import("../../domain/themes-styles.ts")
	const { RELEASED_LABELS } = await import("../../ui/filter-bar/labels.ts")
	const options = commands.find((c) => c.name === "discover")!.options
	for (const [name, choices] of [
		["theme", THEMES.map((r) => ({ name: r.name, value: r.id }))],
		["style", STYLES.map((r) => ({ name: r.name, value: r.id }))],
		[
			"released",
			Object.entries(RELEASED_LABELS).map(([value, name]) => ({ name, value })),
		],
	] as const) {
		assert.deepEqual(
			(options.find((o) => o.name === name) as { choices: unknown }).choices,
			choices,
		)
	}
	assert.equal(
		commands.some((c) => c.name === "want"),
		false,
	)
	assert.ok(commands.some((c) => c.name === "rate"))
	assert.ok(commands.some((c) => c.name === "seen"))
	assert.ok(
		commands
			.find((c) => c.name === "together")!
			.options.some((o) => o.name === "theme"),
	)
})

for (const [name, value, expected] of [
	["length", "medium", { max_runtime: 119 }],
	["length", "long", { min_runtime: 120 }],
	["anime", "only", { anime: "only" }],
	["anime", "any", { anime: "any" }],
	["score", "60", { minimum_score: 60 }],
	["score", "70", { minimum_score: 70 }],
] as const)
	test(`Discover maps ${name} ${value}`, async () => {
		const f = fixture()
		await f.run(2, { name: "discover", options: [{ name, value }] })
		await f.finished
		const saved = await f.deps.loadState!(key)
		for (const [field, value] of Object.entries(expected))
			assert.deepEqual(saved?.args[field as keyof typeof saved.args], value)
	})
