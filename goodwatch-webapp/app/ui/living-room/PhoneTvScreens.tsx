// The phone edition of the TV screens (#224, `type-scale-rows`), drawn on the 560 x 308 canvas. On a phone the TV
// is 320 to 450 px wide, so the desktop canvas would print at about 5 px. This edition keeps every element of the
// home screens with type scaled up (18 px minimum on the canvas, about 11 px on a 390 px wide phone). The TV flow,
// its item ids, and its actions are the same as the desktop's; only the drawing changes. Title screens also take
// a rating: the taste quiz's four levels over a 1 to 10 strip (#220).
import { AnimatePresence, motion } from "framer-motion"
import { type ReactNode, createContext, useContext, useState } from "react"
import { MOODS, MOOD_BY_KEY, type MoodKey } from "~/domain/moods"
import type { Score as RatingScore } from "~/server/scores.server"
import { RATING_LEVELS, levelOf } from "~/ui/taste-quiz/quiz-flow"
import { runtimeLabel } from "~/ui/watch-next/labels"
import { logoUrl } from "~/ui/watch-next/style"
import { getVibeColorValue, scoreLabels } from "~/utils/ratings"
import { ICON, Icon } from "./Remote"
import { TvQuiz } from "./TvQuiz"
import {
	Backdrop,
	Boot,
	EASE,
	Fan,
	Item,
	KEY_ROWS,
	Match,
	MenuItem,
	Poster,
	SEARCH_PRESETS,
	Score,
	type TvView,
	memberTiles,
	searchHits,
	whereLine,
} from "./TvScreens"
import {
	moodCounts,
	myServices,
	sourceFor,
	titleOf,
	titlesFor,
} from "./living-room-data"
import {
	MENU_ITEMS,
	MIN_ANSWERS_FOR_PICKS,
	type Night,
	type TvAction,
} from "./tv-flow"

// True for the copy drawn inside the desktop scene before the window is measured: the desktop edition's
// headline is then the page's one H1, and both editions share the cached guest HTML (#233).
const DuplicateEdition = createContext(false)

export function PhoneTvScreens({
	view,
	duplicate = false,
}: {
	view: TvView
	/** The pre-measure copy next to the desktop edition; its guest headline is not an H1. */
	duplicate?: boolean
}) {
	return (
		<DuplicateEdition.Provider value={duplicate}>
			<PhoneTvScreen view={view} />
		</DuplicateEdition.Provider>
	)
}

function PhoneTvScreen({ view }: { view: TvView }) {
	const { state } = view
	const s = state.screen
	const key =
		s.name === "title"
			? `title-${s.title}`
			: s.name === "search"
				? `search-${s.query ?? ""}`
				: s.name === "quiz"
					? `quiz-${s.quiz.screen}`
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
				<MemberHome view={view} />
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
			return <Moods view={view} night={s.night} />
		case "picks":
			return <Picks view={view} night={s.night} />
		case "title":
			return <TitleScreen view={view} titleKey={s.title} />
		case "search":
			return s.query ? (
				<SearchResults view={view} query={s.query} />
			) : (
				<Keyboard view={view} />
			)
		case "quiz":
			return <TvQuiz view={view} quiz={s.quiz} phone />
	}
}

// ---------------------------------------------------------------------------------------------------------
// Shared bits. A 4 px focus ring (about 2.6 px on a 390 px phone).

function PItem(props: Parameters<typeof Item>[0]) {
	return (
		<Item
			grow="scale-[1.03]"
			{...props}
			className={`!ring-4 ${props.className ?? ""}`}
		/>
	)
}

function Pill({
	view,
	id,
	primary,
	className = "",
	children,
}: {
	view: TvView
	id: string
	primary?: boolean
	className?: string
	children: ReactNode
}) {
	return primary ? (
		<PItem
			view={view}
			id={id}
			className={`shrink-0 rounded-full px-4 py-1.5 text-[18px] font-bold ${className}`}
			on="ring-amber-300 bg-amber-400 text-black"
			off="ring-transparent bg-amber-400/90 text-black"
		>
			{children}
		</PItem>
	) : (
		<PItem
			view={view}
			id={id}
			className={`shrink-0 rounded-full px-4 py-1.5 text-[18px] font-semibold ${className}`}
		>
			{children}
		</PItem>
	)
}

