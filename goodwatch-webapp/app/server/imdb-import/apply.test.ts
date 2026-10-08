// Two webapp instances share one import row. Each `?process=` import below is a separate copy of the import's
// modules, with its own in-process state, over the same fake Crate.
// node-crate loads before the alias hook, which can't resolve the requires inside a CommonJS package.
import "node-crate"
import "../title-filter/test-alias.ts"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import * as nodeModule from "node:module"
import { afterEach, beforeEach, mock, test } from "node:test"
import ts from "typescript"
import { setCrateClientForTest } from "../../utils/crate.ts"

const STUBS: Record<string, string> = {
	"/server/onboarding-media.server.ts":
		"export const resetOnboardingMediaCache = async () => {}",
	"/server/taste/index.server.ts":
		"export const markTasteChanged = async () => {}",
	"/server/userData.server.ts":
		"export const resetUserDataCache = async () => {}",
	"/server/title-snapshot/format.server.ts":
		"export const getTitleSnapshot = () => null",
	// Settling the watches of a batch's movies has its own tests; here it would pull in the cache and Redis.
	"/server/tracking.server.ts": "export const settleMovies = async () => {}",
}

const PROCESS = /\?process=\w+$/
type Resolved = { url: string }
const { registerHooks } = nodeModule as unknown as {
	registerHooks(hooks: {
		resolve(
			specifier: string,
			context: { parentURL?: string },
			next: (specifier: string, context: unknown) => Resolved,
		): Resolved
		load(
			url: string,
			context: unknown,
			next: (url: string, context: unknown) => unknown,
		): unknown
	}): void
}
registerHooks({
	// The alias hook drops the query. A module of the import is loaded once per process: for the process that the
	// test asks for, and for the one whose copy imports it.
	resolve(specifier, context, next) {
		const resolved = next(specifier, context)
		const process = (specifier.match(PROCESS) ??
			context.parentURL?.match(PROCESS))?.[0]
		if (
			!process ||
			!resolved.url.includes("/imdb-import/") ||
			PROCESS.test(resolved.url)
		)
			return resolved
		return { ...resolved, url: resolved.url + process }
	},
	load(url, context, next) {
		const stub = Object.keys(STUBS).find((path) => url.endsWith(path))
		if (stub)
			return { format: "module", source: STUBS[stub], shortCircuit: true }
		// The error class declares a field in its constructor, which Node can't run by stripping the types.
		if (!url.includes("/imdb-import/file.server.ts")) return next(url, context)
		const source = readFileSync(new URL(url.replace(/\?.*$/, "")), "utf8")
		const compilerOptions = {
			module: ts.ModuleKind.ESNext,
			target: ts.ScriptTarget.ESNext,
		}
		return {
			format: "module",
			source: ts.transpileModule(source, { compilerOptions }).outputText,
			shortCircuit: true,
		}
	},
})

type Apply = typeof import("./apply.server.ts")
type Store = typeof import("./store.server.ts")
const loadProcess = async (name: string) => ({
	...((await import(`./apply.server.ts?process=${name}`)) as Apply),
	...((await import(`./store.server.ts?process=${name}`)) as Store),
})
const a = await loadProcess("a")
const b = await loadProcess("b")

const USER = "member-1"
const IMPORT = "5b0c8f0e-7d0a-4c53-9f6b-0d1f1f6a2a10"

/** Enough of Crate for one import with one new rating. Its clock is the test's clock. */
class FakeCrate {
	row: Record<string, unknown> = {}
	itemState: string | null = null
	score: { score: number; updated_at: Date } | null = null
	scoreWrites = 0
	/** Set to hold the write to user_score, which is what makes a batch slow. */
	slowWrite: Promise<void> | null = null

	async execute(
		sql: string,
		params: unknown[] = [],
	): Promise<{ json: unknown[]; rowcount?: number }> {
		const statement = sql.trim().replace(/\s+/g, " ")
		if (statement.startsWith("REFRESH")) return { json: [] }
		if (/^SELECT .* FROM doc\.user_import WHERE id = \?$/.test(statement))
			return {
				json:
					this.row.id === params[0]
						? [{ ...this.row, read_at: Date.now() }]
						: [],
			}
		if (/^SELECT .* FROM doc\.user_import WHERE user_id = \?/.test(statement))
			return {
				json:
					this.row.status === params[1]
						? [{ ...this.row, read_at: Date.now() }]
						: [],
			}
		if (statement.startsWith("UPDATE doc.user_import SET "))
			return this.updateImport(statement, [...params])

		if (statement.startsWith("SELECT row_index")) {
			const pending = this.itemState === null || this.itemState === "failed"
			return {
				json: pending
					? [
							{
								row_index: 0,
								tmdb_id: 603,
								media_type: "movie",
								imdb_score: 9,
								current_score: null,
							},
						]
					: [],
			}
		}
		if (statement.startsWith("SELECT apply_state"))
			return {
				json:
					this.itemState === null
						? []
						: [{ apply_state: this.itemState, n: 1 }],
			}
		if (
			statement.startsWith("UPDATE doc.user_import_item SET apply_state = ?")
		) {
			this.itemState = params[0] as string
			return { json: [], rowcount: 1 }
		}
		if (statement.startsWith("UPDATE doc.user_import_item"))
			return { json: [], rowcount: 0 }

		if (statement.startsWith("INSERT INTO user_score")) {
			this.scoreWrites++
			await this.slowWrite
			this.score ??= {
				score: params[3] as number,
				updated_at: params[5] as Date,
			}
			return { json: [], rowcount: 1 }
		}
		if (
			statement.startsWith("SELECT tmdb_id, score, updated_at FROM user_score")
		)
			return { json: this.score ? [{ tmdb_id: 603, ...this.score }] : [] }
		throw new Error(`The fake Crate doesn't know this statement: ${statement}`)
	}

