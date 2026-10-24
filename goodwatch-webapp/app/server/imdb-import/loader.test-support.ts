// The module hooks the IMDb import's tests share: stand-ins for the caches, Taste and the movie rule, which have
// their own tests and would pull in Redis here, and a transpiled file.server.ts. A test that imports a module with
// `?process=<name>` gets a separate copy of the import's modules, as a second webapp instance would have.
// node-crate loads before the alias hook, which can't resolve the requires inside a CommonJS package.
import "node-crate"
import "../title-filter/test-alias.ts"
import { readFileSync } from "node:fs"
import * as nodeModule from "node:module"
import ts from "typescript"

const STUBS: Record<string, string> = {
	"/utils/auth.ts":
		"export const getAuthFromRequest = async ({request}) => ({user: request.headers.get('x-fixture-member') ? {id: request.headers.get('x-fixture-member')} : null, headers: new Headers()})",
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
