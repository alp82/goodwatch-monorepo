// PROTOTYPE (Discover lab, mood e and i): the top titles of the current mix as small posters, in fixed slots so the
// panel keeps its shape while the list changes. Each poster opens its title page.
import { Link } from "@remix-run/react"
import { motion } from "framer-motion"
import type { TitleCard } from "~/server/title-cards.server"
import { titlePath } from "~/utils/helpers"
import { posterUrl } from "~/ui/watch-next/style"

export type PosterCard = Pick<TitleCard, "key" | "title" | "poster_path" | "media_type" | "tmdb_id" | "release_year">

export function Posters({ cards, slots, className, busy = false }: { cards: PosterCard[]; slots: number; className: string; busy?: boolean }) {
	const shown = cards.filter((c) => c.poster_path).slice(0, slots)
	return (
		<div className={`grid gap-2 transition-opacity ${busy ? "opacity-60" : ""} ${className}`}>
			{Array.from({ length: slots }, (_, i) => {
				const c = shown[i]
				if (!c)
					// biome-ignore lint/suspicious/noArrayIndexKey: empty slots have no identity
					return <span key={`empty${i}`} className="aspect-[2/3] rounded-lg bg-white/[0.03] ring-1 ring-white/[0.05]" aria-hidden />
				return (
					<motion.span key={c.key} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2, delay: i * 0.015 }} className="block min-w-0">
						<Link
							to={titlePath(c.media_type, c.tmdb_id, c.title)}
							title={c.release_year ? `${c.title} (${c.release_year})` : c.title}
							className="group relative block aspect-[2/3] overflow-hidden rounded-lg bg-gray-800 ring-1 ring-white/10 outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
						>
							<img
								src={posterUrl(c.poster_path, "w185")}
								alt={c.title}
								loading="lazy"
								className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105 motion-reduce:transition-none"
							/>
						</Link>
					</motion.span>
				)
			})}
		</div>
	)
}
