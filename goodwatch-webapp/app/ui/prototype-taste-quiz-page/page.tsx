// PROTOTYPE - throwaway (#220, locked after round 4: backdrop layout, full site, secondary dock on phones). The locked living room quiz (rate + stack + moment) as a regular web page:
// what /taste/quiz becomes, reached from a banner on the Taste page.
// It shares the TV version's titles, bands, and taste model (~/ui/prototype-taste-quiz-fit-3/data) and follows the
// same flow: one widely seen title at a time with Haven't seen it, the 5-answer "Keep these 5?" moment, picks with
// side arrows, and Rate more with the sign-up and Back to my picks bottom left.
// Mock titles only. No database, nothing persists, and sign-up is a stand-in toast.
import { Link } from "@remix-run/react"
import { type ReactNode, useEffect, useState } from "react"
import { DockStrip, useHasDock } from "~/ui/navigation"
import {
	type Answer,
	BANDS,
	BY,
	type Band,
	type Pick,
	RATE_DECK,
	bandOf,
	hue,
	label,
	picksFor,
	poster,
} from "~/ui/prototype-taste-quiz-fit-3/data"
import { GoogleG } from "./google"

export const GOAL = 5
export type As = "guest" | "new" | "me"
export type PageVariant = "page" | "backdrop" | "dock"

export const PAGE_VARIANTS: Record<
	PageVariant,
	{ name: string; idea: string }
> = {
	page: {
		name: "Page",
		idea: "The quiz as a plain page section: poster left, stack right, actions under the control. Closest to today's /taste/quiz.",
	},
	backdrop: {
		name: "Backdrop",
		idea: "Locked. The TV's look on the web: the title's backdrop fills a tall hero behind the poster and the stack. On phones the actions sit in a secondary dock above the navigation dock.",
	},
	dock: {
		name: "Dock",
		idea: "The sign-up and Back to my picks ride in a sticky bar at the bottom (above the mobile nav), so they never scroll away.",
	},
}

// Ratings a member starts with; their counts show on the banner.
export const RATED_BEFORE: Record<As, number> = { guest: 0, new: 5, me: 42 }
const MEMBER_PRESET: Answer[] = [
	{ key: "movie:807", kind: "score", score: 9 },
	{ key: "movie:496243", kind: "score", score: 8 },
	{ key: "movie:155", kind: "score", score: 9 },
	{ key: "show:2316", kind: "score", score: 5 },
	{ key: "movie:8966", kind: "score", score: 2 },
]
// A guest who left mid-quiz (from=3) or came back at 5 (from=5): the first widely seen titles, answered.
const GUEST_PARTIAL: Answer[] = [
	{ key: "movie:155", kind: "score", score: 9 },
	{ key: "movie:27205", kind: "score", score: 7 },
	{ key: "show:1396", kind: "score", score: 10 },
	{ key: "movie:13", kind: "skip" },
	{ key: "movie:603", kind: "score", score: 8 },
	{ key: "show:1399", kind: "score", score: 6 },
]

type Screen = "quiz" | "enough" | "picks"

// ---------------------------------------------------------------------------------------------------------
// State: the TV's useQuiz for variant `rate`, signup `moment`, without the D-pad and the remote.

