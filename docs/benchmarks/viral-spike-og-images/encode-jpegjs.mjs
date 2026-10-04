// encode-jpegjs.mjs <png-dir> <out-dir> <quality> ...: re-encodes every PNG card in <png-dir> with jpeg-js, the
// encoder the card renderer uses, at each quality, as <out-dir>/<name>.jpegjs-q<quality>.jpg. The card's pixels come
// from resvg (the PNG is decoded with it), so the output is what the renderer would write. Prints the encode time.
// Run from goodwatch-webapp, so that the packages resolve.
import { readFileSync, readdirSync, writeFileSync } from "node:fs"
import { createRequire } from "node:module"
import { join } from "node:path"
// The packages come from the working directory (goodwatch-webapp), not from this file's folder.
const require = createRequire(join(process.cwd(), "package.json"))
const { Resvg } = require("@resvg/resvg-js")
const jpeg = require("jpeg-js")
const [dir, out, ...qualities] = process.argv.slice(2)
const times = []
for (const file of readdirSync(dir).filter((f) => f.endsWith(".png"))) {
	const png = readFileSync(join(dir, file))
	const w = png.readUInt32BE(16)
	const h = png.readUInt32BE(20)
	const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${w}" height="${h}"><image width="${w}" height="${h}" xlink:href="data:image/png;base64,${png.toString("base64")}"/></svg>`
	const image = new Resvg(svg, { fitTo: { mode: "original" } }).render()
	for (const quality of qualities) {
		const started = performance.now()
		const { data } = jpeg.encode({ data: image.pixels, width: image.width, height: image.height }, Number(quality))
		times.push(performance.now() - started)
		writeFileSync(join(out, `${file.slice(0, -4)}.jpegjs-q${quality}.jpg`), data)
	}
}
times.sort((a, b) => a - b)
console.log(`jpeg-js encode ms: p50 ${times[Math.floor(times.length / 2)].toFixed(0)}, max ${times.at(-1).toFixed(0)}, n ${times.length}`)
