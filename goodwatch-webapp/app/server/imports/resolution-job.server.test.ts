import "../tracking-loader.test-support.ts"
import assert from "node:assert/strict"
import { test } from "node:test"
import type {
	ResolutionContext,
	ResolutionStep,
	ResolutionStore,
} from "./resolution-job.server.ts"
const { createResolutionJobs } = await import("./resolution-job.server.ts")

function setup(
	overrides: {
		step?: (ctx: ResolutionContext) => Promise<ResolutionStep>
		publish?: (ctx: ResolutionContext) => Promise<string>
	} = {},
) {
	let clock = 1000
	let calls = 0
	const records = new Map<string, { value: unknown; version: number }>()
	const store: ResolutionStore = {
		async read(key) {
			const r = records.get(key)
			return r ? structuredClone(r) : null
		},
		async cas(key, version, value) {
			const r = records.get(key)
			if ((r?.version ?? null) !== version) return false
			records.set(key, {
				value: structuredClone(value),
				version: (r?.version ?? 0) + 1,
			})
			return true
		},
		async preview() {
			return true
		},
	}
	const jobs = createResolutionJobs({
		store,
		now: () => clock,
		step:
			overrides.step ??
			(async () => {
				calls++
				return { done: true, processed: 1, matched: 1, held: 0, failed: {} }
			}),
		publish:
			overrides.publish ??
			(async (ctx) => {
				await ctx.check()
				return "replacement"
			}),
	})
	return {
		jobs,
		store,
		records,
		clock: (v: number) => {
			clock = v
		},
		calls: () => calls,
	}
}
test("resolution admits one job per member and two globally, with a clear refusal", async () => {
	const { jobs } = setup()
	await jobs.admit("member-a", "first", 1)
	await assert.rejects(
		jobs.admit("member-a", "second", 1),
		(error: unknown) =>
			error instanceof Error &&
			"code" in error &&
			error.code === "tvtime_resolution_member_busy",
	)
	await jobs.admit("member-b", "second", 1)
	await assert.rejects(
		jobs.admit("member-c", "third", 1),
		(error: unknown) =>
			error instanceof Error &&
			"code" in error &&
			error.code === "tvtime_resolution_global_busy",
	)
})
test("a double claim runs each phase once and publishes a single replacement", async () => {
	const { jobs, calls, store } = setup()
	let otherCalls = 0
	const other = createResolutionJobs({
		store,
		now: () => 1000,
		step: async () => {
			otherCalls++
			return { done: true, processed: 1, matched: 1, held: 0, failed: {} }
		},
		publish: async () => "replacement",
	})
	await jobs.admit("member", "root", 1)
	await Promise.all([jobs.run("root"), other.run("root")])
	const result = await jobs.read("root")
	assert.equal(result?.state, "completed")
	assert.equal(result?.replacementId, "replacement")
	assert.equal(calls() + otherCalls, 4)
})