export function usePageQuiz(as: As, from: number) {
	const member = as !== "guest"
	const guestAt = Math.min(5, Math.max(0, from))
	const preset = member
		? MEMBER_PRESET
		: GUEST_PARTIAL.slice(0, guestAt + (guestAt >= 4 ? 1 : 0))
	const counted = member ? MEMBER_PRESET.length : 0
	// Back at 5 from the Taste banner: this is Rate more, so the picks are already there behind it.
	const back5 = !member && guestAt >= 5
	const [answers, setAnswers] = useState<Answer[]>(preset)
	const [goal, setGoal] = useState(back5 ? GOAL * 2 : GOAL)
	const [screen, setScreen] = useState<Screen>("quiz")
	const [pickedBefore, setPickedBefore] = useState(back5)
	const [pg, setPg] = useState(0)
	const [joined, setJoined] = useState(false)
	const [toast, setToast] = useState<string | null>(null)
	useEffect(() => {
		if (!toast) return
		const t = setTimeout(() => setToast(null), 2800)
		return () => clearTimeout(t)
	}, [toast])

	const mine = answers.slice(counted)
	const progress = mine.filter((a) => a.kind === "score").length
	const kept = mine.filter((a) => a.kind !== "skip")
	const done = new Set(answers.map((a) => a.key))
	const cardKey = RATE_DECK.find((k) => !done.has(k)) ?? null
	const all = picksFor(answers, 18)
	const pages = Math.max(1, Math.ceil(all.length / 3))
	const page = Math.min(pg, pages - 1)
	const picks = all.slice(page * 3, page * 3 + 3)
	const saved = member || joined

	const answer = (a: Answer) => {
		const next = [...answers.filter((x) => x.key !== a.key), a]
		setAnswers(next)
		const n = next.slice(counted).filter((x) => x.kind === "score").length
		if (a.kind === "score" && n >= goal && n - 1 < goal) setScreen("enough")
	}
	const showPicks = () => {
		setPickedBefore(true)
		setScreen("picks")
	}
	return {
		as,
		member,
		saved,
		joined,
		screen,
		progress,
		goal,
		kept,
		cardKey,
		picks,
		page,
		pages,
		pickedBefore,
		ratedBefore: RATED_BEFORE[as],
		toast,
		rate: (s: number) =>
			cardKey && answer({ key: cardKey, kind: "score", score: s }),
		skip: () => cardKey && answer({ key: cardKey, kind: "skip" }),
		showPicks,
		more: () => {
			setGoal((g) => Math.max(g, progress) + 5)
			setScreen("quiz")
		},
		turn: (d: 1 | -1) => setPg(Math.max(0, Math.min(pages - 1, page + d))),
		join: (then?: "picks") => {
			setJoined(true)
			setToast(
				`Prototype: Continue with Google signs you in, and your ${kept.length} answers move to the account.`,
			)
			if (then) showPicks()
		},
		say: setToast,
	}
}
export type PageQuiz = ReturnType<typeof usePageQuiz>

// ---------------------------------------------------------------------------------------------------------
// Buttons in the site's own looks.

const amber =
	"inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-full bg-linear-to-b from-amber-400 to-amber-600 px-5 font-black text-gray-950 hover:brightness-110 md:min-h-10"
const ghost =
	"inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-full border-2 border-gray-700 px-5 font-semibold text-gray-200 hover:border-gray-500 md:min-h-10"
const back =
	"inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-full bg-amber-500/15 px-5 font-bold text-amber-200 ring-1 ring-amber-500/40 hover:bg-amber-500/25 md:min-h-10"

/** The site's Continue with Google button (GoogleSignInButton's look), as the one-press save. */
export function GoogleButton({
	children,
	onClick,
	className = "",
}: { children: ReactNode; onClick: () => void; className?: string }) {
	return (
		<button
			type="button"
			onClick={onClick}
			className={`inline-flex min-h-11 cursor-pointer items-center justify-center gap-2.5 rounded-full bg-gray-100 px-5 text-sm font-bold text-gray-900 shadow-sm ring-2 ring-inset ring-gray-400 hover:bg-white hover:ring-blue-500 md:min-h-10 ${className}`}
		>
			<GoogleG />
			{children}
		</button>
	)
}

export function Dots({ at, of }: { at: number; of: number }) {
	return (
		<span
			className="inline-flex gap-1.5"
			role="img"
			aria-label={`${Math.min(at, of)} of ${of} ratings`}
		>
			{Array.from({ length: of }, (_, i) => (
				<span
					key={i}
					className={`h-2.5 w-2.5 rounded-full ${i < at ? "bg-amber-400" : "bg-white/15"}`}
				/>
			))}
		</span>
	)
}

// ---------------------------------------------------------------------------------------------------------
// The page.