// The header on the left; the bar owns the top right (two keys at home, four elsewhere).
function Head({
	view,
	title,
	line,
	eyebrow,
	as = "h2",
}: {
	view: TvView
	title: string
	line?: ReactNode
	eyebrow?: string
	/** The guest home's headline is the page's H1 (#233), except in the duplicate edition. */
	as?: "h1" | "h2"
}) {
	const Title = useContext(DuplicateEdition) ? "h2" : as
	const atHome = view.state.screen.name === "home"
	return (
		<div
			className="absolute left-5 top-3"
			style={{ right: atHome ? 110 : 206 }}
		>
			<div className="flex items-baseline gap-2.5">
				{eyebrow && (
					<span className="shrink-0 text-[18px] font-bold text-amber-300/90">
						{eyebrow}
					</span>
				)}
				<Title className="truncate text-[26px] font-extrabold leading-tight tracking-tight">
					{title}
				</Title>
			</div>
			{line && (
				<div className="truncate text-[18px] leading-snug text-white/60">
					{line}
				</div>
			)}
		</div>
	)
}

// ---------------------------------------------------------------------------------------------------------
// Home: a selection. The guest Welcome is three full-width rows with the taste quiz taller in the middle; a
// member gets two tiles.

// Like the desktop edition, the same HTML for every guest (#233): only where a row leads depends on the guest.
function Welcome({ view }: { view: TvView }) {
	const best = view.data.suggestions
	const side = (id: string, label: string, line: string, art: ReactNode) => (
		<PItem
			view={view}
			id={id}
			className="flex min-h-0 flex-1 items-center gap-3 overflow-hidden rounded-2xl pr-4"
			grow="scale-[1.02]"
		>
			<div className="relative h-full w-[120px] shrink-0">{art}</div>
			<div className="min-w-0">
				<div className="text-[20px] font-extrabold leading-tight">{label}</div>
				<div className="truncate text-[18px] leading-snug text-white/60">
					{line}
				</div>
			</div>
		</PItem>
	)
	return (
		<>
			<Backdrop title={best[0]} dim={0.18} />
			<Head view={view} as="h1" title="Something good tonight?" />
			<div className="absolute inset-x-5 bottom-3 top-[56px] flex flex-col gap-2">
				{side(
					"watch-next",
					"Watch next",
					"Picks for tonight, on your services.",
					<Fan titles={best.slice(3, 6)} heart size={30} />,
				)}
				<PItem
					view={view}
					id="taste-quiz"
					className="flex min-h-0 flex-[1.7] items-center gap-3 overflow-hidden rounded-2xl pr-4"
					on="ring-amber-300 bg-amber-400/[0.16]"
					off="ring-amber-300/40 bg-amber-400/[0.08]"
					grow="scale-[1.02]"
				>
					<div className="relative h-full w-[150px] shrink-0">
						<Fan titles={best.slice(0, 3)} size={50} />
					</div>
					<div className="min-w-0">
						<div className="text-[26px] font-extrabold leading-tight">
							Rate what you've seen
						</div>
						<div className="truncate text-[18px] leading-snug text-white/70">
							Rate a few, get picks made for you.
						</div>
					</div>
				</PItem>
				{side(
					"moods",
					"Pick a mood",
					"Funny, scary, mind-bending.",
					<div className="absolute inset-0 flex flex-wrap content-center justify-center gap-1 px-4">
						{MOODS.slice(0, 6).map((m) => (
							<span
								key={m.key}
								className="h-3 w-7 rounded-full"
								style={{ background: m.hue }}
							/>
						))}
					</div>,
				)}
			</div>
		</>
	)
}

function moodBackground() {
	return (
		<div className="absolute inset-0 bg-[radial-gradient(110%_90%_at_30%_0%,#2b1706_0%,#08070a_62%)]" />
	)
}

