// Copies the /stats page's pixelfx effects from a pixelfx checkout into app/ui/stats/effects/pixelfx/.
//
//   node scripts/vendor-stats-fx.mjs [path to pixelfx's src folder]
//
// The default source is ~/.cache/pixelfx-src/pixelfx/src. The script clears pixelfx/fx/ first, so an effect that
// nothing plays anymore goes, then copies each effect in EFFECTS with the files it imports, and writes registry.js and
// registry.d.ts (every effect by id). The core is not copied: pixelfx/core/index.js re-exports the app's shared core
// (app/ui/pixelfx/core). The effects stay as pixelfx wrote them, except that a first-line "PROTOTYPE ..." label
// becomes the name of what the effect was made for. Last, it draws the die the roll button shows (the die the
// die-tumble effect throws, lying flat on each face) into die-faces.ts, so the page renders it without loading pixelfx.
import {
	existsSync,
	mkdirSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs"
import { homedir } from "node:os"
import { dirname, join, relative, resolve } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

const SRC = resolve(
	process.argv[2] ?? join(homedir(), ".cache/pixelfx-src/pixelfx/src"),
)
const STATS = resolve(
	dirname(fileURLToPath(import.meta.url)),
	"../app/ui/stats",
)
const OUT = join(STATS, "effects/pixelfx")

/** Every effect the page plays: the roll button's die, the chapters' spots (spots.ts) and the quiz. */
const EFFECTS = [
	"stats/die-tumble",
	"stats/coin-slot",
	"stats/coin-fountain",
	"cinema/glint",
	"cinema/bookmark",
	"cinema/stamp",
	"cinema/pun-crown",
	"cinema/pun-hearts",
	"cinema/pun-holy",
	"cinema/amb-snow",
	"pickups/collect-burst",
	"explosions/firework-burst",
	"quiz/fizzle",
	"stats-page/bar-snap",
	"stats-page/bats",
	"stats-page/black-hole",
	"stats-page/clapper",
	"stats-page/clash",
	"stats-page/coin-shower",
	"stats-page/confetti-pop",
	"stats-page/fireworks",
	"stats-page/flashbulb",
	"stats-page/hourglass",
	"stats-page/moonrise",
	"stats-page/night-bolt",
	"stats-page/paper-planes",
	"stats-page/popcorn-pop",
	"stats-page/projector",
	"stats-page/shark-fin",
	"stats-page/snowflake",
	"stats-page/splat",
	"stats-page/split-bar",
	"stats-page/spotlights",
	"stats-page/storm-cloud",
	"stats-page/sunrise",
	"stats-page/ticket",
	"stats-page/trope-big-bad",
	"stats-page/trope-bittersweet",
	"stats-page/trope-book-ends",
	"stats-page/trope-chekhov",
	"stats-page/trope-deadpan",
	"stats-page/trope-downer",
	"stats-page/trope-foreshadowing",
	"stats-page/trope-meaningful-name",
	"stats-page/trope-oh-crap",
	"stats-page/trope-running-gag",
	"stats-page/trope-shout-out",
	"stats-page/trope-title-drop",
	"stats-page/trophy-shine",
	"stats-page/tv-static",
	"stats-page/zombie-hand",
	"stats-page/zzz",
]

if (!existsSync(join(SRC, "fx"))) {
	console.error(`No pixelfx effects at ${SRC}/fx`)
	process.exit(1)
}

/** The first line's prototype label, replaced by what the effect was made for. */
function relabel(source, rel) {
	const out = source
		.replace(
			/^\/\/ PROTOTYPE - GoodWatch stats page(?:,? rounds? [\d-]+)?\. /,
			"// Made for the GoodWatch stats page: ",
		)
		.replace(
			/^\/\/ PROTOTYPE \(stats page quiz\) - /,
			"// Made for the GoodWatch stats page quiz: ",
		)
		.replace(
			/^\/\/ PROTOTYPE - map wonder round \d+\. GoodWatch explorer /,
			"// Made for the GoodWatch map: ",
		)
	if (/PROTOTYPE/.test(out)) throw new Error(`${rel} still says PROTOTYPE`)
	return out
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
	writeFileSync(out, relabel(source, rel))
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

for (const id of EFFECTS) {
	const abs = join(SRC, "fx", `${id}.js`)
	if (!existsSync(abs)) throw new Error(`Missing effect ${id}`)
	copy(abs)
}

const variable = (id) => id.replace(/[/-]/g, "_")
writeFileSync(
	join(OUT, "registry.js"),
	`// Every effect the stats page plays, by pixelfx id. Written by scripts/vendor-stats-fx.mjs.\n${EFFECTS.map(
		(id) => `import * as ${variable(id)} from "./fx/${id}.js"`,
	).join(
		"\n",
	)}\n\nexport const EFFECTS = {\n${EFFECTS.map((id) => `\t"${id}": ${variable(id)},`).join("\n")}\n}\n`,
)
writeFileSync(
	join(OUT, "registry.d.ts"),
	`// Types for registry.js. Written by scripts/vendor-stats-fx.mjs.\nimport type { FxModule } from "./core/index.js"\n\nexport type FxId =\n${EFFECTS.map(
		(id) => `\t| "${id}"`,
	).join("\n")}\n\nexport const EFFECTS: Record<FxId, FxModule>\n`,
)

// The die lying flat on each face, cell for cell the one die-tumble draws: [x, y, fill] in a 16 x 16 box.
const core = await import(pathToFileURL(join(OUT, "core/index.js")).href).catch(
	() => import(pathToFileURL(resolve(STATS, "../pixelfx/core/index.js")).href),
)
const { drawDie } = await import(
	pathToFileURL(join(OUT, "fx/stats/_die.js")).href
)
const { meta } = await import(
	pathToFileURL(join(OUT, "fx/stats/die-tumble.js")).href
)
const hexOf = (c) =>
	`#${[c & 255, (c >>> 8) & 255, (c >>> 16) & 255].map((v) => v.toString(16).padStart(2, "0")).join("")}`
const faces = [1, 2, 3, 4, 5, 6].map((face) => {
	const frame = core.createFrame(16, 16, -8, -8)
	const painter = core.painterFor(frame)
	painter.place(0, 0, false, 0)
	drawDie(
		painter,
		0,
		0,
		{ s: 14, from: face, to: face },
		core.fit(meta.options.palette, 8),
		core.hex(meta.options.pip),
	)
	const cells = []
	for (let y = 0; y < 16; y++)
		for (let x = 0; x < 16; x++) {
			const c = frame.color[y * 16 + x]
			if (c >>> 24) cells.push([x, y, hexOf(c)])
		}
	return cells
})
writeFileSync(
	join(STATS, "die-faces.ts"),
	`// The roll button's die lying flat on each face (index 0 is a 1): [x, y, fill] cells of a 16 x 16 grid, drawn by
// pixelfx's stats/die-tumble code so the button's die and the thrown one match. Written by scripts/vendor-stats-fx.mjs.
export const DIE_FACES: readonly (readonly [number, number, string])[][] = ${JSON.stringify(faces)}
`,
)

console.log(
	`${EFFECTS.length} effects, ${seen.size} files in ${relative(process.cwd(), join(OUT, "fx"))}; die-faces.ts written`,
)
