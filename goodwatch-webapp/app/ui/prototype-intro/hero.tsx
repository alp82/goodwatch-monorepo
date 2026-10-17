// PROTOTYPE - throwaway. The hand-over frame between chapter 3 (picked for you) and chapter 4 (how it feels):
// the hero title's poster alone, centered, on the stage's black. Chapter 3 clips end on exactly this frame;
// chapter 4 clips start on it and set `enter: "cut"`, so the cut is invisible.
import type { CSSProperties } from "react"
import type { LandingCard } from "~/server/prototype-landing.server"
import { tmdbImageUrl } from "~/utils/tmdb-image"
import "./hero.css"

/** The hero's poster in its hand-over place. Animate the wrapper you put it in, not this element. */
export function HeroPoster({ card, style, className = "" }: { card: LandingCard; style?: CSSProperties; className?: string }) {
	return card.poster_path ? (
		<img src={tmdbImageUrl(card.poster_path, "w500")} alt="" className={`lpi-hero ${className}`} style={style} draggable={false} />
	) : null
}