function gate() {
	let release!: () => void
	const promise = new Promise<void>((r) => {
		release = r
	})
	return { promise, release }
}
test("cancelling an in-flight step invalidates its generation before its checkpoint", async () => {
	const entered = gate()
	const resume = gate()
	const s = setup({
		step: async (ctx) => {
			entered.release()
			await resume.promise
			await ctx.commit("work/root/0", { positive: true })
			return { done: true, processed: 1, matched: 1, held: 0, failed: {} }
		},
	})
	await s.jobs.admit("member", "root", 1)
	const running = s.jobs.run("root")
	await entered.promise
	await s.jobs.cancel("member", "root")
	resume.release()
	await running
	assert.equal((await s.jobs.read("root"))?.state, "cancelled")
	assert.equal(s.records.has("work/root/0"), false)
})
test("a member choice between the last checkpoint and publication defeats the stale projection", async () => {
	const entered = gate()
	const resume = gate()
	const seen: string[] = []
	const s = setup({
		publish: async (ctx) => {
			seen.push(ctx.job.activePreviewId)
			if (seen.length === 1) {
				entered.release()
				await resume.promise
			}
			await ctx.check()
			return `replacement-of-${ctx.job.activePreviewId}`
		},
	})
	await s.jobs.admit("member", "root", 1)
	const running = s.jobs.run("root")
	await entered.promise
	await s.jobs.edit("member", "root", async () => "manual-child")
	resume.release()
	await running
	await s.jobs.run("root")
	assert.deepEqual(seen, ["root", "manual-child"])
	assert.equal(
		(await s.jobs.read("root"))?.replacementId,
		"replacement-of-manual-child",
	)
})
test("the reconciler recovers a worker that restarted mid-step and the old owner cannot checkpoint", async () => {
	const entered = gate()
	const resume = gate()
	const s = setup({
		step: async (ctx) => {
			entered.release()
			await resume.promise
			await ctx.commit("stale", {})
			return { done: true, processed: 0, matched: 0, held: 0, failed: {} }
		},
	})
	await s.jobs.admit("member", "root", 1)
	const old = s.jobs.run("root")
	await entered.promise
	s.clock(62000)
	const restarted = createResolutionJobs({
		store: s.store,
		now: () => 62000,
		step: async () => ({
			done: true,
			processed: 0,
			matched: 0,
			held: 0,
			failed: {},
		}),
		publish: async () => "recovered",
	})
	await restarted.reconcile()
	resume.release()
	await old
	assert.equal((await restarted.read("root"))?.replacementId, "recovered")
	assert.equal(s.records.has("stale"), false)
})
test("the overall deadline publishes cached progress with a limit code rather than an outage", async () => {
	const s = setup()
	await s.jobs.admit("member", "root", 10)
	s.clock(1801001)
	await s.jobs.run("root")
	const j = await s.jobs.read("root")
	assert.equal(j?.state, "limited")
	assert.equal(j?.replacementId, "replacement")
	assert.equal(j?.failed.tvtime_lookup_budget_exhausted, 10)
	assert.equal(j?.processed, 10)
})
test("unexpected worker failures have their own code instead of claiming a TMDB outage", async () => {
	const s = setup({
		step: async () => {
			throw Error("Synthetic checkpoint failure")
		},
	})
	await s.jobs.admit("member", "root", 1)
	await assert.rejects(s.jobs.run("root"))
	const j = await s.jobs.read("root")
	assert.equal(j?.state, "failed")
	assert.equal(j?.failed.tvtime_resolution_failed, 1)
})
test("recovering the admission/checkpoint gap keeps the original overall deadline", async () => {
	const s = setup()
	await s.jobs.admit("member", "root", 1)
	const original = (await s.jobs.read("root"))?.deadline
	s.records.delete("job/root")
	s.clock(61000)
	await s.jobs.reconcile()
	assert.equal((await s.jobs.read("root"))?.deadline, original)
})
test("a preview confirmed outside the worker is retired rather than occupying a slot until its deadline", async () => {
	const s = setup()
	await s.jobs.admit("member", "root", 1)
	const row = await s.store.read("job/root")
	assert.ok(row)
	await s.store.cas("job/root", row.version, {
		...(row.value as object),
		replacementId: "manual-child",
	})
	s.store.preview = async () => false
	await s.jobs.run("root")
	assert.equal((await s.jobs.read("root"))?.state, "cancelled")
	assert.equal((await s.jobs.read("root"))?.replacementId, null)
})

test("a discarded preview refuses further member choices with a clear reason", async () => {
	const s = setup()
	await s.jobs.admit("member", "root", 1)
	await s.jobs.cancel("member", "root")
	await assert.rejects(
		s.jobs.edit("member", "root", async () => "child"),
		/discarded/i,
	)
})
test("a limit preserves budget holds already checkpointed in earlier batches", async () => {
	const s = setup()
	await s.jobs.admit("member", "root", 10)
	const row = await s.store.read("job/root")
	assert.ok(row)
	await s.store.cas("job/root", row.version, {
		...(row.value as object),
		processed: 2,
		matched: 1,
		held: 1,
		failed: { tvtime_lookup_budget_exhausted: 1 },
	})
	s.clock(1801001)
	await s.jobs.run("root")
	assert.equal(
		(await s.jobs.read("root"))?.failed.tvtime_lookup_budget_exhausted,
		9,
	)
})

