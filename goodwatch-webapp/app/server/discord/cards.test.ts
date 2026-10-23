import "../title-filter/test-alias.ts"
import assert from "node:assert/strict"
import { test } from "node:test"
import {
	AMBER,
	QUIET_GREY,
	componentCount,
	countryName,
	linkPromptCard,
	memberBlock,
	message,
	scoreLine,
	slowDownCard,
	titleCard,
	titleListCard,
	watchProviders,
	whereToWatch,
	streamButtonUrl,
	streamLinks,
	type Component,
	type GuestTitle,
} from "./cards.ts"
import {
	SCORE_EMOJI_NAMES,
	scoreBand,
	scoreEmojiName,
	scoreEmojiSvg,
} from "./score-emoji.ts"
import { applicationEmojiIds, resetEmojiCache } from "./emoji.server.ts"
import { discoverHeading } from "./router.server.ts"

const emojis = Object.fromEntries(
	SCORE_EMOJI_NAMES.map((name, i) => [
		name,
		`14300000000000000${String(i).padStart(2, "0")}`,
	]),
)
const title: GuestTitle = {
	id: "movie:687163",
	name: "Project Hail Mary",
	year: 2026,
	goodwatch_score: 85.4,
	runtime_minutes: 157,
	genres: ["Science Fiction", "Adventure"],
	synopsis:
		"Science teacher Ryland Grace wakes up on a spaceship light years from home with no recollection of who he is or how he got there. As his memory returns, he begins to uncover his mission.",
	poster_url: "https://image.tmdb.org/t/p/w342/poster.jpg",
	backdrop_url: "https://image.tmdb.org/t/p/w780/backdrop.jpg",
	availability: {
		state: "watchable",
		offers: [
			{
				name: "Prime Video",
				url: "https://p.example",
				stream_link: "[Prime Video](https://p.example)",
				offer_type: "flatrate",
			},
			{
				name: "Prime Video",
				url: "https://p.example/rent",
				stream_link: "[Prime Video](https://p.example/rent)",
				offer_type: "rent",
			},
		],
	},
}
function all(components: Component[]): Component[] {
	return components.flatMap((c) => [
		c,
		...all(c.components ?? []),
		...(c.accessory ? all([c.accessory]) : []),
	])
}
const texts = (components: Component[]) =>
	all(components)
		.filter((c) => c.type === 10)
		.map((c) => String(c.content))

test("score emojis: ten bands in the site's vibe colors, floor like the score ring", () => {
	assert.deepEqual(
		SCORE_EMOJI_NAMES,
		Array.from({ length: 10 }, (_, i) => `GoodWatchScore${i + 1}`),
	)
	assert.equal(scoreBand(0), 1)
	assert.equal(scoreBand(19.9), 1)
	assert.equal(scoreBand(85), 8)
	assert.equal(scoreBand(99), 9)
	assert.equal(scoreBand(100), 10)
	assert.equal(scoreEmojiName(92), "GoodWatchScore9")
	assert.match(scoreEmojiSvg(8), /fill="#16934a"/)
	assert.match(scoreEmojiSvg(8), /width="128" height="128"/)
	assert.throws(() => scoreEmojiSvg(11))
})

test("score line uses the title page word and falls back to text without emojis", () => {
	assert.equal(
		scoreLine(85.4, emojis),
		`<:GoodWatchScore8:${emojis.GoodWatchScore8}> **85 · Excellent**`,
	)
	assert.equal(scoreLine(85.4), "**85 · Excellent**")
	assert.equal(scoreLine(84.9, { GoodWatchScore9: "1" }), "**84 · Great**")
	assert.equal(scoreLine(0, emojis), "Not rated yet")
	assert.equal(scoreLine(null), "Not rated yet")
})