export function QuizPage({
	q,
	variant,
}: { q: PageQuiz; variant: PageVariant }) {
	// Keyboard: 1-9 and 0 score, S skips, P goes back to the picks; on the picks, arrows turn pages.
	useEffect(() => {
		const on = (e: KeyboardEvent) => {
			if (e.metaKey || e.ctrlKey || e.altKey) return
			if (
				(e.target as HTMLElement).closest("input, textarea, [contenteditable]")
			)
				return
			if (q.screen === "quiz") {
				if (/^[0-9]$/.test(e.key)) q.rate(e.key === "0" ? 10 : Number(e.key))
				else if (e.key === "s" || e.key === "S") q.skip()
				else if ((e.key === "p" || e.key === "P") && q.pickedBefore)
					q.showPicks()
				else return
				e.preventDefault()
			} else if (q.screen === "picks") {
				if (e.key === "ArrowRight") q.turn(1)
				else if (e.key === "ArrowLeft") q.turn(-1)
				else return
				e.preventDefault()
			}
		}
		window.addEventListener("keydown", on)
		return () => window.removeEventListener("keydown", on)
	})
	return (
		<div className="pb-16 text-white lg:pb-24">
			{q.screen === "quiz" && <QuizStep q={q} variant={variant} />}
			{q.screen === "enough" && <Enough q={q} />}
			{q.screen === "picks" && <Picks q={q} variant={variant} />}
			{q.toast && (
				<div
					role="status"
					className="fixed bottom-24 left-1/2 z-[70] w-[min(92vw,560px)] -translate-x-1/2 rounded-xl bg-gray-800 px-4 py-3 text-sm text-gray-100 shadow-2xl ring-1 ring-white/10 lg:bottom-8"
				>
					{q.toast}
				</div>
			)}
		</div>
	)
}

function Heading({
	eyebrow,
	title,
	line,
	right,
}: {
	eyebrow?: ReactNode
	title: string
	line?: ReactNode
	right?: ReactNode
}) {
	return (
		<div className="flex flex-wrap items-end justify-between gap-3">
			<div>
				{eyebrow && (
					<div className="mb-1 text-xs font-bold uppercase tracking-wider text-amber-400/90">
						{eyebrow}
					</div>
				)}
				<h1 className="text-2xl font-extrabold md:text-4xl">{title}</h1>
				{line && <p className="mt-1.5 max-w-2xl text-gray-300">{line}</p>}
			</div>
			{right}
		</div>
	)
}

// ------------------------------------------------------------- one title at a time

function QuizStep({ q, variant }: { q: PageQuiz; variant: PageVariant }) {
	const x = q.cardKey ? BY[q.cardKey] : null
	const rateMore = q.pickedBefore || q.member
	const eyebrow = q.member
		? `Sharpen your taste · ${q.ratedBefore + q.progress} ratings`
		: "Rate what you've seen"
	if (!x)
		return (
			<Section>
				<Heading title="That's every title in this prototype." />
				<div className="mt-6">
					<button type="button" className={amber} onClick={q.showPicks}>
						♥ Show my picks
					</button>
				</div>
			</Section>
		)
	const card = (
		<div className="flex flex-col gap-5 sm:flex-row sm:gap-8">
			<img
				key={x.key}
				src={poster(x, "w342")}
				alt={`Poster for ${x.title}`}
				className="mx-auto aspect-[2/3] w-36 shrink-0 rounded-md border-2 border-gray-800 object-cover shadow-2xl sm:mx-0 sm:w-48"
			/>
			<div className="min-w-0 flex-1">
				<div className="text-2xl font-extrabold leading-tight md:text-3xl">
					{x.title}
				</div>
				<div className="mt-1 text-sm text-gray-400">
					{[x.year, x.genres.join(", ")].join(" · ")}
				</div>
				<div className="mt-5">
					<StackControl onRate={q.rate} />
				</div>
				<div className="mt-3 flex flex-wrap items-center gap-2">
					<button type="button" className={ghost} onClick={q.skip}>
						Haven't seen it
					</button>
					<span className="hidden text-xs text-gray-500 md:inline">
						Keys: 1–9, 0 = 10 · S skips{rateMore ? " · P back to picks" : ""}
					</span>
				</div>
				{rateMore && variant === "page" && (
					<RateMoreActions q={q} className="mt-8" />
				)}
				{rateMore && variant === "backdrop" && (
					<RateMoreActions q={q} className="mt-10 hidden lg:flex" />
				)}
			</div>
		</div>
	)
	return (
		<>
			{variant === "backdrop" ? (
				<div className="relative overflow-hidden">
					{x.backdrop && (
						<img
							src={`https://image.tmdb.org/t/p/w1280${x.backdrop}`}
							alt=""
							className="absolute inset-0 h-full w-full object-cover opacity-30"
						/>
					)}
					<div className="absolute inset-0 bg-linear-to-r from-gray-950 via-gray-950/80 to-gray-950/40" />
					<div className="absolute inset-x-0 bottom-0 h-40 bg-linear-to-t from-gray-950 to-transparent" />
					<Section className="relative min-h-[70vh] pt-10 pb-20 md:pt-16 md:pb-32 lg:min-h-[600px]">
						<Heading
							eyebrow={eyebrow}
							title="How was it?"
							right={<Dots at={q.progress} of={q.goal} />}
						/>
						<div className="mt-6">{card}</div>
					</Section>
				</div>
			) : (
				<Section>
					<Heading
						eyebrow={eyebrow}
						title="How was it?"
						line={
							q.member
								? undefined
								: `Rate ${GOAL} titles you've seen and your picks are ready. No account needed.`
						}
						right={<Dots at={q.progress} of={q.goal} />}
					/>
					<div className="mt-6 rounded-2xl border-2 border-gray-800 bg-gray-900 p-4 md:p-6">
						{card}
					</div>
				</Section>
			)}
			{rateMore && variant === "dock" && <Dock q={q} />}
			{rateMore && variant === "backdrop" && (
				<SecondaryDock>
					<RateMoreActions q={q} />
				</SecondaryDock>
			)}
		</>
	)
}

