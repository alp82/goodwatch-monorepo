import * as nodeModule from "node:module"
import "./title-filter/test-alias.ts"

/** Replace boundary modules before importing a writer/route, without opening database or cache connections. */
export function stubModules(modules: Record<string, string>) {
	const { registerHooks } = nodeModule as unknown as {
		registerHooks(hooks: { resolve(s: string, c: unknown, next: (s: string, c: unknown) => unknown): unknown }): void
	}
	registerHooks({ resolve(specifier, context, next) {
		const source = modules[specifier]
		return source === undefined ? next(specifier, context) : {
			url: `data:text/javascript,${encodeURIComponent(source)}`, shortCircuit: true,
		}
	} })
}