test("1C guest title card: backdrop hero, poster beside the big title, score emoji, service links, actions", () => {
	const card = titleCard(title, "DE", { emojis })
	assert.equal(card.components.length, 1)
	const [box] = card.components
	assert.equal(box.type, 17)
	assert.equal(box.accent_color, 0x16934a)
	const [hero, section, separator, links, menu, row] = box.components!
	const [heading, overview] = section.components!
	assert.equal(section.type, 9)
	assert.deepEqual(section.accessory, {
		type: 11,
		media: { url: title.poster_url },
		description: "Project Hail Mary poster",
	})
	assert.equal(hero.type, 12)
	assert.deepEqual(hero.items, [
		{
			media: { url: title.backdrop_url },
			description: "Project Hail Mary backdrop",
		},
	])
	assert.equal(
		heading.content,
		`# Project Hail Mary\n<:GoodWatchScore8:${emojis.GoodWatchScore8}> **85 · Excellent**  ·  2026  ·  2h 37m  ·  Science Fiction, Adventure`,
	)
	assert.ok(String(overview.content).endsWith("…"))
	assert.ok(String(overview.content).length <= 151)
	assert.equal(separator.type, 14)
	assert.equal(menu.components![0].placeholder, "Germany")
	assert.deepEqual(links.components, [
		{ type: 2, style: 5, label: "Prime Video", url: "https://p.example" },
	])
	assert.deepEqual(
		row.components!.map((b) => b.label),
		["Similar", "Open on GoodWatch", "Share to channel"],
	)
	assert.ok(componentCount(card.components) <= 40)
	for (const content of texts(card.components)) {
		assert.doesNotMatch(content, /!|—/)
	}
})

test("where to watch: service logos as app emojis, junk and channel variants folded, the site's order", () => {
	const offers = [
		{
			service_id: 9999,
			name: "",
			url: "https://x.example",
			stream_link: "[Provider](https://x.example)",
		},
		{
			service_id: 1825,
			name: "HBO Max Amazon Channel",
			url: "https://a.example",
			stream_link: "[a](https://a.example)",
		},
		{
			service_id: 8,
			display_priority: 0,
			name: "Netflix",
			url: "https://n.example",
			stream_link: "[n](https://n.example)",
			offer_type: "flatrate",
		},
		{
			service_id: 1899,
			display_priority: 1,
			name: "HBO Max",
			url: "https://h.example",
			stream_link: "[h](https://h.example)",
			offer_type: "flatrate",
		},
		{
			service_id: 1796,
			name: "Netflix basic with Ads",
			url: "https://n.example/ads",
			stream_link: "[n](https://n.example/ads)",
			offer_type: "ads",
		},
		{
			service_id: 424242,
			name: "Tiny Local Service",
			offer_type: "free",
			url: "https://t.example",
			stream_link: "[t](https://t.example)",
		},
	]
	const providers = watchProviders(offers)
	assert.deepEqual(
		providers.map((p) => [p.brand, p.emoji]),
		[
			["Netflix", "Netflix"],
			["HBO Max", "HBOMax"],
			["Tiny Local Service", null],
		],
	)
	const ids = { ...emojis, Netflix: "1001", HBOMax: "1002" }
	const card = titleCard(
		{ ...title, availability: { state: "watchable", offers } },
		"US",
		{ emojis: ids },
	)
	const buttons = all(card.components).filter((c) => c.style === 5)
	assert.deepEqual(buttons.slice(0, 3), [
		{
			type: 2,
			style: 5,
			label: "Netflix",
			url: "https://n.example",
			emoji: { id: "1001", name: "Netflix" },
		},
		{
			type: 2,
			style: 5,
			label: "HBO Max",
			url: "https://h.example",
			emoji: { id: "1002", name: "HBOMax" },
		},
		{
			type: 2,
			style: 5,
			label: "Tiny Local Service",
			url: "https://t.example",
		},
	])
	const visible = texts(card.components).join("\n")
	assert.doesNotMatch(
		visible,
		/Provider|Amazon Channel|_|flatrate|\(ads\)|https?:/,
	)
	assert.doesNotMatch(visible, /Where to watch|Subscription:|Rent:|Buy:/)
	assert.equal(
		whereToWatch(
			{ ...title, availability: { state: "watchable", offers } },
			"US",
			{ emojis: ids },
		).split("\n")[1],
		"<:Netflix:1001> <:HBOMax:1002> **Tiny Local Service**",
	)
	assert.equal(
		whereToWatch(
			{ ...title, availability: { state: "watchable", offers } },
			"US",
		).split("\n")[1],
		"**Netflix** **HBO Max** **Tiny Local Service**",
	)
})

