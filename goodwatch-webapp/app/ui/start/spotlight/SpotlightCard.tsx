// The start page's guest card (docs/implementation/start-page-redesign.md, "Guest card"), in the stage's card box
// (it fills the box the ledge grows into):
//
// - Before any choice: a dimmed fan of start titles behind "Start with a mood or a search" and Surprise me.
// - Tap three: TapThreePanel, the search's titles as whole poster toggles in a panel they fill.
// - For you: ForYouPanel, with Back to the titles.
//
// The empty state and For you crossfade in place, in one fixed box (spotlight.css).
import {
	type CSSProperties,
	type ReactNode,
	Suspense,
	lazy,
	useEffect,
	useMemo,
	useState,
} from "react"
import { WORDS } from "~/domain/taste-picker"
import type { StartTitle } from "~/ui/living-room/living-room-data"
import { useHydrated } from "~/utils/hydrated"
import { reloadOnStaleChunk } from "~/utils/stale-chunk"
import { tmdbImageUrl } from "~/utils/tmdb-image"
import {
	LOVED_NEEDED,
	type StartQuery,
	type StartResults,
	type StartView,
} from "../stage/start-query"
import type { StartQueryState } from "../stage/useStartQuery"
import { ForYouSkeleton } from "./ForYouSkeleton"
import { LovedSlots } from "./LovedSlots"
import { TapThreePanel } from "./TapThreePanel"
import { DieIcon, FOR_YOU, TAP_THREE } from "./card-parts"
import type { LovedThreeState } from "./useLovedThree"

// For you shows only after three loved titles, so its code loads on first use: fetched once the first title is loved,
// shown as its skeleton (the same box) until it's there.
const importForYouPanel = () => import("./ForYouPanel")
const ForYouPanel = lazy(
	reloadOnStaleChunk(() =>
		importForYouPanel().then((m) => ({ default: m.ForYouPanel })),
	),
)
let forYouPreloaded = false
function preloadForYouPanel() {
	if (forYouPreloaded) return
	forYouPreloaded = true
	// A failure here is left to the lazy load, which reloads a tab that outlived a deploy.
	void importForYouPanel().catch(() => {})
}

const MOOD_IDS = WORDS.filter((w) => w.kind === "mood").map((w) => w.id)

/** Surprise me: a random mood, never the one picked alone now. */
export function surpriseMood(
	picks: readonly string[],
	random: () => number = Math.random,
): string {
	const now = picks.length === 1 ? picks[0] : null
	const pool = MOOD_IDS.filter((id) => id !== now)
	return pool[Math.floor(random() * pool.length)] ?? MOOD_IDS[0]
}

const shortTitle = (title: string) => title.replace(/:.*$/, "")

/** "A", "A and B", "A, B and C". */
export const joinNames = (names: readonly string[]) =>
	names.length < 2
		? names.join("")
		: `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`

