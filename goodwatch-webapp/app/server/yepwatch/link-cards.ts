// YepWatch link-preview cards (1200 × 630): the start page card and the room invite card.
// Both share the Nope and Yep side panels; the middle shows the logo (start) or the invite (room).
// Plain satori element objects, no JSX, so `node --test` and the child renderer run this file directly.
import { existsSync, readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"

export const CARD_WIDTH = 1200
export const CARD_HEIGHT = 630

const C = {
	bg: "#070707",
	ink: "#fafafa",
	soft: "#d4d4d4",
	amber: "#fbbf24",
	amberDeep: "#b45309",
	ink2: "#201400",
	red: "#ef4444",
	redDeep: "#7f1d1d",
	cream: "#fff7ec",
}
const TRACK = -0.03

type Node = { type: string; props: { style?: Record<string, unknown>; children?: unknown; [key: string]: unknown } }
const div = (style: Record<string, unknown>, ...children: unknown[]): Node => ({
	type: "div",
	props: { style: { display: "flex", ...style }, children: children.length === 1 ? children[0] : children },
})
const img = (src: string, width: number, height: number, style: Record<string, unknown> = {}): Node => ({
	type: "img",
	props: { src, width, height, style },
})

// Gabarito Bold advance widths (per 1000 units) for U+0020..U+007E. Other letters count as WIDE.
const ADVANCE = [
	260, 286, 389, 687, 555, 778, 644, 199, 352, 352, 441, 670, 287, 369, 281, 494, 562, 365, 517, 531, 585, 536, 560, 499, 550, 559, 281, 287, 670, 670, 670, 543,
	859, 654, 590, 696, 661, 535, 513, 715, 678, 266, 550, 631, 495, 863, 708, 742, 579, 742, 600, 569, 574, 668, 643, 989, 671, 608, 577, 333, 494, 329, 670, 554,
	560, 508, 571, 511, 571, 534, 338, 574, 554, 254, 260, 512, 270, 840, 553, 562, 571, 571, 367, 451, 397, 554, 521, 761, 528, 549, 479, 328, 259, 328, 670,
]
const WIDE = 660
/** Width of `text` in Gabarito Bold at `size`, with the card's letter spacing. */
export function textWidth(text: string, size: number) {
	let units = 0
	for (const ch of text) {
		const code = ch.codePointAt(0)!
		units += code >= 32 && code < 127 ? ADVANCE[code - 32]! : WIDE
	}
	const n = [...text].length
	return (units / 1000) * size + TRACK * size * Math.max(0, n - 1)
}
const fitSize = (text: string, width: number, max: number) => Math.floor(Math.min(max, width / textWidth(text, 1)))

// Letters Gabarito Bold draws. A name with anything else gets the generic headline instead of missing glyphs.
const DRAWABLE =
	/^[ -~ -¬®-ćĊ-ēĖ-ěĞ-ģĦ-ħĪ-īĮ-ĳĶ-ķĹ-ľŁ-ňŊ-ōŐ-śŞ-šŤ-ťŪ-žǍ-ǎȘ-ț–-—‘-‚“-„…]+$/

/** The name the invite card shows, or null for "You're invited". */
export function cardHostName(name: string | null | undefined) {
	const value = name?.normalize("NFC").replace(/\s+/g, " ").trim()
	return value && DRAWABLE.test(value) ? value : null
}

// ---------- parts ----------

const ICON =
	'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"><rect width="128" height="128" rx="28" fill="#141414"/><defs><linearGradient id="g" x2="1" y2="1"><stop stop-color="#ffdb64"/><stop offset="1" stop-color="#f5a900"/></linearGradient></defs><rect x="25" y="25" width="55" height="77" rx="11" transform="rotate(-14 52 64)" fill="#6c5723" stroke="#dca92b" stroke-width="2"/><rect x="49" y="23" width="55" height="77" rx="11" transform="rotate(10 76 62)" fill="url(#g)"/><g transform="rotate(10 76 62)"><path d="M338 324H269L449 681H606L364 215L374 299V0H228V299L238 215L-3 681H159Z" transform="translate(60.692 80) scale(0.052 -0.052)" fill="#19160e"/></g></svg>'

/** The app icon on a soft amber glow. */
function icon(size: number) {
	const r = size
	return div(
		{ position: "relative", width: size, height: size },
		div({
			position: "absolute",
			left: size / 2 - r,
			top: size / 2 - r,
			width: r * 2,
			height: r * 2,
			borderRadius: r,
			background: "radial-gradient(circle, rgba(251,191,36,0.32) 0%, rgba(251,191,36,0) 70%)",
		}),
		img(`data:image/svg+xml,${encodeURIComponent(ICON)}`, size, size, { position: "absolute", left: 0, top: 0 }),
	)
}

function text(value: string, size: number, color: string, style: Record<string, unknown> = {}) {
	return div({ fontSize: size, fontWeight: 700, color, letterSpacing: TRACK * size, lineHeight: 1, whiteSpace: "nowrap", ...style }, value)
}

function wordmark(size: number) {
	return div(
		{ fontSize: size, fontWeight: 700, letterSpacing: TRACK * size, lineHeight: 1 },
		{ type: "span", props: { style: { color: C.ink }, children: "Yep" } },
		{ type: "span", props: { style: { color: C.amber }, children: "Watch" } },
	)
}

/** Red Nope panel on the left, amber Yep panel on the right, each with its word standing on edge. */
function panels(width: number, word: number) {
	const panel = (right: boolean) =>
		div(
			{
				position: "absolute",
				top: 0,
				[right ? "right" : "left"]: 0,
				width,
				height: CARD_HEIGHT,
				alignItems: "center",
				justifyContent: "center",
				...(right
					? { borderTopLeftRadius: 28, borderBottomLeftRadius: 28, background: `linear-gradient(135deg, ${C.amber} 0%, #f59e0b 50%, ${C.amberDeep} 100%)` }
					: { borderTopRightRadius: 28, borderBottomRightRadius: 28, background: `linear-gradient(225deg, #f87171 0%, ${C.red} 50%, ${C.redDeep} 100%)` }),
			},
			text(right ? "YEP" : "NOPE", word, right ? C.ink2 : C.cream, { transform: `rotate(${right ? 90 : -90}deg)` }),
		)
	return [panel(false), panel(true)]
}

function frame(...children: unknown[]) {
	return div({ position: "relative", width: CARD_WIDTH, height: CARD_HEIGHT, overflow: "hidden", background: C.bg, fontFamily: "Gabarito" }, ...children)
}

function middle(inset: number, gap: number, ...children: unknown[]) {
	return div({ position: "absolute", left: inset, right: inset, top: 0, bottom: 0, flexDirection: "column", alignItems: "center", justifyContent: "center", gap }, ...children)
}

// ---------- cards ----------

const SLOGAN = ["Choose something", "to watch, together."] as const
const SLOGAN_WIDTH = 440

/** yepwatch.com: Nope and Yep panels, the icon, the wordmark and the slogan in two rows of equal width. */
export function startCard() {
	const [first, second] = SLOGAN
	const together = "together."
	const size2 = SLOGAN_WIDTH / textWidth(second, 1)
	return frame(
		...panels(300, 184),
		middle(
			300,
			26,
			icon(220),
			wordmark(64),
			div(
				{ flexDirection: "column", alignItems: "center", gap: 10, marginTop: 6 },
				text(first, SLOGAN_WIDTH / textWidth(first, 1), C.soft),
				div(
					{},
					text(second.slice(0, -together.length), size2, C.soft, { whiteSpace: "pre" }),
					text(together, size2, C.amber),
				),
			),
		),
	)
}

const MID = 680
const INVITED = "invited you"

/** yepwatch.com/r/<code>: Nope and Yep panels, the icon, "<host> invited you" and the Join button. */
export function inviteCard(host: string | null) {
	const name = cardHostName(host)
	const headline = name ? `${name} ${INVITED}` : "You're invited"
	const single = fitSize(headline, MID, 84)
	let head: unknown
	if (single >= 56) head = text(headline, single, C.ink)
	else {
		// Long names: the name on its own line, then "invited you".
		let shown = name!
		while (shown.length > 1 && fitSize(shown, MID, 84) < 40) shown = `${shown.slice(0, -2).trimEnd()}…`
		head = div({ flexDirection: "column", alignItems: "center", gap: 12 }, text(shown, fitSize(shown, MID, 84), C.ink), text(INVITED, 64, C.ink))
	}
	return frame(
		...panels(200, 130),
		middle(
			200,
			30,
			icon(190),
			head,
			div(
				{ padding: "19px 44px", borderRadius: 21, background: C.amber, color: C.ink2, fontSize: 42, fontWeight: 700, letterSpacing: -0.84, gap: 15, boxShadow: "0 10px 40px rgba(251,191,36,0.35)" },
				"Join the room",
				{ type: "span", props: { children: "→" } },
			),
		),
	)
}

// ---------- render ----------

// Fonts sit next to this file's bundle (build/yepwatch-release/fonts) or in the shared og-image folder in source.
function fontFile(name: string) {
	for (const dir of ["./fonts/", "../og-image/fonts/"]) {
		const file = fileURLToPath(new URL(dir + name, import.meta.url))
		if (existsSync(file)) return readFileSync(file)
	}
	throw new Error(`Link card font ${name} not found`)
}

/** Draws a card as PNG. Blocks for a few hundred milliseconds, so the api runs it in a child process. */
export async function renderCard(card: Node) {
	const [{ default: satori }, { Resvg }] = await Promise.all([import("satori"), import("@resvg/resvg-js")])
	const svg = await satori(card as never, {
		width: CARD_WIDTH,
		height: CARD_HEIGHT,
		fonts: [{ name: "Gabarito", data: fontFile("Gabarito-Bold.ttf"), weight: 700, style: "normal" }],
	})
	return new Resvg(svg, { fitTo: { mode: "width", value: CARD_WIDTH } }).render().asPng()
}
