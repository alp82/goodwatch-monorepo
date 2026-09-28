// The desktop TV screens of the "Ask, then answer" flow (#187), drawn on the fixed 960 x 528 canvas. They render
// the TV flow's state and send its actions: hovering an item focuses it, clicking chooses it. No data fetching.
import { AnimatePresence, motion } from "framer-motion"
import type { CSSProperties, ReactNode } from "react"
import { MOODS, MOOD_BY_KEY, type MoodKey } from "~/domain/moods"
import gwLogo from "~/img/goodwatch-logo-white.svg"
import type { Score as RatingScore } from "~/server/scores.server"
import { runtimeLabel } from "~/ui/watch-next/labels"
import { offersOf, watchLine } from "~/ui/watch-next/services"
import { backdropUrl, logoUrl, posterUrl } from "~/ui/watch-next/style"
import { APP, ICON, Icon } from "./Remote"
import {
	type LivingRoomChoices,
	type LivingRoomData,
	type LivingRoomTitle,
	moodCounts,
	myServices,
	titleOf,
	titlesFor,
} from "./living-room-data"
import {
	MIN_ANSWERS_FOR_PICKS,
	type Night,
	TV_APPS,
	type TvAction,
	type TvApp,
	type TvScreen,
	type TvState,
	resolvedSource,
} from "./tv-flow"

export const EASE = [0.2, 0.7, 0.1, 1] as const

export type TvView = {
	state: TvState
	focused: string | null
	dispatch: (action: TvAction) => void
	data: LivingRoomData
	choices: LivingRoomChoices
	/** The on-screen keyboard's text. */
	draft: string
	setDraft: (update: (draft: string) => string) => void
	signInHref: string
	/** Rates a title from 1 to 10. The phone title screen offers it (#224); without it, no rating shows. */
	onRate?: (titleKey: string, score: RatingScore) => void
}

/** What the Remote's one-line screen says: the focused item, and what the wheel does. */
export function lcdLines(
	state: TvState,
	focused: string | null,
	data: LivingRoomData,
	draft: string,
): [string, string] {
	if (state.power === "off") return ["", ""]
	if (state.power === "booting") return ["Starting…", "GoodWatch"]
	if (state.screen.name === "search")
		return state.screen.query
			? [`"${state.screen.query}"`, "Search again with the Search key"]
			: [draft || "Search", "Type, then OK to search"]
	return [
		(focused && itemLabel(focused, state.screen, data)) || "GoodWatch",
		"Turn to choose, OK to open",
	]
}

function itemLabel(
	item: string,
	screen: TvScreen,
	data: LivingRoomData,
): string {
	const [kind, ...rest] = item.split(":")
	const arg = rest.join(":")
	switch (kind) {
		case "title":
			return titleOf(data, arg)?.title ?? "Title"
		case "app":
			return APP[arg as TvApp].name
		case "mood":
			return arg === "any" ? "Any mood" : MOOD_BY_KEY[arg as MoodKey].name
		case "service":
			return arg
		case "answer":
			return arg === "a" ? "This one" : arg === "b" ? "That one" : "Skip"
		case "source":
			return arg === "wishlist" ? "From my Wishlist" : "Something new"
		case "full-page":
			return screen.name === "app" && screen.app === "watch-now"
				? "Create a free account"
				: "Open full page"
		default:
			return (
				(
					{
						"find-my-tonight": "Find my tonight",
						"just-show-me": "Just show me",
						about: "What is GoodWatch?",
						continue: "Continue",
						"show-picks": "Show my picks",
						moods: "Pick a mood",
						"switch-source": "Switch source",
						services: "Make it mine",
						"this-or-that": "Refine my picks",
						watch: "Watch",
						"want-to-see": "Want to See",
						seen: "Seen it",
						"not-for-me": "Not for me",
					} as Record<string, string>
				)[kind] ?? ""
			)
	}
}

// ---------------------------------------------------------------------------------------------------------

export function TvScreens({ view }: { view: TvView }) {
	const { state } = view
	const s = state.screen
	const key =
		s.name === "title"
			? `title-${s.title}`
			: s.name === "app"
				? `app-${s.app}`
				: s.name === "search"
					? `search-${s.query ?? ""}`
					: s.name
	if (state.power === "off")
		return <div className="absolute inset-0 bg-black" aria-hidden />
	return (
		<div className="tv-power-on absolute inset-0 overflow-hidden bg-[#07080b] text-white">
			{state.power === "booting" ? (
				<Boot />
			) : (
				<>
					<AnimatePresence initial={false}>
						<motion.div
							key={key}
							className="absolute inset-0"
							initial={{ opacity: 0, scale: 1.015 }}
							animate={{ opacity: 1, scale: 1 }}
							exit={{ opacity: 0 }}
							transition={{ duration: 0.26, ease: EASE }}
						>
							<Screen view={view} />
						</motion.div>
					</AnimatePresence>
					<Bar view={view} />
				</>
			)}
		</div>
	)
}

function Screen({ view }: { view: TvView }) {
	const s = view.state.screen
	switch (s.name) {
		case "home":
			return view.data.member ? (
				<Moods view={view} night={null} home />
			) : (
				<Welcome view={view} />
			)
		case "about":
			return <About view={view} />
		case "services":
			return <Services view={view} />
		case "this-or-that":
			return <ThisOrThat view={view} />
		case "moods":
			return <Moods view={view} night={s.night} home={false} />
		case "source":
			return <Source view={view} night={s.night} />
		case "picks":
			return <Picks view={view} night={s.night} />
		case "title":
			return <TitleScreen view={view} titleKey={s.title} />
		case "app":
			return <AppScreen view={view} app={s.app} />
		case "search":
			return s.query ? (
				<SearchResults view={view} query={s.query} />
			) : (
				<Keyboard view={view} />
			)
	}
}

