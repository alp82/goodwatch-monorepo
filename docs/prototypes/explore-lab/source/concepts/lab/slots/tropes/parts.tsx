// PROTOTYPE - throwaway (prototype/explore-r6, reworked r7). Pieces both trope slots share: the name plate, a poster
// fan, a twist tag in plain words, a trope card. (The write-up pieces moved to ../trope/frame.tsx in round 8.)
import { Link } from "@remix-run/react"
import type { CSSProperties } from "react"
import type { ShowTitle } from "../../../../kit/types"
import { FOCUS, poster } from "../../../../kit/ui"
import { GLIDE_T, QUICK_T } from "../../../../kit/ui/motion"
import { type Example, type TropeRow, many, twistOf } from "./model"

/** A trope's name as a plate: the group's color as a left rule, the name set in the display face. */
export function NamePlate({
	label,
	color,
	size = "md",
}: {
	label: string
	color: string
	size?: "sm" | "md" | "lg"
}) {
	const text =
		size === "lg"
			? "text-4xl sm:text-6xl tracking-tight"
			: size === "md"
				? "text-xl sm:text-2xl"
				: "text-base"
	return (
		<span className="inline-flex items-stretch gap-3">
			<span
				aria-hidden
				className={`w-1 shrink-0 rounded-full ${size === "lg" ? "my-1.5" : "my-0.5"}`}
				style={{ background: color }}
			/>
			<span className={`font-display leading-[1.05] font-bold text-white ${text}`}>{label}</span>
		</span>
	)
}

/** How an example twists the trope, in plain words; nothing for a trope played straight. */
export function TwistTag({ example, className = "" }: { example: Example; className?: string }) {
	const words = twistOf(example.play)
	if (!words) return null
	return (
		<span
			className={`inline-flex items-center gap-1.5 rounded-full bg-amber-300/10 px-2 py-0.5 text-[12px] font-semibold whitespace-nowrap text-amber-200 ring-1 ring-amber-300/25 ring-inset ${className}`}
		>
			<svg aria-hidden viewBox="0 0 20 20" className="h-3 w-3" fill="currentColor">
				<path d="M4 6.5h9.2l-2.1-2.1L12.5 3 17 7.5 12.5 12l-1.4-1.4 2.1-2.1H4v-2Zm12 7H6.8l2.1 2.1L7.5 17 3 12.5 7.5 8l1.4 1.4-2.1 2.1H16v2Z" />
			</svg>
			{words}
		</span>
	)
}

/** The fan spreads and closes on one eased curve (round 8: it jumped, because the moves were never transitioned). */
const FAN_T =
	"transition-[translate,rotate,scale] duration-[460ms] ease-[cubic-bezier(0.22,1,0.36,1)] will-change-transform motion-reduce:transition-none"

/**
 * Three posters held like a hand of cards: the best-known in front, the other two tilted behind it. Pointing at the
 * fan spreads it a little. Decoration only; the card around it is the link.
 */
export function PosterFan({
	titles,
	width = 84,
	className = "",
}: {
	titles: ShowTitle[]
	width?: number
	className?: string
}) {
	const [front, left, right] = titles
	if (!front) return null
	const h = width * 1.5
	const card = (t: ShowTitle | undefined, pos: "left" | "front" | "right") => {
		if (!t?.card.poster_path) return null
		const at =
			pos === "front"
				? "z-20 translate-x-0 group-hover:-translate-y-1"
				: pos === "left"
					? "z-10 -translate-x-[46%] rotate-[-9deg] translate-y-[6%] group-hover:-translate-x-[58%] group-hover:rotate-[-13deg]"
					: "z-10 translate-x-[46%] rotate-[9deg] translate-y-[6%] group-hover:translate-x-[58%] group-hover:rotate-[13deg]"
		return (
			<img
				src={poster(t.card.poster_path, "w185")}
				alt=""
				loading="lazy"
				decoding="async"
				className={`absolute top-0 left-1/2 -ml-[50%] block w-full origin-bottom rounded-lg object-cover shadow-[0_10px_24px_-8px_rgba(0,0,0,0.75)] ring-1 ring-white/15 ${FAN_T} ${at}`}
				style={{ height: h }}
			/>
		)
	}
	return (
		// isolate: the fan's own layers stay inside it (they used to rise over the sticky nav, #9).
		<span
			aria-hidden
			className={`relative isolate block ${className}`}
			style={{ width, height: h * 1.08 }}
		>
			{card(left, "left")}
			{card(right, "right")}
			{card(front, "front")}
		</span>
	)
}

/** A trope as a card: its color as light, a fan of its best-known titles, the name, our one-liner, and a teaser. */
export function TropeCard({
	t,
	href,
	noun,
	size = "m",
}: {
	t: TropeRow
	href: string
	/** "movies", "shows", "movies and shows". */
	noun: string
	size?: "m" | "l"
}) {
	const big = size === "l"
	return (
		<Link
			to={href}
			prefetch="intent"
			className={`group relative isolate flex h-full flex-col overflow-hidden rounded-2xl bg-[#131a28] ring-1 ring-white/[0.08] ${GLIDE_T} hover:-translate-y-0.5 hover:ring-white/20 ${FOCUS}`}
			style={{ "--tint": t.color } as CSSProperties}
		>
			<span
				aria-hidden
				className={`relative flex items-end justify-center overflow-hidden ${big ? "h-56" : "h-44"}`}
				style={{
					background: `radial-gradient(120% 90% at 50% 100%, color-mix(in oklab, ${t.color} 34%, transparent), transparent 70%), linear-gradient(180deg, color-mix(in oklab, ${t.color} 10%, transparent), transparent)`,
				}}
			>
				<PosterFan titles={t.posters} width={big ? 104 : 82} className="mb-[-14%]" />
			</span>
			<span className="flex flex-1 flex-col p-4 pt-3.5">
				<span
					className={`font-display leading-tight font-bold text-white ${big ? "text-2xl" : "text-lg"}`}
				>
					{t.label}
				</span>
				<span className={`mt-1 leading-snug text-gray-200 ${big ? "text-lg" : "text-[15px]"}`}>
					{t.line}
				</span>
				{t.teaser && (
					<span className="mt-3 border-l-2 pl-2.5 text-[13px] leading-snug text-gray-400 [border-color:color-mix(in_oklab,var(--tint)_60%,transparent)]">
						<span className="font-semibold text-gray-200">In {t.teaser.title.card.title}: </span>
						{t.teaser.text}
					</span>
				)}
				<span className="mt-auto flex items-center justify-between pt-3 text-xs text-gray-500">
					<span className="tabular-nums">
						{many(t.n)} {noun}
					</span>
					<span
						aria-hidden
						className={`text-base text-gray-500 ${QUICK_T} group-hover:translate-x-0.5 group-hover:text-white`}
					>
						›
					</span>
				</span>
			</span>
		</Link>
	)
}
