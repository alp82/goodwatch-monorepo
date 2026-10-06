import assert from "node:assert/strict"
import { test } from "node:test"
import { Resvg } from "@resvg/resvg-js"
import { tightenShadowFilters } from "./svg-filters.js"

const rectangle =
	'<rect x="100" y="100" width="200" height="200" rx="20" fill="red"/>'
const blur = '<feGaussianBlur stdDeviation="10"/>'
const roundedPath =
	'<path x="100" y="100" width="200" height="200" d="M120 100 L280 100 Q300 100 300 120 L300 280 Q300 300 280 300 L120 300 Q100 300 100 280 L100 120 Q100 100 120 100 Z"/>'
function svg(shape = rectangle, body = blur) {
	return `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"><defs><filter id="satori_s-test" x="-500%" y="-500%" width="1100%" height="1100%">${body}</filter></defs><g filter="url(#satori_s-test)">${shape}</g></svg>`
}
function expected(
	input: string,
	x: number,
	y: number,
	width: number,
	height: number,
) {
	return input.replace(
		'x="-500%" y="-500%" width="1100%" height="1100%"',
		`filterUnits="userSpaceOnUse" x="${x}" y="${y}" width="${width}" height="${height}"`,
	)
}

test("rounded rectangle box shadow uses its explicit box plus reach", () => {
	const input = svg(roundedPath)
	assert.equal(tightenShadowFilters(input), expected(input, 66, 66, 268, 268))
})
test("text shadow includes control points and absolute offsets", () => {
	const input = svg(
		'<path d="M100 100 L200 100 Q250 150 200 200 L100 200 Z"/>',
		'<feDropShadow stdDeviation="2" dx="-7" dy="11"/>',
	)
	assert.equal(tightenShadowFilters(input), expected(input, 83, 79, 184, 142))
})
test("matrix rotation uses all four corners", () => {
	const input = svg(
		'<rect x="10" y="20" width="100" height="50" transform="matrix(0,1,-1,0,200,0)"/>',
	)
	assert.equal(tightenShadowFilters(input), expected(input, 96, -24, 118, 168))
})
test("spread grows the box by half the stroke width", () => {
	const input = svg(roundedPath.replace("<path ", '<path stroke-width="12" '))
	assert.equal(tightenShadowFilters(input), expected(input, 60, 60, 280, 280))
})
test("nested shapes are unioned using the largest blur and offsets", () => {
	const input = svg(
		'<g><path d="M100 100 C120 80 280 320 300 300 Z"/></g><rect x="80" y="120" width="20" height="20"/>',
		'<feGaussianBlur stdDeviation="2"/><feDropShadow stdDeviation="3.2" dx="-8" dy="1"/><feOffset dx="2" dy="-9"/>',
	)
	assert.equal(tightenShadowFilters(input), expected(input, 58, 57, 264, 286))
})

const skipped: [string, string][] = [
	["inset shadow", svg(rectangle, '<feComposite operator="out"/>')],
	["unreferenced filter", svg().replace('filter="url(#satori_s-test)"', "")],
	[
		"reference on a shape",
		svg().replace("<g filter=", "<rect filter=").replace("</g>", "</rect>"),
	],
	[
		"group transform",
		svg().replace("<g filter=", '<g transform="translate(1,2)" filter='),
	],
	[
		"nested group transform",
		svg(`<g transform="matrix(1,0,0,1,0,0)">${rectangle}</g>`),
	],
	[
		"unsupported element",
		svg('<image x="100" y="100" width="200" height="200"/>'),
	],
	["relative path without a box", svg('<path d="M100 100 l100 100 Z"/>')],
	["unsupported absolute command", svg('<path d="M100 100 H200 V200 Z"/>')],
	["odd coordinate count", svg('<path d="M100 100 L200"/>')],
	["empty group", svg("")],
	["missing group end", svg().replace("</g>", "")],
	[
		"non-matrix transform",
		svg(rectangle.replace("/>", ' transform="rotate(30)"/>')),
	],
	[
		"wrong matrix length",
		svg(rectangle.replace("/>", ' transform="matrix(1,0,0,1,0)"/>')),
	],
	[
		"non-finite matrix",
		svg(rectangle.replace("/>", ' transform="matrix(1,0,0,1,Infinity,0)"/>')),
	],
	["non-finite box", svg(rectangle.replace('x="100"', 'x="Infinity"'))],
	["non-finite spread", svg(rectangle.replace("/>", ' stroke-width="NaN"/>'))],
	[
		"non-finite blur",
		svg(rectangle, '<feGaussianBlur stdDeviation="Infinity"/>'),
	],
	[
		"non-finite offset",
		svg(rectangle, '<feDropShadow stdDeviation="2" dx="NaN"/>'),
	],
	["non-finite percentage", svg().replace('x="-500%"', 'x="-Infinity%"')],
	[
		"old region clips the shadow",
		svg().split("-500%").join("-1%").split("1100%").join("102%"),
	],
	["backdrop filter", svg().split("satori_s-").join("satori_bf-")],
	[
		"explicit filter units",
		svg().replace("<filter ", '<filter filterUnits="objectBoundingBox" '),
	],
	["non-percentage region", svg().replace('x="-500%"', 'x="-500"')],
]
for (const [name, input] of skipped) {
	test(`leaves ${name} unchanged`, () => {
		assert.equal(tightenShadowFilters(input), input)
	})
}
test("an SVG without filters stays unchanged", () => {
	const input = `<svg>${rectangle}</svg>`
	assert.equal(tightenShadowFilters(input), input)
})
test("garbage input is returned unchanged without throwing", () => {
	for (const input of ["garbage", "<filter", null, undefined, 42, {}]) {
		assert.equal(tightenShadowFilters(input), input)
	}
})
test("tightening a satori-style box shadow preserves every rendered pixel", () => {
	const body =
		'<feGaussianBlur in="SourceAlpha" stdDeviation="10"/><feOffset dx="8" dy="12" result="offsetblur"/><feFlood flood-color="#000" flood-opacity="0.5"/><feComposite in2="offsetblur" operator="in"/><feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge>'
	const input = svg(rectangle, body)
	const tightened = tightenShadowFilters(input)
	assert.notEqual(tightened, input)
	assert.equal(
		Buffer.compare(
			new Resvg(tightened).render().pixels,
			new Resvg(input).render().pixels,
		),
		0,
	)
})