export function Boot() {
	return (
		<div className="absolute inset-0 flex flex-col items-center justify-center bg-black">
			<motion.img
				src={gwLogo}
				alt=""
				className="h-16"
				initial={{ scale: 0.7, opacity: 0 }}
				animate={{ scale: 1, opacity: 1 }}
				transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
			/>
			<motion.div
				className="mt-5 text-[26px] font-bold tracking-[0.35em] text-white/90"
				initial={{ opacity: 0 }}
				animate={{ opacity: 1 }}
				transition={{ delay: 0.6, duration: 0.5 }}
			>
				GOODWATCH
			</motion.div>
		</div>
	)
}

// A focusable thing on the TV: pointing at it focuses it, the wheel moves the focus, OK or a click chooses it.
export function Item({
	view,
	id,
	className = "",
	on = "ring-amber-300 bg-white/[0.10]",
	off = "ring-white/5 bg-white/[0.04]",
	grow = "scale-[1.04]",
	children,
}: {
	view: TvView
	id: string
	className?: string
	on?: string
	off?: string
	grow?: string
	children: ReactNode
}) {
	const focused = view.focused === id
	return (
		<button
			type="button"
			data-tv-item={id}
			aria-current={focused || undefined}
			onMouseEnter={() => view.dispatch({ type: "focus", item: id })}
			onClick={() => view.dispatch({ type: "choose", item: id })}
			className={`relative text-left ring-2 transition-[transform,background-color,box-shadow] duration-200 ${focused ? `${on} ${grow}` : off} ${className}`}
		>
			{children}
		</button>
	)
}

function Head({
	title,
	line,
	eyebrow,
}: { title: string; line?: ReactNode; eyebrow?: string }) {
	return (
		<div className="absolute left-12 right-44 top-9">
			{eyebrow && (
				<div className="mb-1 text-[12px] font-bold uppercase tracking-[0.25em] text-amber-300/80">
					{eyebrow}
				</div>
			)}
			<div className="text-[34px] font-extrabold leading-none tracking-tight">
				{title}
			</div>
			{line && <div className="mt-2 text-[15px] text-white/60">{line}</div>}
		</div>
	)
}

export function Backdrop({
	title,
	dim,
}: { title: LivingRoomTitle | null | undefined; dim: number }) {
	if (!title?.backdrop_path) return null
	return (
		<img
			src={backdropUrl(title.backdrop_path, "w780")}
			alt=""
			className="absolute inset-0 h-full w-full object-cover"
			style={{ opacity: dim }}
		/>
	)
}

export function Score({
	title,
	size = "md",
}: { title: LivingRoomTitle; size?: "md" | "lg" }) {
	const score = title.goodwatch_overall_score_normalized_percent
	if (score == null) return null
	return (
		<span
			className={`inline-flex items-center gap-1 rounded-md bg-black/60 font-black tabular-nums text-white ring-1 ring-white/15 ${size === "lg" ? "px-2.5 py-1 text-[20px]" : "px-2 py-0.5 text-[15px]"}`}
			title="GoodWatch score"
		>
			<img src={gwLogo} alt="" className={size === "lg" ? "h-4" : "h-3"} />
			{Math.round(score)}
		</span>
	)
}

export function Match({
	title,
	className = "",
}: { title: LivingRoomTitle; className?: string }) {
	if (title.match == null) return null
	return (
		<span
			className={`rounded-full bg-gradient-to-b from-amber-400 to-amber-600 px-2 py-0.5 text-[13px] font-black tabular-nums text-black ring-2 ring-black/60 ${className}`}
			title="Taste match"
		>
			{title.match}
		</span>
	)
}

export function whereLine(view: TvView, title: LivingRoomTitle) {
	const mine = new Set(myServices(view.data, view.choices))
	const offers = offersOf(
		title,
		view.data.catalog.filter((s) => mine.has(s.name)),
	)
	return { offers, text: watchLine(offers) }
}

export function Poster({
	title,
	size,
	className,
	style,
}: {
	title: LivingRoomTitle
	size: string
	className: string
	style?: CSSProperties
}) {
	return title.poster_path ? (
		<img
			src={posterUrl(title.poster_path, size)}
			alt=""
			className={className}
			style={style}
		/>
	) : (
		<div className={`${className} bg-white/10`} style={style} />
	)
}

// ---------------------------------------------------------------------------------------------------------
// Home.

function Welcome({ view }: { view: TvView }) {
	const best = view.data.suggestions
	const cols = [
		{
			id: "find-my-tonight",
			label: "Find my tonight",
			line: "Three quick questions, then your picks.",
			art: <Fan titles={best.slice(3, 6)} heart />,
		},
		{
			id: "just-show-me",
			label: "Just show me",
			line: "The best rated, right now.",
			art: <Fan titles={best.slice(0, 3)} />,
		},
		{
			id: "about",
			label: "What is GoodWatch?",
			line: "One score, how it feels, where it streams.",
			art: (
				<div className="absolute inset-0 flex items-center justify-center bg-[radial-gradient(circle,rgba(34,197,94,0.22),transparent_65%)]">
					<img src={gwLogo} alt="" className="h-20" />
				</div>
			),
		},
	]
	return (
		<>
			<Backdrop title={best[0]} dim={0.18} />
			<Head title="Let's find something good for tonight." />
			<div className="absolute inset-x-12 bottom-12 top-[120px] grid grid-cols-3 gap-6">
				{cols.map((c) => (
					<Item
						key={c.id}
						view={view}
						id={c.id}
						className="flex flex-col overflow-hidden rounded-3xl"
					>
						<div className="relative h-[200px] w-full">{c.art}</div>
						<div className="px-6 pt-2">
							<div className="text-[24px] font-extrabold leading-tight">
								{c.label}
							</div>
							<div className="mt-1 text-[15px] leading-snug text-white/60">
								{c.line}
							</div>
						</div>
					</Item>
				))}
			</div>
		</>
	)
}