export function SpotlightCard({
	start,
	results,
	view,
	loved,
	fan,
}: {
	start: StartQueryState
	results: StartResults & { retry: () => void }
	view: StartView
	loved: LovedThreeState
	/** The start titles, for the fan before any choice. */
	fan: readonly StartTitle[]
}) {
	const { query } = start
	const [roll, setRoll] = useState(0)
	const surprise = () => {
		setRoll((r) => r + 1)
		start.clearSearch()
		start.setPicks([surpriseMood(query.picks)])
	}
	const forYou = view === "forYou"
	const anyLoved = loved.loved.length > 0
	useEffect(() => {
		if (anyLoved) preloadForYouPanel()
	}, [anyLoved])
	if (view === "results" || view === "loading")
		return (
			<TapThreePanel
				start={start}
				results={results}
				view={view}
				loved={loved}
				onSurprise={surprise}
			/>
		)
	return (
		<div className="spotlight">
			<div
				aria-hidden
				className="spotlight-halo"
				{...(view === "empty" ? {} : { "data-lit": "" })}
			/>
			<div className="spotlight-card">
				<div className="spotlight-head spotlight-pad">
					<div className="min-w-0 flex-1">
						<div className="flex min-w-0 items-center gap-1.5 sm:gap-3">
							<h2
								key={forYou ? "for-you" : "tap-three"}
								className="spotlight-in spotlight-title min-w-0 truncate font-extrabold tracking-tight text-white"
							>
								{forYou ? FOR_YOU : TAP_THREE}
							</h2>
							{forYou ? null : (
								<Dice roll={roll} onRoll={surprise} away={view === "empty"} />
							)}
						</div>
						<div className="mt-0.5 flex min-w-0 text-[13px] leading-5 text-gray-300 sm:mt-1 sm:text-sm">
							<span className="min-w-0 truncate">
								<CardLine view={view} loved={loved} />
							</span>
						</div>
					</div>
					{forYou ? (
						<button
							type="button"
							onClick={loved.reset}
							aria-label={`Back to ${TAP_THREE.toLowerCase()}`}
							className="inline-flex h-9 shrink-0 cursor-pointer items-center rounded-lg px-2.5 text-sm font-semibold text-amber-400 hover:bg-amber-400/10 hover:text-amber-300 sm:px-3"
						>
							<span aria-hidden>←&nbsp;</span>Back
						</button>
					) : null}
					<LovedSlots loved={loved.loved} onUndo={loved.toggle} />
				</div>
				<div className="relative min-h-0 flex-1">
					<Layer on={view === "empty"} from="up">
						<EmptyFan
							fan={fan}
							lovedCount={loved.loved.length}
							roll={roll}
							onRoll={surprise}
							on={view === "empty"}
						/>
					</Layer>
					<Layer on={forYou} from="down">
						{forYou ? (
							<Suspense fallback={<ForYouSkeleton />}>
								<ForYouPanel picks={loved.picks} onStartOver={loved.reset} />
							</Suspense>
						) : null}
					</Layer>
				</div>
			</div>
		</div>
	)
}

/** One state of the card's body: shown, or faded out of reach. */
function Layer({
	on,
	from,
	children,
}: {
	on: boolean
	from: "up" | "down"
	children: ReactNode
}) {
	return (
		<div
			className="spotlight-layer"
			data-from={from}
			{...(on ? { "data-on": "" } : { inert: "", "aria-hidden": true })}
		>
			{children}
		</div>
	)
}

/** The one line under the heading: why these picks, or what's loved so far. */
function CardLine({
	view,
	loved,
}: {
	view: StartView
	loved: LovedThreeState
}) {
	const names = loved.loved.map((c) => shortTitle(c.title))
	if (view === "forYou")
		return (
			<>
				Because you loved{" "}
				<b className="font-semibold text-white">{joinNames(names)}</b>
			</>
		)
	if (names.length)
		return (
			<>
				Loved <b className="font-semibold text-white">{joinNames(names)}</b> ·{" "}
				{LOVED_NEEDED - names.length} more
			</>
		)
	return <>Then get picks for you.</>
}

/**
 * Surprise me beside the heading: icon-led and compact; the die rolls on a tap. `away` while the empty state shows its
 * own big button: it keeps its room, unseen and out of reach.
 */
function Dice({
	roll,
	onRoll,
	away,
}: {
	roll: number
	onRoll: () => void
	away: boolean
}) {
	return (
		<button
			type="button"
			disabled={away}
			aria-hidden={away || undefined}
			tabIndex={away ? -1 : undefined}
			onClick={onRoll}
			aria-label="Surprise me: a random mood"
			title="Surprise me"
			style={{ opacity: away ? 0 : 1 }}
			className="inline-flex h-8 shrink-0 cursor-pointer items-center gap-1.5 rounded-full bg-white/[0.07] px-1.5 text-[13px] font-semibold text-gray-200 ring-1 ring-white/12 outline-none transition-opacity duration-300 hover:bg-amber-400/15 hover:text-white hover:ring-amber-400/40 focus-visible:ring-2 focus-visible:ring-amber-400 sm:pr-3 sm:pl-2 sm:text-sm"
		>
			<span
				key={roll}
				className={`grid place-items-center ${roll ? "spotlight-roll" : ""}`}
			>
				<DieIcon className="h-[18px] w-[18px] text-amber-400" />
			</span>
			<span className="max-sm:hidden">Surprise me</span>
		</button>
	)
}