function Section({
	children,
	className = "",
}: { children: ReactNode; className?: string }) {
	return (
		<section
			className={`mx-auto max-w-7xl px-4 pt-6 md:px-8 md:pt-10 ${className}`}
		>
			{children}
		</section>
	)
}

/** Round 4: in Rate more, the sign-up stays bottom left for a guest, and Back to my picks sits right next to it. */
function RateMoreActions({
	q,
	className = "",
}: { q: PageQuiz; className?: string }) {
	return (
		<div className={`flex items-center gap-2 ${className}`}>
			{!q.saved && (
				<GoogleButton onClick={() => q.join()}>
					Save these {q.kept.length}
					<span className="hidden sm:inline"> answers · free</span>
				</GoogleButton>
			)}
			<button type="button" className={back} onClick={q.showPicks}>
				♥ Back to my picks
			</button>
		</div>
	)
}

/**
 * Phone actions stacked above the site's navigation dock, the way Discover's filters and Watch next's controls do it
 * (DockStrip from ~/ui/navigation). Without the new navigation it falls back to a bar above the legacy BottomNav.
 */
function SecondaryDock({ children }: { children: ReactNode }) {
	const hasDock = useHasDock()
	if (hasDock)
		return (
			<DockStrip>
				<div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 [&>*]:flex-wrap">
					{children}
				</div>
			</DockStrip>
		)
	return (
		<div className="fixed inset-x-0 bottom-16 z-40 border-t border-gray-800 bg-gray-950/95 backdrop-blur lg:hidden">
			<div className="flex flex-wrap items-center gap-2 px-4 py-2.5">
				{children}
			</div>
		</div>
	)
}

function Dock({ q }: { q: PageQuiz }) {
	return (
		<div className="fixed inset-x-0 bottom-16 z-40 border-t border-gray-800 bg-gray-950/95 backdrop-blur lg:bottom-0">
			<div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-2.5 md:px-8">
				<RateMoreActions q={q} />
				<span className="ml-auto hidden text-sm text-gray-400 md:inline">
					{q.progress} new ratings · your picks update as you go
				</span>
			</div>
		</div>
	)
}

/** The locked `stack`: four levels over the ten scores, each level spanning exactly its own scores. */
export function StackControl({ onRate }: { onRate: (s: number) => void }) {
	const [hot, setHot] = useState<Band | null>(null)
	return (
		<fieldset
			className="grid grid-cols-10 gap-1 sm:gap-1.5"
			onMouseLeave={() => setHot(null)}
		>
			<legend className="sr-only">Your score</legend>
			{BANDS.map((b, i) => (
				<button
					key={b.name}
					type="button"
					onClick={() => onRate(b.pick)}
					onMouseEnter={() => setHot(i as Band)}
					onFocus={() => setHot(i as Band)}
					aria-label={`${b.name}, ${b.pick}`}
					className={`flex h-14 cursor-pointer items-center justify-center gap-2 rounded-xl bg-gray-800 px-1 text-left sm:justify-start ring-2 transition hover:bg-gray-700 focus-visible:outline-none sm:h-16 sm:px-3 ${hot === i ? "ring-amber-400" : "ring-transparent"}`}
					style={{ gridColumn: `span ${b.hi - b.lo + 1}` }}
				>
					<span
						className="hidden h-7 w-1.5 shrink-0 rounded-full sm:block"
						style={{ background: b.hue }}
					/>
					<span className="text-xs font-extrabold sm:text-lg">{b.name}</span>
					<span className="ml-auto hidden text-[11px] tabular-nums text-gray-500 md:inline">
						{b.lo}–{b.hi}
					</span>
				</button>
			))}
			{Array.from({ length: 10 }, (_, i) => i + 1).map((n) => {
				const on = hot != null && bandOf(n) === hot
				const off = hot != null && !on
				return (
					<button
						key={n}
						type="button"
						onClick={() => onRate(n)}
						onFocus={() => setHot(bandOf(n))}
						onMouseEnter={() => setHot(bandOf(n))}
						aria-label={`${n}, ${label(n)}`}
						title={`${n} · ${label(n)}`}
						className={`flex h-9 cursor-pointer items-center justify-center rounded-md text-sm font-black tabular-nums transition hover:scale-110 hover:text-gray-950 focus-visible:scale-110 focus-visible:outline-2 focus-visible:outline-amber-400 sm:h-7 ${on ? "text-white" : off ? "text-white/35" : "text-white/75"}`}
						style={{
							background: `${hue(n)}${on ? "77" : off ? "22" : "44"}`,
						}}
					>
						{n}
					</button>
				)
			})}
		</fieldset>
	)
}

