import assert from "node:assert/strict"
import { test } from "node:test"
import {
	routeInteraction,
	type Dependencies,
	type Interaction,
} from "./router.server.ts"
import { commands } from "./commands.ts"
import { guestWatchPick } from "./watch-picks.server.ts"
import {
	watchOptions,
	anotherId,
	parseAnotherId,
	type WatchOptions,
} from "./watch-id.ts"
import { watchCard, nextCard } from "./watch-cards.ts"
import {
	componentCount,
	EPHEMERAL,
	type Component,
	type GuestTitle,
} from "./cards.ts"
import type { Taste } from "../taste/index.server.ts"
import type { ViewerContext } from "../viewer.server.ts"
const title: GuestTitle = {
	id: "movie:42",
	name: "A title",
	year: 2024,
	match: 93,
	backdrop_url: "https://example.test/backdrop.jpg",
	poster_url: "https://example.test/poster.jpg",
	goodwatch_score: 85,
	synopsis: "An adventure.",
	availability: {
		offers: [
			{
				name: "A service",
				url: "https://example.test/watch",
				stream_link: "https://example.test/watch",
			},
		],
	},
}
const taste: Taste = {
	signal: "none",
	ratings: 0,
	liked: 0,
	vector: null,
	match: () => [],
	percentile: () => [],
	reasons: () => [],
	leanings: () => [],
}
function flatten(cs: Component[]): Component[] {
	return cs.flatMap((c) => [
		c,
		...flatten(c.components ?? []),
		...(c.accessory ? flatten([c.accessory]) : []),
	])
}
const buttons = (b: { components: Component[] }) =>
	flatten(b.components).filter((c) => c.type === 2)
const text = (b: { components: Component[] }) =>
	flatten(b.components)
		.map((c) => c.content ?? "")
		.join("\n")