test("expired deadlines do not release active slots before their jobs retire", async () => {
	const s = setup()
	await s.jobs.admit("first-member", "first", 1)
	await s.jobs.admit("second-member", "second", 1)
	s.clock(1_802_000)
	await assert.rejects(
		s.jobs.admit("third-member", "third", 1),
		(error: unknown) =>
			error instanceof Error &&
			"code" in error &&
			error.code === "tvtime_resolution_global_busy",
	)
	await s.jobs.reconcile()
	await s.jobs.admit("third-member", "third", 1)
})

test("even a failed member edit invalidates the previous generation's suggestion token", async () => {
	const s = setup()
	await s.jobs.admit("member", "root", 1)
	await s.jobs.run("root")
	const before = await s.jobs.read("root")
	await assert.rejects(
		s.jobs.edit("member", "root", async () => {
			throw new Error("Invalid selection")
		}),
		/Invalid selection/,
	)
	const after = await s.jobs.read("root")
	assert.notEqual(after?.snapshot, before?.snapshot)
	assert.equal(after?.state, "completed")
})

test("member edits preserve a limited job's budget signal on success and failure", async () => {
	const s = setup()
	await s.jobs.admit("member", "root", 1)
	s.clock(1_802_000)
	await s.jobs.run("root")
	assert.equal((await s.jobs.read("root"))?.state, "limited")
	await s.jobs.edit("member", "root", async () => "manual-child")
	assert.equal((await s.jobs.read("root"))?.state, "limited")
	await assert.rejects(
		s.jobs.edit("member", "root", async () => {
			throw Error("Invalid choice")
		}),
		/Invalid choice/,
	)
	assert.equal((await s.jobs.read("root"))?.state, "limited")
})

test("discard clears replacement pointers once, and cannot cancel an already confirmed import", async () => {
	const s = setup()
	await s.jobs.admit("member", "root", 1)
	await s.jobs.run("root")
	const done = await s.jobs.read("root")
	s.store.preview = async () => false
	await s.jobs.cancel("member", "root")
	assert.deepEqual(await s.jobs.read("root"), done)
	s.store.preview = async () => true
	await s.jobs.cancel("member", "root")
	const discarded = await s.jobs.read("root")
	assert.equal(discarded?.state, "cancelled")
	assert.equal(discarded?.replacementId, null)
	await s.jobs.cancel("member", "root")
	assert.deepEqual(await s.jobs.read("root"), discarded)
})

test("400 attempts checkpoint exact usage without per-request job CAS or preview reads", async () => {
	const s = setup({
		step: async (ctx) => {
			if (ctx.job.phase !== "episodes")
				return { done: true, processed: 0, matched: 0, held: 0, failed: {} }
			for (let i = 0; i < 200; i += 4)
				await Promise.all(Array.from({ length: 4 }, () => ctx.attempt()))
			return {
				done: ctx.job.cursor === "200",
				cursor: "200",
				processed: 200,
				matched: 200,
				held: 0,
				failed: {},
			}
		},
	})
	await s.jobs.admit("member", "root", 400)
	let writes = 0
	let previewReads = 0
	const cas = s.store.cas
	s.store.cas = async (key, version, value) => {
		writes++
		return cas(key, version, value)
	}
	s.store.preview = async () => {
		previewReads++
		return true
	}
	await s.jobs.run("root")
	assert.equal((await s.jobs.read("root"))?.attempts, 400)
	assert.ok(writes <= 20, `400 requests needed ${writes} CAS calls`)
	assert.ok(
		previewReads <= 8,
		`400 requests needed ${previewReads} preview-status reads`,
	)
})

test("lookup responses flush once per completed step behind the generation fence", async () => {
	const s = setup()
	let flushes = 0
	const jobs = createResolutionJobs({
		store: s.store,
		now: () => 1000,
		step: async (ctx) => {
			if (ctx.job.phase === "episodes") {
				for (let i = 0; i < 200; i++)
					ctx.deferCache?.(`cache/root/${i}`, { id: i })
				assert.equal(flushes, 0)
			}
			return { done: true, processed: 0, matched: 0, held: 0, failed: {} }
		},
		flushCache: async (ctx, entries) => {
			await ctx.check()
			assert.equal(entries.length, 200)
			flushes++
		},
		publish: async () => "child",
	})
	await jobs.admit("member", "root", 0)
	await jobs.run("root")
	assert.equal(flushes, 1)
})

