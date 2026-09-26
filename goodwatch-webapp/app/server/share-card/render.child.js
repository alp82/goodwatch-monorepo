// Share card renderer, run as a child process by render.server.ts.
//
// satori lays the card out as SVG and resvg rasterizes it. Both block their thread for up to several seconds, and
// resvg aborts its whole process on some inputs, so they run here instead of in the web server.
// Messages in: { id, tree, width, height, preview: { width, quality } }, where tree is a card with every component
// already resolved to plain elements. One satori layout draws two images: the card as a PNG at its native size, and a
// link preview as a JPEG scaled to preview.width. Messages out: { id, png, jpeg } (base64) or { id, error }. One render
// at a time.
//
// This file is plain JavaScript because the server bundle can't hold a separate entry: vite.config.js copies it
// next to build/server/index.js, and in development it runs from this folder.
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { Resvg } from "@resvg/resvg-js"
import jpeg from "jpeg-js"
import { createElement } from "react"
import satori from "satori"

const { fontDir, fonts: fontList } = JSON.parse(process.argv[2])
const fonts = fontList.map((f) => ({
	name: f.name,
	weight: f.weight,
	style: f.style,
	data: readFileSync(join(fontDir, f.file)),
}))

const toElement = (node) => {
	if (node === null || typeof node !== "object") return node
	if (Array.isArray(node)) return node.map(toElement)
	const { children, ...props } = node.props
	return createElement(node.type, props, ...(Array.isArray(children) ? children : [children]).map(toElement))
}

process.on("message", async ({ id, tree, width, height, preview }) => {
	try {
		const svg = await satori(toElement(tree), { width, height, fonts })
		const png = new Resvg(svg, { fitTo: { mode: "width", value: width } }).render().asPng()
		const small = new Resvg(svg, { fitTo: { mode: "width", value: preview.width } }).render()
		const { data } = jpeg.encode({ data: small.pixels, width: small.width, height: small.height }, preview.quality)
		process.send({ id, png: Buffer.from(png).toString("base64"), jpeg: Buffer.from(data).toString("base64") })
	} catch (error) {
		process.send({ id, error: error instanceof Error ? error.message : String(error) })
	}
})

process.send({ ready: true })
