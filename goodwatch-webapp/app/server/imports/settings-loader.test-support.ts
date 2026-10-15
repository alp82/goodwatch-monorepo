import "../tracking-loader.test-support.ts"
import { readFileSync } from "node:fs"
import * as nodeModule from "node:module"
import ts from "typescript"
const { registerHooks } = nodeModule as unknown as {
	registerHooks(hooks: {
		load(
			url: string,
			context: unknown,
			next: (url: string, context: unknown) => unknown,
		): unknown
	}): void
}
// Only authentication and the IMDb database boundary are replaced. Native imports use ImportDb.
registerHooks({
	load(url, context, next) {
		if (url.endsWith("/utils/auth.ts"))
			return {
				format: "module",
				shortCircuit: true,
				source: `export async function getAuthFromRequest({request}) {const id = request.headers.get('Member'); return {user: id ? {id} : null, headers: new Headers()}}`,
			}
		if (url.endsWith("/utils/crate.ts"))
			return {
				format: "module",
				shortCircuit: true,
				source:
					"export const query = async () => []; export const execute = async () => ({rowcount: 0})",
			}
		if (url.endsWith("/imdb-import/file.server.ts"))
			return {
				format: "module",
				shortCircuit: true,
				source: ts.transpileModule(readFileSync(new URL(url), "utf8"), {
					compilerOptions: {
						module: ts.ModuleKind.ESNext,
						target: ts.ScriptTarget.ESNext,
					},
				}).outputText,
			}
		return next(url, context)
	},
})
