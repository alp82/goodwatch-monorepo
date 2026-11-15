// Copies the footer cinema's pixelfx effects from a pixelfx checkout into app/ui/footer/cinema/pixelfx/.
//
//   node scripts/vendor-footer-cinema-fx.mjs [path to pixelfx's src folder]
//
// The default source is ~/.cache/pixelfx-src/pixelfx/src. The script clears pixelfx/fx/ first, so an effect that
// nothing plays anymore goes, then copies each effect below with the files it imports, and writes the two module maps:
// idle.js (the projector that the footer draws) and show.js (everything the show plays), with their types. The core
// is not copied: pixelfx/core/index.js re-exports the app's shared core (app/ui/pixelfx/core). The effects stay as
// pixelfx wrote them, except that a first-line "PROTOTYPE ..." label becomes the name of what the effect was made for.
import {
	copyFileSync,
	existsSync,
	mkdirSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs"
import { homedir } from "node:os"
import { dirname, join, relative, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const SRC = resolve(
	process.argv[2] ?? join(homedir(), ".cache/pixelfx-src/pixelfx/src"),
)
const OUT = resolve(
	dirname(fileURLToPath(import.meta.url)),
	"../app/ui/footer/cinema/pixelfx",
)

const IDLE = ["cinema-show/projector-35mm"]
const SHOW = [
	"cinema-show/beam",
	"cinema-show/room-palace",
	"cinema-show/film-gate",
	"cinema-show/silence-phone",
	"cinema-show/leader",
	"cinema-show/ident-a",
	"cinema-show/trailer-chase",
	"cinema-show/ident-b",
	"cinema-show/trailer-space",
	"cinema-show/ident-c",
	"cinema-show/trailer-monster",
	"cinema-show/after-credits",
	"cinema-show/after-credits-end",
]

if (!existsSync(join(SRC, "fx"))) {
	console.error(`No pixelfx effects at ${SRC}/fx`)
	process.exit(1)
}

/** The first line's prototype label, replaced by what the effect was made for. */
function relabel(source) {
	return source
		.replace(
			/^\/\/ PROTOTYPE \(GoodWatch footer cinema\) - /,
			"// Made for the GoodWatch footer cinema: ",
		)
		.replace(
			/^\/\/ PROTOTYPE - GoodWatch stats page(?:,? round \d+)?\. /,
			"// Made for the GoodWatch stats page: ",
		)
}

rmSync(join(OUT, "fx"), { recursive: true, force: true })
const seen = new Set()
function copy(abs) {
	if (seen.has(abs)) return
	seen.add(abs)
	const rel = relative(SRC, abs)
	const out = join(OUT, rel)
	mkdirSync(dirname(out), { recursive: true })
	const source = readFileSync(abs, "utf8")
	writeFileSync(out, relabel(source))
	for (const m of source.matchAll(/(?:from|import)\s+"(\.[^"]+)"/g)) {
		const dep = resolve(dirname(abs), m[1])
		if (relative(SRC, dep).startsWith("core/")) {
			// Effects import ../../core/index.js, which is pixelfx/core/index.js here too.
			if (!m[1].endsWith("core/index.js"))
				throw new Error(`${rel} imports ${m[1]}, not core/index.js`)
			continue
		}
		copy(dep)
	}
}

const variable = (id) => id.replace(/[/-]/g, "_")
function moduleMap(name, ids, what) {
	for (const id of ids) {
		const abs = join(SRC, "fx", `${id}.js`)
		if (!existsSync(abs)) throw new Error(`Missing effect ${id}`)
		copy(abs)
	}
	writeFileSync(
		join(OUT, `${name}.js`),
		`// ${what}, by pixelfx id. Written by scripts/vendor-footer-cinema-fx.mjs.\n${ids
			.map((id) => `import * as ${variable(id)} from "./fx/${id}.js"`)
			.join(
				"\n",
			)}\n\nexport const FX = {\n${ids.map((id) => `\t"${id}": ${variable(id)},`).join("\n")}\n}\n`,
	)
	writeFileSync(
		join(OUT, `${name}.d.ts`),
		`// Types for ${name}.js. Written by scripts/vendor-footer-cinema-fx.mjs.\nimport type { FxModule } from "./core/index.js"\n\nexport type FxId =\n${ids
			.map((id) => `\t| "${id}"`)
			.join(
				"\n",
			)}\n\n/** Effect modules; some export timing helpers too (the palace's curtainAt). */\nexport const FX: Record<FxId, FxModule & Record<string, unknown>>\n`,
	)
	console.log(`${name}: ${ids.length} effects`)
}

moduleMap("idle", IDLE, "The projector that the footer draws while idle")
moduleMap("show", SHOW, "Every effect the show plays")
console.log(`${seen.size} files in ${relative(process.cwd(), join(OUT, "fx"))}`)
