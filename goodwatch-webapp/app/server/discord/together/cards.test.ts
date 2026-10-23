import assert from "node:assert/strict"
import { test } from "node:test"
import {
	componentCount,
	EPHEMERAL,
	type Component,
	type GuestTitle,
} from "../cards.ts"
import {
	publicCard,
	votingCard,
	installCard,
	publicSignature,
} from "./cards.ts"
import { togetherCustomId, parseTogetherId } from "../custom-id.ts"
import { summarize } from "./rules.ts"
import type { Session } from "./store.server.ts"
const id = "a".repeat(24)
const title: GuestTitle = {
	id: "movie:1",
	name: "A title",
	year: 2026,
	goodwatch_score: 95,
	runtime_minutes: 121,
	poster_url: "https://image.tmdb.org/t/p/w342/a.jpg",
	trailer_url: "https://www.youtube.com/watch?v=abcdefghijk",
	availability: {
		offers: [{ name: "Netflix", stream_link: "", offer_type: "flatrate" }],
	},
}
function session(): Session {
	const state = { deck: [title.id], votes: {} }
	return {
		...state,
		summary: summarize(state),
		meta: {
			id,
			guildId: "guild",
			starterId: "starter",
			createdAt: 0,
			status: "open",
			type: "movie",
			mood: "feelgood",
			place: { country: "DE", services: [] },
			deck: state.deck,
		},
	}
}
const flatten = (cs: Component[]): Component[] =>
	cs.flatMap((c) => [
		c,
		...flatten(c.components ?? []),
		...(c.accessory ? [c.accessory] : []),
	])
test("6A has a thumbnail, rounded score word, runtime, services, stable vote row, and separate official trailer row", () => {
	const card = votingCard(session(), "a", title),
		nodes = flatten(card.components)
	assert.ok(card.flags & EPHEMERAL)
	assert.ok(nodes.some((c) => c.type === 11))
	assert.match(JSON.stringify(card), /95 · Masterpiece/)
	assert.match(JSON.stringify(card), /2h 1m/)
	assert.match(
		JSON.stringify(card),
		/Where to watch on every service in Germany\\nNetflix/,
	)
	assert.doesNotMatch(JSON.stringify(card), /all services|· DE\b/)
	const rows = nodes.filter((c) => c.type === 1)
	assert.deepEqual(
		rows[0].components!.map((b) => b.label),
		["Yep", "Nope", "Undo", "Leave"],
	)
	assert.deepEqual(
		rows[1].components!.map((b) => b.label),
		["Trailer"],
	)
	assert.ok(componentCount(card.components) <= 40)
	assert.equal(
		flatten(
			votingCard(session(), "a", { ...title, trailer_url: null }).components,
		).filter((c) => c.type === 1).length,
		1,
	)
})
test("5B caps match and possible poster rows, mentions overflow, and respects component and text limits", () => {
	const s = session()
	const titles = Array.from({ length: 120 }, (_, i) => ({
		...title,
		id: `movie:${i + 1}`,
		name: "x".repeat(300),
		availability: {
			offers: Array.from({ length: 10 }, () => ({
				name: "y".repeat(200),
				stream_link: "",
			})),
		},
	}))
	s.summary = {
		participantCount: 12,
		stillVoting: 11,
		matches: titles.slice(0, 60).map((t) => t.id),
		possibleMatches: titles
			.slice(60)
			.map((t) => ({ titleId: t.id, waitingFor: 2 })),
	}
	const card = publicCard(s, titles),
		nodes = flatten(card.components)
	assert.equal(card.flags & EPHEMERAL, 0)
	assert.equal(nodes.filter((c) => c.type === 11).length, 10)
	assert.match(JSON.stringify(card), /55 more matches/)
	assert.match(JSON.stringify(card), /waiting for 2 people/)
	assert.match(JSON.stringify(card), /12 participants · 11 still voting/)
	assert.ok(componentCount(card.components) <= 40)
	assert.ok(
		nodes.reduce(
			(n, c) => n + (typeof c.content === "string" ? c.content.length : 0),
			0,
		) <= 4000,
	)
})
test("waiting card keeps Undo and Leave; no trailer; lobby has Join", () => {
	const s = session()
	s.votes.a = [{ titleId: title.id, vote: "yep" }]
	const card = votingCard(s, "a")
	assert.match(JSON.stringify(card), /every title for now/)
	assert.deepEqual(
		flatten(card.components)
			.filter((c) => c.type === 2)
			.map((c) => c.label),
		["Undo", "Leave"],
	)
	assert.match(JSON.stringify(publicCard(session())), /Join/)
})
test("all together IDs round trip within 100 characters and reject malformed IDs", () => {
	for (const action of ["join", "yep", "nope", "undo", "leave"] as const) {
		const titleId = ["yep", "nope", "undo"].includes(action)
			? "show:9999999999"
			: undefined
		const value = togetherCustomId(action, id, titleId)
		assert.ok(value.length <= 100)
		assert.deepEqual(parseTogetherId(value), {
			action,
			session: id,
			...(titleId ? { titleId } : {}),
		})
	}
	for (const value of [
		"x".repeat(101),
		`gw1:together:yep:${id}`,
		`gw1:together:join:${id}:movie:1`,
		`gw1:together:yep:${id}:movie:0`,
		"gw1:together:join:bad",
	])
		assert.equal(parseTogetherId(value), null)
	const url = flatten(installCard("app").components).find((c) => c.type === 2)!
		.url as string
	assert.match(url, /client_id=app/)
	assert.match(url, /permissions=52224/)
})

