// The For you chapter's pick poster alone, centred on black: where the wall's dive leaves it and the backdrop takes
// over (scenes/for-you/).
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