test("1C share copy is public and drops only the Share button", () => {
	const shared = titleCard(title, "DE", {
		share: true,
		emojis,
		allServices: true,
	})
	assert.equal(shared.flags & 64, 0)
	assert.doesNotMatch(JSON.stringify(shared), /Share to channel/)
	assert.match(JSON.stringify(shared), /"placeholder":"Germany"/)
})

test("provider IDs fold verified tiers and channels while distinct services keep their links", () => {
	const offers = [
		[9, "Amazon Prime Video"],
		[10, "Amazon Video"],
		[2100, "Amazon Prime Video with Ads"],
		[192, "YouTube"],
		[188, "YouTube Premium"],
		[386, "Peacock Premium"],
		[387, "Peacock Premium Plus"],
		[2553, "Peacock Premium Plus"],
		[1899, "HBO Max"],
		[1825, "HBO Max Amazon Channel"],
		[2472, "HBO Max Apple TV Channel"],
		[99991, "HBO Max Amazon Channel"],
		[2, "Apple TV Store"],
		[350, "Apple TV Plus"],
	].map(([id, name]) => ({
		service_id: Number(id),
		name: String(name),
		offer_type: "flatrate",
		url: `https://service.example/${id}`,
		stream_link: "",
	}))
	const providers = watchProviders(offers)
	assert.equal(providers.length, 9)
	assert.equal(
		providers.find((p) => p.brand === "Amazon Prime Video")?.offers.length,
		2,
	)
	assert.equal(providers.find((p) => p.brand === "Peacock")?.offers.length, 3)
	assert.equal(providers.find((p) => p.brand === "HBO Max")?.offers.length, 3)
	assert.equal(
		providers.find((p) => p.brand === "HBO Max Amazon Channel")?.offers.length,
		1,
	)
	const links = all(
		titleCard({ ...title, availability: { state: "watchable", offers } }, "US")
			.components,
	)
		.filter((c) => c.style === 5)
		.map((c) => `[${c.label}](${c.url})`)
		.join("\n")
	for (const [id, name] of [
		[9, "Amazon Prime Video"],
		[10, "Amazon Video"],
		[192, "YouTube"],
		[188, "YouTube Premium"],
		[2, "Apple TV Store"],
		[350, "Apple TV+"],
	]) {
		assert.ok(links.includes(`[${name}](https://service.example/${id})`))
	}
	// Distinct services never share a logo emoji (the emoji map is generated, so a service may also have none).
	const emojiOf = (brand: string) =>
		providers.find((p) => p.brand === brand)?.emoji ?? null
	for (const [a, b] of [
		["Amazon Video", "Amazon Prime Video"],
		["YouTube Premium", "YouTube"],
	]) {
		if (emojiOf(a) !== null) assert.notEqual(emojiOf(a), emojiOf(b))
	}
})

test("visible copy has no enum underscores or raw title IDs; link destinations stay intact", () => {
	const card = titleCard(
		{
			...title,
			name: "a_title",
			genres: ["science_fiction"],
			synopsis: "Try movie:42 and show:7.",
		},
		"US",
		{
			member: { status: "on_hold" },
		},
	)
	const visible = all(card.components).flatMap((c) =>
		[c.content, c.label, c.description].filter((v) => typeof v === "string"),
	)
	assert.doesNotMatch(visible.join("\n"), /_|(?:movie|show):\d+/)
	assert.match(visible.join("\n"), /a title|science fiction/)
	const linked = message([
		{ type: 10, content: "A_label [Watch](https://example.com/a_b)" },
	])
	assert.equal(
		linked.components[0].content,
		"A label [Watch](https://example.com/a_b)",
	)
})

test("1C without a backdrop falls back to the poster thumbnail with the vibe accent", () => {
	const card = titleCard({ ...title, backdrop_url: null }, "GB")
	const [box] = card.components
	assert.equal(box.accent_color, 0x16934a)
	assert.equal(box.components![0].type, 9)
	assert.equal(box.components![0].accessory?.type, 11)
	assert.match(JSON.stringify(card), /"placeholder":"United Kingdom"/)
	const bare = titleCard(
		{ ...title, backdrop_url: null, poster_url: null, goodwatch_score: null },
		"DE",
	)
	assert.equal(bare.components[0].components![0].type, 10)
	assert.equal("accent_color" in bare.components[0], false)
	assert.match(JSON.stringify(bare), /Not rated yet/)
})

