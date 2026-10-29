import assert from "node:assert/strict"
import { test } from "node:test"
import { stubModules } from "./rating-onboarding.test-support.ts"

stubModules({
	"~/server/discover-results.server": `export class SnapshotNotLoaded extends Error {};
		export const forYouFromParams = () => false;
		export const discoverFilterDefaults = () => ({onMyServices: false, notSeenYet: false});
		export const getDiscoverResults = async (ctx, input) => ({input, guest: ctx.guest});`,
	"~/server/media-payload.server":
		"export const presentCatalogLoader = load => load",
	"~/server/viewer.server":
		"export const getViewerContext = async (request, guest) => ({guest: guest ?? null})",
})
const { loader, action } = await import("../routes/api.discover_.results.ts")
const args = (request: Request) => ({ request, params: {}, context: {} })

test("GET and guest POST opt into exact comma-list count groups, including combinations", async () => {
	for (const counts of [
		null,
		"taste",
		"scores",
		"budget",
		"shows",
		"released",
		"length",
		"origin",
		"taste,budget,shows,popularity,released,length,origin,scores",
		"tastes,budgets,show,unreleased,lengthy,origins,score",
	]) {
		for (const method of ["GET", "POST"]) {
			const url = new URL("https://goodwatch.test/api/discover/results")
			if (counts !== null) url.searchParams.set("counts", counts)
			const request = new Request(
				url,
				method === "POST"
					? { method, body: JSON.stringify({ guest: { interactions: [] } }) }
					: {},
			)
			const response = await (method === "POST" ? action : loader)(
				args(request),
			)
			assert.equal(response.status, 200)
			const { input } = JSON.parse(await response.text())
			for (const [group, flag] of [
				["popularity", "popularityCounts"],
				["taste", "tasteCounts"],
				["budget", "budgetCounts"],
				["shows", "showsCounts"],
				["released", "releasedCounts"],
				["length", "lengthCounts"],
				["origin", "originCounts"],
				["scores", "scoresCounts"],
			])
				assert.equal(
					Boolean(input[flag]),
					counts?.split(",").includes(group) ?? false,
				)
		}
	}
})