// ------------------------------------------------------------- the moment: Keep these 5?

function Enough({ q }: { q: PageQuiz }) {
	const ask = !q.saved
	return (
		<Section>
			<Heading
				eyebrow={`${q.progress} answers`}
				title={
					q.member
						? "Saved to your taste."
						: ask
							? `Keep these ${q.progress}?`
							: "That's enough for now."
				}
				line={
					q.member
						? `${q.ratedBefore + q.progress} ratings now. Your picks moved with them.`
						: "Your picks are ready. Save your answers and they follow you to every screen. Free."
				}
			/>
			<div className="mt-6 flex flex-wrap gap-3">
				{q.kept.slice(-8).map((a) => (
					<div key={a.key} className="relative">
						<img
							src={poster(BY[a.key], "w185")}
							alt={BY[a.key].title}
							className="aspect-[2/3] w-20 rounded-md border-2 border-gray-800 object-cover md:w-28"
						/>
						{a.kind === "score" && (
							<span
								className="absolute -right-1.5 -top-1.5 flex h-7 min-w-7 items-center justify-center rounded-md px-1.5 text-sm font-extrabold text-white ring-2 ring-gray-950"
								style={{ background: hue(a.score) }}
							>
								{a.score}
							</span>
						)}
					</div>
				))}
			</div>
			<div className="mt-8 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
				{ask ? (
					<>
						<GoogleButton onClick={() => q.join("picks")} className="text-base">
							Save and show my picks
						</GoogleButton>
						<button type="button" className={ghost} onClick={q.showPicks}>
							Just show my picks
						</button>
					</>
				) : (
					<button type="button" className={amber} onClick={q.showPicks}>
						♥ Show my picks
					</button>
				)}
				<button
					type="button"
					className="min-h-11 cursor-pointer px-3 font-semibold text-gray-400 hover:text-gray-200"
					onClick={q.more}
				>
					5 more
				</button>
			</div>
			{ask && (
				<p className="mt-3 text-sm text-gray-500">
					Continue with Google: no password.{" "}
					<button
						type="button"
						className="cursor-pointer underline hover:text-gray-300"
						onClick={() => q.say("Prototype: the site's email sign-up opens.")}
					>
						Use email instead
					</button>
				</p>
			)}
		</Section>
	)
}

// ------------------------------------------------------------- picks, three at a time, side arrows

