// PROTOTYPE - throwaway (#541). Variant E, "Pulse + native": D's board and curves with B's native content in it. The
// lead title carries its two or three best pieces as they are on their platforms (the trailer behind the click-to-load
// facade, a Bluesky or Mastodon post, a headline), so the reason a title is hot is shown and also heard. Each row of
// the board shows a small preview of what is said (one line of a post or a headline, and the platforms it is on);
// pressing the row makes that title the lead, where the full pieces are. The curve and "×N its usual" stay as in D.
import { Link } from "@remix-run/react"
import { useState } from "react"
import { type Content, HOT, type HotTitle, heatOf } from "./data"
import { nativeOf } from "./data-native"
import {
	DISPLAY,
	HeadlineCard,
	Move,
	Platform,
	PostCard,
	RowHead,
	Spark,
	VideoFacade,
	WhyChip,
	WhyIcon,
	hrefOf,
	img,
} from "./kit"
import { useWidth } from "./VariantPulse"

const BOARD = HOT.slice(0, 8)

const MARK: Record<string, string> = {
	YouTube: "bg-[#ff3b30]",
	Bluesky: "bg-[#1185fe]",
	Mastodon: "bg-[#6364ff]",
}

/** Where a piece is from, as a tiny mark: the platform's dot, or a sky bar for a headline. */
function SourceMark({ item }: { item: Content }) {
	if (item.kind === "headline") return <i className="h-1.5 w-2.5 rounded-sm bg-sky-300/80" title={item.source} />
	if (item.kind === "video")
		return (
			<i className="grid h-2.5 w-3.5 place-items-center rounded-[3px] bg-[#ff3b30]" title="YouTube">
				<svg viewBox="0 0 8 8" className="h-1.5 w-1.5" aria-hidden="true">
					<path d="M2 1v6l5-3z" fill="#fff" />
				</svg>
			</i>
		)
	return <i className={`h-2 w-2 rounded-full ${MARK[item.platform]}`} title={item.platform} />
}

/** The row's preview: a voice first (a post), else a headline, else the video, in one line. */
function Preview({ title }: { title: HotTitle }) {
	const items = nativeOf(title.tmdb_id)
	const pick = items.find((i) => i.kind === "post") ?? items.find((i) => i.kind === "headline") ?? items[0]
	if (!pick) return null
	return (
		<span className="mt-1.5 flex min-w-0 items-center gap-2 text-xs">
			<span className="flex shrink-0 items-center gap-1" aria-hidden="true">
				{items.map((item) => (
					<SourceMark key={item.id} item={item} />
				))}
			</span>
			<span className="min-w-0 truncate text-neutral-300">
				{pick.kind === "post" && (
					<>
						<span className="italic">“{pick.text}”</span>
						<span className="text-neutral-500"> {pick.name.split(" ")[0]}</span>
					</>
				)}
				{pick.kind === "headline" && (
					<>
						<b className="font-semibold text-sky-300/90">{pick.source}</b> {pick.headline}
					</>
				)}
				{pick.kind === "video" && (
					<>
						{pick.label} · {pick.views}
					</>
				)}
			</span>
		</span>
	)
}

