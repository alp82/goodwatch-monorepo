// PROTOTYPE - throwaway. My movies for /prototype/arrival-mark: the page as it is built (ui/watch-next and
// ui/my-movies, redrawn here with the same classes and the real poster card, so that the real page stays untouched),
// with what each variation adds. The moods, "How long?" and the services toggle are drawn and do nothing.
import {
	CheckIcon,
	ChevronDownIcon,
	GlobeAltIcon,
	PlayIcon,
} from "@heroicons/react/20/solid"
import type { TitleCard } from "~/server/title-cards.server"
import { LandedNote } from "~/ui/my-pages/LandedNote"
import {
	DISPLAY,
	MY_LIBRARY,
	MY_SHOWS,
	PageHead,
	WRAP,
	tmdbImage,
} from "~/ui/my-pages/bits"
import { TitlePosterCard } from "~/ui/title-card/TitlePosterCard"
import {
	MINE,
	MOVIES,
	type Mark,
	SERVICES,
	type Title,
	lineOf,
	logoUrl,
	runtimeWords,
} from "./model"
import {
	Chip,
	type Ctx,
	DotD,
	LineC,
	LogRow,
	Logos,
	Shelf,
	SortSelect,
	StickerB,
	TagA,
	opens,
} from "./parts"

type Size = "xl" | "lg" | "md"
const GRID: Record<Size, string> = {
	xl: "grid grid-cols-2 gap-3 md:flex md:flex-wrap md:gap-4",
	lg: "grid grid-cols-3 gap-2 md:flex md:flex-wrap md:gap-3",
	md: "grid grid-cols-4 gap-1.5 md:flex md:flex-wrap md:gap-2",
}
const ITEM: Record<Size, string> = {
	xl: "md:w-56",
	lg: "md:w-36",
	md: "md:w-24",
}
const HEADING: Record<Size, string> = {
	xl: "text-3xl md:text-4xl text-amber-300",
	lg: "text-2xl md:text-3xl text-white",
	md: "text-xl md:text-2xl text-gray-200",
}

const mine = (title: Title) => title.on.filter((s) => MINE.includes(s))

/** The real poster card's data for a made-up title. `bare` leaves its service badges off (variation B draws them). */
const cardOf = (title: Title, bare: boolean) =>
	({
		key: title.id,
		tmdb_id: title.id,
		media_type: title.kind,
		title: title.title,
		release_year: String(title.year),
		poster_path: title.poster,
		backdrop_path: title.backdrop,
		goodwatch_overall_score_normalized_percent: title.score,
		match: title.match,
		reasons: [],
		services: bare
			? []
			: mine(title).map((service, i) => ({
					id: i + 1,
					name: SERVICES[service].name,
					logo_path: SERVICES[service].logo,
					owned: true,
				})),
		seen: false,
		wantToSee: true,
		notInterested: false,
		rating: null,
	}) as unknown as TitleCard

/** A poster of the stepped grid, with the variation's mark on it or under it. */
function Tile({ title, size, ctx }: { title: Title; size: Size; ctx: Ctx }) {
	const mark = ctx.marks.get(title.key)
	const { variant } = ctx
	const big = size !== "md"
	return (
		<div
			className={`relative min-w-0 ${ITEM[size]}`}
			data-key={title.key}
			{...opens(ctx, title.key)}
		>
			{big ? (
				<TitlePosterCard
					card={cardOf(title, variant === "B" && Boolean(mark))}
					actions={false}
				/>
			) : (
				<img
					src={tmdbImage(title.poster, "w185")}
					alt={title.title}
					loading="lazy"
					className="aspect-[2/3] w-full rounded-md bg-white/5 object-cover ring-1 ring-white/5"
				/>
			)}
			{mark && variant === "B" && (
				<StickerB
					mark={mark}
					small={!big}
					className={`absolute z-20 ${big ? "left-2 top-3" : "-left-1 -top-1"}`}
				/>
			)}
			{mark && variant === "D" && (
				<DotD
					mark={mark}
					className={`absolute z-20 ${big ? "left-1 top-1 h-3.5 w-3.5" : "-left-1 -top-1"}`}
				/>
			)}
			{size === "xl" && (
				<div className="-mt-1 truncate px-1 text-xs text-gray-400">
					{mark && variant === "C" ? (
						<LineC mark={mark} />
					) : (
						`${title.match}% taste match, on ${SERVICES[mine(title)[0]].name}`
					)}
				</div>
			)}
			{mark && variant === "A" && (
				<div className={`px-1 ${big ? "mt-1" : "mt-1 -mx-1"}`}>
					<TagA mark={mark} short={size !== "xl"} />
				</div>
			)}
			{mark && variant === "C" && size !== "xl" && (
				<LineC
					mark={mark}
					className="mt-0.5 block px-1 text-[11px] leading-tight"
				/>
			)}
		</div>
	)
}

