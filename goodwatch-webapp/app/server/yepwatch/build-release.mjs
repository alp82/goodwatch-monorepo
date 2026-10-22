import { build } from "esbuild"
import { builtinModules } from "node:module"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import { fileURLToPath } from "node:url"
import path from "node:path"
const root = fileURLToPath(new URL("../../../", import.meta.url))
const out = path.join(root, "build/yepwatch-release")
await mkdir(out, { recursive: true })
const result = await build({
	absWorkingDir: root,
	entryPoints: {
		server: "app/server/yepwatch/proposal-release-main.ts",
		operator: "app/server/yepwatch/proposal-release-operator.ts",
	},
	outdir: out,
	outExtension: { ".js": ".mjs" },
	bundle: true,
	packages: "external",
	platform: "node",
	target: "node24",
	format: "esm",
	alias: { "~": path.join(root, "app") },
	tsconfig: "tsconfig.json",
	metafile: true,
	sourcemap: false,
	banner: {
		js: 'import { createRequire as __releaseCreateRequire } from "node:module"; const require = __releaseCreateRequire(import.meta.url);',
	},
})
// Existing prepare-worker resolves this exact adjacent filename; preserve the whole output directory.
await build({
	absWorkingDir: root,
	entryPoints: ["app/server/title-snapshot/title-snapshot.worker.ts"],
	outfile: path.join(out, "title-snapshot.worker.js"),
	bundle: true,
	platform: "node",
	target: "node24",
	format: "esm",
	tsconfig: "tsconfig.json",
})
const forbidden = Object.keys(result.metafile.inputs).filter((p) =>
	/(?:local-members|test-support|continuous-runtime|continuous-member-refresh|auth\/runtime|auth\/auth\.server)/.test(
		p
	)
)
if (forbidden.length)
	throw new Error(`Unexpected release dependency: ${forbidden.join(", ")}`)
const external = new Set(
	Object.values(result.metafile.outputs).flatMap((output) =>
		output.imports
			.filter(
				(i) =>
					i.external &&
					!i.path.startsWith("node:") &&
					!builtinModules.includes(i.path)
			)
			.map((i) => i.path)
	)
)
const names = [
	...new Set(
		[...external].map((name) =>
			name.startsWith("@")
				? name.split("/").slice(0, 2).join("/")
				: name.split("/")[0]
		)
	),
].sort()
const original = JSON.parse(
	await readFile(path.join(root, "package-lock.json"), "utf8")
)
const dependencies = Object.fromEntries(
	names.map((name) => {
		const entry = original.packages[`node_modules/${name}`]
		if (!entry?.version || entry.link)
			throw new Error(`No pinned registry runtime package: ${name}`)
		return [name, entry.version]
	})
)
const pkg = {
	name: "yepwatch-guest-runtime",
	version: "0.0.0",
	private: true,
	type: "module",
	engines: { node: ">=24" },
	dependencies,
}
const packages = { "": pkg }
function resolveDependency(from, name) {
	let location = from
	for (;;) {
		const key = `${location ? `${location}/` : ""}node_modules/${name}`
		if (original.packages[key] && !original.packages[key].link) return key
		if (!location) return null
		location = location.includes("/node_modules/")
			? location.slice(0, location.lastIndexOf("/node_modules/"))
			: ""
	}
}
function add(key) {
	if (packages[key]) return
	const entry = structuredClone(original.packages[key])
	delete entry.dev
	delete entry.devOptional
	packages[key] = entry
	for (const [name, optional] of [
		...Object.keys(entry.dependencies ?? {}).map((n) => [n, false]),
		...Object.keys(entry.optionalDependencies ?? {}).map((n) => [n, true]),
		...Object.keys(entry.peerDependencies ?? {}).map((n) => [
			n,
			!!entry.peerDependenciesMeta?.[n]?.optional,
		]),
	]) {
		const resolved = resolveDependency(key, name)
		if (resolved) add(resolved)
		else if (!optional)
			throw new Error(`Missing pinned transitive dependency: ${key} -> ${name}`)
	}
}
for (const name of names) add(`node_modules/${name}`)
await writeFile(
	path.join(out, "package.json"),
	JSON.stringify(pkg, null, 2) + "\n"
)
await writeFile(
	path.join(out, "package-lock.json"),
	JSON.stringify(
		{
			name: pkg.name,
			version: pkg.version,
			lockfileVersion: 3,
			requires: true,
			packages,
		},
		null,
		2
	) + "\n"
)
await writeFile(
	path.join(out, "build-evidence.json"),
	JSON.stringify(
		{
			externalPackages: dependencies,
			packageCount: Object.keys(packages).length - 1,
			inputs: Object.keys(result.metafile.inputs).sort(),
			outputs: Object.keys(result.metafile.outputs).sort(),
		},
		null,
		2
	) + "\n"
)
console.info(
	`Built guest release bundle + snapshot worker; ${names.length} direct / ${
		Object.keys(packages).length - 1
	} pinned runtime packages. No fixture/member issuer entry.`
)