test("concurrent block reservations cannot exceed the remaining two attempts at the hard cap", async () => {
	let requests = 0
	const s = setup({
		step: async (ctx) => {
			const results = await Promise.allSettled(
				Array.from({ length: 4 }, async () => {
					await ctx.attempt()
					requests++
				}),
			)
			assert.equal(results.filter((r) => r.status === "fulfilled").length, 2)
			return { done: true, processed: 4, matched: 2, held: 2, failed: {} }
		},
	})
	await s.jobs.admit("member", "root", 4)
	const row = await s.store.read("job/root")
	assert.ok(row)
	await s.store.cas("job/root", row.version, {
		...(row.value as object),
		attempts: 24998,
	})
	await s.jobs.run("root")
	assert.equal(requests, 2)
	assert.equal((await s.jobs.read("root"))?.attempts, 25000)
	assert.equal((await s.jobs.read("root"))?.state, "limited")
})

test("cancellation between provider success and the step checkpoint cannot flush lookup receipts", async () => {
	const entered = gate()
	const resume = gate()
	const s = setup()
	let flushes = 0
	const jobs = createResolutionJobs({
		store: s.store,
		now: () => 1000,
		step: async (ctx) => {
			ctx.deferCache?.("cache/root/synthetic", { id: 1 })
			entered.release()
			await resume.promise
			return { done: true, processed: 0, matched: 0, held: 0, failed: {} }
		},
		flushCache: async () => {
			flushes++
		},
		publish: async () => "child",
	})
	await jobs.admit("member", "root", 0)
	const running = jobs.run("root")
	await entered.promise
	await jobs.cancel("member", "root")
	resume.release()
	await running
	assert.equal(flushes, 0)
})

test("settling a run closes its local request permit", async () => {
	let captured: ResolutionContext | undefined
	const s = setup({
		step: async (ctx) => {
			captured = ctx
			return { done: true, processed: 0, matched: 0, held: 0, failed: {} }
		},
	})
	await s.jobs.admit("member", "root", 0)
	await s.jobs.run("root")
	assert.ok(captured)
	assert.throws(() => captured?.localCheck?.(), { name: "ResolutionStopped" })
})

test("a member repair of a failed job keeps the existing completed transition", async () => {
	const s = setup({
		step: async () => {
			throw Error("Provider checkpoint failed")
		},
	})
	await s.jobs.admit("member", "root", 1)
	await assert.rejects(s.jobs.run("root"))
	await s.jobs.edit("member", "root", async () => "manual-child")
	assert.equal((await s.jobs.read("root"))?.state, "completed")
})

test("restart conservatively consumes unused reservation credits instead of resetting the attempt budget", async () => {
	const entered = gate()
	const resume = gate()
	const s = setup({
		step: async (ctx) => {
			await ctx.attempt()
			entered.release()
			await resume.promise
			await ctx.attempt()
			return { done: true, processed: 0, matched: 0, held: 0, failed: {} }
		},
	})
	await s.jobs.admit("member", "root", 0)
	const old = s.jobs.run("root")
	await entered.promise
	assert.equal((await s.jobs.read("root"))?.attempts, 50)
	s.clock(62000)
	const restarted = createResolutionJobs({
		store: s.store,
		now: () => 62000,
		step: async (ctx) => {
			if (ctx.job.phase === "watched_parents") await ctx.attempt()
			return { done: true, processed: 0, matched: 0, held: 0, failed: {} }
		},
		publish: async () => "recovered",
	})
	await restarted.reconcile()
	resume.release()
	await old
	assert.equal((await restarted.read("root"))?.attempts, 51)
	assert.equal((await restarted.read("root"))?.replacementId, "recovered")
})

test("a preview confirmed during child construction cannot publish a replacement", async () => {
	const s = setup({
		publish: async () => {
			s.store.preview = async () => false
			return "unpublished-child"
		},
	})
	await s.jobs.admit("member", "root", 1)
	await s.jobs.run("root")
	const result = await s.jobs.read("root")
	assert.equal(result?.state, "cancelled")
	assert.equal(result?.replacementId, null)
})