function Tier({
	name,
	note,
	size,
	titles,
	ctx,
	sky,
}: {
	name: string
	note?: string
	size: Size
	titles: Title[]
	ctx: Ctx
	sky?: boolean
}) {
	if (!titles.length) return null
	return (
		<li
			className={`grid gap-3 md:grid-cols-[12rem_1fr] md:gap-8 ${size === "xl" ? "pb-12" : size === "lg" ? "pb-10" : "pb-8"}`}
			data-tier={name}
		>
			<div className="md:sticky md:top-32 md:self-start md:text-right">
				<h3
					className={`${DISPLAY} leading-none ${sky ? "text-3xl text-sky-300 md:text-4xl" : HEADING[size]}`}
				>
					{name}
				</h3>
				<p className="mt-1 text-sm text-gray-400">
					{note ? `${note} ` : ""}
					{titles.length} {titles.length === 1 ? "movie" : "movies"}
				</p>
			</div>
			<div className={`min-w-0 ${GRID[size]}`}>
				{titles.map((title) => (
					<Tile key={title.key} title={title} size={size} ctx={ctx} />
				))}
			</div>
		</li>
	)
}

/** The control strip on the hero, drawn: only the chip (B) and the sort (C) do something. */
function Strip({ ctx, count }: { ctx: Ctx; count: number }) {
	const key =
		"flex h-9 shrink-0 items-center gap-1.5 rounded-xl px-3 text-sm font-bold"
	return (
		<div className="flex min-h-14 items-center gap-2 rounded-2xl bg-black/45 p-2 ring-1 ring-white/10 backdrop-blur-md">
			<span
				className={`${key} bg-white/[0.06] text-gray-100 ring-1 ring-white/10`}
			>
				<span className="flex -space-x-1.5" aria-hidden>
					{["#facc15", "#f472b6", "#60a5fa", "#2dd4bf"].map((hue) => (
						<span
							key={hue}
							className="h-5 w-5 rounded-full ring-2 ring-gray-900"
							style={{ background: hue }}
						/>
					))}
				</span>
				Any mood
				<ChevronDownIcon className="h-4 w-4 opacity-70" aria-hidden />
			</span>
			{/* With the chip on, the chip says how many. */}
			{!ctx.only && (
				<span className="whitespace-nowrap pl-1 pr-1.5 text-sm tabular-nums text-gray-400">
					<b className="font-semibold text-white">{count}</b> on your services
				</span>
			)}
			{ctx.variant === "B" && <Chip ctx={ctx} kind="movie" />}
			<span className="grow" />
			<span
				className={`${key} bg-white/[0.06] text-gray-200 ring-1 ring-white/10`}
			>
				How long? Any length
				<ChevronDownIcon className="h-4 w-4 opacity-70" aria-hidden />
			</span>
			<span className="flex h-9 shrink-0 items-center rounded-xl bg-white/[0.06] p-0.5 text-sm font-bold ring-1 ring-white/10">
				<span className="flex h-8 items-center gap-1.5 rounded-[10px] bg-emerald-600 px-2.5 text-white">
					<Logos on={MINE.slice(0, 2)} className="h-5 w-5" />
					On my services
				</span>
				<span className="flex h-8 items-center gap-1.5 px-2.5 text-gray-400">
					<GlobeAltIcon className="h-4 w-4" aria-hidden />
					Everywhere
				</span>
			</span>
			{ctx.variant === "C" ? (
				<SortSelect ctx={ctx} />
			) : (
				<span
					className={`${key} bg-white/[0.06] text-gray-200 ring-1 ring-white/10`}
				>
					<span className="font-normal text-gray-400">Sort</span> Best match
					<ChevronDownIcon className="h-4 w-4 opacity-70" aria-hidden />
				</span>
			)}
		</div>
	)
}