test("2C personal card: guest container on top, amber member block below with a button seam", () => {
	const marks = { score: 9, want_to_see: true, watch_count: 1 }
	const guest = titleCard(title, "DE", { emojis })
	const personal = titleCard(
		{ ...title, match: 70, match_label: "70% taste match" },
		"DE",
		{ emojis, member: marks },
	)
	assert.equal(personal.components.length, 2)
	assert.deepEqual(personal.components[0], guest.components[0])
	const [, member] = personal.components
	assert.equal(member.type, 17)
	assert.equal(member.accent_color, AMBER)
	assert.equal(
		member.components![0].content,
		"### 70% taste match\n-# In your Wishlist  ·  Seen  ·  You rated it **9 · Excellent**",
	)
	assert.equal(member.components!.length, 2)
	assert.deepEqual(
		member.components![1].components!.map((c) => c.label),
		["Want to see", "Seen", "Rate"],
	)
	const buttons: Component[] = ["Want to see", "Seen", "Rate"].map(
		(label, i) => ({
			type: 2,
			style: 2,
			label,
			custom_id: `gw1:member:${i}`,
		}),
	)
	const withButtons = titleCard(title, "DE", {
		member: {},
		memberButtons: buttons,
	})
	assert.deepEqual(withButtons.components[1].components![1], {
		type: 1,
		components: buttons,
	})
	assert.equal(
		memberBlock({ id: "show:1" }, { status: "watching" }).components![0]
			.content,
		"-# Watching",
	)
	assert.equal(
		memberBlock({ id: "movie:1" }, {}).components![0].content,
		"-# Not seen yet",
	)
	const shared = titleCard(title, "DE", {
		share: true,
		member: marks,
		memberButtons: buttons,
	})
	assert.equal(shared.components.length, 1)
})

test("4D list card: poster gallery above the ranked list, then the menu and paging", () => {
	const items: GuestTitle[] = Array.from({ length: 12 }, (_, i) => ({
		id: `movie:${i + 1}`,
		name: `Title ${i + 1}`,
		year: 2000 + i,
		runtime_minutes: 95 + i,
		goodwatch_score: 90 - i,
		poster_url: `https://image.tmdb.org/t/p/w342/p${i}.jpg`,
	}))
	const card = titleListCard("Feel-good movies", items, {
		page: 0,
		stateKey: "iabc",
		next: true,
		total: 2214,
		subtitle: "popular · every service in Germany",
		shareId: "gw1:discover-share:iabc:0",
		emojis,
	})
	assert.equal(card.components.length, 1)
	const [box] = card.components
	assert.equal(box.accent_color, AMBER)
	const [heading, gallery, ranked, selectRow, nav] = box.components!
	assert.equal(
		heading.content,
		"### Feel-good movies\n-# Popular · every service in Germany · page 1 of 222",
	)
	assert.equal(gallery.type, 12)
	assert.equal((gallery.items as unknown[]).length, 10)
	const lines = String(ranked.content).split("\n")
	assert.equal(lines.length, 10)
	assert.equal(
		lines[0],
		`**1**  <:GoodWatchScore9:${emojis.GoodWatchScore9}>  **Title 1**  ·  90  ·  2000  ·  1h 35m`,
	)
	const select = selectRow.components![0]
	assert.equal(select.type, 3)
	const options = select.options as {
		description: string
		emoji?: { name: string }
	}[]
	assert.equal(options.length, 10)
	assert.equal(options[0].description, "2000 · Movie · 90 · Excellent")
	assert.deepEqual(options[0].emoji, {
		id: emojis.GoodWatchScore9,
		name: "GoodWatchScore9",
	})
	assert.deepEqual(
		nav.components!.map((b) => [b.label, b.disabled]),
		[
			["Previous", true],
			["Next", false],
			["Share to channel", undefined],
		],
	)
	assert.ok(componentCount(card.components) <= 40)
	const plain = titleListCard(
		"Hot on socials",
		items.map(({ poster_url: _, goodwatch_score: __, ...t }) => t),
	)
	const parts = plain.components[0].components!
	assert.equal(
		parts.some((c) => c.type === 12),
		false,
	)
	assert.equal(
		String(parts[1].content).split("\n")[0],
		"**1**  **Title 1**  ·  2000  ·  1h 35m",
	)
	assert.equal(
		(parts[2].components![0].options as { emoji?: unknown }[])[0].emoji,
		undefined,
	)
})

