// PROTOTYPE - throwaway (prototype/explore-r9). Small pieces the genre pickers share: a tight stack of three posters,
// and a genre's count as people read it ("29k", never 29,233).
import { count } from "../../../../kit/count"
import { poster } from "../../../../kit/ui"
import { GLIDE_T } from "../../../../kit/ui/motion"
import type { AtlasGenre } from "./atlas.server"

/** Three posters overlapping, the front one on top. Decoration inside a genre button, so no links of its own. */
export function Stack({
	g,
	on,
	className = "",
}: {
	g: AtlasGenre
	on: boolean
	className?: string
}) {
	const shown = g.titles.filter((t) => t.poster).slice(0, 3)
	return (
		<span aria-hidden className={`relative block h-[3.4rem] w-[4.6rem] shrink-0 ${className}`}>
			{shown.map((t, i) => (
				<img
					key={t.key}
					src={poster(t.poster, "w92")}
					alt=""
					loading="lazy"
					decoding="async"
					className={`absolute top-0 h-[3.4rem] w-[2.3rem] rounded-[4px] object-cover shadow-md ring-1 shadow-black/50 ring-black/40 ${GLIDE_T}`}
					style={{
						left: `${i * 1.15}rem`,
						zIndex: 3 - i,
						transform: on
							? `translateY(${i === 0 ? -2 : 0}px)`
							: `translateY(${i * 2}px) scale(${1 - i * 0.04})`,
						opacity: on ? 1 : 1 - i * 0.18,
					}}
				/>
			))}
		</span>
	)
}

export const genreCount = (g: AtlasGenre) => count(g.n)
