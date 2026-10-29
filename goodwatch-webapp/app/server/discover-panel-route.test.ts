import assert from "node:assert/strict"
import { test } from "node:test"
import { stubModules } from "./rating-onboarding.test-support.ts"

stubModules({
	"~/server/discover-results.server":
		"export class SnapshotNotLoaded extends Error {}; export const forYouFromParams = () => false; export const discoverFilterDefaults = () => ({onMyServices: false, notSeenYet: false})",
	"~/server/discover-panel.server": `export const isPanelPart = part => ['mixes', 'titles', 'people', 'released', 'taste'].includes(part);
		export const getDiscoverPanel = async (ctx, part, input) => ({part, input, guest: ctx.guest});`,
	"~/server/media-payload.server":
		"export const presentCatalogLoader = load => load",
	"~/server/viewer.server":
		"export const getViewerContext = async (request, guest) => ({guest: guest ?? null})",
})
const { loader, action } = await import("../routes/api.discover_.panel.ts")
const args = (request: Request) => ({ request, params: {}, context: {} })

test("GET parses panel part and filter query, with private responses and timing", async () => {
	for (const part of ["mixes", "titles", "people", "released", "taste"]) {
		const response = await loader(
			args(
				new Request(
					`https://goodwatch.test/api/discover/panel?part=${part}&moods=funny&all=moods&sort=top&taste=movie-603,2`,
				),
			),
		)
		assert.equal(response.status, 200)
		const body = JSON.parse(await response.text())
		assert.equal(body.part, part)
		assert.deepEqual(body.input.state.moods, ["funny"])
		assert.deepEqual(body.input.state.tasteGroups, ["movie-603", "2"])
		assert.equal(body.input.sort, "top")
		assert.equal(response.headers.get("Cache-Control"), "private, no-store")
		assert.match(
			response.headers.get("Server-Timing") ?? "",
			new RegExp(`${part};dur=`),
		)
	}
})

test("missing, unknown and inherited object property parts are rejected with 400", async () => {
	for (const suffix of [
		"",
		"?part=unknown",
		"?part=toString",
		"?part=__proto__",
	]) {
		const response = await loader(
			args(new Request(`https://goodwatch.test/api/discover/panel${suffix}`)),
		)
		assert.equal(response.status, 400)
	}
})

test("POST forwards guest progress; invalid, oversized bodies and other methods fail", async () => {
	const url = "https://goodwatch.test/api/discover/panel?part=mixes"
	const guest = { interactions: [{ id: 1 }], country: "DE", services: [8] }
	const response = await action(
		args(new Request(url, { method: "POST", body: JSON.stringify({ guest }) })),
	)
	assert.equal(response.status, 200)
	assert.deepEqual(JSON.parse(await response.text()).guest, guest)
	for (const body of [
		"{",
		JSON.stringify({ guest: { interactions: "invalid" } }),
		" ".repeat(256 * 1024 + 1),
	]) {
		assert.equal(
			(await action(args(new Request(url, { method: "POST", body })))).status,
			400,
		)
	}
	assert.equal(
		(await action(args(new Request(url, { method: "PUT" })))).status,
		405,
	)
})

test("people and released forward ranked search including empty results and default to relevance", async () => {
	for (const part of ["people", "released"]) {
		for (const ranked of [
			"1000000000001,invalid,2000000000002,1000000000001",
			"",
		]) {
			const response = await loader(
				args(
					new Request(
						`https://goodwatch.test/api/discover/panel?part=${part}&ranked=${ranked}&page=3`,
					),
				),
			)
			const body = JSON.parse(await response.text())
			assert.deepEqual(
				body.input.ranked,
				ranked ? [1000000000001, 2000000000002] : [],
			)
			assert.equal(body.input.sort, "relevance")
		}
	}
})