test("discover heading names the mood or genre and the kind", () => {
	assert.equal(
		discoverHeading({ moods: ["feelgood"], type: "movie" }),
		"Feel-good movies",
	)
	assert.equal(
		discoverHeading({ genres: ["Comedy"], type: "show" }),
		"Comedy shows",
	)
	assert.equal(discoverHeading({}), "Movies and shows")
})

test("8B link prompt lists three benefits around one link button", () => {
	const card = linkPromptCard(
		"https://goodwatch.app/discord/link",
		"/rate needs a linked GoodWatch account.",
	)
	const [box] = card.components
	assert.equal(box.accent_color, AMBER)
	assert.match(
		String(box.components![0].content),
		/^-# \/rate needs a linked GoodWatch account\.\n## Link GoodWatch\n(- .+\n){2}- .+$/,
	)
	assert.deepEqual(box.components![1], {
		type: 1,
		components: [
			{
				type: 2,
				style: 5,
				label: "Link GoodWatch",
				url: "https://goodwatch.app/discord/link",
			},
		],
	})
	assert.match(
		String(box.components![2].content),
		/Unlink any time with \/unlink/,
	)
})

test("9B slow down is a quiet grey card with a Discord timestamp", () => {
	const card = slowDownCard(42, Date.UTC(2026, 9, 23, 19, 4))
	assert.equal(card.flags & 64, 64)
	assert.equal(card.components[0].accent_color, QUIET_GREY)
	assert.equal(
		card.components[0].components![0].content,
		`### Slow down\nYou can send 30 commands a minute and 500 an hour. Try again <t:${
			Date.UTC(2026, 9, 23, 19, 4) / 1000 + 42
		}:R>.`,
	)
})

test("message rejects nested containers, oversized galleries and more than 4000 characters", () => {
	assert.throws(
		() => message([{ type: 17, components: [{ type: 17, components: [] }] }]),
		/limit/,
	)
	assert.throws(
		() =>
			message([
				{
					type: 12,
					items: Array.from({ length: 11 }, () => ({ media: { url: "x" } })),
				},
			]),
		/limit/,
	)
	assert.throws(
		() =>
			message([
				{
					type: 17,
					components: [
						{ type: 10, content: "x".repeat(2001) },
						{ type: 10, content: "x".repeat(2000) },
					],
				},
			]),
		/text limit/,
	)
	const long = "x".repeat(5000)
	assert.doesNotThrow(() =>
		titleListCard(
			long,
			Array.from({ length: 10 }, (_, i) => ({
				id: `movie:${i + 1}`,
				name: long,
				year: 2000,
			})),
		),
	)
	assert.doesNotThrow(() =>
		titleCard({ ...title, name: long, synopsis: long }, "DE", { emojis }),
	)
})

test("country names read naturally after in", () => {
	assert.equal(countryName("DE"), "Germany")
	assert.equal(countryName("us"), "the United States")
	assert.equal(countryName("NL"), "the Netherlands")
	assert.equal(countryName("??"), "??")
})

