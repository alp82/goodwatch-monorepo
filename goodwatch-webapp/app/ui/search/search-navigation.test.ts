import assert from "node:assert/strict"
import { test } from "node:test"

const { searchDetailShouldRevalidate } = await import("./search-navigation.ts")

const decide = (current: string, next: string, formMethod?: string) =>
	searchDetailShouldRevalidate({
		currentUrl: new URL(current, "https://goodwatch.app"),
		nextUrl: new URL(next, "https://goodwatch.app"),
		defaultShouldRevalidate: true,
		formMethod,
	} as Parameters<typeof searchDetailShouldRevalidate>[0])

const journey = "searchJourney=1&q=matrix"

test("a search refinement on a slugged title page keeps the loaded title", () => {
	assert.equal(
		decide(
			`/movie/603-the-matrix?${journey}&page=1`,
			`/movie/603-the-matrix?${journey}&page=2`,
		),
		false,
	)
	assert.equal(
		decide(
			`/show/1396-breaking-bad?${journey}`,
			`/show/1396-breaking-bad?${journey}&sort=popular`,
		),
		false,
	)
})

test("another title in the journey loads", () => {
	assert.equal(
		decide(
			`/movie/603-the-matrix?${journey}`,
			`/movie/604-the-matrix-reloaded?${journey}`,
		),
		true,
	)
})

test("the same title under an address without its slug loads", () => {
	assert.equal(
		decide(`/movie/603?${journey}`, `/movie/603-the-matrix?${journey}`),
		true,
	)
})

test("a change of country or language loads", () => {
	assert.equal(
		decide(
			`/movie/603-the-matrix?${journey}`,
			`/movie/603-the-matrix?${journey}&country=DE`,
		),
		true,
	)
	assert.equal(
		decide(
			`/movie/603-the-matrix?${journey}&language=en`,
			`/movie/603-the-matrix?${journey}&language=de`,
		),
		true,
	)
})

test("outside the search journey and after a form the default decides", () => {
	assert.equal(
		decide("/movie/603-the-matrix?page=1", "/movie/603-the-matrix?page=2"),
		true,
	)
	assert.equal(
		decide(
			`/movie/603-the-matrix?${journey}`,
			`/movie/603-the-matrix?${journey}&page=2`,
			"POST",
		),
		true,
	)
})