function Lead({ title, rank }: { title: HotTitle; rank: number }) {
	const [box, width] = useWidth(300)
	const items = nativeOf(title.tmdb_id).slice(0, 3)
	const video = items.find((i) => i.kind === "video")
	const rest = items.filter((i) => i !== video)
	const ago = title.buzz.length - 1 - title.spikeAt
	const head = (
		<>
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
		</>
	)
	return (
		<article className="overflow-hidden rounded-2xl bg-neutral-950 ring-1 ring-inset ring-white/10">
			{/* With a video the trailer's picture is the title's backdrop already: the head stands on a faint one. */}
			{video ? (
				<div className="relative px-4 pb-1 pt-4 sm:px-5 sm:pt-5">
					<img
						src={img(title.backdrop_path, "w780")}
						alt=""
						loading="lazy"
						className="absolute inset-0 h-full w-full object-cover opacity-20 [mask-image:linear-gradient(#000,transparent)]"
					/>
					<div className="relative">{head}</div>
				</div>
			) : (
				<div className="relative">
					<img
						src={img(title.backdrop_path, "w780")}
						alt=""
						loading="lazy"
						className="aspect-[16/7] w-full object-cover opacity-70"
					/>
					<span className="absolute inset-0 bg-gradient-to-t from-neutral-950 via-neutral-950/40 to-transparent" />
					<div className="absolute inset-x-4 bottom-3 sm:inset-x-5">{head}</div>
				</div>
			)}
			<div className="px-4 pb-4 sm:px-5 sm:pb-5">
				<div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
					<WhyChip why={title.why} />
					<span className="text-sm text-neutral-300">{title.why.detail}</span>
				</div>
				<div className="mt-4 grid grid-cols-[auto_minmax(0,1fr)] items-end gap-x-4">
					<div>
						<p className="text-[11px] font-bold uppercase tracking-[0.16em] text-neutral-500">Buzz, 14 days</p>
						<p className="mt-1 whitespace-nowrap text-3xl font-extrabold tabular-nums text-white" style={DISPLAY}>
							×{heatOf(title).toFixed(1)}
							<span className="ml-1.5 text-sm font-semibold text-neutral-400">its usual</span>
						</p>
						<p className="mt-0.5 flex items-center gap-1 text-[11px] text-neutral-500">
							<span className="text-neutral-300">
								<WhyIcon kind={title.why.kind} />
							</span>
							{title.why.label}, {ago === 0 ? "today" : ago === 1 ? "yesterday" : `${ago} days ago`}
						</p>
					</div>
					<div ref={box} className="min-w-0">
						<Spark title={title} width={width} height={64} hover />
					</div>
				</div>
				{items.length > 0 && (
					<>
						<p className="mb-2.5 mt-5 flex items-center gap-3 text-[11px] font-bold uppercase tracking-[0.16em] text-neutral-500">
							What is said about it
							<span className="h-px flex-1 bg-white/10" />
						</p>
						{video && <VideoFacade video={video} about={false} />}
						{rest.length > 0 && (
							// Side by side from 640 px; on a phone a short strip to swipe, so the lead does not grow by two cards.
							<div
								className={`-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:grid sm:overflow-visible sm:px-0 ${rest.length > 1 ? "sm:grid-cols-2" : ""} ${video ? "mt-3" : ""}`}
							>
								{rest.map((item) => (
									<div
										key={item.id}
										className={`shrink-0 snap-start sm:w-auto ${rest.length > 1 ? "w-[78%]" : "w-full"}`}
									>
										{item.kind === "post" && <PostCard post={item} about={false} className="h-full" />}
										{item.kind === "headline" && <HeadlineCard item={item} about={false} className="h-full" />}
									</div>
								))}
							</div>
						)}
					</>
				)}
			</div>
		</article>
	)
}

export function VariantPulseNative() {
	const [lead, setLead] = useState(0)
	return (
		<section aria-labelledby="talked-title" className="mb-14">
			<RowHead
				right={
					<p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-neutral-500">
						<span>Ranked by how much each is talked about · curves on each title's own scale</span>
						<span className="flex items-center gap-2">
							<Platform name="YouTube" />
							<Platform name="Bluesky" />
							<Platform name="Mastodon" />
						</span>
					</p>
				}
			/>
			<div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,6fr)_minmax(0,5fr)] lg:items-start">
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
								className={`group grid w-full grid-cols-[1.5rem_32px_minmax(0,1fr)_auto] items-center gap-3 rounded-xl px-2 py-2.5 text-left sm:grid-cols-[1.75rem_34px_minmax(0,1fr)_96px_3.25rem] ${lead === i ? "bg-amber-300/[0.08] ring-1 ring-inset ring-amber-300/40" : "hover:bg-white/[0.04]"}`}
							>
								<b className="self-start pt-1 text-right text-lg tabular-nums text-white/30" style={DISPLAY}>
									{i + 1}
								</b>
								<img
									src={img(title.poster_path, "w92")}
									alt=""
									width={34}
									height={51}
									loading="lazy"
									className="h-12 w-8 self-start rounded object-cover sm:h-[51px] sm:w-[34px]"
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
									<Preview title={title} />
								</span>
								<span className="hidden sm:block">
									<Spark title={title} width={96} height={34} />
								</span>
								<span className="flex flex-col items-end">
									<span className="sm:hidden">
										<Spark title={title} width={56} height={22} mark={false} />
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