/** Three posters fanned out; `size` is a poster's width in canvas pixels. */
export function Fan({
	titles,
	heart,
	size,
}: { titles: LivingRoomTitle[]; heart?: boolean; size?: number }) {
	return (
		<div className="absolute inset-0 flex items-center justify-center">
			{titles.slice(0, 3).map((t, i) => (
				<div
					key={t.key}
					className={`relative ${size ? "" : "-mx-3 first:mt-6 last:mt-6"}`}
					style={{
						...(size && {
							margin: `0 ${-size * 0.14}px`,
							marginTop: i === 1 ? 0 : size * 0.28,
						}),
						transform: `rotate(${(i - 1) * 7}deg)`,
						zIndex: i === 1 ? 2 : 1,
					}}
				>
					<Poster
						title={t}
						size="w185"
						className="h-[129px] w-[86px] rounded-lg object-cover shadow-xl ring-1 ring-white/10"
						style={size ? { width: size, height: size * 1.5 } : undefined}
					/>
					{heart && i === 1 && (
						<span className="absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-amber-400 text-[13px] text-black">
							♥
						</span>
					)}
				</div>
			))}
		</div>
	)
}

export function greeting() {
	const hour = new Date().getHours()
	return hour < 12
		? "Good morning."
		: hour < 18
			? "Good afternoon."
			: "Good evening."
}

// The moods. Members see how many fit on their Wishlist. On the member home, the apps sit underneath.
function Moods({
	view,
	night,
	home,
}: { view: TvView; night: Night | null; home: boolean }) {
	const counts = view.data.member ? moodCounts(view.data, view.choices) : null
	const current = night?.mood ?? null
	return (
		<>
			<div className="absolute inset-0 bg-[radial-gradient(110%_90%_at_30%_0%,#2b1706_0%,#08070a_62%)]" />
			<Head
				eyebrow={home ? greeting() : undefined}
				title="What kind of night?"
				line={
					counts
						? "Numbers are what fits on your Wishlist, on your services."
						: undefined
				}
			/>
			<div
				className={`absolute inset-x-12 grid grid-cols-4 gap-2.5 ${home ? "top-[128px]" : "top-[140px]"}`}
			>
				<Item
					view={view}
					id="mood:any"
					className="flex h-[60px] items-center gap-3 rounded-2xl px-4"
				>
					<span className="h-7 w-1.5 rounded-full bg-white/60" />
					<span className="text-[17px] font-bold">Any mood</span>
				</Item>
				{MOODS.map((m) => {
					const n = counts ? counts[m.key] : null
					return (
						<Item
							key={m.key}
							view={view}
							id={`mood:${m.key}`}
							className="flex h-[60px] items-center gap-3 rounded-2xl px-4"
						>
							<span
								className="h-7 w-1.5 shrink-0 rounded-full"
								style={{ background: m.hue }}
							/>
							<span
								className={`min-w-0 flex-1 truncate text-[17px] font-bold ${current === m.key ? "text-amber-200" : ""}`}
							>
								{m.name}
							</span>
							{n != null && (
								<span
									className={`text-[13px] tabular-nums ${n ? "text-white/60" : "text-white/25"}`}
								>
									{n}
								</span>
							)}
						</Item>
					)
				})}
			</div>
			{home && <OrOpen view={view} />}
		</>
	)
}

// Watch now, Taste, Discover, and Explorer as a thin row near the bottom of the member home.
function OrOpen({ view }: { view: TvView }) {
	return (
		<div className="absolute inset-x-12 bottom-8 flex items-center gap-3">
			<span className="mr-1 text-[12px] font-bold uppercase tracking-[0.2em] text-white/35">
				Or open
			</span>
			{TV_APPS.map((a) => (
				<Item
					key={a}
					view={view}
					id={`app:${a}`}
					className="flex h-10 items-center gap-2 rounded-full px-4 text-[14px] font-semibold"
					grow="scale-[1.06]"
				>
					<span style={{ color: APP[a].tint }}>
						<Icon d={APP[a].d} className="h-[18px] w-[18px]" />
					</span>
					{APP[a].name}
				</Item>
			))}
		</div>
	)
}

// ---------------------------------------------------------------------------------------------------------
// Find my tonight.

