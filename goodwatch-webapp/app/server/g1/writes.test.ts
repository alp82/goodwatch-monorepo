// Real interaction writers, fake storage/cache/tracking. No connector can be imported by this harness.
import ts from "typescript"
import "../title-filter/test-alias.ts"
import assert from "node:assert/strict"
import * as nodeModule from "node:module"
import { test } from "node:test"

const state = { fail: false, rowcount: 1, committed: [] as string[] }
;(globalThis as unknown as { g1Writes: typeof state }).g1Writes = state
const { registerHooks } = nodeModule as unknown as {
	registerHooks(hooks: {
		load(
			url: string,
			context: unknown,
			next: (url: string, context: unknown) => unknown,
		): unknown
	}): void
}
registerHooks({
	load(url, context, next) {
		let source: string | undefined
		if (url.endsWith("/utils/crate.ts"))
			source = `
		export const execute = async sql => {
			if (globalThis.g1Writes.fail) throw Error('uncommitted');
			globalThis.g1Writes.committed.push(sql);
			return { rowcount: globalThis.g1Writes.rowcount };
		};
		export const upsert = async ({ table }) => execute(table);
		export const query = () => { throw Error('Unexpected storage read') };`
		else if (url.endsWith("/taste/index.server.ts"))
			source = `export const markTasteChanged = async () => {};`
		else if (url.endsWith("/tracking.server.ts"))
			source = `export const applyTrackingEvent = async () => ({ status: 'applied' });`
		else if (url.endsWith("/userData.server.ts"))
			source = `export const resetUserDataCache = async () => {};`
		else if (url.endsWith("/onboarding-media.server.ts"))
			source = `export const resetOnboardingMediaCache = async () => {};`
		if (!source) return next(url, context)
		return {
			format: "module",
			source: ts.transpileModule(source, {
				compilerOptions: {
					module: ts.ModuleKind.ESNext,
					target: ts.ScriptTarget.ESNext,
				},
			}).outputText,
			shortCircuit: true,
		}
	},
})
const { updateScores } = await import("../scores.server.ts")
const { updateWishList } = await import("../wishList.server.ts")
const { updateSkipped } = await import("../skipped.server.ts")
const { updateNotInterested } = await import("../not-interested.server.ts")
const { stopG1Rebuilds } = await import("./rebuild.server.ts")

test("committed scores, Want to See, Skip and Not interested enqueue only preview members, including removals", async (t) => {
	t.mock.timers.enable({ apis: ["setTimeout"] })
	process.env.REC_PREVIEW_USERS = "owner"
	process.env.REC_G1_ORDER = "on" // Broad ordering does not authorize broader builds.
	process.env.G1_WINDMILL_URL = "https://windmill.example"
	process.env.G1_WINDMILL_TOKEN = "fake-test-token"
	const calls: string[] = []
	t.mock.method(
		globalThis,
		"fetch",
		async (_url: RequestInfo | URL, options: RequestInit) => {
			assert.ok(state.committed.length)
			calls.push(JSON.parse(options.body as string).member_ids[0])
			return new Response("fake-job")
		},
	)
	try {
		for (const member of ["owner", "stranger"]) {
			const args = { user_id: member, tmdb_id: 1, media_type: "movie" as const }
			const writes = [
				() => updateScores({ ...args, score: 8 }),
				() => updateScores({ ...args, score: null }),
				() => updateWishList({ ...args, action: "add" }),
				() => updateWishList({ ...args, action: "remove" }),
				() => updateSkipped({ ...args, action: "add" }),
				() => updateSkipped({ ...args, action: "remove" }),
				() => updateNotInterested({ ...args, action: "add" }),
				() => updateNotInterested({ ...args, action: "remove" }),
			]
			for (const write of writes) {
				const before = calls.length
				await write()
				t.mock.timers.tick(1_500)
				await Promise.resolve()
				assert.equal(calls.length - before, member === "owner" ? 1 : 0)
			}
		}
		// Rejected writes and no-op deletes do not schedule anything.
		state.fail = true
		const args = { user_id: "owner", tmdb_id: 1, media_type: "movie" as const }
		await assert.rejects(updateScores({ ...args, score: 8 }))
		await assert.rejects(updateWishList({ ...args, action: "add" }))
		await assert.rejects(updateSkipped({ ...args, action: "add" }))
		const error = t.mock.method(console, "error", () => {})
		assert.equal(
			(await updateNotInterested({ ...args, action: "add" })).status,
			"failed",
		)
		error.mock.restore()
		state.fail = false
		state.rowcount = 0
		await updateScores({ ...args, score: null })
		await updateWishList({ ...args, action: "remove" })
		await updateSkipped({ ...args, action: "remove" })
		await updateNotInterested({ ...args, action: "remove" })
		t.mock.timers.tick(1_500)
		await Promise.resolve()
		assert.equal(calls.length, 8)
	} finally {
		stopG1Rebuilds()
		for (const key of [
			"REC_PREVIEW_USERS",
			"REC_G1_ORDER",
			"G1_WINDMILL_URL",
			"G1_WINDMILL_TOKEN",
		])
			delete process.env[key]
	}
})