function Picks({ q, variant }: { q: PageQuiz; variant: PageVariant }) {
	const line = q.saved
		? `From your ${q.ratedBefore + q.progress} ratings · on your services`
		: `Closest to your ${q.kept.length} answers · everywhere`
	const actions = q.saved ? (
		<>
			<Link to={tasteHref(q)} className={ghost}>
				✓ Saved · Open Taste
			</Link>
			<button type="button" className={ghost} onClick={q.more}>
				Rate more
			</button>
		</>
	) : (
		<>
			<GoogleButton onClick={() => q.join()}>
				Save these {q.kept.length}
				<span className="hidden sm:inline"> answers · free</span>
			</GoogleButton>
			<button type="button" className={ghost} onClick={q.more}>
				Rate more
			</button>
		</>
	)
	return (
		<Section>
			<Heading
				title={
					q.page
						? `More for you · ${q.page + 1} of ${q.pages}`
						: "Here are your picks."
				}
				line={line}
			/>
			<div className="relative mx-auto mt-6 max-w-4xl md:px-14">
				<ArrowButton side="prev" q={q} />
				<div key={q.page} className="grid grid-cols-3 gap-2 sm:gap-4">
					{q.picks.map((p) => (
						<PickCard key={p.key} p={p} q={q} />
					))}
				</div>
				<ArrowButton side="next" q={q} />
			</div>
			<div className="mt-4 flex items-center justify-center gap-1.5">
				{Array.from({ length: q.pages }, (_, i) => (
					<span
						key={i}
						className={`h-1.5 rounded-full ${i === q.page ? "w-5 bg-amber-400" : "w-1.5 bg-white/25"}`}
					/>
				))}
			</div>
			{variant === "dock" ? (
				<div className="fixed inset-x-0 bottom-16 z-40 border-t border-gray-800 bg-gray-950/95 backdrop-blur lg:bottom-0">
					<div className="mx-auto flex max-w-7xl flex-wrap items-center gap-2 px-4 py-2.5 md:px-8">
						{actions}
					</div>
				</div>
			) : variant === "backdrop" ? (
				<>
					<div className="mt-10 hidden flex-wrap items-center gap-2 lg:flex">
						{actions}
					</div>
					<SecondaryDock>{actions}</SecondaryDock>
				</>
			) : (
				<div className="mt-8 flex flex-wrap items-center gap-2">{actions}</div>
			)}
		</Section>
	)
}

function ArrowButton({ side, q }: { side: "prev" | "next"; q: PageQuiz }) {
	const hidden = side === "prev" ? q.page === 0 : q.page >= q.pages - 1
	return (
		<button
			type="button"
			aria-label={side === "prev" ? "Earlier picks" : "More picks"}
			disabled={hidden}
			onClick={() => q.turn(side === "prev" ? -1 : 1)}
			className={`absolute top-1/3 z-10 flex h-24 w-9 -translate-y-1/2 cursor-pointer items-center justify-center rounded-xl bg-gray-950/80 text-2xl font-black text-white ring-1 ring-white/15 hover:bg-amber-500 hover:text-gray-950 md:h-32 md:w-11 ${side === "prev" ? "-left-2 md:left-0" : "-right-2 md:right-0"} ${hidden ? "invisible" : ""}`}
		>
			{side === "prev" ? "‹" : "›"}
		</button>
	)
}

/** An unseen pick in MovieTvCard's look, with the match and its "because" line. */
function PickCard({ p, q }: { p: Pick; q: PageQuiz }) {
	return (
		<button
			type="button"
			onClick={() =>
				q.say(
					`Prototype: opens ${p.title}'s page. Want to See works from there.`,
				)
			}
			className="flex cursor-pointer flex-col overflow-hidden rounded-lg border-4 border-gray-800 bg-gray-900 text-left hover:border-amber-700/50 hover:bg-gray-800"
		>
			<img
				src={poster(p, "w342")}
				alt={`Poster for ${p.title}`}
				className="aspect-[2/3] w-full object-cover"
			/>
			<div className="flex flex-col gap-1 p-2 md:p-3">
				<div className="truncate text-sm font-bold md:text-base">{p.title}</div>
				<div className="flex flex-wrap items-center gap-1.5 text-xs">
					<span
						className="rounded px-1.5 py-0.5 font-black text-white"
						style={{ background: hue(Math.round(p.gw / 10)) }}
					>
						{p.gw}
					</span>
					{p.match != null && (
						<span className="rounded-full bg-amber-500/15 px-2 py-0.5 font-bold text-amber-200">
							{p.match}% match
						</span>
					)}
				</div>
				{p.because && (
					<div className="hidden line-clamp-2 text-xs text-amber-100/70 sm:block">
						{p.because}.
					</div>
				)}
				<div className="hidden text-xs text-gray-500 sm:block">
					{p.runtime} · On {p.on}
				</div>
			</div>
		</button>
	)
}

// ---------------------------------------------------------------------------------------------------------
// Links between the two prototype pages, carrying the prototype's own state.

export const QUIZ_PATH = "/prototype/taste-quiz-page"
export const TASTE_PATH = "/prototype/taste-quiz-page/taste"

function tasteHref(q: PageQuiz) {
	if (q.member) return `${TASTE_PATH}?as=${q.as}`
	return `${TASTE_PATH}?as=guest&state=${q.joined ? "joined" : "five"}`
}

export const firstPosters = RATE_DECK.slice(0, 4).map((k) => BY[k])
