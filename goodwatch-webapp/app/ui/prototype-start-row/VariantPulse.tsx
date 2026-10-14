// PROTOTYPE - throwaway (#541). Variant D, "Pulse" (the prototype's own idea): the row shows why a title is hot as
// data. Every title has its last 14 days of buzz as a sparkline with the day of the reason marked, and "×2.4" says
// how far above its own usual it is today. One title is the lead, large, with its backdrop, the full curve and its
// best piece of content; pressing a title in the board makes it the lead. GoodWatch's scores and fingerprints
// already explain themselves with numbers; this asks whether "talked about" should too.
import { Link } from "@remix-run/react"
import { useEffect, useRef, useState } from "react"
import { HOT, type HotTitle, contentOf, heatOf } from "./data"
import {
	DISPLAY,
	HeadlineCard,
	Move,
	PostCard,
	RowHead,
	Spark,
	VideoFacade,
	WhyChip,
	WhyIcon,
	hrefOf,
	img,
} from "./kit"

const BOARD = HOT.slice(0, 8)

/** The box's width, once measured: the lead's curve fills its card at every window size. */
function useWidth(fallback: number) {
	const ref = useRef<HTMLDivElement>(null)
	const [width, setWidth] = useState(fallback)
	useEffect(() => {
		const el = ref.current
		if (!el) return
		const observer = new ResizeObserver(() => setWidth(Math.round(el.clientWidth)))
		observer.observe(el)
		return () => observer.disconnect()
	}, [])
	return [ref, width] as const
}

function Lead({ title, rank }: { title: HotTitle; rank: number }) {
	const [box, width] = useWidth(300)
	const best = contentOf(title.tmdb_id)[0]
	const ago = title.buzz.length - 1 - title.spikeAt
	return (
		<article className="overflow-hidden rounded-2xl bg-neutral-950 ring-1 ring-inset ring-white/10">
			<div className="relative">
				<img
					src={img(title.backdrop_path, "w780")}
					alt=""
					loading="lazy"
					className="aspect-[16/8] w-full object-cover opacity-70"
				/>
				<span className="absolute inset-0 bg-gradient-to-t from-neutral-950 via-neutral-950/40 to-transparent" />
				<div className="absolute inset-x-4 bottom-3 sm:inset-x-5">
					<p className="flex items-center gap-2 text-xs font-bold text-amber-300">
						#{rank} talked about <Move move={title.move} />
					</p>
					<Link
						to={hrefOf(title)}
						discover="none"
						className="mt-0.5 block text-[clamp(1.6rem,3.4vw,2.4rem)] font-extrabold leading-[1.05] text-white hover:text-amber-300"
						style={DISPLAY}
					>
						{title.title}
					</Link>
					<p className="mt-1 text-xs text-neutral-400">
						{title.media_type === "movie" ? "Movie" : "TV show"} · {title.where}
					</p>
				</div>
			</div>
			<div className="px-4 pb-4 sm:px-5 sm:pb-5">
				<div className="flex flex-wrap items-center gap-x-3 gap-y-2">
					<WhyChip why={title.why} />
					<span className="text-sm text-neutral-300">{title.why.detail}</span>
				</div>
				<div className="mt-4 flex items-end justify-between gap-4">
					<div>
						<p className="text-[11px] font-bold uppercase tracking-[0.16em] text-neutral-500">Buzz, 14 days</p>
						<p className="mt-1 text-3xl font-extrabold tabular-nums text-white" style={DISPLAY}>
							×{heatOf(title).toFixed(1)}
							<span className="ml-1.5 text-sm font-semibold text-neutral-400">its usual, today</span>
						</p>
					</div>
					<p className="text-right text-[11px] text-neutral-500">
						<span className="inline-flex items-center gap-1 text-neutral-300">
							<WhyIcon kind={title.why.kind} /> {title.why.label}
						</span>
						<br />
						{ago === 0 ? "today" : ago === 1 ? "yesterday" : `${ago} days ago`}
					</p>
				</div>
				<div ref={box} className="mt-3 min-w-0">
					<Spark title={title} width={width} height={84} hover />
				</div>
				<p className="mt-1 flex justify-between text-[10px] text-neutral-600">
					<span>14 days ago</span>
					<span>Today</span>
				</p>
				{best && (
					<div className="mt-4">
						{best.kind === "video" && <VideoFacade video={best} about={false} />}
						{best.kind === "post" && <PostCard post={best} about={false} />}
						{best.kind === "headline" && <HeadlineCard item={best} about={false} />}
					</div>
				)}
			</div>
		</article>
	)
}

export function VariantPulse() {
	const [lead, setLead] = useState(0)
	return (
		<section aria-labelledby="talked-title" className="mb-14">
			<RowHead right={<p className="text-xs text-neutral-500">Ranked by how much each is talked about · curves on each title's own scale</p>} />
			<div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:items-start">
				{/* From 1024 px the lead stands beside the board; on a phone it opens in the board, under its row. */}
				<div className="hidden lg:block">
					<Lead key={BOARD[lead].tmdb_id} title={BOARD[lead]} rank={lead + 1} />
				</div>
				<ol className="rounded-2xl bg-white/[0.03] px-2 py-1 ring-1 ring-inset ring-white/10 sm:px-3">
					{BOARD.map((title, i) => (
						<li key={title.tmdb_id} className="border-b border-white/[0.07] last:border-0">
							<button
								type="button"
								onClick={() => setLead(i)}
								aria-pressed={lead === i}
								className={`group grid w-full grid-cols-[1.5rem_32px_minmax(0,1fr)_auto] items-center gap-3 rounded-xl px-2 py-2 text-left sm:grid-cols-[1.75rem_34px_minmax(0,1fr)_120px_3.5rem] ${lead === i ? "bg-amber-300/[0.08] ring-1 ring-inset ring-amber-300/40" : "hover:bg-white/[0.04]"}`}
							>
								<b className="text-right text-lg tabular-nums text-white/30" style={DISPLAY}>
									{i + 1}
								</b>
								<img
									src={img(title.poster_path, "w92")}
									alt=""
									width={34}
									height={51}
									loading="lazy"
									className="h-12 w-8 rounded object-cover sm:h-[51px] sm:w-[34px]"
								/>
								<span className="min-w-0">
									<b className="flex items-center gap-2 text-[15px] text-white group-hover:text-amber-300" style={DISPLAY}>
										<span className="truncate">{title.title}</span>
										<Move move={title.move} />
									</b>
									<span className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-neutral-400">
										<span className="text-neutral-300">
											<WhyIcon kind={title.why.kind} />
										</span>
										<span className="truncate">{title.why.detail}</span>
									</span>
								</span>
								<span className="hidden sm:block">
									<Spark title={title} width={120} height={34} />
								</span>
								<span className="flex flex-col items-end">
									<span className="sm:hidden">
										<Spark title={title} width={64} height={22} mark={false} />
									</span>
									<b className="text-sm tabular-nums text-white">×{heatOf(title).toFixed(1)}</b>
								</span>
							</button>
							{lead === i && (
								<div className="pb-3 pt-1 lg:hidden">
									<Lead title={title} rank={i + 1} />
								</div>
							)}
						</li>
					))}
				</ol>
			</div>
		</section>
	)
}