function About({ view }: { view: TvView }) {
	const best = view.data.suggestions[0]
	return (
		<>
			<Head
				title="What is GoodWatch?"
				line="Everything you need to decide, before you press play."
			/>
			<div className="absolute inset-x-12 top-[132px] grid grid-cols-3 gap-6">
				<Fact
					title="One score"
					line="IMDb, Rotten Tomatoes, and Metacritic in one number."
				>
					{best ? <Score title={best} size="lg" /> : null}
				</Fact>
				<Fact
					title="How it feels"
					line="Energy, heart, humor, and more, at a glance."
				>
					<div className="flex flex-wrap justify-center gap-1.5 px-5">
						{MOODS.slice(0, 6).map((m) => (
							<span
								key={m.key}
								className="rounded-full px-2.5 py-0.5 text-[12px] font-bold text-black"
								style={{ background: m.hue }}
							>
								{m.name}
							</span>
						))}
					</div>
				</Fact>
				<Fact
					title="Where it streams"
					line="Your services first, in your country."
				>
					<div className="grid grid-cols-3 gap-2 px-8">
						{view.data.catalog.slice(0, 6).map((c) => (
							<img
								key={c.name}
								src={logoUrl(c.logo_path)}
								alt=""
								className="aspect-square w-full rounded-xl"
							/>
						))}
					</div>
				</Fact>
			</div>
			<div className="absolute bottom-10 left-12 flex gap-3">
				<Item
					view={view}
					id="find-my-tonight"
					className="rounded-full px-6 py-3 text-[17px] font-bold"
					on="ring-amber-300 bg-amber-400 text-black"
					off="ring-transparent bg-amber-400/90 text-black"
				>
					Find my tonight
				</Item>
				<Item
					view={view}
					id="just-show-me"
					className="rounded-full px-6 py-3 text-[17px] font-semibold"
				>
					Just show me
				</Item>
			</div>
		</>
	)
}

function Fact({
	title,
	line,
	children,
}: { title: string; line: string; children: ReactNode }) {
	return (
		<div className="flex flex-col rounded-3xl bg-white/[0.04] ring-1 ring-white/5">
			<div className="flex h-[160px] items-center justify-center">
				{children}
			</div>
			<div className="px-5 pb-5">
				<div className="text-[21px] font-extrabold">{title}</div>
				<div className="mt-1 text-[14px] leading-snug text-white/60">
					{line}
				</div>
			</div>
		</div>
	)
}

function Services({ view }: { view: TvView }) {
	const mine = myServices(view.data, view.choices)
	return (
		<>
			<Head
				eyebrow="1 of 3"
				title="Where do you watch?"
				line="Pick every service you have. The streaming keys on the remote work too."
			/>
			<div className="absolute inset-x-12 top-[150px] grid grid-cols-4 gap-3">
				{view.data.catalog.map((c) => {
					const on = mine.includes(c.name)
					return (
						<Item
							key={c.name}
							view={view}
							id={`service:${c.name}`}
							className="flex h-[58px] items-center gap-3 rounded-2xl pr-3"
							off={
								on
									? "ring-green-500 bg-green-500/10"
									: "ring-white/5 bg-white/[0.04]"
							}
							on={
								on
									? "ring-green-400 bg-green-500/20"
									: "ring-amber-300 bg-white/[0.10]"
							}
						>
							<img
								src={logoUrl(c.logo_path)}
								alt=""
								className="h-[54px] w-[54px] rounded-[14px]"
							/>
							<span className="truncate text-[15px] font-semibold">
								{c.name}
							</span>
							{on && (
								<span className="absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-green-500 text-[13px] font-black text-black">
									✓
								</span>
							)}
						</Item>
					)
				})}
			</div>
			<div className="absolute bottom-10 left-12">
				<Item
					view={view}
					id="continue"
					className="rounded-full px-7 py-3 text-[17px] font-bold"
					on="ring-amber-300 bg-white text-black"
					off="ring-transparent bg-white/90 text-black"
				>
					{mine.length ? `Continue with ${mine.length}` : "Continue without"}
				</Item>
			</div>
		</>
	)
}

function Steps({ at, of }: { at: number; of: number }) {
	return (
		<div
			className="absolute right-12 top-[92px] flex items-center gap-2"
			aria-hidden
		>
			{Array.from({ length: of }, (_, i) => (
				<span
					// biome-ignore lint/suspicious/noArrayIndexKey: fixed-length progress dots
					key={i}
					className={`h-1.5 rounded-full ${i < at ? "w-6 bg-amber-400" : i === at ? "w-6 bg-white/60" : "w-3 bg-white/20"}`}
				/>
			))}
		</div>
	)
}

function ThisOrThat({ view }: { view: TvView }) {
	const { data, choices } = view
	const at = choices.answers.length
	const pair = data.pairs[at]
	const answered = choices.answers.filter((a) => a !== "skip").length
	if (!pair) return null
	const side = (key: number, s: "a" | "b", label: string) => {
		const t = titleOf(data, key)
		if (!t) return null
		return (
			<Item
				view={view}
				id={`answer:${s}`}
				className="flex w-[300px] items-center gap-4 rounded-3xl p-3"
				grow="scale-[1.05]"
			>
				<Poster
					title={t}
					size="w185"
					className="h-[210px] w-[140px] rounded-xl object-cover"
				/>
				<div className="min-w-0">
					<div className="text-[20px] font-extrabold leading-tight">
						{label}
					</div>
					<div className="mt-2 line-clamp-2 text-[14px] text-white/60">
						{t.title}{" "}
						{t.release_year && (
							<span className="text-white/35">({t.release_year})</span>
						)}
					</div>
				</div>
			</Item>
		)
	}
	return (
		<>
			<Backdrop title={titleOf(data, pair.a)} dim={0.12} />
			<Head
				eyebrow="2 of 3"
				title="Which one, tonight?"
				line="No need to have seen them. Go with your gut."
			/>
			<Steps at={at} of={data.pairs.length} />
			<div className="absolute inset-x-12 top-[142px] flex items-center justify-center gap-6">
				{side(pair.a, "a", pair.aLabel)}
				<span className="text-[22px] font-bold text-white/40">or</span>
				{side(pair.b, "b", pair.bLabel)}
			</div>
			<div className="absolute bottom-9 left-12 flex items-center gap-3">
				<Item
					view={view}
					id="answer:skip"
					className="rounded-full px-5 py-2.5 text-[15px] font-semibold"
				>
					Skip
				</Item>
				{answered >= MIN_ANSWERS_FOR_PICKS && (
					<Item
						view={view}
						id="show-picks"
						className="rounded-full px-6 py-2.5 text-[16px] font-bold"
						on="ring-amber-300 bg-amber-400 text-black"
						off="ring-transparent bg-amber-400/90 text-black"
					>
						♥ Show my picks
					</Item>
				)}
				<span className="text-[13px] text-white/40">
					{answered >= MIN_ANSWERS_FOR_PICKS
						? "Three are enough, six are better."
						: `${MIN_ANSWERS_FOR_PICKS - answered} more for your picks.`}
				</span>
			</div>
		</>
	)
}

