import "../title-filter/test-alias.ts"
import assert from "node:assert/strict"
import { test } from "node:test"
import {
	IS_COMPONENTS_V2,
	componentCount,
	titleCard,
	titleListCard,
	type Component,
	type GuestTitle,
} from "./cards.ts"
import { loadingLine, loadingMessage, pressedName } from "./loading.ts"

const all = (components: Component[]): Component[] =>
	components.flatMap((c) => [
		c,
		...all(c.components ?? []),
		...(c.accessory ? all([c.accessory]) : []),
	])
const title: GuestTitle = {
	id: "movie:7",
	name: "Seven_Samurai",
	year: 1954,
	poster_url: "https://image.tmdb.org/t/p/w342/p.jpg",
	availability: {
		state: "watchable",
		offers: [
			{
				service_id: 8,
				name: "Netflix",
				url: "https://n.example",
				stream_link: "",
			},
		],
	},
}

test("the loading card disables every button and menu, keeps the rest, and adds the loading line", () => {
	const card = titleCard(title, "DE").components
	const before = JSON.stringify(card)
	const loading = loadingMessage(card, loadingLine("Similar"))!
	assert.equal(JSON.stringify(card), before, "the pressed message stays as it was")
	assert.equal(loading.flags, IS_COMPONENTS_V2)
	assert.deepEqual(loading.allowed_mentions, { parse: [] })
	const controls = all(loading.components).filter(
		(c) => c.type === 2 || c.type === 3,
	)
	assert.ok(controls.length >= 4)
	assert.ok(controls.every((c) => c.disabled === true))
	assert.deepEqual(loading.components.at(-1), {
		type: 10,
		content: "-# Loading Similar…",
	})
	assert.equal(
		componentCount(loading.components),
		componentCount(card) + 1,
	)
	assert.equal(loadingMessage(undefined, "Loading…"), null)
	assert.equal(loadingMessage([], "Loading…"), null)
})

test("a full card gets the loading line in its last text instead of a new component", () => {
	const full: Component[] = Array.from({ length: 38 }, (_, i) => ({
		type: 10,
		content: `line ${i}`,
	}))
	full.push({
		type: 1,
		components: [{ type: 2, style: 2, label: "Next", custom_id: "gw1:hot:1" }],
	})
	assert.equal(componentCount(full), 40)
	const loading = loadingMessage(full, "Loading the next page…")!
	assert.equal(componentCount(loading.components), 40)
	assert.equal(
		loading.components[37].content,
		"line 37\n-# Loading the next page…",
	)
	assert.equal(full[37].content, "line 37")
})

test("pressed names: the chosen title from a menu, the next or previous page, or the fallback", () => {
	const list = titleListCard(
		"Hot",
		[
			{ id: "movie:7", name: "Seven Samurai", year: 1954 },
			{ id: "movie:8", name: "Ikiru", year: 1952 },
		],
		{ page: 0, next: true, stateKey: "k0123456789abcdefab" },
	).components
	const select = all(list).find((c) => c.type === 3)!
	assert.equal(
		pressedName(list, String(select.custom_id), ["movie:8"], "the title"),
		"Ikiru",
	)
	const next = all(list).find((c) => c.label === "Next")!
	assert.equal(
		loadingLine(pressedName(list, String(next.custom_id), [], "the page")),
		"Loading the next page…",
	)
	assert.equal(pressedName(list, "gw1:unknown", [], "the list"), "the list")
	assert.equal(loadingLine(""), "Loading…")
	assert.doesNotMatch(
		JSON.stringify(loadingMessage(list, loadingLine("Seven_Samurai"))),
		/Seven_Samurai/,
	)
})
