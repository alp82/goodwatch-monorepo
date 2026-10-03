// For tests under `node --test`: resolves the app's `~/` alias and imports written without `.ts`, which Node doesn't
// know. Import it first, then load the module under test with `await import(...)`.
//
// The title snapshot's index is replaced by its format module, which holds the constants the filter needs: the index
// pulls in Redis and code Node can't run without a build.
import { existsSync } from "node:fs"
import * as nodeModule from "node:module"
import { fileURLToPath, pathToFileURL } from "node:url"

const app = new URL("../../", import.meta.url)
const SNAPSHOT_INDEX = "~/server/title-snapshot/index.server"
const SNAPSHOT_FORMAT = "~/server/title-snapshot/format.server"

// The installed Node types predate registerHooks.
type Resolve = (specifier: string, context: { parentURL?: string }) => unknown
const { registerHooks } = nodeModule as unknown as {
	registerHooks(hooks: {
		resolve(...args: [...Parameters<Resolve>, Resolve]): unknown
	}): void
}

registerHooks({
	resolve(specifier, context, nextResolve) {
		const aliased = specifier === SNAPSHOT_INDEX ? SNAPSHOT_FORMAT : specifier
		const from = aliased.startsWith("~/")
			? new URL(aliased.slice(2), app)
			: aliased.startsWith(".") && context.parentURL
				? new URL(aliased, context.parentURL)
				: null
		if (from) {
			const path = fileURLToPath(from)
			for (const ending of ["", ".ts", ".tsx", "/index.ts"])
				if (existsSync(path + ending) && !existsSync(`${path + ending}/`))
					return nextResolve(pathToFileURL(path + ending).href, context)
		}
		return nextResolve(specifier, context)
	},
})