function Source({ view, night }: { view: TvView; night: Night }) {
	const mood = night.mood ? MOOD_BY_KEY[night.mood as MoodKey]?.name : null
	const wish = titlesFor(
		{ ...night, source: "wishlist" },
		view.data,
		view.choices,
	)
	const fresh = titlesFor({ ...night, source: "new" }, view.data, view.choices)
	const card = (
		id: string,
		title: string,
		line: string,
		art: LivingRoomTitle[],
	) => (
		<Item
			view={view}
			id={id}
			className="flex h-[250px] flex-col justify-end overflow-hidden rounded-3xl p-6"
		>
			<span className="absolute -right-4 top-4 flex -space-x-10">
				{art.slice(0, 3).map((t, i) => (
					<span
						key={t.key}
						style={{ transform: `rotate(${(i - 1) * 6}deg)` }}
						className="block"
					>
						<Poster
							title={t}
							size="w185"
							className="h-[150px] w-[100px] rounded-lg object-cover shadow-2xl ring-1 ring-white/10"
						/>
					</span>
				))}
			</span>
			<span className="absolute inset-0 bg-gradient-to-r from-[#0b0c10] via-[#0b0c10]/80 to-transparent" />
			<span className="relative max-w-[62%]">
				<span className="block text-[28px] font-extrabold leading-none">
					{title}
				</span>
				<span className="mt-2 block text-[15px] text-white/60">{line}</span>
			</span>
		</Item>
	)
	return (
		<>
			<Head title={mood ? `${mood}. From where?` : "From where?"} />
			<div className="absolute inset-x-12 top-[120px] grid grid-cols-2 gap-6">
				{card(
					"source:wishlist",
					"From my Wishlist",
					wish.length
						? `${wish.length} fit, on your services, best match first.`
						: "Nothing on your Wishlist fits.",
					wish,
				)}
				{card(
					"source:new",
					"Something new",
					"Not seen yet, on your services, closest to your taste.",
					fresh,
				)}
			</div>
		</>
	)
}

// The answer: three picks, the first one big. Every pick opens its title screen.
function Picks({ view, night }: { view: TvView; night: Night }) {
	const { data, choices } = view
	const [first, ...rest] = titlesFor(night, data, choices).slice(0, 3)
	const mood = night.mood ? MOOD_BY_KEY[night.mood as MoodKey]?.name : null
	const source = resolvedSource(night, {
		member: data.member,
		wishlistKeys: data.wishlist.map((t) => String(t.key)),
	})
	const where = night.service
		? `only ${night.service}`
		: myServices(data, choices).length
			? "on your services"
			: "everywhere"
	const from =
		source === "wishlist"
			? "From your Wishlist"
			: data.member
				? "New to you"
				: choices.answers.length
					? "Closest to your answers"
					: "Best rated right now"
	const answered = choices.answers.filter((a) => a !== "skip").length
	return (
		<>
			<Backdrop title={first} dim={0.3} />
			<div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/60 to-black/20" />
			<Head
				title="Here's tonight."
				line={[from, mood, where].filter(Boolean).join(" · ")}
			/>
			{!first && (
				<div className="absolute left-12 top-[150px] text-[18px] text-white/60">
					Nothing fits. Try another mood, or everywhere.
				</div>
			)}
			<div className="absolute left-12 right-12 top-[124px] flex gap-5">
				{first && (
					<Item
						view={view}
						id={`title:${first.key}`}
						className="flex w-[430px] gap-4 rounded-3xl p-3"
						grow="scale-[1.03]"
					>
						<Poster
							title={first}
							size="w342"
							className="h-[240px] w-[160px] rounded-xl object-cover"
						/>
						<div className="min-w-0 py-1">
							<div className="line-clamp-2 text-[24px] font-extrabold leading-tight">
								{first.title}
							</div>
							<div className="mt-2 flex items-center gap-2">
								<Score title={first} />
								<Match title={first} />
							</div>
							<div className="mt-2 text-[13px] text-white/60">
								{[runtimeLabel(first), whereLine(view, first).text]
									.filter(Boolean)
									.join(" · ")}
							</div>
							{first.moods.length > 0 && (
								<div className="mt-2 line-clamp-3 text-[13px] text-amber-100/80">
									For you:{" "}
									{first.moods
										.slice(0, 2)
										.map((m) => MOOD_BY_KEY[m].name.toLowerCase())
										.join(" and ")}
									.
								</div>
							)}
						</div>
					</Item>
				)}
				{rest.map((t) => (
					<Item
						key={t.key}
						view={view}
						id={`title:${t.key}`}
						className="w-[150px] rounded-2xl p-2"
						grow="scale-[1.05]"
					>
						<Poster
							title={t}
							size="w185"
							className="h-[200px] w-full rounded-xl object-cover"
						/>
						<div className="mt-1.5 truncate text-[14px] font-bold">
							{t.title}
						</div>
						<div className="flex items-center gap-1.5 text-[12px] text-white/55">
							<Match title={t} className="!px-1.5 !text-[11px]" />
							<span className="truncate">{whereLine(view, t).text}</span>
						</div>
					</Item>
				))}
			</div>
			<div className="absolute bottom-9 left-12 flex items-center gap-2.5">
				<Item
					view={view}
					id="moods"
					className="rounded-full px-4 py-2 text-[14px] font-semibold"
				>
					{mood ? `Mood: ${mood}` : "Pick a mood"}
				</Item>
				{data.member ? (
					<Item
						view={view}
						id="switch-source"
						className="rounded-full px-4 py-2 text-[14px] font-semibold"
					>
						{source === "wishlist"
							? "Something new instead"
							: "From my Wishlist instead"}
					</Item>
				) : (
					<Item
						view={view}
						id={answered ? "this-or-that" : "services"}
						className="rounded-full px-4 py-2 text-[14px] font-bold text-amber-200"
						on="ring-amber-300 bg-amber-400/20"
						off="ring-amber-300/30 bg-amber-400/10"
					>
						{answered
							? "♥ Refine my picks"
							: "♥ Make it mine: 3 quick questions"}
					</Item>
				)}
			</div>
		</>
	)
}

