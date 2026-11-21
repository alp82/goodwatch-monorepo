// PROTOTYPE - throwaway (prototype/explore-r4, concept "blend"). How a blend's ingredients overlap, as navigation.
//   - Two ingredients: two circles drawn to their real overlap. Each of the three regions is a link to its own list
//     (only the first, both, only the second); the one you are on is solid white, and a line underneath says in
//     words what the region under the pointer holds.
//   - Three or more: one compact row per pair with a small two-circle glyph and how often the two turn up together.
//     Each row opens that pair's blend. The rarest pair is what keeps the blend small.
import { Link, useNavigate } from "@remix-run/react"
import { useState } from "react"
import type { Kind, Venn } from "../../kit/address"
import type { PlaceRef } from "../../kit/types"
import { PlaceMark } from "../../kit/ui"
import type { PairLink } from "./loader.server"
import { nice } from "./parts"
import { inSentence, phrase, without } from "./phrase"

const COOL = "#93a7c9"
const WARM = "#cdb48c"
/** Two colors that tell the circles apart: a mood's hue where there is one, else a cool and a warm neutral. */
const pairColors = (a: PlaceRef, b: PlaceRef): [string, string] => [
	a.hue ?? COOL,
	b.hue ?? (a.hue ? COOL : WARM),
]

const W = 380
const H = 196
const R = 74
const CY = 112

export function BlendVenn({
	kind,
	a,
	b,
	value,
	counts,
	to,
}: {
	kind: Kind
	a: PlaceRef
	b: PlaceRef
	value: Venn
	counts: { a: number; both: number; b: number }
	to: (v: Venn) => string
}) {
	const navigate = useNavigate()
	const [hover, setHover] = useState<Venn | null>(null)
	const [ca, cb] = pairColors(a, b)
	// The lens is 24% to 64% of a circle's width, by the share of the smaller side that is shared.
	const smaller = Math.max(1, Math.min(counts.a, counts.b) + counts.both)
	const share = Math.min(1, counts.both / smaller)
	const d = R * 2 * (1 - (0.24 + share * 0.4))
	const ax = W / 2 - d / 2
	const bx = W / 2 + d / 2
	const h = Math.sqrt(R * R - (d / 2) ** 2)
	const top = `${W / 2},${CY - h}`
	const bot = `${W / 2},${CY + h}`
	const paths: Record<Venn, string> = {
		both: `M${top} A${R},${R} 0 0 1 ${bot} A${R},${R} 0 0 1 ${top}Z`,
		a: `M${top} A${R},${R} 0 1 0 ${bot} A${R},${R} 0 0 1 ${top}Z`,
		b: `M${top} A${R},${R} 0 1 1 ${bot} A${R},${R} 0 0 0 ${top}Z`,
	}
	const lens = R * 2 - d
	const mid: Record<Venn, number> = {
		a: ax - R + (R * 2 - lens) / 2,
		both: W / 2,
		b: bx + R - (R * 2 - lens) / 2,
	}
	const color: Record<Venn, string> = { a: ca, b: cb, both: "#ffffff" }
	const noun = kind === "all" ? "movies and shows" : kind === "show" ? "shows" : "movies"
	const says: Record<Venn, string> = {
		both: `${inSentence(phrase(kind, [a, b]))}: both at once`,
		a: `${inSentence(phrase(kind, [a]))} ${without(kind, b)}`,
		b: `${inSentence(phrase(kind, [b]))} ${without(kind, a)}`,
	}
	const shown = hover ?? value
	const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
	void noun
	return (
		<nav aria-label={`${a.label} and ${b.label}: which to list`} className="w-full max-w-[24rem]">
			<svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full select-none overflow-visible">
				{(["a", "b"] as const).map((side) => {
					const p = side === "a" ? a : b
					const x = side === "a" ? ax - R * 0.28 : bx + R * 0.28
					return (
						<text
							key={side}
							x={x}
							y={20}
							textAnchor="middle"
							fontSize="15"
							fontWeight={700}
							fill="#f3f4f6"
						>
							{nice(p).length > 20 ? `${nice(p).slice(0, 19)}…` : nice(p)}
						</text>
					)
				})}
				{(["a", "b", "both"] as Venn[]).map((v) => {
					const on = value === v
					const hot = hover === v
					return (
						<a
							key={v}
							href={to(v)}
							aria-current={on ? "true" : undefined}
							aria-label={cap(says[v])}
							onClick={(e) => {
								if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return
								e.preventDefault()
								navigate(to(v), { preventScrollReset: true })
							}}
							onPointerEnter={() => setHover(v)}
							onPointerLeave={() => setHover(null)}
							onFocus={() => setHover(v)}
							onBlur={() => setHover(null)}
							className="cursor-pointer outline-none"
						>
							<path
								d={paths[v]}
								fill={on ? "#ffffff" : color[v]}
								fillOpacity={on ? 1 : hot ? 0.34 : v === "both" ? 0.1 : 0.16}
								stroke={on ? "#ffffff" : color[v]}
								strokeOpacity={on ? 1 : hot ? 1 : v === "both" ? 0.45 : 0.8}
								strokeWidth={1.75}
								strokeLinejoin="round"
								style={{
									transition: "fill-opacity .2s ease, stroke-opacity .2s ease, fill .2s ease",
								}}
							/>
							<text
								x={mid[v]}
								y={CY + 5}
								textAnchor="middle"
								fontSize="14"
								fontWeight={700}
								fill={on ? "#030712" : "#e5e7eb"}
								style={{ pointerEvents: "none", transition: "fill .2s ease" }}
							>
								{v === "both" ? "Both" : "Only"}
							</text>
						</a>
					)
				})}
			</svg>
			<p
				aria-live="polite"
				className="mt-1 min-h-[2.75rem] text-center text-sm leading-snug text-pretty text-gray-300"
			>
				{cap(says[shown])}.
			</p>
		</nav>
	)
}

