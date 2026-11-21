// PROTOTYPE - throwaway (prototype/explore-r5). Kind control "Plus": at rest it is the round 4 control, untouched.
// Point at (or tab to) the word that is not lit and a small + appears at its inner edge: the word switches, the +
// adds it, the way an ingredient is added to a blend. A touch screen has no hover, so there the + is always shown.
import { Link } from "@remix-run/react"
import { useState } from "react"
import type { Kind } from "../../../../kit/address"
import type { SlotVariant } from "../../contract"
import type { KindProps } from "./slot"
import { Seam, Track, W, WORD, WORD_LIT, byKind, kindNotes, useShownKind, useWindow } from "./track"

const TOTAL = W.movie + W.gap + W.show
const SEAM = W.movie + W.gap / 2
const WINDOW: Record<Kind, [number, number]> = {
	movie: [0, W.movie],
	show: [W.movie + W.gap, TOTAL],
	all: [0, TOTAL],
}

function View({ kinds }: KindProps) {
	const k = byKind(kinds)
	const shown = useShownKind(kinds)
	// "word": the pointer or focus is on the unlit word (the + shows); "plus": it is on the + (the pill previews).
	const [near, setNear] = useState<"word" | "plus" | null>(null)
	const both = shown === "all"
	const other = shown === "show" ? k.movie : k.show
	const lit = useWindow(...WINDOW[shown])
	const ghost = useWindow(...WINDOW[near === "plus" && !both ? "all" : shown])
	const word = (kind: "movie" | "show") => {
		const unlit = !both && shown !== kind
		return (
			<Link
				to={k[kind].href}
				prefetch="intent"
				aria-current={shown === kind ? "page" : undefined}
				title={both ? `Only ${k[kind].label.toLowerCase()}` : undefined}
				onPointerEnter={unlit ? () => setNear("word") : undefined}
				onPointerLeave={unlit ? () => setNear(null) : undefined}
				onFocus={unlit ? () => setNear("word") : undefined}
				onBlur={unlit ? () => setNear(null) : undefined}
				className={`${WORD} hover:bg-white/10`}
				style={{ width: W[kind], marginLeft: kind === "show" ? W.gap : 0 }}
			>
				{k[kind].label}
			</Link>
		)
	}
	return (
		<Track
			label="Movies, shows, or both"
			total={TOTAL}
			l={lit.l}
			r={lit.r}
			ghost={ghost}
			lit={
				<>
					<span className={WORD_LIT} style={{ width: W.movie }}>
						Movies
					</span>
					<span className={WORD_LIT} style={{ width: W.show, marginLeft: W.gap }}>
						Shows
					</span>
					{both && <Seam at={SEAM} />}
				</>
			}
		>
			{word("movie")}
			{word("show")}
			{!both && (
				<Link
					to={k.all.href}
					prefetch="intent"
					aria-label={`Add ${other.label.toLowerCase()}`}
					title={`Add ${other.label.toLowerCase()}: movies and shows together`}
					onPointerEnter={() => setNear("plus")}
					onPointerLeave={() => setNear(null)}
					onFocus={() => setNear("plus")}
					onBlur={() => setNear(null)}
					onClick={() => setNear(null)}
					data-near={near ?? undefined}
					// 18px mark on the seam, above the pill and its amber edge (round 10); the hit area is 28px. Shown on intent, and always where there is no hover.
					className="absolute top-1/2 z-40 grid h-[18px] w-[18px] -translate-x-1/2 -translate-y-1/2 scale-50 place-items-center rounded-full bg-gray-900 text-gray-100 opacity-0 ring-1 ring-white/30 outline-none transition-[opacity,scale,background-color,color] duration-200 ease-out before:absolute before:-inset-[5px] hover:bg-white hover:text-gray-950 focus-visible:scale-100 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-amber-400 data-[near]:scale-100 data-[near]:opacity-100 motion-reduce:transition-none [@media(hover:none)]:scale-100 [@media(hover:none)]:opacity-100"
					style={{ left: SEAM }}
				>
					<svg viewBox="0 0 10 10" aria-hidden className="h-2.5 w-2.5">
						<path
							d="M5 1.5v7M1.5 5h7"
							stroke="currentColor"
							strokeWidth="1.6"
							strokeLinecap="round"
						/>
					</svg>
				</Link>
			)}
		</Track>
	)
}

export const variant: SlotVariant<never, KindProps> = {
	id: "plus",
	name: "Plus",
	what: "Looks like today's control. Point at the other word and a small + appears beside it: the word switches, the + adds it.",
	order: 3,
	View,
	notes: kindNotes,
}