test("5B and 6A share score badges and title facts and clean human-facing text", () => {
	const s = session()
	const t = {
		...title,
		name: "A_title movie:123",
		genres: ["Science_fiction"],
	}
	s.summary.matches = [title.id]
	const emojis = { GoodWatchScore9: "badge" }
	for (const card of [
		publicCard(s, [t], emojis),
		votingCard(s, "a", t, emojis),
	]) {
		const content = flatten(card.components)
			.map((c) => c.content ?? "")
			.join("\n")
		assert.match(content, /<:GoodWatchScore9:badge> \*\*95 · Masterpiece\*\*/)
		assert.match(content, /Science fiction/)
		assert.match(content, /A title this title/)
		assert.doesNotMatch(content.replace(/<:[^>]+>/g, ""), /_|movie:123/)
	}
})

test("5B counts read as one participant, one more match, and waiting for 1 person", () => {
	const s = session()
	const titles = Array.from({ length: 12 }, (_, i) => ({
		...title,
		id: `movie:${i + 1}`,
	}))
	s.summary = {
		participantCount: 1,
		stillVoting: 1,
		matches: titles.slice(0, 6).map((t) => t.id),
		possibleMatches: titles
			.slice(6)
			.map((t) => ({ titleId: t.id, waitingFor: 1 })),
	}
	const sent = JSON.stringify(publicCard(s, titles))
	assert.match(sent, /1 participant · 1 still voting/)
	assert.match(sent, /and 1 more match"/)
	assert.match(sent, /and 1 more possible match"/)
	assert.match(sent, /waiting for 1 person/)
	assert.doesNotMatch(sent, /1 participants|1 more matches/)
})

test("public menus cap picks at 25, name participants, show pick counts, and fit with all poster rows", () => {
	const s = session()
	const titles = Array.from({ length: 60 }, (_, i) => ({
		...title,
		id: `movie:${i + 1}`,
		name: "A_long_title movie:99 " + "n".repeat(200),
	}))
	s.deck = s.meta.deck = titles.map((t) => t.id)
	s.votes = Object.fromEntries(
		Array.from({ length: 12 }, (_, i) => [
			`123456789012345${String(i).padStart(3, "0")}`,
			[{ titleId: title.id, vote: "yep" as const }],
		]),
	)
	s.names = Object.fromEntries(
		Object.keys(s.votes).map((id) => [id, "Human_name"]),
	)
	s.picks = { [Object.keys(s.votes)[0]]: title.id }
	s.summary = {
		participantCount: 12,
		stillVoting: 12,
		matches: titles.slice(0, 30).map((t) => t.id),
		possibleMatches: titles
			.slice(30)
			.map((t) => ({ titleId: t.id, waitingFor: 1 })),
	}
	const card = publicCard(s, titles)
	const nodes = flatten(card.components)
	assert.ok(componentCount(card.components) <= 40)
	const menus = nodes.filter((c) => c.type === 3)
	assert.deepEqual(
		menus.map((c) => (c.options as unknown[]).length),
		[25, 12],
	)
	assert.match(JSON.stringify(card), /picked by 1 of 12/)
	const visible = nodes
		.flatMap((c) => [
			c.content ?? "",
			...((c.options ?? []) as { label: string }[]).map((o) => o.label),
		])
		.join("\n")
	assert.match(visible, /Human name/)
	assert.doesNotMatch(visible, /_|movie:99|\d{15,20}/)
})

test("5B decided uses the shared OG image, title facts, fresh offers and availability failure copy; closed cards have no session controls", () => {
	const s = session()
	s.meta.status = "decided"
	s.meta.decidedTitleId = title.id
	s.meta.decisionTitle = { ...title, name: "A_title" }
	s.summary.participantCount = 4
	const card = publicCard(s, [], { gw_score_9: "badge" })
	assert.match(JSON.stringify(card), /\/og\/movie\/1-a_title\.jpg\?brand=/)
	assert.match(JSON.stringify(card), /95 · Masterpiece/)
	assert.match(JSON.stringify(card), /Decided: A title/)
	assert.match(JSON.stringify(card), /Netflix/)
	assert.equal(flatten(card.components).filter((c) => c.type === 3).length, 0)
	s.meta.availabilityFailed = true
	assert.match(
		JSON.stringify(publicCard(s)),
		/Availability couldn't be checked/,
	)
	for (const status of ["ended", "expired"] as const) {
		s.meta.status = status
		const closed = publicCard(s)
		assert.equal(
			flatten(closed.components).filter((c) => c.type === 2 || c.type === 3)
				.length,
			0,
		)
		assert.match(
			JSON.stringify(closed),
			status === "ended" ? /Ended by the starter/ : /session expired/,
		)
	}
})

test("5B exhausted shows only the top three Yep choices with names and a starter menu", () => {
	const s = session()
	s.deck = s.meta.deck = Array.from({ length: 120 }, (_, i) => `movie:${i + 1}`)
	s.votes = {
		a: s.deck.map((titleId) => ({ titleId, vote: "nope" })),
		b: s.deck.map((titleId, i) => ({ titleId, vote: i < 4 ? "yep" : "nope" })),
	}
	s.names = { a: "Alice", b: "Bob" }
	s.summary = summarize(s)
	const card = publicCard(
		s,
		[1, 2, 3].map((i) => ({ ...title, id: `movie:${i}`, name: `Title ${i}` })),
	)
	assert.match(JSON.stringify(card), /Deck exhausted/)
	const choose = flatten(card.components).find(
		(c) => c.type === 3 && String(c.custom_id).includes(":choose:"),
	)!
	assert.deepEqual(
		(choose.options as { label: string }[]).map((o) => o.label),
		["Title 1", "Title 2", "Title 3"],
	)
	assert.ok(componentCount(card.components) <= 40)
})

test("public signatures include picks and stay stable across Lua object order and expired ballot cleanup", () => {
	const s = session()
	const initial = publicSignature(s)
	s.picks = { a: title.id }
	assert.notEqual(publicSignature(s), initial)
	s.meta.status = "decided"
	s.meta.decisionTitle = title
	const decided = publicSignature(s)
	s.meta.decisionTitle = Object.fromEntries(
		Object.entries(title).reverse(),
	) as unknown as GuestTitle
	assert.equal(publicSignature(s), decided)
	s.meta.status = "expired"
	s.summary.participantCount = 2
	s.summary.stillVoting = 1
	const expired = publicSignature(s)
	s.votes = {}
	s.picks = {}
	s.names = {}
	s.summary.stillVoting = 0
	assert.equal(publicSignature(s), expired)
})

test("public counts use singular and plural nouns, including overflow and decisions", () => {
	for (const n of [1, 2]) {
		const s = session()
		s.summary.participantCount = n
		s.summary.matches = Array.from(
			{ length: 5 + n },
			(_, i) => `movie:${i + 1}`,
		)
		s.summary.possibleMatches = Array.from({ length: 5 + n }, (_, i) => ({
			titleId: `show:${i + 1}`,
			waitingFor: 1,
		}))
		s.picks = { a: title.id }
		const card = JSON.stringify(publicCard(s, [title]))
		assert.ok(card.includes(`${n} participant${n === 1 ? "" : "s"}`))
		assert.ok(card.includes(`picked by 1 of ${n}`))
		assert.ok(card.includes(`${n} more match${n === 1 ? "" : "es"}`))
		assert.ok(card.includes(`${n} more possible match${n === 1 ? "" : "es"}`))
		s.meta.status = "decided"
		s.meta.decidedTitleId = title.id
		assert.ok(
			JSON.stringify(publicCard(s)).includes(
				`${n} of ${n} participant${n === 1 ? "" : "s"}`,
			),
		)
	}
})

const offer = (service_id: number, name: string, offer_type = "flatrate") => ({
	service_id,
	name,
	offer_type,
	stream_link: "",
	url: `https://example.com/${service_id}`,
})
const served: GuestTitle = {
	...title,
	availability: {
		state: "watchable",
		offers: [
			offer(8, "Netflix"),
			offer(337, "Disney Plus"),
			offer(11, "MUBI"),
			offer(2, "Apple TV Store", "rent"),
			offer(3, "Google Play Movies", "buy"),
		],
	},
}
const logos = { Netflix: "101", DisneyPlus: "102", MUBI: "103" }

test("voting card and match rows show service logos with names as text, a readable country, and no buttons", () => {
	const s = session()
	s.meta.place = { country: "US", services: [8, 337] }
	const voting = JSON.stringify(votingCard(s, "a", served, logos))
	assert.match(
		voting,
		/Where to watch in the United States\\n<:Netflix:101> Netflix, <:DisneyPlus:102> Disney\+, Apple TV Store and 2 more/,
	)
	assert.doesNotMatch(voting, /"url":"https:\/\/example\.com/)
	s.summary = {
		participantCount: 2,
		stillVoting: 0,
		matches: [served.id],
		possibleMatches: [],
	}
	const sent = JSON.stringify(publicCard(s, [served], logos))
	// Rows show logos only, under one place line in the header.
	assert.match(sent, /still voting\\n-# Where to watch in the United States"/)
	assert.match(
		sent,
		/<:Netflix:101> <:DisneyPlus:102> \*\*Apple TV Store\*\*  \+2 more/,
	)
	assert.equal(sent.match(/Where to watch/g)?.length, 1)
	assert.doesNotMatch(
		sent,
		/"url":"https:\/\/example\.com|\bUS\b|all services/,
	)
})

test("decision card gets the title card's service link buttons with logos, and names as text when no link works", () => {
	const s = session()
	s.meta.status = "decided"
	s.meta.decidedTitleId = served.id
	s.meta.decisionTitle = served
	s.meta.place = { country: "GB", services: [] }
	s.summary.participantCount = 2
	const card = publicCard(s, [], logos)
	const buttons = flatten(card.components).filter((c) => c.type === 2)
	assert.deepEqual(
		buttons.map((b) => b.label),
		[
			"Netflix",
			"Disney+",
			"Apple TV Store",
			"MUBI",
			"Google Play Movies",
			"Open on GoodWatch",
		],
	)
	assert.deepEqual(buttons[0].emoji, { id: "101", name: "Netflix" })
	assert.ok(buttons.every((b) => b.style === 5 && !b.custom_id))
	const sent = JSON.stringify(card)
	assert.match(sent, /Where to watch on every service in the United Kingdom/)
	assert.doesNotMatch(sent, /gw1:watch|\bGB\b/)
	s.meta.decisionTitle = {
		...served,
		availability: {
			state: "watchable",
			offers: [{ ...offer(8, "Netflix"), url: undefined }],
		},
	}
	const unlinked = publicCard(s, [], logos)
	assert.match(JSON.stringify(unlinked), /<:Netflix:101> Netflix/)
	assert.equal(
		flatten(unlinked.components).filter((c) => c.type === 2).length,
		1,
	)
})

test("a full public card with long titles and three logos per row stays within Discord's text limit", () => {
	// Real emoji markup: long CamelCase names and 19-digit IDs.
	const services: [number, string][] = [
		[1747, "Studiocanal Presents Amazon Channel"],
		[2266, "Qello Concerts by Stingray Amazon Channel"],
		[2445, "MovieSphere+ Amazon Channel"],
		[1737, "INA Madelen Amazon Channel"],
		[2430, "PBS Documentaries Amazon Channel"],
	]
	const emojis = Object.fromEntries(
		[
			"StudiocanalPresentsAmazonChannel",
			"QelloConcertsByStingrayAmazonCha",
			"MovieSpherePlusAmazonChannel",
			"INAMadelenAmazonChannel",
			"PBSDocumentariesAmazonChannel",
		].map((name, i) => [name, `14290871234567890${10 + i}`]),
	)
	const titles: GuestTitle[] = Array.from({ length: 9 }, (_, i) => ({
		...title,
		id: `movie:${i + 1}`,
		name: `The Extraordinary and Unlikely Adventures of the Midnight Cartographers Society, Part ${i + 1}: The Long Road Home`,
		genres: ["Science Fiction", "Documentary", "Adventure"],
		availability: {
			state: "watchable",
			offers: services.map(([id, name]) => offer(id, name)),
		},
	}))
	const s = session()
	s.meta.place = { country: "US", services: [] }
	s.votes = Object.fromEntries(
		Array.from({ length: 12 }, (_, i) => [`user${i}`, []]),
	)
	s.names = Object.fromEntries(
		Array.from({ length: 12 }, (_, i) => [`user${i}`, `Participant name ${i}`]),
	)
	s.summary = {
		participantCount: 12,
		stillVoting: 12,
		matches: titles.slice(0, 5).map((t) => t.id),
		possibleMatches: titles
			.slice(5)
			.map((t) => ({ titleId: t.id, waitingFor: 11 })),
	}
	const card = publicCard(s, titles, emojis)
	const nodes = flatten(card.components)
	const text = nodes.reduce(
		(n, c) => n + (typeof c.content === "string" ? c.content.length : 0),
		0,
	)
	assert.ok(text <= 4000, `text is ${text} characters`)
	assert.ok(componentCount(card.components) <= 40)
	const sent = JSON.stringify(card)
	assert.match(sent, /\\n(<:[A-Za-z]+:\d{19}> ){2}<:[A-Za-z]+:\d{19}>  \+2 more"/)
	assert.equal(sent.match(/Where to watch/g)?.length, 1)
	const rows = nodes.filter((c) => c.type === 11).length
	assert.ok(rows >= 5, `only ${rows} rows fit`)
	if (rows < 9) assert.match(sent, /and \d more possible match/)
	// Rows that still don't fit are dropped from the end and counted.
	const crowded = titles.map((t) => ({
		...t,
		genres: ["Science Fiction ".repeat(12), "Documentary ".repeat(12), "Adventure ".repeat(12)],
	}))
	const dropped = publicCard(s, crowded, emojis)
	const droppedText = flatten(dropped.components).reduce(
		(n, c) => n + (typeof c.content === "string" ? c.content.length : 0),
		0,
	)
	assert.ok(droppedText <= 4000)
	assert.match(JSON.stringify(dropped), /and \d more possible match/)
	// Without logos the names stand in, and the card still fits.
	const plain = flatten(publicCard(s, titles).components)
	assert.ok(
		plain.reduce(
			(n, c) => n + (typeof c.content === "string" ? c.content.length : 0),
			0,
		) <= 4000,
	)
})