function fixture(member = false, overrides: Partial<Dependencies> = {}) {
	const reads: {
		name: string
		args: Parameters<Dependencies["memberRead"]>[2]
	}[] = []
	const guests: { place: unknown; options: WatchOptions }[] = []
	let serial = 42
	const deps: Partial<Dependencies> = {
		getGuild: async () => ({
			guild_id: "guild",
			country: "DE",
			service_ids: [8],
			updated_by: "admin",
			digest_channel_id: null,
			updated_at: 0,
		}),
		linkedUser: async () => (member ? "member" : null),
		memberRead: async (_user, name, args) => {
			reads.push({ name, args })
			if (name === "get_settings") return { country: "GB", service_ids: [9] }
			if (name === "get_tonight")
				return { pick: { title: { ...title, id: `movie:${serial++}` } } }
			if (name === "get_my_shows")
				return {
					items: [
						{
							...title,
							id: "show:12",
							group: "continue",
							next_episode: { season: 2, number: 5, name: "Episode name" },
						},
						{
							...title,
							id: "show:13",
							group: "pick_up",
							next_episode: { season: 1, number: 2, name: null },
						},
						{ ...title, id: "show:14", group: "waiting", next_episode: null },
						{
							...title,
							id: "show:15",
							group: "on_hold",
							next_episode: { season: 1, number: 1, name: null },
						},
					],
				}
			return {
				title: { ...title, id: args.title_id },
				member: { want_to_see: true },
			}
		},
		read: async (_place, _origin, _name, args) => ({
			title: { ...title, match: undefined, id: args.title_id },
		}),
		guestPick: async (place, options) => {
			guests.push({ place, options })
			while (options.recent.includes(`movie:${serial}`)) serial++
			return `movie:${serial++}`
		},
		take: async () => ({ allowed: true, store: "memory" }),
		emojis: async () => ({}),
		log: () => {},
		...overrides,
	}
	async function run(
		type: number,
		data: Interaction["data"],
		extra: Partial<Interaction> = {},
	) {
		let finish!: (body: { flags: number; components: Component[] }) => void
		const edited = new Promise<{ flags: number; components: Component[] }>(
			(resolve) => {
				finish = resolve
			},
		)
		const response = await routeInteraction(
			{
				type,
				id: "interaction",
				application_id: "app",
				token: "token",
				guild_id: "guild",
				locale: "fr",
				user: { id: "discord" },
				data,
				...extra,
			},
			{
				...deps,
				edit: async (_app, _token, body) =>
					finish(body as { flags: number; components: Component[] }),
			},
		)
		return { response, body: await edited }
	}
	return { run, reads, guests }
}
test("watch and next register both installs, all contexts and readable discover choices", () => {
	for (const name of ["watch", "next"]) {
		const c = commands.find((c) => c.name === name)!
		assert.deepEqual(c.integration_types, [0, 1])
		assert.deepEqual(c.contexts, [0, 1, 2])
	}
	assert.deepEqual(
		commands.find((c) => c.name === "watch")!.options,
		commands.find((c) => c.name === "discover")!.options.slice(0, 2),
	)
	assert.equal(watchOptions("invalid"), null)
	assert.equal(watchOptions("movie", "raw_mood"), null)
})
test("guest worthwhileSuggestions receives the place's country, services, moods and exclusions with empty browser progress", async () => {
	for (const services of [[8, 9], []]) {
		let called = false
		const id = await guestWatchPick(
			{ country: "DE", services },
			{ type: "show", mood: "feelgood", recent: ["show:12"] },
			{
				taste,
				context: (progress, country): ViewerContext => {
					assert.deepEqual(progress, {
						interactions: [],
						country: "DE",
						services,
					})
					assert.equal(country, "DE")
					return {
						viewer: { kind: "guest", progress: progress! },
						country,
						services,
						seen: new Set(),
						ratings: new Map(),
						wishlist: new Map(),
						skipped: new Set(),
						notInterested: new Set(),
						hidden: new Set(),
						forYou: true,
					}
				},
				suggest: (ctx, givenTaste, options) => {
					called = true
					assert.equal(ctx.country, "DE")
					assert.deepEqual(ctx.services, services)
					assert.equal(ctx.wishlist.size, 0)
					assert.equal(givenTaste, taste)
					assert.deepEqual(options.moods, ["feelgood"])
					assert.equal(options.onMyServices, services.length > 0)
					assert.equal(options.count, 1)
					assert.equal(options.fits!(1e12 + 42), false)
					assert.equal(options.fits!(2e12 + 12), false)
					assert.equal(options.fits!(2e12 + 13), true)
					return [2e12 + 13]
				},
			},
		)
		assert(called)
		assert.equal(id, "show:13")
	}
})
test("guest watch defers ephemerally, resolves server then locale, and offers Share and Link", async () => {
	const f = fixture()
	const { response, body } = await f.run(2, {
		name: "watch",
		options: [
			{ name: "type", value: "movie" },
			{ name: "mood", value: "feelgood" },
		],
	})
	assert.deepEqual(response, { type: 5, data: { flags: EPHEMERAL } })
	assert.equal(body.flags & EPHEMERAL, EPHEMERAL)
	assert.deepEqual(f.guests[0], {
		place: { country: "DE", services: [8] },
		options: { type: "movie", mood: "feelgood", recent: [] },
	})
	assert(buttons(body).some((b) => b.label === "Share to channel"))
	assert(
		buttons(body).some((b) => b.url === "https://goodwatch.app/discord/link"),
	)
	assert(!buttons(body).some((b) => b.label === "Rate"))
	assert(!text(body).includes("Link GoodWatch for picks"))
	assert.equal(
		buttons(body).filter(
			(b) => b.label === "Link GoodWatch for picks that fit your taste",
		).length,
		1,
	)
	const fallback = fixture(false, { getGuild: async () => null })
	const result = await fallback.run(2, { name: "watch" })
	assert.deepEqual(fallback.guests[0].place, { country: "FR" })
	assert.match(text(result.body), /Not on a subscription service in France/)
})
test("member watch uses get_tonight with filters and personal context and reuses member buttons", async () => {
	const f = fixture(true)
	const { body } = await f.run(2, {
		name: "watch",
		options: [
			{ name: "type", value: "movie" },
			{ name: "mood", value: "action" },
		],
	})
	assert.equal(f.guests.length, 0)
	assert.deepEqual(f.reads.find((r) => r.name === "get_tonight")!.args, {
		type: "movie",
		moods: ["action"],
		exclude_title_ids: [],
	})
	assert.match(text(body), /93% taste match/)
	for (const label of ["Want to see", "Seen", "Rate"])
		assert(buttons(body).some((b) => b.label === label))
	assert(
		!buttons(body).some(
			(b) =>
				b.label === "Share to channel" ||
				String(b.label).startsWith("Link GoodWatch"),
		),
	)
	assert.match(text(body), /United Kingdom/)
})
test("Another retains filters and five recent picks for guests and members", async () => {
	for (const member of [false, true]) {
		const f = fixture(member)
		let { body } = await f.run(2, {
			name: "watch",
			options: [{ name: "mood", value: "feelgood" }],
		})
		const seen: string[] = []
		for (let i = 0; i < 8; i++) {
			const id = String(
				buttons(body).find((b) => b.label === "Another")!.custom_id,
			)
			const options = parseAnotherId(id)!
			const current = options.recent.at(-1)!
			assert(!seen.includes(current))
			seen.push(current)
			assert.deepEqual(options.recent, seen.slice(-5))
			assert.equal(options.mood, "feelgood")
			const result = await f.run(3, { custom_id: id })
			assert.equal(result.response.type, 6)
			body = result.body
			if (member)
				assert.deepEqual(
					f.reads.filter((r) => r.name === "get_tonight").at(-1)!.args
						.exclude_title_ids,
					seen.slice(-5),
				)
			else assert.deepEqual(f.guests.at(-1)!.options.recent, seen.slice(-5))
		}
	}
	const max = anotherId(
		{
			type: "movie",
			mood: "feelgood",
			recent: Array(5).fill("movie:9999999999"),
		},
		"show:9999999999",
	)
	assert(max.length <= 100)
	assert(parseAnotherId(max))
	assert.equal(parseAnotherId("gw1:another:any:unknown:m42"), null)
	assert.equal(parseAnotherId("gw1:another:any:none:raw_id"), null)
})
test("Share posts a fresh public guest card with no member fields", async () => {
	const f = fixture()
	const initial = await f.run(2, { name: "watch" })
	const share = buttons(initial.body).find(
		(b) => b.label === "Share to channel",
	)!
	const { response, body } = await f.run(3, {
		custom_id: String(share.custom_id),
	})
	assert.deepEqual(response, { type: 5, data: { flags: 0 } })
	assert.equal(body.flags & EPHEMERAL, 0)
	assert(!text(body).includes("taste match"))
	assert(
		!buttons(body).some((b) =>
			["Rate", "Seen", "Want to see", "Share to channel"].includes(
				String(b.label),
			),
		),
	)
})
test("next shows guests a link prompt and members next episodes with images, services and a working title menu", async () => {
	const guest = fixture()
	const prompt = await guest.run(2, { name: "next" })
	assert.equal(prompt.response.type, 5)
	assert.match(text(prompt.body), /Link your account.*next episodes/)
	assert(buttons(prompt.body).some((b) => b.label === "Link GoodWatch"))
	assert.equal(guest.reads.length, 0)
	const f = fixture(true)
	const { body } = await f.run(2, { name: "next" })
	assert.equal(body.flags & EPHEMERAL, EPHEMERAL)
	assert.deepEqual(
		f.reads.map((r) => r.name),
		["get_settings", "get_my_shows"],
	)
	assert.match(text(body), /S2 E5 · Episode name/)
	assert.match(text(body), /A service/)
	assert(flatten(body.components).some((c) => c.type === 11))
	const menu = flatten(body.components).find((c) => c.type === 3)!
	assert.deepEqual(
		(menu.options as { value: string }[]).map((o) => o.value),
		["show:12", "show:13"],
	)
	assert(!buttons(body).some((b) => b.label === "Seen"))
	const opened = await f.run(3, {
		custom_id: String(menu.custom_id),
		values: ["show:12"],
	})
	assert.match(text(opened.body), /93% taste match/)
	// A title opened from /next offers Back to the /next list, and its member buttons keep it.
	assert.equal(menu.custom_id, "gw1:open:n")
	const back = buttons(opened.body).find((b) => b.label === "Back")!
	assert.equal(back.custom_id, "gw1:back:n")
	assert(buttons(opened.body).some((b) => b.custom_id === "gw1:want:show:12:n"))
	const returned = await f.run(3, { custom_id: String(back.custom_id) })
	assert.match(text(returned.body), /Watch next/)
	assert(
		f.reads.some(
			(r) => r.name === "get_title" && r.args.title_id === "show:12",
		),
	)
	const empty = fixture(true, {
		memberRead: async (_user, name) =>
			name === "get_settings" ? { country: "DE" } : { items: [] },
	})
	assert.match(
		text((await empty.run(2, { name: "next" })).body),
		/No next episodes/,
	)
})
test("watch and next cards stay within Discord limits and scrub displayed identifiers", () => {
	const large: GuestTitle = {
		...title,
		name: "show:123 _name_ @everyone ".repeat(100),
		synopsis: "Story ".repeat(1000),
		genres: ["Genre", "Drama"],
		match_label: "93% taste match",
	}
	for (const member of [undefined, { score: 9, want_to_see: true }]) {
		const body = watchCard(large, "DE", {
			another: anotherId(watchOptions()!, large.id),
			origin: "https://goodwatch.app",
			member,
		})
		assert(componentCount(body.components) <= 40)
		assert(!text(body).includes("show:123"))
		assert(!text(body).includes("_name_"))
	}
	const body = nextCard(
		Array.from({ length: 100 }, (_, i) => ({
			title: { ...large, id: `show:${i + 1}` },
			episode: { season: 2, number: 5, name: "Episode ".repeat(1000) },
		})),
		"DE",
		false,
	)
	assert(componentCount(body.components) <= 40)
	assert.equal(
		(flatten(body.components).find((c) => c.type === 3)!.options as unknown[])
			.length,
		8,
	)
	assert(!text(body).includes("show:123"))
})

