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
	titleCard,
	textCard,
	message,
	componentCount,
	EPHEMERAL,
	IS_COMPONENTS_V2,
	type Component,
	type GuestTitle,
} from "./cards.ts"
import { listCustomId, parseListId, formatCustomId } from "./custom-id.ts"
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
					assert.ok(o.description.length <= 100)
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
					name: name === "person" ? "name" : "title",
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
test("title Similar button defers update and reads similar titles", async () => {
	const f = fixture()
	const buttons = buttonsIn(titleCard(title, "DE").components)
	assert.deepEqual(
		buttons.map((b) => b.label),
		["Where to watch", "Similar", "Open on GoodWatch", "Share to channel"],
	)
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
			return name === "get_settings"
				? { country: "FR" }
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
	assert.match(personal, /Where to watch on every service in Germany/)
	assert.match(personal, /On every service in France/)
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
		/Excellent taste fit|You rated|Wishlist|93%|France/,
	)
	assert.match(
		JSON.stringify(shared.edits[0]),
		/Where to watch on every service in Germany/,
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

test("hot adapter maps the Hot on socials row, poster paths included, into 4D list titles", () => {
	// The shape getHotOnSocials returns: catalog poster paths, social items, curves.
	const row = {
		day: "2026-10-22",
		titles: Array.from({ length: 12 }, (_, i) => ({
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
			move: "new" as const,
			items: [],
		})),
	}
	const titles = hotTitles(row)
	assert.equal(titles.length, 10)
	assert.deepEqual(titles.slice(0, 2), [
		{
			id: "movie:100",
			name: "Buzz 0",
			year: 2026,
			poster_url: "https://image.tmdb.org/t/p/w342/p0.jpg",
		},
		{ id: "show:101", name: "Buzz 1", year: 2026, poster_url: null },
	])
	assert.deepEqual(hotTitles(null), [])
	const gallery = titleListCard("Hot on socials", titles).components[0]
		.components!.find((c) => c.type === 12)!
	assert.equal((gallery.items as unknown[]).length, 9)
})