function MoodItem({
	view,
	mood,
	count,
	current,
	height,
}: {
	view: TvView
	mood: MoodKey | null
	count: number | null
	current: boolean
	height: number
}) {
	const m = mood ? MOOD_BY_KEY[mood] : null
	const id = `mood:${mood ?? "any"}`
	// The Wishlist count shows on the focused mood only: at 18 px a count on every item truncates the names.
	const n = view.focused === id ? count : null
	return (
		<PItem
			view={view}
			id={id}
			className="flex items-center gap-2 rounded-xl px-2.5"
			grow="scale-[1.04]"
		>
			<span
				className="w-1.5 shrink-0 rounded-full"
				style={{
					background: m?.hue ?? "rgba(255,255,255,0.6)",
					height: height * 0.6,
				}}
			/>
			<span
				className={`min-w-0 flex-1 truncate text-[18px] font-bold ${current ? "text-amber-200" : ""}`}
				style={{ lineHeight: `${height}px` }}
			>
				{m?.name ?? "Any mood"}
			</span>
			{n != null && (
				<span
					className={`text-[18px] tabular-nums ${n ? "text-white/60" : "text-white/30"}`}
				>
					{n}
				</span>
			)}
		</PItem>
	)
}

// Two tiles: Watch next (the Wishlist's best) and Something new.
function MemberHome({ view }: { view: TvView }) {
	return (
		<>
			{moodBackground()}
			<Head view={view} title="What are we watching?" />
			<div className="absolute inset-x-5 bottom-4 top-[58px] grid grid-cols-2 gap-4">
				{memberTiles(view).map((tile) => (
					<PItem
						key={tile.id}
						view={view}
						id={tile.id}
						className="flex flex-col justify-end overflow-hidden rounded-2xl p-4"
					>
						<span className="absolute -right-3 top-3 flex -space-x-7">
							{tile.art.slice(0, 3).map((t, i) => (
								<span
									key={t.key}
									className="block"
									style={{ transform: `rotate(${(i - 1) * 6}deg)` }}
								>
									<Poster
										title={t}
										size="w92"
										className="h-[108px] w-[72px] rounded-lg object-cover shadow-2xl ring-1 ring-white/10"
									/>
								</span>
							))}
						</span>
						<span className="absolute inset-0 bg-gradient-to-r from-[#0b0c10] via-[#0b0c10]/80 to-transparent" />
						<span className="relative">
							<span className="block text-[24px] font-extrabold leading-none">
								{tile.title}
							</span>
							<span className="mt-1 block text-[18px] text-white/60">
								{tile.short}
							</span>
						</span>
					</PItem>
				))}
			</div>
		</>
	)
}

// The eleven moods and Any mood last, three across.
function Moods({ view, night }: { view: TvView; night: Night }) {
	const counts = view.data.member ? moodCounts(view.data, view.choices) : null
	return (
		<>
			{moodBackground()}
			<Head view={view} title="What kind of night?" />
			<div className="absolute inset-x-5 top-[56px] grid grid-cols-3 gap-x-2 gap-y-2">
				{MOODS.map((m) => (
					<MoodItem
						key={m.key}
						view={view}
						mood={m.key}
						count={counts ? counts[m.key] : null}
						current={night.mood === m.key}
						height={50}
					/>
				))}
				<MoodItem
					view={view}
					mood={null}
					count={null}
					current={false}
					height={50}
				/>
			</div>
		</>
	)
}

// ---------------------------------------------------------------------------------------------------------
// What is GoodWatch?, and a guest's Watch next: services, then this or that.

function About({ view }: { view: TvView }) {
	const best = view.data.suggestions[0]
	const fact = (title: string, art: ReactNode) => (
		<div className="flex flex-col items-center rounded-2xl bg-white/[0.04] pb-2 ring-1 ring-white/5">
			<div className="flex h-[112px] items-center justify-center">{art}</div>
			<div className="text-center text-[18px] font-extrabold leading-tight">
				{title}
			</div>
		</div>
	)
	return (
		<>
			<Head view={view} title="What is GoodWatch?" />
			<div className="absolute inset-x-5 top-[58px] grid grid-cols-3 gap-3">
				{fact("One score", best ? <Score title={best} size="lg" /> : null)}
				{fact(
					"How it feels",
					<div className="flex flex-wrap justify-center gap-1 px-2">
						{MOODS.slice(0, 4).map((m) => (
							<span
								key={m.key}
								className="h-4 w-10 rounded-full"
								style={{ background: m.hue }}
							/>
						))}
					</div>,
				)}
				{fact(
					"Where it streams",
					<div className="grid grid-cols-3 gap-1">
						{view.data.catalog.slice(0, 6).map((c) => (
							<img
								key={c.name}
								src={logoUrl(c.logo_path)}
								alt=""
								className="h-9 w-9 rounded-md"
							/>
						))}
					</div>,
				)}
			</div>
			<div className="absolute bottom-3 left-5 flex gap-2.5">
				<Pill view={view} id="watch-next" primary>
					Watch next
				</Pill>
				<Pill view={view} id="just-show-me">
					Just show me
				</Pill>
			</div>
		</>
	)
}