test("next uses the canonical episode label for the display-season sentinel and keeps provider markdown whole", () => {
	const body = nextCard(
		[
			{
				title: {
					...title,
					availability: {
						offers: [
							{ name: "First_service", stream_link: "https://example.test/1" },
							{ name: "*".repeat(60), stream_link: "https://example.test/2" },
							{ name: "Other_service", stream_link: "https://example.test/3" },
						],
					},
				},
				episode: {
					season: 2,
					number: 3,
					displaySeason: -1,
					displayNumber: 99,
					name: "episode_name show:123",
				},
			},
		],
		"DE",
		false,
	)
	assert.match(text(body), /TMDB S2 E3 · episode name this title/)
	assert(!text(body).includes("S-1"))
	assert.match(text(body), /\*\*First service\*\*\s*$/)
	assert(!text(body).includes("_"))
})

for (const failure of ["reject", "unavailable"] as const) {
	test(`member watch falls back to the same show's guest card when get_title ${
		failure === "reject" ? "rejects" : "is unavailable"
	}`, async () => {
		const guestReads: unknown[] = []
		const f = fixture(true, {
			memberRead: async (_user, name) => {
				if (name === "get_settings") return { country: "GB", service_ids: [9] }
				if (name === "get_tonight")
					return {
						pick: {
							title: { id: "show:42" },
							episode: { code: "S01E02", name: "The next episode" },
						},
					}
				assert.equal(name, "get_title")
				if (failure === "reject") throw new Error("private backend failure")
				return { status: "data_unavailable" }
			},
			read: async (place, _origin, name, args) => {
				guestReads.push({ place, name, args })
				return { title: { ...title, id: "show:42", match: undefined } }
			},
		})
		const { body } = await f.run(2, {
			name: "watch",
			options: [{ name: "type", value: "show" }],
		})
		assert.match(text(body), /A title/)
		assert.match(text(body), /S01E02/)
		assert.doesNotMatch(
			text(body),
			/private backend failure|Could not load|Try again|Wishlist|taste fit/,
		)
		assert.deepEqual(guestReads, [
			{
				place: { country: "GB", services: [9] },
				name: "get_title",
				args: { title_id: "show:42" },
			},
		])
		assert.ok(buttons(body).some((button) => button.label === "Another"))
	})
}