const STRENGTH: Record<PairLink["strength"], string> = {
	often: "often together",
	sometimes: "now and then",
	rarely: "rarely together",
}

/** Two small circles whose overlap follows how much the pair shares. */
function Glyph({ pair }: { pair: PairLink }) {
	const [ca, cb] = pairColors(pair.a, pair.b)
	const r = 9
	const reach = pair.strength === "often" ? 0.62 : pair.strength === "sometimes" ? 0.36 : 0.08
	const d = r * 2 * (1 - reach)
	return (
		<svg viewBox="0 0 40 20" aria-hidden className="h-5 w-10 shrink-0">
			<circle
				cx={20 - d / 2}
				cy={10}
				r={r}
				fill={ca}
				fillOpacity={0.3}
				stroke={ca}
				strokeWidth={1.5}
			/>
			<circle
				cx={20 + d / 2}
				cy={10}
				r={r}
				fill={cb}
				fillOpacity={0.3}
				stroke={cb}
				strokeWidth={1.5}
			/>
		</svg>
	)
}

export function PairStrip({
	pairs,
	to,
}: {
	pairs: PairLink[]
	to: (a: PlaceRef, b: PlaceRef) => string
}) {
	if (!pairs.length) return null
	const order = { rarely: 0, sometimes: 1, often: 2 }
	const sorted = [...pairs].sort((x, y) => order[x.strength] - order[y.strength]).slice(0, 6)
	const weakest = sorted[0]
	const line =
		weakest.strength === "rarely"
			? `${nice(weakest.a)} and ${nice(weakest.b)} rarely meet. That pair is what makes this a small, particular blend.`
			: weakest.strength === "sometimes"
				? "These meet now and then, which is what makes the blend its own thing."
				: "These turn up together all the time. A natural blend."
	return (
		<nav aria-label="The pairs inside this blend" className="w-full max-w-[24rem]">
			<p className="text-[11px] font-semibold tracking-[0.14em] text-gray-500 uppercase">
				How it holds together
			</p>
			<ul className="mt-2 space-y-0.5">
				{sorted.map((pair) => (
					<li key={`${pair.a.family}:${pair.a.slug}+${pair.b.family}:${pair.b.slug}`}>
						<Link
							to={to(pair.a, pair.b)}
							prefetch="intent"
							className="group -mx-2 flex items-center gap-2.5 rounded-lg px-2 py-1.5 outline-none transition-colors hover:bg-white/[0.07] focus-visible:ring-2 focus-visible:ring-amber-400"
						>
							<Glyph pair={pair} />
							<span className="flex min-w-0 items-center gap-1.5 text-[15px] font-semibold text-white">
								<PlaceMark place={pair.a} size={13} />
								<span className="truncate">{nice(pair.a)}</span>
								<span className="text-gray-500">+</span>
								<PlaceMark place={pair.b} size={13} />
								<span className="truncate">{nice(pair.b)}</span>
							</span>
							<span
								className={`ml-auto shrink-0 text-sm ${
									pair.strength === "rarely" ? "font-semibold text-gray-200" : "text-gray-400"
								}`}
							>
								{STRENGTH[pair.strength]}
							</span>
						</Link>
					</li>
				))}
			</ul>
			<p className="mt-2 text-sm leading-snug text-pretty text-gray-400">{line}</p>
		</nav>
	)
}