// All twelve services at once, four by three.
function Services({ view }: { view: TvView }) {
	const mine = myServices(view.data, view.choices)
	return (
		<>
			<Head view={view} eyebrow="1 of 3" title="Where do you watch?" />
			<div className="absolute inset-x-5 top-[54px] grid grid-cols-4 gap-2">
				{view.data.catalog.slice(0, 12).map((c) => {
					const on = mine.includes(c.name)
					return (
						<PItem
							key={c.name}
							view={view}
							id={`service:${c.name}`}
							className="flex h-[48px] items-center gap-2 rounded-xl pr-2"
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
								className="h-[44px] w-[44px] shrink-0 rounded-[10px]"
							/>
							<span className="truncate text-[18px] font-semibold">
								{c.name}
							</span>
							{on && (
								<span className="absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-green-500 text-[14px] font-black text-black">
									✓
								</span>
							)}
						</PItem>
					)
				})}
			</div>
			<div className="absolute bottom-3 left-5">
				<PItem
					view={view}
					id="continue"
					className="rounded-full px-5 py-1.5 text-[18px] font-bold"
					on="ring-amber-300 bg-white text-black"
					off="ring-transparent bg-white/90 text-black"
				>
					{mine.length ? `Continue with ${mine.length}` : "Continue without"}
				</PItem>
			</div>
		</>
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
			<PItem
				view={view}
				id={`answer:${s}`}
				className="flex min-w-0 flex-1 items-center gap-2.5 rounded-2xl p-2"
				grow="scale-[1.04]"
			>
				<Poster
					title={t}
					size="w92"
					className="h-[138px] w-[92px] shrink-0 rounded-lg object-cover"
				/>
				<div className="min-w-0 text-[20px] font-extrabold leading-tight">
					{label}
				</div>
			</PItem>
		)
	}
	return (
		<>
			<Backdrop title={titleOf(data, pair.a)} dim={0.12} />
			<Head view={view} eyebrow="2 of 3" title="Which one, tonight?" />
			<div className="absolute inset-x-5 top-[56px] flex items-center gap-3">
				{side(pair.a, "a", pair.aLabel)}
				<span className="text-[18px] font-bold text-white/40">or</span>
				{side(pair.b, "b", pair.bLabel)}
			</div>
			<div className="absolute bottom-3 left-5 right-5 flex items-center gap-2.5">
				<Pill view={view} id="answer:skip">
					Skip
				</Pill>
				{answered >= MIN_ANSWERS_FOR_PICKS ? (
					<Pill view={view} id="show-picks" primary>
						♥ Show my picks
					</Pill>
				) : (
					<span className="truncate text-[18px] text-white/50">
						{MIN_ANSWERS_FOR_PICKS - answered} more for your picks
					</span>
				)}
				<span className="ml-auto flex items-center gap-1.5" aria-hidden>
					{data.pairs.map((p, i) => (
						<span
							key={`${p.a}-${p.b}`}
							className={`h-2 rounded-full ${i < at ? "w-5 bg-amber-400" : i === at ? "w-5 bg-white/60" : "w-2.5 bg-white/20"}`}
						/>
					))}
				</span>
			</div>
		</>
	)
}