// ---------------------------------------------------------------------------------------------------------
// A title and the apps.

function TitleScreen({ view, titleKey }: { view: TvView; titleKey: string }) {
	const t = titleOf(view.data, titleKey)
	if (!t)
		return (
			<Head
				title="This title isn't on the TV right now."
				line="Press Back to return."
			/>
		)
	const { offers, text } = whereLine(view, t)
	const first = offers?.[0]
	return (
		<>
			<Backdrop title={t} dim={0.5} />
			<div className="absolute inset-0 bg-gradient-to-r from-black via-black/75 to-transparent" />
			<div className="absolute left-12 top-10 flex gap-7">
				<Poster
					title={t}
					size="w342"
					className="h-[300px] w-[200px] rounded-2xl object-cover shadow-2xl ring-1 ring-white/10"
				/>
				<div className="w-[500px] pt-1">
					<h2 className="line-clamp-2 text-[34px] font-extrabold leading-none">
						{t.title}
					</h2>
					<div className="mt-2 text-[14px] text-white/55">
						{[t.release_year, runtimeLabel(t), text]
							.filter(Boolean)
							.join(" · ")}
					</div>
					<div className="mt-3 flex items-center gap-3">
						<Score title={t} size="lg" />
						{t.match != null && (
							<span className="flex items-center gap-2 text-[14px] text-white/70">
								<Match title={t} /> taste match
							</span>
						)}
					</div>
					{t.tagline && (
						<div className="mt-3 line-clamp-3 text-[15px] leading-snug text-white/65">
							{t.tagline}
						</div>
					)}
				</div>
			</div>
			<div className="absolute bottom-9 left-12 flex items-center gap-2.5">
				<Item
					view={view}
					id="watch"
					className="flex items-center gap-2 rounded-full px-5 py-2.5 text-[15px] font-bold"
					on="ring-amber-300 bg-white text-black"
					off="ring-transparent bg-white/90 text-black"
				>
					{first && (
						<img
							src={logoUrl(first.logo_path)}
							alt=""
							className="h-6 w-6 rounded-md"
						/>
					)}
					{first?.owned
						? `Watch on ${first.name}`
						: first
							? `On ${first.name}`
							: "Not streaming"}
				</Item>
				<Item
					view={view}
					id="want-to-see"
					className="rounded-full px-4 py-2.5 text-[15px] font-semibold"
				>
					{t.wantToSee ? "✓ On Wishlist" : "Want to See"}
				</Item>
				<Item
					view={view}
					id="seen"
					className="rounded-full px-4 py-2.5 text-[15px] font-semibold"
				>
					Seen it
				</Item>
				<Item
					view={view}
					id="not-for-me"
					className="rounded-full px-4 py-2.5 text-[15px] font-semibold"
				>
					Not for me
				</Item>
				<Item
					view={view}
					id="full-page"
					className="rounded-full px-4 py-2.5 text-[15px] font-semibold text-white/80"
				>
					Full page ↗
				</Item>
			</div>
		</>
	)
}

// The apps open on the TV as a glimpse; the full page is one step further, through the TV.
function AppScreen({ view, app }: { view: TvView; app: TvApp }) {
	const { data } = view
	const a = APP[app]
	const guest = !data.member && app === "watch-now"
	const line =
		app === "watch-now" && data.member
			? `${data.wishlist.length} on your Wishlist, best match first.`
			: a.line
	return (
		<>
			<div
				className="absolute inset-0"
				style={{
					background: `radial-gradient(90% 80% at 20% 0%, ${a.tint}33 0%, #07080b 60%)`,
				}}
			/>
			<div className="absolute left-12 top-9 flex items-center gap-3">
				<span style={{ color: a.tint }}>
					<Icon d={a.d} className="h-8 w-8" />
				</span>
				<div>
					<div className="text-[34px] font-extrabold leading-none">
						{a.name}
					</div>
					<div className="mt-1 text-[14px] text-white/60">{line}</div>
				</div>
			</div>
			{guest ? (
				<SignUpCard view={view} />
			) : (
				<>
					<AppGlimpse view={view} app={app} />
					<div className="absolute bottom-9 left-12">
						<Item
							view={view}
							id="full-page"
							className="rounded-full px-6 py-3 text-[16px] font-bold"
							on="ring-amber-300 bg-white text-black"
							off="ring-transparent bg-white/90 text-black"
						>
							Open {a.name} ↗
						</Item>
					</div>
				</>
			)}
		</>
	)
}

