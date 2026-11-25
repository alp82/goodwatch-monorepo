// Under the opened genre: a few picks that are not its front row, each
// with the reason it is there. A phone scrolls the row sideways.
import { TmdbImage } from "~/ui/TmdbImage"
import { Link } from "@remix-run/react"
import { ScorePill } from "~/ui/poster-card/ScorePill"
import { FOCUS } from "~/ui/browse/index"
import { QUICK_T } from "~/ui/browse/motion"
import type { AtlasGenre, Pick, PickWhy } from "~/server/browse/genres.server"
import { low } from "~/ui/browse/genres/shared"

const WHY: Record<PickWhy, { label: string; color: string }> = {
	gem: { label: "Hidden gem", color: "#34d399" },
	new: { label: "Recent standout", color: "#60a5fa" },
	classic: { label: "Still holds up", color: "#fbbf24" },
	edge: { label: "Off the main road", color: "#c084fc" },
	crowd: { label: "Everyone's watching", color: "#fb7185" },
}

function PickCard({ p }: { p: Pick }) {
	const why = WHY[p.why]
	return (
		<li className="w-[15rem] shrink-0 snap-start sm:w-auto">
			<Link
				to={p.to}
				prefetch="intent"
				className={`group/p flex h-full items-center gap-3 rounded-xl bg-white/[0.03] p-2.5 ring-1 ring-white/[0.07] hover:bg-white/[0.06] hover:ring-white/15 ${QUICK_T} ${FOCUS}`}
			>
				<span
					className={`relative block w-[4.25rem] shrink-0 overflow-hidden rounded-md bg-gray-800 shadow-md ring-1 shadow-black/40 ring-white/10 ${QUICK_T} group-hover/p:-translate-y-0.5`}
				>
					{p.poster && (
						<TmdbImage
							kind="poster"
							path={p.poster}
							width={68}
							alt=""
							className="block aspect-[2/3] w-full object-cover"
						/>
					)}
				</span>
				<span className="min-w-0 flex-1">
					<span
						className="block text-[10.5px] font-bold tracking-[0.08em] uppercase"
						style={{ color: why.color }}
					>
						{why.label}
					</span>
					<span className="mt-1 line-clamp-2 block text-sm leading-snug font-semibold text-gray-100 group-hover/p:text-white">
						{p.title}
					</span>
					<span className="mt-1 flex items-center gap-2 text-xs text-gray-500">
						<ScorePill goodwatch={p.score} score={null} mark={null} size="S" />
						<span className="truncate">
							{p.year}
							{p.kind ? ` · ${p.kind.toLowerCase()}` : ""}
						</span>
					</span>
				</span>
			</Link>
		</li>
	)
}

export function GenrePicks({ g }: { g: AtlasGenre }) {
	if (g.picks.length < 2) return null
	return (
		<section aria-label={`Picks from ${low(g.plural)}`}>
			<h2 className="text-xl font-bold tracking-tight text-white">
				Beyond the obvious {low(g.plural)}
			</h2>
			<ul className="relative -mx-4 mt-4 flex snap-x scroll-px-4 gap-3.5 overflow-x-auto px-4 pb-2 [scrollbar-width:none] sm:mx-0 sm:grid sm:grid-cols-2 sm:gap-3 sm:overflow-visible sm:px-0 lg:grid-cols-5">
				{g.picks.map((p) => (
					<PickCard key={p.key} p={p} />
				))}
			</ul>
		</section>
	)
}
