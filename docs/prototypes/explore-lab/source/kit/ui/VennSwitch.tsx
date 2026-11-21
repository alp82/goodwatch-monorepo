// PROTOTYPE - throwaway (prototype/explore-r4). Two overlapping circles as navigation for a blend of two: only the
// first, both, or only the second. Each region is a link to its own list; the current one is the solid white of a
// choice that filters the page. The circles' overlap is drawn to the real share of titles the two have in common.
import { useNavigate } from "@remix-run/react"
import { useState } from "react"
import type { Venn } from "../address"
import type { PlaceRef } from "../types"

const W = 340
const H = 148
const R = 66

export function VennSwitch({
	a,
	b,
	value,
	counts,
	to,
	both = "Both",
}: {
	a: PlaceRef
	b: PlaceRef
	value: Venn
	/** Blend.venn: titles only in a, in both, only in b. Sets how far the circles overlap. */
	counts: { a: number; both: number; b: number }
	to: (v: Venn) => string
	/** The middle's word. */
	both?: string
}) {
	const navigate = useNavigate()
	const [hover, setHover] = useState<Venn | null>(null)
	// Overlap: 22% to 62% of a radius-width, by the share of the smaller side that is shared.
	const smaller = Math.max(1, Math.min(counts.a, counts.b) + counts.both)
	const share = Math.min(1, counts.both / smaller)
	const d = R * 2 * (1 - (0.22 + share * 0.4))
	const cy = H / 2
	const ax = W / 2 - d / 2
	const bx = W / 2 + d / 2
	const h = Math.sqrt(R * R - (d / 2) ** 2)
	const top = `${W / 2},${cy - h}`
	const bot = `${W / 2},${cy + h}`
	const paths: Record<Venn, string> = {
		both: `M${top} A${R},${R} 0 0 1 ${bot} A${R},${R} 0 0 1 ${top}Z`,
		a: `M${top} A${R},${R} 0 1 0 ${bot} A${R},${R} 0 0 1 ${top}Z`,
		b: `M${top} A${R},${R} 0 1 1 ${bot} A${R},${R} 0 0 0 ${top}Z`,
	}
	const lensW = R * 2 - d
	const label: Record<Venn, { x: number; text: string; sub: string }> = {
		a: { x: ax - R + (R * 2 - lensW) / 2, text: `Only ${a.label}`, sub: "" },
		both: { x: W / 2, text: both, sub: "" },
		b: { x: bx + R - (R * 2 - lensW) / 2, text: `Only ${b.label}`, sub: "" },
	}
	const tint = (v: Venn) => (v === "a" ? a.hue : v === "b" ? b.hue : undefined)
	return (
		<nav
			aria-label={`${a.label} and ${b.label}: which titles to list`}
			className="w-full max-w-[22rem]"
		>
			<svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full select-none">
				{(["a", "b", "both"] as Venn[]).map((v) => {
					const on = value === v
					const hot = hover === v
					const words = label[v].text.split(" ")
					const lines =
						v === "both" || words.length < 2
							? [label[v].text]
							: [words[0], words.slice(1).join(" ")]
					return (
						<a
							key={v}
							href={to(v)}
							aria-current={on ? "true" : undefined}
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
								fill={on ? "#ffffff" : (tint(v) ?? "#ffffff")}
								fillOpacity={on ? 1 : hot ? 0.3 : tint(v) ? 0.2 : 0.07}
								stroke={on ? "#ffffff" : (tint(v) ?? "#ffffff")}
								strokeOpacity={on ? 1 : hot ? 0.95 : tint(v) ? 0.75 : 0.32}
								strokeWidth={1.5}
								strokeLinejoin="round"
								style={{ transition: "fill-opacity .18s ease, stroke-opacity .18s ease" }}
							/>
							<text
								x={label[v].x}
								y={cy - (lines.length - 1) * 8 + 4.5}
								textAnchor="middle"
								fontSize="13.5"
								fontWeight={700}
								fill={on ? "#030712" : "#f3f4f6"}
								style={{ pointerEvents: "none", transition: "fill .18s ease" }}
							>
								{lines.map((line, i) => (
									<tspan key={line} x={label[v].x} dy={i === 0 ? 0 : 15}>
										{line}
									</tspan>
								))}
							</text>
						</a>
					)
				})}
			</svg>
		</nav>
	)
}