// Guests pressing Watch now: the sign-up card. Its focusable key is the flow's `full-page` item, which the page
// sends to sign-up instead of the Watch now page.
function SignUpCard({ view }: { view: TvView }) {
	return (
		<div className="absolute left-12 top-[140px] w-[560px]">
			<div className="text-[18px] leading-snug text-white/75">
				With a free account, the TV opens on the best match from your Wishlist
				that you can play tonight, and keeps what you've seen out of the way.
			</div>
			<div className="mt-6 flex items-center gap-3">
				<Item
					view={view}
					id="full-page"
					className="rounded-full px-6 py-3 text-[16px] font-bold"
					on="ring-amber-300 bg-white text-black"
					off="ring-transparent bg-white/90 text-black"
				>
					Create a free account
				</Item>
				<a
					href={view.signInHref}
					className="rounded-full px-5 py-3 text-[16px] font-semibold ring-1 ring-white/20 hover:bg-white/10"
				>
					Sign in
				</a>
			</div>
		</div>
	)
}

function AppGlimpse({ view, app }: { view: TvView; app: TvApp }) {
	const { data } = view
	if (app === "watch-now")
		return (
			<div className="absolute inset-x-12 top-[132px] flex gap-3">
				{data.wishlist.slice(0, 6).map((t) => (
					<Item
						key={t.key}
						view={view}
						id={`title:${t.key}`}
						className="w-[128px] rounded-2xl p-1.5"
						grow="scale-[1.06]"
					>
						<Poster
							title={t}
							size="w185"
							className="h-[180px] w-full rounded-xl object-cover"
						/>
						<div className="mt-1 truncate text-[13px] font-bold">{t.title}</div>
						<div className="truncate text-[11px] text-white/50">
							{whereLine(view, t).text}
						</div>
					</Item>
				))}
				{!data.wishlist.length && (
					<div className="text-[18px] text-white/60">
						Your Wishlist is empty. Want to See adds a title here.
					</div>
				)}
			</div>
		)
	if (app === "taste") {
		const moods = [...new Set(data.wishlist.flatMap((t) => t.moods))].slice(
			0,
			6,
		)
		return (
			<div className="absolute inset-x-12 top-[130px]">
				<div className="text-[20px] text-white/70">
					{data.member
						? "Your taste, from what you've rated and saved."
						: "Answer a few this-or-thats and watch your taste take shape."}
				</div>
				<div className="mt-3 flex flex-wrap gap-2">
					{moods.map((m) => (
						<span
							key={m}
							className="rounded-full px-3 py-1 text-[13px] font-bold text-black"
							style={{ background: MOOD_BY_KEY[m].hue }}
						>
							{MOOD_BY_KEY[m].name}
						</span>
					))}
				</div>
			</div>
		)
	}
	if (app === "discover")
		return (
			<div className="absolute inset-x-12 top-[132px] grid grid-cols-8 gap-2.5">
				{data.suggestions.slice(0, 16).map((t) => (
					<div key={t.key} className="relative">
						<Poster
							title={t}
							size="w154"
							className="aspect-[2/3] w-full rounded-lg object-cover"
						/>
						<Match
							title={t}
							className="absolute bottom-1 right-1 !px-1.5 !text-[10px]"
						/>
					</div>
				))}
			</div>
		)
	// Explorer: islands of moods, a few posters each.
	const islands = MOODS.slice(0, 6).map((m) => ({
		m,
		titles: data.suggestions.filter((t) => t.moods.includes(m.key)).slice(0, 3),
	}))
	return (
		<div className="absolute inset-x-12 top-[128px] grid grid-cols-3 gap-4">
			{islands.map(({ m, titles }) => (
				<div
					key={m.key}
					className="flex items-center gap-3 rounded-[40px] px-4 py-3"
					style={{
						background: `${m.hue}1f`,
						boxShadow: `inset 0 0 0 1px ${m.hue}40`,
					}}
				>
					<div className="flex -space-x-4">
						{titles.map((t) => (
							<Poster
								key={t.key}
								title={t}
								size="w92"
								className="h-[66px] w-[44px] rounded-md object-cover ring-2 ring-black/60"
							/>
						))}
					</div>
					<span className="text-[15px] font-bold" style={{ color: m.hue }}>
						{m.name}
					</span>
				</div>
			))}
		</div>
	)
}

// ---------------------------------------------------------------------------------------------------------
// Search: the on-screen keyboard without a query, the results with one.

export const KEY_ROWS = ["qwertyuiop", "asdfghjkl", "zxcvbnm"]
export const SEARCH_PRESETS = [
	"cozy mystery",
	"space adventure",
	"feel-good comedy",
	"mind-bending thriller",
	"true story",
	"animated for adults",
]