/** The fan's posters run -FAN_HALF..FAN_HALF from the middle. */
const FAN_HALF = 5

/**
 * Before any choice: start titles fanned in a shallow bowl (each placed from its own size, so it fits every
 * breakpoint), dimmed, behind a short headline, one line and Surprise me. It fills exactly the box the posters take.
 */
function EmptyFan({
	fan,
	lovedCount,
	roll,
	onRoll,
	on,
}: {
	fan: readonly StartTitle[]
	lovedCount: number
	roll: number
	onRoll: () => void
	on: boolean
}) {
	// The fan's posters come after the page has started: the card waits out of sight until the guest asks, and eleven
	// posters fetched with the HTML would share the slow phone's first second with the room.
	const hydrated = useHydrated()
	const posters = useMemo(
		() =>
			hydrated
				? fan.filter((t) => t.poster_path).slice(0, FAN_HALF * 2 + 1)
				: [],
		[fan, hydrated],
	)
	return (
		<div className="absolute inset-0 overflow-clip">
			<div aria-hidden className="absolute inset-0">
				{posters.map((t, i) => {
					const d = i - FAN_HALF
					return (
						<img
							key={`${t.media_type}:${t.tmdb_id}`}
							src={tmdbImageUrl(t.poster_path as string, "w342")}
							alt=""
							loading="lazy"
							decoding="async"
							fetchPriority="low"
							draggable={false}
							className="spotlight-fan aspect-[2/3] rounded-lg object-cover shadow-[0_18px_40px_rgb(0_0_0/.6)] ring-1 ring-white/10"
							style={
								{
									"--fan-x": `${d * 74}%`,
									"--fan-y": `${48 - d * d * 1.9}%`,
									"--fan-r": `${-d * 2.2}deg`,
									zIndex: 10 - Math.abs(d),
									opacity: d === 0 ? 0.4 : 0.5,
								} as CSSProperties
							}
						/>
					)
				})}
			</div>
			<div aria-hidden className="spotlight-fan-dim" />
			<div className="relative z-30 flex flex-col items-center px-4 pt-4 text-center sm:pt-7 lg:pt-9">
				<h3 className="font-['Gabarito'] text-[22px] font-black leading-7 tracking-[-0.03em] text-white sm:text-[28px] sm:leading-9 lg:text-[34px] lg:leading-10">
					{lovedCount
						? `${LOVED_NEEDED - lovedCount} more to go`
						: "Start with a mood or a search"}
				</h3>
				<p className="mt-1 text-[14px] leading-5 text-gray-300 sm:mt-1.5 lg:text-[15px] lg:leading-6">
					Search above, pick a mood, or roll the dice.
				</p>
				<button
					type="button"
					tabIndex={on ? undefined : -1}
					onClick={onRoll}
					className="mt-3 inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-full bg-amber-400 pr-5 pl-4 text-[14px] font-black text-gray-950 shadow-[0_8px_28px_rgb(251_191_36/.28)] outline-none hover:bg-amber-300 focus-visible:ring-2 focus-visible:ring-white sm:mt-4 sm:min-h-11 lg:mt-5 lg:text-[15px]"
				>
					<span
						key={roll}
						className={`grid place-items-center ${roll ? "spotlight-roll" : ""}`}
					>
						<DieIcon className="h-5 w-5" />
					</span>
					Surprise me
				</button>
			</div>
		</div>
	)
}