	/** `SET column = ?|CURRENT_TIMESTAMP|NULL|'text', ... WHERE column = ? AND ...`, with every condition on the one row. */
	private updateImport(statement: string, params: unknown[]) {
		const [, set, where] =
			statement.match(/^UPDATE doc\.user_import SET (.*) WHERE (.*)$/) ?? []
		const value = (text: string) => {
			if (text === "?") return params.shift()
			if (text === "CURRENT_TIMESTAMP") return Date.now()
			return text === "NULL" ? null : text.replace(/^'|'$/g, "")
		}
		const changes = set.split(", ").map((part) => part.split(" = "))
		const next = Object.fromEntries(
			changes.map(([column, text]) => [column, value(text)]),
		)
		const same = (stored: unknown, wanted: unknown) =>
			stored instanceof Date || wanted instanceof Date
				? new Date(stored as Date).getTime() ===
					new Date(wanted as Date).getTime()
				: stored === wanted
		const matches = where.split(" AND ").every((part) => {
			const [column, text] = part.split(" = ")
			return same(this.row[column], value(text))
		})
		if (matches) Object.assign(this.row, next)
		return { json: [], rowcount: matches ? 1 : 0 }
	}
}

let crate: FakeCrate

function seed(status: "preview" | "running") {
	const now = new Date()
	crate.row = {
		id: IMPORT,
		user_id: USER,
		status,
		file_name: "ratings.csv",
		conflict_choice: status === "running" ? "keep" : null,
		counts: JSON.stringify({
			rows: 1,
			new: 1,
			update: 0,
			unchanged: 0,
			conflict: 0,
			unmatched: 0,
			unsupported: 0,
			invalid: 0,
		}),
		processed: 0,
		total: status === "running" ? 1 : 0,
		added: 0,
		updated: 0,
		kept: 0,
		failed: 0,
		without_fingerprint: null,
		error: null,
		created_at: now,
		updated_at: now,
		confirmed_at: status === "running" ? now : null,
		finished_at: null,
	}
}

/** Lets the background apply run until `done` holds. The apply only waits on the fake, so a few turns are enough. */
async function until(done: () => boolean) {
	for (let turn = 0; turn < 1000 && !done(); turn++)
		await new Promise((resolve) => setImmediate(resolve))
	assert.ok(done(), "the import didn't get there")
}

/** Moves the clock forward in steps, letting the writes of each step land before the next. */
async function pass(ms: number) {
	for (let passed = 0; passed < ms; passed += 1000) {
		mock.timers.tick(1000)
		for (let turn = 0; turn < 10; turn++)
			await new Promise((resolve) => setImmediate(resolve))
	}
}

beforeEach(() => {
	mock.timers.enable({
		apis: ["Date", "setInterval", "setTimeout"],
		now: new Date("2026-10-06T12:00:00Z"),
	})
	crate = new FakeCrate()
	setCrateClientForTest(crate)
	mock.method(console, "log", () => {})
})
afterEach(() => {
	setCrateClientForTest(null)
	mock.restoreAll()
	mock.timers.reset()
})

test("the other process doesn't offer a resume while a batch runs longer than the stall time", async () => {
	seed("preview")
	let finishWrite = () => {}
	crate.slowWrite = new Promise((resolve) => {
		finishWrite = resolve
	})

	assert.equal((await a.confirmImport(USER, IMPORT, "keep")).status, "running")
	await until(() => crate.scoreWrites === 1)
	await pass(a.STALL_MS + 5000)

	const seenByOther = b.summarize(await b.getImportRow(USER, IMPORT))
	assert.equal(seenByOther.status, "running")
	assert.equal(
		seenByOther.stalled,
		false,
		"the other process takes the live run for a stalled one",
	)

	// Confirming is what the Resume button does. Neither process may start a second apply next to the live one.
	assert.equal((await b.confirmImport(USER, IMPORT, "keep")).stalled, false)
	assert.equal((await a.confirmImport(USER, IMPORT, "keep")).stalled, false)
	await pass(1000)
	assert.equal(
		crate.scoreWrites,
		1,
		"a second apply started next to the live one",
	)

	finishWrite()
	await until(() => crate.row.status !== "running")
	assert.equal(crate.row.status, "done")
	assert.equal(crate.row.added, 1)
	assert.equal(crate.scoreWrites, 1)
})

test("an import whose process died can be resumed by the other process once the stall time has passed", async () => {
	// What a killed process leaves behind: a running import that nothing reports on any more.
	seed("running")

	await pass(b.STALL_MS - 5000)
	assert.equal(b.summarize(await b.getImportRow(USER, IMPORT)).stalled, false)

	await pass(10_000)
	assert.equal(b.summarize(await b.getImportRow(USER, IMPORT)).stalled, true)

	const resumed = await b.confirmImport(USER, IMPORT, "keep")
	assert.equal(resumed.status, "running")
	assert.equal(resumed.stalled, false)
	await until(() => crate.row.status !== "running")
	assert.equal(crate.row.status, "done")
	assert.equal(crate.row.added, 1)
})

test("a finished import stops reporting, so a late look doesn't find it running", async () => {
	seed("preview")
	await a.confirmImport(USER, IMPORT, "keep")
	await until(() => crate.row.status === "done")
	const finishedAt = crate.row.updated_at

	await pass(a.STALL_MS)
	assert.equal(crate.row.status, "done")
	assert.deepEqual(crate.row.updated_at, finishedAt)
})
