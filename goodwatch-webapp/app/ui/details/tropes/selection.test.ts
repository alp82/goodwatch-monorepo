import assert from "node:assert/strict"
import { test } from "node:test"
import { TROPE_PARAM, shouldRevalidateTropes, withTrope } from "./selection.ts"

const base = "https://goodwatch.app"
const movie = "/movie/1-example/tropes"
const show = "/show/2-example/tropes"
const trope = "https://tvtropes.org/pmwiki/pmwiki.php/Main/BigBad"

test("shared trope links preserve exact IDs on movie and show pages", () => {
	for (const path of [movie, show]) {
		for (const id of [trope, 'label:["A + B / C?", ""]']) {
			const url = new URL(withTrope(path, id), base)
			assert.equal(url.pathname, path)
			assert.equal(url.searchParams.get(TROPE_PARAM), id)
		}
	}
})

test("selecting or closing a trope preserves other view parameters and the hash", () => {
	const rest = "?country=DE&hl=big+bad#list"
	const selected = withTrope(movie + rest, trope)
	assert.deepEqual(new URL(selected, base).searchParams.getAll(TROPE_PARAM), [trope])
	assert.equal(withTrope(selected, null), movie + rest)
})

function revalidate(
	current: string,
	next: string,
	formMethod?: Parameters<typeof shouldRevalidateTropes>[0]["formMethod"],
) {
	return shouldRevalidateTropes({
		currentUrl: new URL(current, base),
		nextUrl: new URL(next, base),
		currentParams: {},
		nextParams: {},
		defaultShouldRevalidate: true,
		formMethod,
	})
}

test("selection and find highlights use the existing title data", () => {
	const selected = withTrope(movie + "?hl=big+bad", trope)
	assert.equal(revalidate(movie, selected), false)
	assert.equal(revalidate(selected, movie), false)
	assert.equal(revalidate(selected, withTrope(show, trope)), true)
	assert.equal(revalidate(selected, selected + "&country=DE"), true)
	assert.equal(revalidate(selected, selected), true)
	assert.equal(revalidate(movie, selected, "POST"), true)
})
