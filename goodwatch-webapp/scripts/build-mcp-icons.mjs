import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { Resvg } from "@resvg/resvg-js"

// Use the existing amber GoodWatch mark, centered on the site's dark background.
// Preserve its aspect ratio and leave 10% padding; no new brand artwork.
const source = readFileSync(
	new URL("../app/img/goodwatch-logo-amber.svg", import.meta.url),
	"utf8",
)
const nested = source
	.slice(source.indexOf("<svg"))
	.replace(/<svg\s+/, '<svg x="10" y="10" ')
	.replace(/width="[^"]+"/, 'width="80"')
	.replace(/height="[^"]+"/, 'height="80"')
const square = `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><rect width="100" height="100" rx="18" fill="#111827"/>${nested}</svg>`
const output = new URL("../public/mcp-icons/", import.meta.url)
mkdirSync(output, { recursive: true })
for (const size of [48, 128, 512]) {
	const renderer = new Resvg(square, { fitTo: { mode: "width", value: size } })
	writeFileSync(
		new URL(`goodwatch-${size}.png`, output),
		renderer.render().asPng(),
	)
}