/** How a mark shows in a row of the Then column, in the line that says where the movie streams. */
function ThenLine({
	title,
	mark,
	ctx,
}: { title: Title; mark?: Mark; ctx: Ctx }) {
	const on = `On ${SERVICES[mine(title)[0]].name}`
	if (!mark) return <>{on}</>
	if (ctx.variant === "A") return <TagA mark={mark} />
	if (ctx.variant === "C") return <LineC mark={mark} />
	return <>{on}</>
}

export function MoviesPage({ ctx }: { ctx: Ctx }) {
	const { variant, marks, sort } = ctx
	const onMine = MOVIES.filter((title) => mine(title).length)
	const landed = [...marks.values()]
		.filter((mark) => mark.title.kind === "movie")
		.map((mark) => mark.title)
	const byMatch = [...onMine].sort((a, b) => b.match - a.match)
	// B with the chip on: only what landed. C sorted by arrival: what landed first, the latest on top.
	const order =
		variant === "B" && ctx.only
			? landed
			: variant === "C" && sort === "arrived"
				? [...landed, ...byMatch.filter((title) => !landed.includes(title))]
				: byMatch
	const [hero, ...rest] = order
	const thens = rest.slice(0, 3)
	const grid = rest.slice(3)
	const heroMark = hero && marks.get(hero.key)
	const arrivedSort = variant === "C" && sort === "arrived"
	// C sorted by arrival: the fresh landings the hero and Then did not take are a tier of their own.
	const justArrived = arrivedSort
		? grid.filter((title) => marks.get(title.key)?.state === "fresh")
		: []
	const steps = grid.filter((title) => !justArrived.includes(title))
	const line = [...marks.values()].filter((m) => m.title.kind === "movie")
	return (
		<div className="overflow-x-clip pb-40" data-my-movies>
			<PageHead
				name="My movies"
				line={`${MOVIES.length} movies you want to see`}
				links={[
					{ label: "My shows", to: MY_SHOWS },
					{ label: "My library", to: MY_LIBRARY },
				]}
			/>
			<div className={`${WRAP} flex flex-col gap-4 empty:hidden`}>
				{ctx.firstVisit && (
					<LandedNote
						kind="movie"
						landed={
							line.length
								? {
										count: line.length,
										titles: line.slice(0, 3).map((mark) => mark.title.title),
										service: SERVICES[line[0].on[0]].name,
									}
								: null
						}
						className="-mt-2"
					/>
				)}
				{variant === "A" && <Shelf ctx={ctx} kind="movie" />}
				{variant === "D" && <LogRow ctx={ctx} kind="movie" />}
				{/* A phone has the strip's choices in a slab at the bottom; here the two that matter sit under the head. */}
				{variant === "B" && (
					<div className="lg:hidden">
						<Chip ctx={ctx} kind="movie" />
					</div>
				)}
				{variant === "C" && (
					<div className="flex lg:hidden">
						<SortSelect ctx={ctx} />
					</div>
				)}
			</div>
			{hero && (
				<section
					className="relative isolate mt-4 overflow-hidden"
					data-hero={hero.key}
				>
					<img
						src={tmdbImage(hero.backdrop, "original")}
						alt=""
						className="absolute inset-0 -z-10 h-full w-full object-cover object-[center_20%]"
					/>
					<div className="absolute inset-0 -z-10 bg-linear-to-t from-gray-900 via-gray-900/70 to-gray-900/10 md:bg-linear-to-r md:from-gray-900 md:via-gray-900/75 md:to-transparent" />
					<div className="absolute inset-x-0 bottom-0 -z-10 h-32 bg-linear-to-t from-gray-900 to-transparent" />
					<div className="absolute inset-x-0 top-0 -z-10 h-40 bg-linear-to-b from-gray-900/90 to-transparent" />
					<div className={`${WRAP} relative z-20 hidden pt-6 lg:block`}>
						<Strip ctx={ctx} count={order.length} />
					</div>
					<div
						className={`${WRAP} grid min-h-[30rem] items-end gap-6 pb-8 pt-24 md:min-h-[36rem] md:grid-cols-[1fr_auto] md:items-center md:gap-10 md:pt-6`}
					>
						<div className="min-w-0 max-w-2xl">
							<p className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm font-semibold">
								<span className="text-amber-300">
									Tonight's movie ·{" "}
									{arrivedSort && heroMark
										? "Arrived most recently"
										: ctx.only
											? "Newest on your services"
											: "Best match for you tonight"}
								</span>
								{heroMark && variant === "A" && <TagA mark={heroMark} />}
								{heroMark && variant === "C" && (
									<span className="text-sky-200">{lineOf(heroMark)}</span>
								)}
								{heroMark && variant === "D" && <DotD mark={heroMark} />}
							</p>
							<h2
								className={`${DISPLAY} mt-1 leading-[0.9] text-white ${hero.title.length > 22 ? "text-4xl md:text-6xl lg:text-7xl" : "text-5xl md:text-7xl lg:text-[7rem]"}`}
							>
								{hero.title}
							</h2>
							<p className="mt-3 text-sm text-gray-400">
								{hero.year}, {runtimeWords(hero.runtime ?? 0)}, {hero.match}%
								taste match, GoodWatch score {hero.score}
							</p>
							<div className="mt-5 flex flex-wrap items-center gap-2">
								{mine(hero).map((service) => {
									const fresh = heroMark?.on.includes(service)
									return (
										<span
											key={service}
											className={`relative flex h-10 shrink-0 items-center gap-2 rounded-lg border-2 bg-white/10 pr-2.5 ${fresh && variant === "B" ? "border-sky-400" : "border-green-500"}`}
										>
											<img
												src={logoUrl(service)}
												alt=""
												className="aspect-square h-full rounded-md"
											/>
											<span className="truncate text-sm font-medium text-white">
												{SERVICES[service].name}
											</span>
											{fresh && variant === "B" ? (
												<span className="absolute -right-2 -top-2 rounded-full bg-sky-400 px-1.5 py-0.5 text-[9px] font-black uppercase leading-none text-black ring-2 ring-stone-950">
													New
												</span>
											) : (
												<span className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-green-500 text-black ring-2 ring-stone-950">
													<CheckIcon className="h-3 w-3" aria-hidden />
												</span>
											)}
										</span>
									)
								})}
							</div>
							<div className="mt-6 flex flex-wrap items-center gap-2">
								<span className="inline-flex h-12 items-center gap-2.5 rounded-lg bg-white pl-2 pr-5 text-base font-bold text-black shadow-lg shadow-black/40">
									<img
										src={logoUrl(mine(hero)[0])}
										alt=""
										className="h-8 w-8 rounded-md"
									/>
									<PlayIcon className="h-5 w-5" aria-hidden />
									Watch on {SERVICES[mine(hero)[0]].name}
								</span>
								<span className="inline-flex h-12 items-center gap-2 rounded-lg bg-white/10 px-4 font-semibold text-white backdrop-blur">
									<CheckIcon className="h-5 w-5 text-green-400" aria-hidden />I
									watched it
								</span>
								<span className="inline-flex h-12 items-center rounded-lg px-4 font-semibold text-gray-300">
									Not tonight
								</span>
							</div>
						</div>
						{thens.length > 0 && (
							<div className="min-w-0" data-then>
								<p className="mb-2 text-sm font-semibold text-gray-300">Then</p>
								<ol className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none] md:mx-0 md:w-[20rem] md:flex-col md:overflow-visible md:px-0">
									{thens.map((title, i) => {
										const mark = marks.get(title.key)
										return (
											<li key={title.key} className="w-28 shrink-0 md:w-auto">
												<a
													href="#title"
													{...opens(ctx, title.key)}
													className="flex w-full flex-col gap-2 rounded-lg bg-black/50 p-1.5 text-left backdrop-blur-md hover:bg-black/70 md:flex-row md:items-center md:gap-3"
												>
													<span className="relative block shrink-0">
														<img
															src={tmdbImage(title.poster, "w185")}
															alt=""
															className="aspect-[2/3] w-full rounded-md object-cover md:h-24 md:w-16"
														/>
														<span
															className={`${DISPLAY} absolute -bottom-1 left-1 text-3xl text-white [text-shadow:0_2px_8px_#000]`}
															aria-hidden
														>
															{i + 2}
														</span>
														{mark && variant === "B" && (
															<StickerB
																mark={mark}
																small
																className="absolute -right-1.5 -top-1.5"
															/>
														)}
														{mark && variant === "D" && (
															<DotD
																mark={mark}
																className="absolute -right-1 -top-1"
															/>
														)}
													</span>
													<span className="min-w-0 flex-1">
														<span className="block truncate text-sm font-bold text-white">
															{title.title}
														</span>
														<span className="block truncate text-xs text-gray-400">
															<ThenLine title={title} mark={mark} ctx={ctx} />
														</span>
														<span className="hidden truncate text-xs text-gray-500 md:block">
															{runtimeWords(title.runtime ?? 0)}
														</span>
													</span>
												</a>
											</li>
										)
									})}
								</ol>
							</div>
						)}
					</div>
				</section>
			)}
			{grid.length > 0 && (
				<div className={`${WRAP} pt-8`}>
					<section aria-label="The rest of your movies">
						<header className="mb-6 md:grid md:grid-cols-[12rem_1fr] md:gap-8">
							<span className="hidden md:block" />
							<div>
								<h2 className={`${DISPLAY} text-2xl text-white md:text-3xl`}>
									After that
								</h2>
								<p className="mt-1 text-sm text-gray-400">
									{ctx.only
										? "The other movies that are new on your services, the latest first."
										: arrivedSort
											? "What arrived on your services first, the latest on top; then the rest by best match."
											: "The rest of your movies that fit, by best match. Each step further down gets smaller."}
								</p>
							</div>
						</header>
						<ol>
							<Tier
								name="Just arrived"
								note="New on your services."
								size="xl"
								titles={justArrived}
								ctx={ctx}
								sky
							/>
							<Tier
								name="Up next"
								size="xl"
								titles={steps.slice(0, 4)}
								ctx={ctx}
							/>
							<Tier
								name="Soon"
								size="lg"
								titles={steps.slice(4, 10)}
								ctx={ctx}
							/>
							<Tier name="Later" size="md" titles={steps.slice(10)} ctx={ctx} />
						</ol>
					</section>
				</div>
			)}
			{ctx.only && (
				<p className={`${WRAP} pt-6 text-sm text-gray-400`}>
					{landed.length} of {onMine.length} movies on your services.{" "}
					<button
						type="button"
						onClick={() => ctx.setOnly(false)}
						className="cursor-pointer font-bold text-gray-200 underline decoration-white/30 underline-offset-4"
					>
						Show all
					</button>
				</p>
			)}
		</div>
	)
}