function Keyboard({ view }: { view: TvView }) {
	const { draft, setDraft, dispatch } = view
	const key = (label: string, run: () => void, className: string) => (
		<button
			key={label}
			type="button"
			onClick={run}
			className={`h-12 rounded-xl text-[20px] font-semibold uppercase ring-1 ring-white/10 transition-colors hover:bg-white/20 ${className}`}
		>
			{label}
		</button>
	)
	return (
		<div className="absolute inset-0 bg-[radial-gradient(100%_80%_at_50%_0%,#0b2a28_0%,#05080a_60%)]">
			<div className="absolute left-12 right-44 top-[84px] flex h-[60px] items-center gap-4 rounded-2xl bg-white/[0.07] px-6 ring-1 ring-white/15">
				<Icon d={ICON.search} className="h-6 w-6 shrink-0 text-teal-300" />
				<span className="truncate text-[24px] font-medium">
					{draft || (
						<span className="text-white/35">
							What do you feel like watching?
						</span>
					)}
					<span className="ml-0.5 inline-block h-6 w-[3px] translate-y-1 bg-teal-300" />
				</span>
			</div>
			<div className="absolute left-12 right-12 top-[160px] grid grid-cols-3 gap-3">
				{SEARCH_PRESETS.map((q) => (
					<button
						key={q}
						type="button"
						onClick={() => dispatch({ type: "submit-search", query: q })}
						className="truncate rounded-xl bg-teal-400/10 px-4 py-2.5 text-left text-[15px] text-teal-100 ring-1 ring-teal-300/25 hover:bg-teal-400/20"
					>
						{q}
					</button>
				))}
			</div>
			<div className="absolute bottom-8 left-12 right-12 flex flex-col items-center gap-2.5">
				{KEY_ROWS.map((row) => (
					<div key={row} className="flex gap-2.5">
						{[...row].map((c) =>
							key(
								c,
								() => setDraft((d) => (d + c).slice(0, 120)),
								"w-[64px] bg-white/[0.08]",
							),
						)}
					</div>
				))}
				<div className="flex gap-2.5">
					{key(
						"Delete",
						() => setDraft((d) => d.slice(0, -1)),
						"w-[130px] bg-white/[0.08] !text-[15px] !normal-case",
					)}
					{key(
						"Space",
						() => setDraft((d) => `${d} `.slice(0, 120)),
						"w-[330px] bg-white/[0.08] !text-[15px] !normal-case",
					)}
					{key(
						"Search",
						() => dispatch({ type: "submit-search", query: draft }),
						"w-[130px] bg-teal-400 !text-[15px] !normal-case font-bold text-black hover:bg-teal-300",
					)}
				</div>
			</div>
		</div>
	)
}

/** Interim: matches among the titles already on the TV. The search itself arrives with #231. */
export function searchHits(
	data: LivingRoomData,
	query: string,
): LivingRoomTitle[] {
	const q = query.toLowerCase()
	const seen = new Set<number>()
	return [...data.wishlist, ...data.suggestions].filter((t) => {
		if (seen.has(t.key) || !t.title.toLowerCase().includes(q)) return false
		seen.add(t.key)
		return true
	})
}

function SearchResults({ view, query }: { view: TvView; query: string }) {
	const hits = searchHits(view.data, query)
	return (
		<>
			<Head
				title={`"${query}"`}
				line={
					hits.length
						? `${hits.length} on the TV right now`
						: "Nothing on the TV matches yet."
				}
			/>
			<div className="absolute inset-x-12 top-[132px] grid grid-cols-6 gap-3">
				{hits.slice(0, 12).map((t) => (
					<div key={t.key}>
						<Poster
							title={t}
							size="w185"
							className="aspect-[2/3] w-full rounded-xl object-cover"
						/>
						<div className="mt-1 truncate text-[13px] font-bold">{t.title}</div>
					</div>
				))}
			</div>
		</>
	)
}

// ---------------------------------------------------------------------------------------------------------
// The on-screen bar: Back and Home away from home, Search, and a More menu that mirrors the remote's well.

function Bar({ view }: { view: TvView }) {
	const { state, dispatch } = view
	const atHome = state.screen.name === "home"
	const btn = (label: string, d: string, action: TvAction, on?: boolean) => (
		<button
			type="button"
			aria-label={label}
			title={label}
			onClick={() => dispatch(action)}
			className={`flex h-9 w-9 items-center justify-center rounded-full ${on ? "bg-white/90 text-black" : "bg-black/45 text-white/85 ring-1 ring-white/10 hover:bg-black/70"}`}
		>
			<Icon d={d} className="h-[18px] w-[18px]" />
		</button>
	)
	const item = (label: string, d: string, action: TvAction, tint?: string) => (
		<button
			key={label}
			type="button"
			onClick={() => dispatch(action)}
			className="flex items-center gap-3 rounded-xl px-3 py-2 text-left text-[15px] font-medium text-white/90 hover:bg-white/10"
		>
			<span style={tint ? { color: tint } : undefined}>
				<Icon d={d} className="h-[18px] w-[18px] opacity-80" />
			</span>
			{label}
		</button>
	)
	return (
		<div className="absolute right-6 top-5 z-20 flex flex-col items-end gap-2">
			<div className="flex items-center gap-2">
				{!atHome && btn("Back", ICON.back, { type: "back" })}
				{!atHome && btn("Home", ICON.home, { type: "home" })}
				{btn(
					"Search",
					ICON.search,
					{ type: "open-search" },
					state.screen.name === "search",
				)}
				{btn("More", ICON.more, { type: "toggle-menu" }, state.menuOpen)}
			</div>
			<AnimatePresence>
				{state.menuOpen && (
					<motion.div
						className="flex w-[220px] flex-col gap-0.5 rounded-2xl bg-[#0c0e12]/95 p-2 ring-1 ring-white/10"
						initial={{ opacity: 0, y: -6 }}
						animate={{ opacity: 1, y: 0 }}
						exit={{ opacity: 0, y: -6 }}
						transition={{ duration: 0.15 }}
					>
						{item("Mood", ICON.mood, { type: "open-moods" }, "#fbbf24")}
						{TV_APPS.map((a) =>
							item(
								APP[a].name,
								APP[a].d,
								{ type: "open-app", app: a },
								APP[a].tint,
							),
						)}
						{item(
							"Pick for me",
							ICON.pickForMe,
							{ type: "pick-for-me" },
							"#fb923c",
						)}
						<div className="mx-2 my-1 h-px bg-white/10" />
						{item("Turn off", ICON.power, { type: "power", on: false })}
					</motion.div>
				)}
			</AnimatePresence>
		</div>
	)
}
