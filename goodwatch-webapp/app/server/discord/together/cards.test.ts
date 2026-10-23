import assert from "node:assert/strict"
import { test } from "node:test"
import {
	componentCount,
	EPHEMERAL,
	type Component,
	type GuestTitle,
} from "../cards.ts"
import { publicCard, votingCard, installCard } from "./cards.ts"
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
	assert.match(JSON.stringify(card), /all services.*Netflix/)
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
	assert.match(JSON.stringify(card), /waiting for 2/)
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
	const t = { ...title, name: "A_title movie:123", genres: ["Science_fiction"] }
	s.summary.matches = [title.id]
	const emojis = { gw_score_9: "badge" }
	for (const card of [
		publicCard(s, [t], emojis),
		votingCard(s, "a", t, emojis),
	]) {
		const content = flatten(card.components)
			.map((c) => c.content ?? "")
			.join("\n")
		assert.match(content, /<:gw_score_9:badge> \*\*95 · Masterpiece\*\*/)
		assert.match(content, /Science fiction/)
		assert.match(content, /A title this title/)
		assert.doesNotMatch(content.replace(/<:[^>]+>/g, ""), /_|movie:123/)
	}
})