test("emoji IDs: read once, cached 24 hours when complete, briefly while missing, empty on failure", async () => {
	resetEmojiCache()
	assert.deepEqual(await applicationEmojiIds({ appId: "", botToken: "" }), {})
	let calls = 0
	let uploaded = SCORE_EMOJI_NAMES.slice(0, 1)
	const stored = new Map<string, { value: string; ttl: number }>()
	const store = {
		get: async (key: string) => stored.get(key)?.value ?? null,
		set: async (key: string, value: string, ttl: number) => {
			stored.set(key, { value, ttl })
		},
	}
	let now = 0
	const fetch = (async (url: string, init: RequestInit) => {
		calls++
		assert.equal(url, "https://discord.com/api/v10/applications/app/emojis")
		assert.deepEqual(init.headers, { Authorization: "Bot token" })
		return new Response(
			JSON.stringify({
				items: [
					...uploaded.map((name) => ({ id: emojis[name], name })),
					{ id: "12", name: "other" },
					{ id: "13", name: "gw_score_1" },
				],
			}),
		)
	}) as typeof globalThis.fetch
	const options = {
		appId: "app",
		botToken: "token",
		fetch,
		store,
		now: () => now,
	}
	const one = { GoodWatchScore1: emojis.GoodWatchScore1 }
	assert.deepEqual(await applicationEmojiIds(options), one)
	assert.deepEqual(await applicationEmojiIds(options), one)
	assert.equal(calls, 1)
	assert.equal(stored.get("discord:emojis:v3:app")?.ttl, 300)
	uploaded = SCORE_EMOJI_NAMES
	stored.clear()
	now = 301_000
	assert.deepEqual(await applicationEmojiIds(options), emojis)
	assert.equal(calls, 2)
	assert.equal(stored.get("discord:emojis:v3:app")?.ttl, 86400)
	now = 3_600_000
	assert.deepEqual(await applicationEmojiIds(options), emojis)
	assert.equal(calls, 2, "cached in process")
	resetEmojiCache()
	assert.deepEqual(await applicationEmojiIds(options), emojis)
	assert.equal(calls, 2, "a second process reads Valkey, not Discord")
	assert.deepEqual(
		JSON.parse(stored.get("discord:emojis:v3:app")!.value).expires_at,
		301_000 + 86_400_000,
		"the entry carries its own expiry",
	)
	resetEmojiCache()
	const failing = (async () =>
		new Response("", { status: 500 })) as typeof globalThis.fetch
	assert.deepEqual(
		await applicationEmojiIds({ ...options, fetch: failing, store: null }),
		{},
	)
	resetEmojiCache()
})

test("emoji IDs: a partial Valkey hit keeps only its remaining few minutes in process", async () => {
	resetEmojiCache()
	let calls = 0
	let now = 0
	const one = { GoodWatchScore1: emojis.GoodWatchScore1 }
	// Another process wrote a partial map at 0, which Valkey keeps for 300 s.
	const stored = new Map([
		[
			"discord:emojis:v3:app",
			JSON.stringify({ ids: one, expires_at: 300_000 }),
		],
	])
	const store = {
		get: async (key: string) => stored.get(key) ?? null,
		set: async (key: string, value: string) => {
			stored.set(key, value)
		},
	}
	const fetch = (async () => {
		calls++
		return new Response(
			JSON.stringify({
				items: SCORE_EMOJI_NAMES.map((name) => ({ id: emojis[name], name })),
			}),
		)
	}) as typeof globalThis.fetch
	const options = {
		appId: "app",
		botToken: "token",
		fetch,
		store,
		now: () => now,
	}
	now = 100_000
	assert.deepEqual(await applicationEmojiIds(options), one)
	now = 299_000
	assert.deepEqual(await applicationEmojiIds(options), one)
	assert.equal(calls, 0)
	// Past five minutes: the process memo has run out with the entry, and the stale Valkey value is not reused.
	now = 301_000
	assert.deepEqual(await applicationEmojiIds(options), emojis)
	assert.equal(calls, 1)
	// A complete entry read late keeps only what Valkey has left, not a fresh 24 hours.
	resetEmojiCache()
	now = 301_000 + 86_000_000
	assert.deepEqual(await applicationEmojiIds(options), emojis)
	now = 301_000 + 86_401_000
	await applicationEmojiIds(options)
	assert.equal(calls, 2)
	resetEmojiCache()
})

