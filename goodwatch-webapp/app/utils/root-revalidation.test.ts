import assert from "node:assert/strict"
import { beforeEach, test } from "node:test"
import {
	requestRootRevalidation,
	rootRevalidated,
	shouldRevalidateRoot,
} from "./root-revalidation.ts"

type Args = Parameters<typeof shouldRevalidateRoot>[0]
const decide = (
	from: string,
	to: string,
	extra: Partial<Args> = {},
	defaultShouldRevalidate = true,
) =>
	shouldRevalidateRoot({
		currentUrl: new URL(from, "https://goodwatch.test"),
		nextUrl: new URL(to, "https://goodwatch.test"),
		currentParams: {},
		nextParams: {},
		defaultShouldRevalidate,
		...extra,
	} as Args)

beforeEach(rootRevalidated)

test("a navigation never reloads the root, whatever Remix would do", () => {
	for (const [from, to] of [
		["/", "/movie/603-the-matrix"],
		["/discover?genre=action", "/movie/603-the-matrix"],
		["/movie/603-the-matrix", "/discover?genre=action"],
		["/discover", "/discover?genre=action"],
		["/discover?genre=action", "/discover?genre=drama"],
		["/search?q=a", "/search?q=ab"],
	])
		assert.equal(decide(from, to), false, `${from} -> ${to}`)
})

test("a revalidation on the same URL and a form submission follow Remix", () => {
	assert.equal(decide("/u/someone", "/u/someone"), true)
	assert.equal(decide("/u/someone", "/u/someone", {}, false), false)
	assert.equal(decide("/a", "/b", { formMethod: "POST" }), true)
	assert.equal(decide("/a", "/b", { formMethod: "POST" }, false), false)
	// A hash change alone is not a navigation to another URL.
	assert.equal(decide("/a#one", "/a#two"), true)
})

test("a sign-in or sign-out reloads the root even during a navigation, until its data arrived", () => {
	requestRootRevalidation()
	assert.equal(decide("/sign-in", "/discover?genre=action"), true)
	assert.equal(decide("/a", "/b", {}, false), true)
	rootRevalidated()
	assert.equal(decide("/sign-in", "/discover?genre=action"), false)
})