// Tonight: one big pick and two posters.
function Picks({ view, night }: { view: TvView; night: Night }) {
	const { data, choices } = view
	const [first, ...rest] = titlesFor(night, data, choices).slice(0, 3)
	const mood = night.mood ? MOOD_BY_KEY[night.mood as MoodKey]?.name : null
	const source = sourceFor(night, data, choices)
	const from =
		source === "wishlist"
			? "From your Wishlist"
			: data.member
				? "New to you"
				: choices.answers.length
					? "For your answers"
					: "Best rated"
	const answered = choices.answers.filter((a) => a !== "skip").length
	return (
		<>
			<Backdrop title={first} dim={0.3} />
			<div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/60 to-black/20" />
			<Head
				view={view}
				title="Here's tonight."
				line={[from, mood, night.service].filter(Boolean).join(" · ")}
			/>
			{!first && (
				<div className="absolute left-5 top-[92px] text-[18px] text-white/60">
					Nothing fits. Try another mood, or everywhere.
				</div>
			)}
			<div className="absolute inset-x-5 top-[82px] flex items-start gap-2.5">
				{first && (
					<PItem
						view={view}
						id={`title:${first.key}`}
						className="flex min-w-0 flex-1 gap-2.5 rounded-2xl p-2"
					>
						<Poster
							title={first}
							size="w342"
							className="h-[144px] w-[96px] shrink-0 rounded-lg object-cover"
						/>
						<div className="min-w-0">
							<div className="line-clamp-2 text-[20px] font-extrabold leading-tight">
								{first.title}
							</div>
							<div className="mt-1.5 flex items-center gap-2">
								<Score title={first} />
								<Match title={first} className="!text-[18px]" />
							</div>
							<div className="mt-1.5 line-clamp-2 text-[18px] leading-tight text-white/60">
								{whereLine(view, first).text}
							</div>
						</div>
					</PItem>
				)}
				{rest.map((t) => (
					<PItem
						key={t.key}
						view={view}
						id={`title:${t.key}`}
						className="shrink-0 rounded-xl p-1"
						grow="scale-[1.05]"
					>
						<Poster
							title={t}
							size="w92"
							className="h-[118px] w-[79px] rounded-lg object-cover"
						/>
						<div className="w-[79px] truncate text-[18px] font-bold">
							{t.title}
						</div>
					</PItem>
				))}
			</div>
			<div className="absolute bottom-3 left-5 right-5 flex items-center gap-2">
				<Pill view={view} id="moods">
					{mood ? `Mood: ${mood}` : "Pick a mood"}
				</Pill>
				{data.member ? (
					<Pill view={view} id="switch-source">
						{source === "wishlist" ? "Something new" : "My Wishlist"}
					</Pill>
				) : (
					<PItem
						view={view}
						id={answered ? "this-or-that" : "services"}
						className="shrink-0 rounded-full px-4 py-1.5 text-[18px] font-bold text-amber-200"
						on="ring-amber-300 bg-amber-400/20"
						off="ring-amber-300/30 bg-amber-400/10"
					>
						{answered ? "♥ Refine" : "♥ Make it mine"}
					</PItem>
				)}
				<Pill view={view} id="full-page">
					{source === "wishlist" ? "All ↗" : "More ↗"}
				</Pill>
			</div>
		</>
	)
}

// ---------------------------------------------------------------------------------------------------------
// A title.

function TitleScreen({ view, titleKey }: { view: TvView; titleKey: string }) {
	const t = titleOf(view.data, titleKey)
	if (!t)
		return (
			<Head
				view={view}
				title="Not on the TV right now."
				line="Press Back to return."
			/>
		)
	const first = whereLine(view, t).offers?.[0]
	const left = 20 + 112 + 14
	return (
		<>
			<Backdrop title={t} dim={0.5} />
			<div className="absolute inset-0 bg-gradient-to-r from-black via-black/75 to-transparent" />
			<Poster
				title={t}
				size="w342"
				className="absolute left-5 top-4 h-[168px] w-[112px] rounded-xl object-cover shadow-2xl ring-1 ring-white/10"
			/>
			<div className="absolute right-5 top-3" style={{ left }}>
				<h2 className="mr-[186px] truncate text-[24px] font-extrabold leading-tight">
					{t.title}
				</h2>
				<div className="mt-3 flex items-center gap-2.5 text-[18px] text-white/55">
					<Score title={t} />
					<Match title={t} className="!text-[18px]" />
					<span className="truncate">
						{[t.release_year, runtimeLabel(t)].filter(Boolean).join(" · ")}
					</span>
				</div>
				{view.onRate && (
					<Rating
						key={t.key}
						onRate={(score) => view.onRate?.(String(t.key), score)}
					/>
				)}
			</div>
			<div
				className="absolute bottom-3 right-4 flex flex-wrap content-end items-center gap-2"
				style={{ left }}
			>
				<PItem
					view={view}
					id="watch"
					className="flex shrink-0 items-center gap-1.5 rounded-full px-4 py-1.5 text-[18px] font-bold"
					on="ring-amber-300 bg-white text-black"
					off="ring-transparent bg-white/90 text-black"
				>
					{first && (
						<img
							src={logoUrl(first.logo_path)}
							alt=""
							className="h-5 w-5 rounded"
						/>
					)}
					{first?.owned
						? "Watch"
						: first
							? `On ${first.name}`
							: "Not streaming"}
				</PItem>
				<Pill view={view} id="want-to-see">
					{t.wantToSee ? "✓ Wishlist" : "Want to See"}
				</Pill>
				<Pill view={view} id="seen">
					Seen it
				</Pill>
				<Pill view={view} id="not-for-me">
					Not for me
				</Pill>
				<Pill view={view} id="full-page">
					↗
				</Pill>
			</div>
		</>
	)
}

