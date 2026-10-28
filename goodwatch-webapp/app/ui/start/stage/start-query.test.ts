import assert from "node:assert/strict"
import { test } from "node:test"
import {
	EMPTY_QUERY,
	IDLE_RESULTS,
	type StartQuery,
	type StartQueryAction,
	type StartResults,
	hasQuery,
	isChoice,
	querySignature,
	reduceQuery,
	startView,
} from "./start-query.ts"

const run = (...actions: StartQueryAction[]) =>
	actions.reduce(reduceQuery, EMPTY_QUERY)

test("typing changes only the draft; searching sets the trimmed text and keeps the picks", () => {
	const picked = run({ type: "picks", picks: ["m:funny"] })
	const typed = reduceQuery(picked, { type: "draft", draft: "rainy day" })
	assert.deepEqual(typed, { draft: "rainy day", text: "", picks: ["m:funny"] })
	const searched = reduceQuery(typed, {
		type: "search",
		text: " rainy day whodunit ",
	})
	assert.deepEqual(searched, {
		draft: " rainy day whodunit ",
		text: "rainy day whodunit",
		picks: ["m:funny"],
	})
})

test("picking keeps the text; Clear in the field keeps the picks; the picker's Clear keeps the text", () => {
	const q = run(
		{ type: "search", text: "twist ending" },
		{ type: "picks", picks: ["m:funny", "t:crime"] },
	)
	assert.equal(q.text, "twist ending")
	assert.deepEqual(reduceQuery(q, { type: "clearSearch" }), {
		draft: "",
		text: "",
		picks: ["m:funny", "t:crime"],
	})
	assert.deepEqual(reduceQuery(q, { type: "clearPicks" }), { ...q, picks: [] })
	assert.deepEqual(
		reduceQuery(q, { type: "removePick", id: "m:funny" }).picks,
		["t:crime"],
	)
})

test("at most three distinct picks", () => {
	assert.deepEqual(
		run({
			type: "picks",
			picks: ["m:funny", "m:funny", "t:crime", "s:slow", "m:scary"],
		}).picks,
		["m:funny", "t:crime", "s:slow"],
	)
})

test("an action that changes nothing returns the same query", () => {
	const q = run(
		{ type: "search", text: "space adventure" },
		{ type: "picks", picks: ["m:funny"] },
	)
	for (const action of [
		{ type: "draft", draft: "space adventure" },
		{ type: "search", text: "space adventure" },
		{ type: "picks", picks: ["m:funny"] },
		{ type: "removePick", id: "s:slow" },
	] satisfies StartQueryAction[])
		assert.equal(reduceQuery(q, action), q, action.type)
	assert.equal(reduceQuery(EMPTY_QUERY, { type: "clearSearch" }), EMPTY_QUERY)
	assert.equal(reduceQuery(EMPTY_QUERY, { type: "clearPicks" }), EMPTY_QUERY)
})

test("every action but typing is a choice", () => {
	assert.equal(isChoice({ type: "draft", draft: "a" }), false)
	for (const action of [
		{ type: "search", text: "a" },
		{ type: "clearSearch" },
		{ type: "picks", picks: [] },
		{ type: "removePick", id: "m:funny" },
		{ type: "clearPicks" },
	] satisfies StartQueryAction[])
		assert.equal(isChoice(action), true, action.type)
})

test("the signature names the searched text and the picks, not the draft", () => {
	const a = run({ type: "search", text: "cheer me up" })
	assert.equal(
		querySignature(a),
		querySignature(reduceQuery(a, { type: "draft", draft: "cheer me" })),
	)
	assert.notEqual(
		querySignature(a),
		querySignature(reduceQuery(a, { type: "picks", picks: ["m:funny"] })),
	)
	assert.notEqual(
		querySignature({ text: "a,b", picks: [] }),
		querySignature({ text: "a", picks: ["b"] }),
	)
	assert.equal(hasQuery(EMPTY_QUERY), false)
	assert.equal(hasQuery(a), true)
})

test("the view: empty before asking, loading until the query's own results arrive, For you at three loved", () => {
	const q: StartQuery = run({ type: "search", text: "cheer me up" })
	const ready = (
		query: StartQuery,
		status: StartResults["status"] = "ready",
	): StartResults => ({
		...IDLE_RESULTS,
		status,
		signature: querySignature(query),
	})
	assert.equal(startView(EMPTY_QUERY, IDLE_RESULTS, 0), "empty")
	assert.equal(startView(q, IDLE_RESULTS, 0), "loading")
	assert.equal(startView(q, ready(q, "loading"), 0), "loading")
	assert.equal(
		startView(q, ready(run({ type: "search", text: "other" })), 0),
		"loading",
	)
	assert.equal(startView(q, ready(q), 2), "results")
	assert.equal(startView(q, ready(q, "error"), 0), "results")
	assert.equal(startView(q, ready(q), 3), "forYou")
	assert.equal(startView(EMPTY_QUERY, IDLE_RESULTS, 3), "forYou")
})
