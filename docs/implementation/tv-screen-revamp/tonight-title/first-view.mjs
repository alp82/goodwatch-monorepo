// The client scripts of a route's first view in a production build of goodwatch-webapp: the entry, the root and the
// route with their static imports, as the build's manifest lists them, with the sizes scripts/precompress.mjs wrote.
//
//   node first-view.mjs <build/client> <route id>...             one build, as JSON
//   node first-view.mjs --compare <base.json> <branch.json>      two such answers, file by file
//
// Build both sides with the same SENTRY_RELEASE: the build writes its release id into every file, and a copy
// without git gets none, which is about 206 bytes a file.
import { readFileSync, readdirSync, statSync } from "node:fs"
import { join } from "node:path"

const [first, ...rest] = process.argv.slice(2)

if (first === "--compare") {
	const [base, branch] = rest.map((file) => JSON.parse(readFileSync(file, "utf8")))
	const sizes = (s) => (s ? `${s.raw}/${s.gzip}/${s.brotli}` : "-")
	for (const id of Object.keys(branch)) {
		const a = base[id]
		const b = branch[id]
		console.log(`${id}: ${a ? `${a.total.files} files ${sizes(a.total)}` : "not in the base"} -> ${b.total.files} files ${sizes(b.total)} (raw/gzip/Brotli)`)
		for (const name of new Set([...Object.keys(a?.each ?? {}), ...Object.keys(b.each)])) {
			const [p, q] = [a?.each[name], b.each[name]]
			if (!p || !q || p.raw !== q.raw) console.log(`    ${name}: ${sizes(p)} -> ${sizes(q)}`)
		}
	}
} else {
	const assets = join(first, "assets")
	const file = readdirSync(assets).find((name) => /^manifest-.*\.js$/.test(name))
	const manifest = JSON.parse(
		readFileSync(join(assets, file), "utf8")
			.replace(/^window\.__remixManifest=/, "")
			.replace(/;\s*$/, ""),
	)
	const size = (url) => {
		const path = join(first, url.replace(/^\//, ""))
		return { raw: statSync(path).size, gzip: statSync(`${path}.gz`).size, brotli: statSync(`${path}.br`).size }
	}
	const out = {}
	for (const id of rest) {
		const route = manifest.routes[id]
		if (!route) continue
		const files = new Set([manifest.entry.module, ...manifest.entry.imports, manifest.routes.root.module, ...(manifest.routes.root.imports ?? []), route.module, ...(route.imports ?? [])])
		const total = { files: files.size, raw: 0, gzip: 0, brotli: 0 }
		const each = {}
		for (const url of files) {
			const s = size(url)
			total.raw += s.raw
			total.gzip += s.gzip
			total.brotli += s.brotli
			// Without the content hash, so two builds compare by name. A route's module and its chunk can share
			// a name: the larger keeps it.
			const name = url.replace(/^\/assets\//, "").replace(/-[\w-]{8}\.js$/, "")
			const taken = each[name]
			if (taken && taken.raw >= s.raw) each[`${name} (the smaller)`] = s
			else {
				if (taken) each[`${name} (the smaller)`] = taken
				each[name] = s
			}
		}
		out[id] = { total, each }
	}
	console.log(JSON.stringify(out, null, 1))
}
