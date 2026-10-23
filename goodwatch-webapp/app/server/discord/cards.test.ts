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
			{ name: "Prime Video", stream_link: "[Prime Video](https://p.example)" },
			{
				name: "Prime Video",
				stream_link: "[Prime Video](https://p.example/rent)",
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
		Array.from({ length: 10 }, (_, i) => `gw_score_${i + 1}`),
	)
	assert.equal(scoreBand(0), 1)
	assert.equal(scoreBand(19.9), 1)
	assert.equal(scoreBand(85), 8)
	assert.equal(scoreBand(99), 9)
	assert.equal(scoreBand(100), 10)
	assert.equal(scoreEmojiName(92), "gw_score_9")
	assert.match(scoreEmojiSvg(8), /fill="#16934a"/)
	assert.match(scoreEmojiSvg(8), /width="128" height="128"/)
	assert.throws(() => scoreEmojiSvg(11))
})

test("score line uses the title page word and falls back to text without emojis", () => {
	assert.equal(
		scoreLine(85.4, emojis),
		`<:gw_score_8:${emojis.gw_score_8}> **85 · Excellent**`,
	)
	assert.equal(scoreLine(85.4), "**85 · Excellent**")
	assert.equal(scoreLine(84.9, { gw_score_9: "1" }), "**84 · Great**")
	assert.equal(scoreLine(0, emojis), "Not rated yet")
	assert.equal(scoreLine(null), "Not rated yet")
})

test("1C guest title card: backdrop hero, big title, score emoji, providers, unchanged buttons", () => {
	const card = titleCard(title, "DE", { emojis })
	assert.equal(card.components.length, 1)
	const [box] = card.components
	assert.equal(box.type, 17)
	assert.equal("accent_color" in box, false)
	const [hero, heading, overview, separator, where, row] = box.components!
	assert.equal(hero.type, 12)
	assert.deepEqual(hero.items, [
		{
			media: { url: title.backdrop_url },
			description: "Project Hail Mary backdrop",
		},
	])
	assert.equal(
		heading.content,
		`# Project Hail Mary\n<:gw_score_8:${emojis.gw_score_8}> **85 · Excellent**  ·  2026  ·  2h 37m  ·  Science Fiction, Adventure`,
	)
	assert.ok(String(overview.content).endsWith("…"))
	assert.ok(String(overview.content).length <= 151)
	assert.equal(separator.type, 14)
	assert.equal(where.content, "-# Where to watch in Germany\n**Prime Video**")
	assert.deepEqual(
		row.components!.map((b) => b.label),
		["Where to watch", "Similar", "Open on GoodWatch", "Share to channel"],
	)
	assert.ok(componentCount(card.components) <= 40)
	for (const content of texts(card.components)) {
		assert.doesNotMatch(content, /!|—/)
	}
})

test("1C share copy is public and drops only the Share button", () => {
	const shared = titleCard(title, "DE", {
		share: true,
		emojis,
		allServices: true,
	})
	assert.equal(shared.flags & 64, 0)
	assert.doesNotMatch(JSON.stringify(shared), /Share to channel/)
	assert.match(
		JSON.stringify(shared),
		/Where to watch on every service in Germany/,
	)
})

test("1C without a backdrop falls back to the poster thumbnail with the vibe accent", () => {
	const card = titleCard({ ...title, backdrop_url: null }, "GB")
	const [box] = card.components
	assert.equal(box.accent_color, 0x16934a)
	assert.equal(box.components![0].type, 9)
	assert.equal(box.components![0].accessory?.type, 11)
	assert.match(JSON.stringify(card), /in the United Kingdom/)
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
	assert.equal(member.components!.length, 1)
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
		`**1**  <:gw_score_9:${emojis.gw_score_9}>  **Title 1**  ·  90  ·  2000  ·  1h 35m`,
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
		id: emojis.gw_score_9,
		name: "gw_score_9",
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
		`### Slow down\nYou can send 30 commands a minute and 500 an hour. Try again <t:${Date.UTC(2026, 9, 23, 19, 4) / 1000 + 42}:R>.`,
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
	const one = { gw_score_1: emojis.gw_score_1 }
	assert.deepEqual(await applicationEmojiIds(options), one)
	assert.deepEqual(await applicationEmojiIds(options), one)
	assert.equal(calls, 1)
	assert.equal(stored.get("discord:emojis:v2:app")?.ttl, 300)
	uploaded = SCORE_EMOJI_NAMES
	stored.clear()
	now = 301_000
	assert.deepEqual(await applicationEmojiIds(options), emojis)
	assert.equal(calls, 2)
	assert.equal(stored.get("discord:emojis:v2:app")?.ttl, 86400)
	now = 3_600_000
	assert.deepEqual(await applicationEmojiIds(options), emojis)
	assert.equal(calls, 2, "cached in process")
	resetEmojiCache()
	assert.deepEqual(await applicationEmojiIds(options), emojis)
	assert.equal(calls, 2, "a second process reads Valkey, not Discord")
	assert.deepEqual(
		JSON.parse(stored.get("discord:emojis:v2:app")!.value).expires_at,
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
	const one = { gw_score_1: emojis.gw_score_1 }
	// Another process wrote a partial map at 0, which Valkey keeps for 300 s.
	const stored = new Map([
		[
			"discord:emojis:v2:app",
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
	const options = { appId: "app", botToken: "token", fetch, store, now: () => now }
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
