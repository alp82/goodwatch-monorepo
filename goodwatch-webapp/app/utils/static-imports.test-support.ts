// For tests: the modules a browser loads with a module, read from the source. Only static imports count; a module
// loaded on demand (`import()`) comes later and isn't walked. `import type` is left out, as the build leaves it out.
import { existsSync, readFileSync } from "node:fs"
import { dirname, join } from "node:path"

/** One static import of an app module, or of a package or a file (`spec` as written). */
export type StaticImport = { from: string; spec: string }

/** A module's static imports as written (not `import type`, not `import()`). */
const importsOf = (source: string) =>
	[
		...source.matchAll(
			/^(?:import|export)\s+(?!type\s)(?:[^'"]*?\sfrom\s+)?["']([^"']+)["']/gm,
		),
	].map((m) => m[1])

/** An app module's file, or null for a package. */
function resolve(from: string, spec: string): string | null {
	const bare = spec.split("?")[0]
	let path: string
	if (bare.startsWith("~/")) path = join("app", bare.slice(2))
	else if (bare.startsWith(".")) path = join(dirname(from), bare)
	else return null
	if (/\.\w+$/.test(path) && existsSync(path)) return path
	for (const ext of [".ts", ".tsx", "/index.ts", "/index.tsx"])
		if (existsSync(path + ext)) return path + ext
	return null
}

/** Every static import reachable from `entry` (a path from the webapp's root), and the app modules it walked. */
export function staticImportGraph(entry: string): {
	modules: Set<string>
	imports: StaticImport[]
} {
	const modules = new Set<string>()
	const imports: StaticImport[] = []
	const walk = (file: string) => {
		if (modules.has(file)) return
		modules.add(file)
		if (!/\.tsx?$/.test(file)) return
		for (const spec of importsOf(readFileSync(file, "utf8"))) {
			imports.push({ from: file, spec })
			const next = resolve(file, spec)
			if (next) walk(next)
		}
	}
	walk(entry)
	return { modules, imports }
}