const SCORES = Array.from({ length: 10 }, (_, i) => (i + 1) as RatingScore)

// The taste quiz's `stack` rating, drawn for the TV: Dislike / Okay / Good / Excellent, each spanning its scores,
// over a 1 to 10 strip. A level stores its score (3, 5, 7, or 9), a number stores itself. Touch only: the D-pad
// walks the title's actions.
function Rating({ onRate }: { onRate: (score: RatingScore) => void }) {
	const [rated, setRated] = useState<RatingScore | null>(null)
	const rate = (score: RatingScore) => {
		setRated(score)
		onRate(score)
	}
	const level = rated == null ? null : levelOf(rated)
	return (
		<fieldset className="mt-2 grid grid-cols-10 gap-1">
			<legend className="sr-only">Your score</legend>
			{RATING_LEVELS.map((l, i) => (
				<button
					key={l.name}
					type="button"
					onClick={() => rate(l.score)}
					aria-label={`${l.name}, ${l.score}`}
					className={`flex h-[34px] items-center justify-center rounded-lg text-[18px] font-extrabold ring-2 ${level === i ? "bg-white/20 ring-amber-300" : "bg-white/[0.08] ring-transparent"}`}
					style={{ gridColumn: `span ${l.hi - l.lo + 1}` }}
				>
					{l.name}
				</button>
			))}
			{SCORES.map((score) => (
				<button
					key={score}
					type="button"
					onClick={() => rate(score)}
					aria-label={`${score}, ${scoreLabels[score]}`}
					className={`flex h-[22px] items-center justify-center rounded-md text-[18px] font-black leading-none tabular-nums ${rated === score ? "text-white ring-2 ring-amber-300" : "text-white/75"}`}
					style={{ background: `${getVibeColorValue(score)}55` }}
				>
					{score}
				</button>
			))}
		</fieldset>
	)
}

// ---------------------------------------------------------------------------------------------------------
// Search: the on-screen keyboard without a query, the results with one.

