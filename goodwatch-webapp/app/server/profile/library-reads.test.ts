import assert from "node:assert/strict"
import { test } from "node:test"
import { build } from "esbuild"
import path from "node:path"

// Exercise the real library and score loader while controlling database completion.
// The gate proves independent reads start before score cards complete, without timing assertions.
test("library overlaps independent reads and reads scored title display fields once", async () => {
	const result = await build({
		entryPoints: ["app/server/profile/library.server.ts"],
		absWorkingDir: process.cwd(),
		bundle: true,
		write: false,
		platform: "node",
		format: "esm",
		alias: { "~": path.resolve("app") },
		plugins: [
			{
				name: "profile-read-fixture",
				setup(builder) {
					builder.onResolve(
						{
							filter:
								/^~\/(utils\/crate|utils\/helpers|server\/userData.server|server\/movie-runtimes.server)$/,
						},
						(args) => ({ path: args.path, namespace: "fixture" }),
					)
					builder.onLoad(
						{ filter: /.*/, namespace: "fixture" },
						({ path: name }) => ({
							contents: name.endsWith("helpers")
								? "export const titlePath = (type,id,title) => `/${type}/${id}-${title}`"
								: name.endsWith("movie-runtimes.server")
									? "export const movieRuntimes = async () => new Map()"
									: name.endsWith("userData.server")
										? `export const getUserData = async () => ({ scores: { 'movie-1': { score: 9, updatedAt: new Date('2026-01-01') } }, wishlist: {}, watchState: {}, favorites: {}, skipped: {}, notInterested: {} })`
										: `export const query = (...args) => globalThis.__profileReadFixture(...args)`,
						}),
					)
				},
			},
		],
	})
	const calls: string[] = []
	let release: () => void = () => {}
	const gate = new Promise<void>((resolve) => {
		release = resolve
	})
	const scope = globalThis as typeof globalThis & {
		__profileReadFixture?: (sql: string) => Promise<object[]>
	}
	scope.__profileReadFixture = async (sql: string) => {
		calls.push(sql)
		if (sql.includes("FROM movie")) {
			await gate
			return [
				{
					tmdb_id: 1,
					title: "One",
					release_year: 2020,
					poster_path: "/p.jpg",
					backdrop_path: "/b.jpg",
					genres: ["Drama"],
					gw: 75,
				},
			]
		}
		return [{ first: null }]
	}
	try {
		const { getProfileLibrary } = await import(
			`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString("base64")}`
		)
		const work = getProfileLibrary("owner")
		await new Promise((resolve) => setImmediate(resolve))
		const datesStarted = calls.filter((sql) => sql.includes("MIN(")).length
		release()
		const library = await work
		assert.equal(datesStarted, 2, "first dates must not wait for catalog cards")
		assert.equal(
			calls.filter((sql) => sql.includes("FROM movie")).length,
			1,
			"scores and backdrops share one catalog read",
		)
		assert.equal(library.scored.get("movie-1").backdrop, "/b.jpg")
		assert.equal(library.scored.get("movie-1").score, 9)
	} finally {
		delete scope.__profileReadFixture
	}
})
