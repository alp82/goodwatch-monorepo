// Shrinks the regions of the shadow filters that satori writes, so that resvg blurs only what a shadow can reach.
//
// satori (0.33.5) sizes the filter region of a box shadow or text shadow with the square of the blur radius: a shadow
// with an 80 pixel blur gets a region that is 1,600 pixels larger than its box on every side. resvg blurs the whole
// region, also outside the canvas, and that took 85% of a share list card's render time. A region of the shape's box
// plus three standard deviations (resvg's box blur reaches no further), the offset, and a small margin gives the same
// pixels.
// One case does change: above about 3,300 pixels per side, resvg works at a lower resolution and draws the shadow
// weaker than the design asks for. With the tight region such a shadow is drawn at full strength, as a browser does.
//
// Rules: only percentage regions on untransformed groups of paths and rectangles are understood. Inset shadows and
// unfamiliar geometry stay unchanged, and a new region must lie inside the old one, because satori's regions for
// small blurs are tighter than three standard deviations and clip the shadow. The function never throws.
function attribute(tag, name) {
	return tag.match(new RegExp(`(?:^|\\s)${name}="([^"]*)"`))?.[1]
}

function groupContents(svg, id) {
	const reference = svg.indexOf(`filter="url(#${id})"`)
	if (reference < 0) return null
	const start = svg.lastIndexOf("<", reference)
	if (!svg.startsWith("<g ", start)) return null
	const openingEnd = svg.indexOf(">", start)
	if (/transform=/.test(svg.slice(start, openingEnd))) return null
	const groups = /<g[ >]|<\/g>/g
	groups.lastIndex = start
	let depth = 0
	for (const match of svg.matchAll(groups)) {
		if (match[0] === "</g>") {
			if (--depth === 0) return svg.slice(openingEnd + 1, match.index)
		} else depth++
	}
	return null
}

function shapeBox(tag) {
	const values = ["x", "y", "width", "height"].map((name) =>
		attribute(tag, name),
	)
	if (
		values.some(
			(value) => value !== undefined && !Number.isFinite(Number(value)),
		)
	)
		return null
	if (values.every((value) => value !== undefined)) {
		const [x, y, width, height] = values.map(Number)
		const spread = Number(attribute(tag, "stroke-width") ?? 0) / 2
		if (!Number.isFinite(spread)) return null
		return [x - spread, y - spread, x + width + spread, y + height + spread]
	}
	const path = attribute(tag, "d") ?? ""
	if (!/^[MLQCZ\d.\-\s,]*$/.test(path)) return null
	const coordinates = path.match(/-?\d*\.?\d+/g)?.map(Number) ?? []
	if (
		coordinates.length < 2 ||
		coordinates.length % 2 ||
		!coordinates.every(Number.isFinite)
	)
		return null
	const box = [Infinity, Infinity, -Infinity, -Infinity]
	for (let index = 0; index < coordinates.length; index += 2) {
		includePoint(box, coordinates[index], coordinates[index + 1])
	}
	return box
}

function includePoint(box, x, y) {
	box[0] = Math.min(box[0], x)
	box[1] = Math.min(box[1], y)
	box[2] = Math.max(box[2], x)
	box[3] = Math.max(box[3], y)
}

function groupBox(contents) {
	const bounds = [Infinity, Infinity, -Infinity, -Infinity]
	for (const tag of contents.match(/<[a-zA-Z][^>]*>/g) ?? []) {
		const name = tag.match(/^<([a-zA-Z]+)/)[1]
		if (name === "g") {
			if (/transform=/.test(tag)) return null
			continue
		}
		if (name !== "path" && name !== "rect") return null
		const box = shapeBox(tag)
		if (!box || !box.every(Number.isFinite)) return null
		const transform = attribute(tag, "transform")
		let matrix = [1, 0, 0, 1, 0, 0]
		if (transform !== undefined) {
			const match = transform.match(/^matrix\(([^)]*)\)$/)
			matrix = match?.[1].split(/[\s,]+/).map(Number)
			if (!matrix || matrix.length !== 6 || !matrix.every(Number.isFinite))
				return null
		}
		const [a, b, c, d, e, f] = matrix
		for (const x of [box[0], box[2]]) {
			for (const y of [box[1], box[3]]) {
				includePoint(bounds, a * x + c * y + e, b * x + d * y + f)
			}
		}
	}
	return bounds.every(Number.isFinite) ? bounds : null
}

function largestMagnitude(body, name) {
	let largest = 0
	for (const match of body.matchAll(
		new RegExp(`(?:^|\\s)${name}="([^"]*)"`, "g"),
	)) {
		const value = Number(match[1])
		if (!Number.isFinite(value)) return NaN
		largest = Math.max(largest, Math.abs(value))
	}
	return largest
}

function shadowRegion(box, body, percentages) {
	const sigma = largestMagnitude(body, "stdDeviation")
	const reachX = Math.ceil(3 * sigma) + largestMagnitude(body, "dx") + 4
	const reachY = Math.ceil(3 * sigma) + largestMagnitude(body, "dy") + 4
	const [left, top, right, bottom] = box
	const region = [
		Math.floor(left - reachX),
		Math.floor(top - reachY),
		Math.ceil(right + reachX),
		Math.ceil(bottom + reachY),
	]
	const [x, y, width, height] = percentages.map(Number)
	if (![...region, x, y, width, height].every(Number.isFinite)) return null
	const boxWidth = right - left
	const boxHeight = bottom - top
	const oldLeft = left + (x / 100) * boxWidth
	const oldTop = top + (y / 100) * boxHeight
	const oldRight = oldLeft + (width / 100) * boxWidth
	const oldBottom = oldTop + (height / 100) * boxHeight
	if (![oldLeft, oldTop, oldRight, oldBottom].every(Number.isFinite))
		return null
	if (
		oldLeft > region[0] ||
		oldTop > region[1] ||
		oldRight < region[2] ||
		oldBottom < region[3]
	)
		return null
	return region
}

export function tightenShadowFilters(svg) {
	try {
		return svg.replace(
			/<filter id="(satori_s-[^"]+)" x="([^"]*)%" y="([^"]*)%" width="([^"]*)%" height="([^"]*)%">(.*?)<\/filter>/g,
			(whole, id, x, y, width, height, body) => {
				if (/operator="out"/.test(body)) return whole
				const contents = groupContents(svg, id)
				if (contents === null) return whole
				const box = groupBox(contents)
				if (!box) return whole
				const region = shadowRegion(box, body, [x, y, width, height])
				if (!region) return whole
				const [left, top, right, bottom] = region
				return `<filter id="${id}" filterUnits="userSpaceOnUse" x="${left}" y="${top}" width="${right - left}" height="${bottom - top}">${body}</filter>`
			},
		)
	} catch {
		return svg
	}
}
