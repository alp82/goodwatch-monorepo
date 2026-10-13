// `/api/title-cards`: which requests it answers, who it reads the cards for, and that nothing may store the answer.
import "@remix-run/node"
import "zod"
import "./title-filter/test-alias.ts"
import assert from "node:assert/strict"
import { test } from "node:test"
import type { CardService, TitleCard } from "~/server/title-cards.server"
import type { GuestProgress } from "~/server/viewer.server"

const { parseCardKeys, titleCardsResponse } = await import(
	"./title-cards-request.server.ts"
)

const MATRIX = 1_000_000_000_603
const THRONES = 2_000_000_001_399
const URL_ = "https://goodwatch.app/api/title-cards"

const card = (key: number): TitleCard =>
	({ key, title: `Title ${key}`, wantToSee: false }) as TitleCard
const netflix: CardService = { id: 8, name: "Netflix", logo_path: "/n.jpg" }

/** A reader that answers every key but `missing` and notes what it was asked. */
function reader(missing: number[] = []) {
	const calls: { guest: GuestProgress | undefined; keys: number[] }[] = []
	return {
		calls,
		request: {
			max: 3,
			read: async (
				_request: Request,
				guest: GuestProgress | undefined,
				keys: number[],
			) => {
				calls.push({ guest, keys })
				return {
					cards: keys.filter((key) => !missing.includes(key)).map(card),
					services: [netflix],
				}
			},
		},
	}
}

const post = (keys: string, body: unknown) =>
	new Request(`${URL_}?keys=${keys}`, {
		method: "POST",
		body: typeof body === "string" ? body : JSON.stringify(body),
	})

test("keys are read from keys=1,2,3: in order, without repeats, at most the limit", () => {
	assert.deepEqual(parseCardKeys(`${MATRIX},${THRONES}`, 60), [MATRIX, THRONES])
	assert.deepEqual(parseCardKeys(`${THRONES},${MATRIX},${THRONES}`, 60), [
		THRONES,
		MATRIX,
	])
	assert.deepEqual(parseCardKeys("1,2,3", 3), [1, 2, 3])
	assert.equal(parseCardKeys("1,2,3,4", 3), null)
	// A repeat does not count toward the limit.
	assert.deepEqual(parseCardKeys("1,2,3,3", 3), [1, 2, 3])
})

test("no keys, and anything that is no key, is no request", () => {
	for (const value of [
		null,
		"",
		"movie-603",
		"1,,2",
		"1.5",
		"-1",
		"0",
		"4000000000000",
		"1e3x",
	])
		assert.equal(parseCardKeys(value, 60), null, String(value))
})

test("a member's GET answers the cards in the order asked, with their services", async () => {
	const { calls, request } = reader()
	const response = await titleCardsResponse(
		new Request(`${URL_}?keys=${THRONES},${MATRIX}`),
		request,
	)
	assert.equal(response.status, 200)
	assert.deepEqual(await response.json(), {
		cards: [card(THRONES), card(MATRIX)],
		services: [netflix],
	})
	assert.deepEqual(calls, [{ guest: undefined, keys: [THRONES, MATRIX] }])
})

test("a guest's POST hands the browser's guest progress to the read", async () => {
	const { calls, request } = reader()
	const guest = {
		interactions: [{ media_type: "movie", tmdb_id: 603, type: "plan" }],
		country: "DE",
		services: "8,9",
	}
	const response = await titleCardsResponse(
		post(String(MATRIX), { guest, more: "ignored" }),
		request,
	)
	assert.equal(response.status, 200)
	assert.deepEqual(calls, [{ guest, keys: [MATRIX] }])
	// A POST without a body is a guest nobody knows anything about.
	await titleCardsResponse(post(String(MATRIX), ""), request)
	assert.equal(calls[1].guest, undefined)
})

test("a title the catalog lacks is left out, not an error", async () => {
	const { request } = reader([MATRIX])
	const response = await titleCardsResponse(
		new Request(`${URL_}?keys=${MATRIX},${THRONES}`),
		request,
	)
	assert.equal(response.status, 200)
	assert.deepEqual((await response.json()).cards, [card(THRONES)])
})

test("the answer is private and never stored, also when it is an error", async () => {
	const { request } = reader()
	const responses = await Promise.all([
		titleCardsResponse(new Request(`${URL_}?keys=${MATRIX}`), request),
		titleCardsResponse(new Request(URL_), request),
		titleCardsResponse(
			new Request(`${URL_}?keys=1`, { method: "DELETE" }),
			request,
		),
	])
	assert.deepEqual(
		responses.map((r) => r.status),
		[200, 400, 405],
	)
	for (const response of responses)
		assert.equal(response.headers.get("Cache-Control"), "private, no-store")
})

test("bad requests are refused before anything is read", async () => {
	const { calls, request } = reader()
	const refused = await Promise.all([
		titleCardsResponse(new Request(URL_), request),
		titleCardsResponse(new Request(`${URL_}?keys=movie-603`), request),
		titleCardsResponse(new Request(`${URL_}?keys=1,2,3,4`), request),
		titleCardsResponse(post("1", "{not json"), request),
		titleCardsResponse(post("1", { guest: { interactions: "all" } }), request),
		titleCardsResponse(post("1", "x".repeat(256 * 1024 + 1)), request),
	])
	assert.deepEqual(
		refused.map((r) => r.status),
		[400, 400, 400, 400, 400, 400],
	)
	assert.match((await refused[2].json()).error, /up to 3 title keys/)
	assert.equal(calls.length, 0)
})