function Keyboard({ view }: { view: TvView }) {
	const { draft, setDraft, dispatch } = view
	const key = (label: string, run: () => void, className: string) => (
		<button
			key={label}
			type="button"
			onClick={run}
			className={`h-[32px] rounded-lg text-[20px] font-semibold uppercase leading-none ring-1 ring-white/10 ${className}`}
		>
			{label}
		</button>
	)
	return (
		<div className="absolute inset-0 bg-[radial-gradient(100%_80%_at_50%_0%,#0b2a28_0%,#05080a_60%)]">
			<div className="absolute left-5 right-[206px] top-3 flex h-[44px] items-center gap-2.5 rounded-xl bg-white/[0.07] px-3 ring-1 ring-white/15">
				<Icon d={ICON.search} className="h-5 w-5 shrink-0 text-teal-300" />
				<span className="truncate text-[20px] font-medium">
					{draft || <span className="text-white/35">Search</span>}
					<span className="ml-0.5 inline-block h-5 w-[3px] translate-y-1 bg-teal-300" />
				</span>
			</div>
			<div className="absolute inset-x-5 top-[66px] flex gap-2">
				{SEARCH_PRESETS.slice(0, 3).map((q) => (
					<button
						key={q}
						type="button"
						onClick={() => dispatch({ type: "submit-search", query: q })}
						className="min-w-0 flex-1 truncate rounded-lg bg-teal-400/10 px-2.5 py-1 text-left text-[18px] text-teal-100 ring-1 ring-teal-300/25"
					>
						{q}
					</button>
				))}
			</div>
			<div className="absolute bottom-3 inset-x-5 flex flex-col items-center gap-[5px]">
				{KEY_ROWS.map((row) => (
					<div key={row} className="flex gap-[5px]">
						{[...row].map((c) =>
							key(
								c,
								() => setDraft((d) => (d + c).slice(0, 120)),
								"w-[47px] bg-white/[0.08]",
							),
						)}
					</div>
				))}
				<div className="flex gap-[5px]">
					{key(
						"Delete",
						() => setDraft((d) => d.slice(0, -1)),
						"w-[110px] bg-white/[0.08] !text-[18px] !normal-case",
					)}
					{key(
						"Space",
						() => setDraft((d) => `${d} `.slice(0, 120)),
						"w-[230px] bg-white/[0.08] !text-[18px] !normal-case",
					)}
					{key(
						"Search",
						() => dispatch({ type: "submit-search", query: draft }),
						"w-[110px] bg-teal-400 !text-[18px] !normal-case font-bold text-black",
					)}
				</div>
			</div>
		</div>
	)
}

// Five posters with their titles, like Tonight's small posters.
function SearchResults({ view, query }: { view: TvView; query: string }) {
	const hits = searchHits(view.data, query)
	return (
		<>
			<Head
				view={view}
				title={`"${query}"`}
				line={
					hits.length
						? `${hits.length} on the TV right now`
						: "Nothing on the TV matches yet."
				}
			/>
			<div className="absolute inset-x-5 top-[84px] grid grid-cols-5 gap-2.5">
				{hits.slice(0, 5).map((t) => (
					<div key={t.key} className="min-w-0">
						<Poster
							title={t}
							size="w92"
							className="aspect-[2/3] w-full rounded-lg object-cover"
						/>
						<div className="mt-1 truncate text-[18px] font-bold">{t.title}</div>
					</div>
				))}
			</div>
		</>
	)
}

// ---------------------------------------------------------------------------------------------------------
// The on-screen bar, scaled up: Back and Home away from home, Search, and the menu in two columns.

function Bar({ view }: { view: TvView }) {
	const { state, dispatch } = view
	const atHome = state.screen.name === "home"
	const btn = (label: string, d: string, action: TvAction, on?: boolean) => (
		<button
			type="button"
			aria-label={label}
			onClick={() => dispatch(action)}
			className={`flex h-11 w-11 items-center justify-center rounded-full ${on ? "bg-white/90 text-black" : "bg-black/50 text-white/85 ring-1 ring-white/10"}`}
		>
			<Icon d={d} className="h-6 w-6" />
		</button>
	)
	return (
		<div className="absolute right-3 top-3 z-20 flex flex-col items-end gap-1.5">
			<div className="flex items-center gap-1.5">
				{!atHome && btn("Back", ICON.back, { type: "back" })}
				{!atHome && btn("Home", ICON.home, { type: "home" })}
				{btn(
					"Search",
					ICON.search,
					{ type: "open-search" },
					state.screen.name === "search",
				)}
				{btn("Menu", ICON.more, { type: "toggle-menu" }, state.menuOpen)}
			</div>
			<AnimatePresence>
				{state.menuOpen && (
					<motion.nav
						aria-label="Menu"
						className="grid w-[440px] grid-cols-2 gap-1 rounded-2xl bg-[#0c0e12]/95 p-1.5 ring-1 ring-white/10"
						initial={{ opacity: 0, y: -4 }}
						animate={{ opacity: 1, y: 0 }}
						exit={{ opacity: 0 }}
						transition={{ duration: 0.15 }}
					>
						{MENU_ITEMS.map((id) => (
							<MenuItem
								key={id}
								view={view}
								id={id}
								className="gap-2.5 rounded-lg px-2.5 py-1.5 text-[18px] !ring-4"
							/>
						))}
					</motion.nav>
				)}
			</AnimatePresence>
		</div>
	)
}
