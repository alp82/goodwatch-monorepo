// The hand-over frame between "Picked for you" and "How it feels": the pick's poster alone, centred on black. The
// pick ends on exactly this frame and the feelings start on it, so the cut between them is invisible.
import type { CSSProperties } from "react"
import type { IntroCard } from "~/ui/living-room/intro/data"
import { tmdbImageUrl } from "~/utils/tmdb-image"

/** The hero's poster in its hand-over place. Animate the wrapper you put it in, not this element. */
export function HeroPoster({
	card,
	style,
	className = "",
}: { card: IntroCard; style?: CSSProperties; className?: string }) {
	return card.poster_path ? (
		<img
			src={tmdbImageUrl(card.poster_path, "w500")}
			alt=""
			className={`film-hero ${className}`}
			style={style}
			draggable={false}
		/>
	) : null
}