test("service links: long links go through the GoodWatch redirect, more than ten services end with More on GoodWatch", () => {
	const long = `https://click.justwatch.com/a?r=${"x".repeat(600)}`
	assert.equal(
		streamButtonUrl(
			{ service_id: 8, name: "Netflix", url: long, stream_link: "" },
			"movie:687163",
			"de",
		),
		"https://goodwatch.app/go/stream/movie/687163/8?country=DE",
	)
	assert.equal(
		streamButtonUrl(
			{ name: "Netflix", url: long, stream_link: "" },
			"movie:687163",
			"DE",
		),
		null,
	)
	assert.equal(
		streamButtonUrl(
			{ service_id: 8, url: "javascript:alert(1)", stream_link: "" },
			"movie:687163",
			"DE",
		),
		null,
	)
	const offers = Array.from({ length: 12 }, (_, i) => ({
		service_id: 900000 + i,
		name: `Service Name ${String.fromCharCode(65 + i)}`,
		url: i === 0 ? long : `https://s.example/${i}`,
		offer_type: "flatrate",
		stream_link: "",
	}))
	const many = { ...title, availability: { state: "watchable", offers } }
	const parts = streamLinks(many, "DE")
	const rows = parts.filter((c) => c.type === 1 && c.components?.[0].type === 2)
	assert.equal(rows.length, 2)
	assert.deepEqual(
		rows.map((r) => r.components!.length),
		[5, 5],
	)
	const buttons = rows.flatMap((r) => r.components!)
	assert.equal(
		buttons[0].url,
		"https://goodwatch.app/go/stream/movie/687163/900000?country=DE",
	)
	assert.equal(buttons.at(-1)!.label, "More on GoodWatch")
	assert.equal(
		buttons.at(-1)!.url,
		"https://goodwatch.app/movie/687163-project-hail-mary#streaming",
	)
	assert.ok(buttons.every((b) => String(b.url).length <= 512))
	assert.doesNotMatch(
		JSON.stringify(parts),
		/Where to watch|Subscription:|Rent:/,
	)
	const card = titleCard(many, "DE", {
		member: { want_to_see: true },
		back: { kind: "hot", page: 1 },
	})
	assert.ok(componentCount(card.components) <= 40)
	assert.deepEqual(
		all(card.components)
			.filter((c) => c.type === 2 && c.style !== 5)
			.map((c) => c.label),
		["Back", "Similar", "Share to channel", "Want to see", "Seen", "Rate"],
	)
	const none = streamLinks(
		{ ...title, availability: { state: "no_match", offers: [] } },
		"DE",
	)
	assert.equal(none[0].content, "Not on a subscription service in Germany")
	assert.equal(none[1].components![0].placeholder, "Germany")
	assert.throws(() =>
		message([
			{ type: 1, components: [{ type: 2, style: 5, label: "x", url: long }] },
		]),
	)
})

test("subscription buttons use country popularity, exclude paid and unknown kinds, and have a country menu", () => {
	const offers = [
		{
			service_id: 2,
			name: "Apple TV Store",
			offer_type: "buy",
			display_priority: 0,
		},
		{
			service_id: 8,
			name: "Netflix",
			offer_type: "flatrate",
			display_priority: 3,
		},
		{
			service_id: 1899,
			name: "HBO Max",
			offer_type: "ads",
			display_priority: 1,
		},
		{ service_id: 11, name: "MUBI", offer_type: "free", display_priority: 2 },
		{
			service_id: 10,
			name: "Amazon Video",
			offer_type: "rent",
			display_priority: 0,
		},
		{ service_id: 9999, name: "Unknown offer" },
	].map((o) => ({
		...o,
		url: `https://service.example/${o.service_id}`,
		stream_link: "",
	}))
	const back = {
		kind: "discover" as const,
		key: "k0123456789abcdefab",
		page: 3,
	}
	const card = titleCard({ ...title, availability: { offers } }, "NZ", {
		back,
		share: true,
	})
	const controls = all(card.components)
	assert.deepEqual(
		controls.filter((c) => c.style === 5).map((c) => c.label),
		["HBO Max", "MUBI", "Netflix", "Open on GoodWatch"],
	)
	assert.doesNotMatch(
		texts(card.components).join("\n"),
		/Where to watch|Subscription:|Rent|Buy/,
	)
	const menu = controls.find((c) => c.type === 3)!
	assert.equal(menu.placeholder, "New Zealand")
	const choices = menu.options as {
		label: string
		value: string
		default: boolean
		emoji: { name: string }
	}[]
	assert.equal(choices.length, 21)
	assert.deepEqual(choices[0], {
		label: "New Zealand",
		value: "NZ",
		default: true,
		emoji: { name: "🇳🇿" },
	})
	assert.equal(new Set(choices.map((o) => o.value)).size, choices.length)
	assert.ok(String(menu.custom_id).length <= 100)
})
