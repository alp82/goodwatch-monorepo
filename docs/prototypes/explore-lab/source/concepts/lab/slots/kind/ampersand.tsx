// PROTOTYPE - throwaway (prototype/explore-r5). Kind control "Ampersand": the control reads "Movies & Shows". A word
// picks that kind alone. The "&" between them is the small extra control: it grows the pill over both words, and the
// lit control then reads as the phrase it means. Pressed again it lets go, back to the word you had.
import { Link } from "@remix-run/react"
import { useRef, useState } from "react"
import type { Kind } from "../../../../kit/address"
import type { SlotVariant } from "../../contract"
import type { KindProps } from "./slot"
import { Track, W, WORD, WORD_LIT, byKind, kindNotes, useShownKind, useWindow } from "./track"

const AMP = 22
const TOTAL = W.movie + AMP + W.show
const WINDOW: Record<Kind, [number, number]> = {
	movie: [0, W.movie],
	show: [W.movie + AMP, TOTAL],
	all: [0, TOTAL],
}

function View({ kinds }: KindProps) {
	const k = byKind(kinds)
	const shown = useShownKind(kinds)
	// The word to fall back to when the "&" lets go.
	const last = useRef<Exclude<Kind, "all">>(shown === "all" ? "movie" : shown)
	if (shown !== "all") last.current = shown
	const [peek, setPeek] = useState(false)
	const both = shown === "all"
	const lit = useWindow(...WINDOW[shown])
	const ghost = useWindow(...WINDOW[peek ? "all" : shown])
	const back = k[last.current]
	const amp = "flex h-8 shrink-0 items-center justify-center text-[15px] leading-none font-bold"
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
					<span className={`${amp}`} style={{ width: AMP }}>
						&amp;
					</span>
					<span className={WORD_LIT} style={{ width: W.show }}>
						Shows
					</span>
				</>
			}
		>
			<Link
				to={k.movie.href}
				prefetch="intent"
				aria-current={shown === "movie" ? "page" : undefined}
				title={both ? "Only movies" : undefined}
				className={WORD}
				style={{ width: W.movie }}
			>
				Movies
			</Link>
			<Link
				to={both ? back.href : k.all.href}
				prefetch="intent"
				aria-label={both ? `Only ${back.label.toLowerCase()}` : "Movies and shows together"}
				aria-current={both ? "page" : undefined}
				title={both ? `Only ${back.label.toLowerCase()}` : "Movies and shows together"}
				onPointerEnter={() => setPeek(true)}
				onPointerLeave={() => setPeek(false)}
				onFocus={() => setPeek(true)}
				onBlur={() => setPeek(false)}
				onClick={() => setPeek(false)}
				// The hit area reaches a little into both words: 34px wide for a finger.
				className={`${amp} relative z-10 rounded-full text-gray-400 outline-none transition-colors before:absolute before:inset-y-0 before:-inset-x-1.5 hover:text-white focus-visible:ring-2 focus-visible:ring-amber-400`}
				style={{ width: AMP }}
			>
				&amp;
			</Link>
			<Link
				to={k.show.href}
				prefetch="intent"
				aria-current={shown === "show" ? "page" : undefined}
				title={both ? "Only shows" : undefined}
				className={WORD}
				style={{ width: W.show }}
			>
				Shows
			</Link>
		</Track>
	)
}

export const variant: SlotVariant<never, KindProps> = {
	id: "ampersand",
	name: "Ampersand",
	what: "The control reads “Movies & Shows”. The “&” grows the pill over both words; a word alone picks only that one.",
	order: 1,
	View,
	notes: kindNotes,
}
