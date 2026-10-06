// PROTOTYPE - throwaway (#369). The pieces the three variants share: the episode row, the season controls, the
// date dialog, the toast, the status controls, the hero box and the prototype panel.
import { CheckIcon, ChevronDownIcon, ClockIcon, EllipsisHorizontalIcon, EyeSlashIcon, NoSymbolIcon, PauseIcon, PlayIcon, XMarkIcon } from "@heroicons/react/24/solid"
import { Link, useSearchParams } from "@remix-run/react"
import { type ReactNode, useState } from "react"
import type { Score } from "~/server/scores.server"
import EpisodeGrid from "~/ui/details/episode-grid/EpisodeGrid"
import { ActionButton } from "~/ui/title-actions/ActionButton"
import { ScoreControl } from "~/ui/title-actions/ScoreControl"
import { type Ep, SCENARIOS, STATUS_LABEL, type Scenario, type Season, type Status, type When, epCode, fmtDay, fmtWhen, isAired, plural, seasonProgress, standInGrid, unwatchedUpTo } from "./model"
import { FLOW, useStore } from "./store"

const TMDB = "https://image.tmdb.org/t/p"
export const SURFACE = "bg-[#141923]"
const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
const CHIP = `inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold cursor-pointer ${FOCUS}`
const CHIP_OFF = "bg-white/10 text-gray-100 hover:bg-white/20"

export const SHOWS = {
	supernatural: "Supernatural: 15 seasons, 327 episodes, 106 specials, ended",
	chernobyl: "Chernobyl: limited series, 5 episodes",
	"slow-horses": "Slow Horses: season 6 airing weekly",
	sherlock: "Sherlock: 4 short seasons and 9 specials",
} as const

// ---- progress ----------------------------------------------------------------------------

export function Bar({ value, max, className = "" }: { value: number; max: number; className?: string }) {
	return (
		<span className={`block h-1.5 overflow-hidden rounded-full bg-white/10 ${className}`} aria-hidden>
			<span className="block h-full rounded-full bg-green-500 transition-[width]" style={{ width: `${max ? (value / max) * 100 : 0}%` }} />
		</span>
	)
}

/** The show's progress: aired regular episodes only. Unaired episodes and specials are named and left out. */
export function ShowProgress({ className = "" }: { className?: string }) {
	const { d } = useStore()
	return (
		<div className={className}>
			<p className="flex flex-wrap items-baseline gap-x-2 text-sm">
				<span className="font-semibold text-white">
					{d.watched.length} of {d.aired.length} episodes
				</span>
				{d.unaired > 0 && <span className="text-xs text-gray-400">{d.unaired} not aired yet</span>}
				{d.specialsWatched > 0 && <span className="text-xs text-gray-400">{plural(d.specialsWatched, "special")} watched, not counted</span>}
			</p>
			<Bar value={d.watched.length} max={d.aired.length} className="mt-1.5" />
		</div>
	)
}

/** Where the person stands, in one pill: the status, Caught up, or Seen with new episodes. */
export function StatePill() {
	const { st, d } = useStore()
	const [text, look] = d.newEpisodes
		? [`Seen · ${plural(d.newEpisodes, "new episode")}`, "bg-green-500/20 text-green-300 ring-green-400/40"]
		: st.seenMarked
			? ["Seen · watched through", "bg-green-500/20 text-green-300 ring-green-400/40"]
			: st.status === "dropped"
				? ["Dropped", "bg-pink-500/20 text-pink-300 ring-pink-400/40"]
				: st.status === "on_hold"
					? ["On hold", "bg-violet-500/20 text-violet-300 ring-violet-400/40"]
					: d.caughtUp
						? ["Watching · caught up", "bg-sky-500/20 text-sky-300 ring-sky-400/40"]
						: st.status === "watching"
							? ["Watching", "bg-sky-500/20 text-sky-300 ring-sky-400/40"]
							: d.seen
								? ["Seen · scored", "bg-green-500/20 text-green-300 ring-green-400/40"]
								: ["", ""]
	if (!text) return null
	return <span className={`inline-flex h-6 shrink-0 items-center rounded-full px-2.5 text-xs font-bold ring-1 ${look}`}>{text}</span>
}

/** The next episode with a one-press mark, or what stands in its place when there is none. */
export function NextEpisode({ onOpen, className = "" }: { onOpen?: () => void; className?: string }) {
	const s = useStore()
	const { d, show } = s
	if (d.next)
		return (
			<div className={`flex items-center gap-3 ${className}`}>
				<button type="button" onClick={onOpen} className={`min-w-0 flex-1 text-left ${onOpen ? "cursor-pointer" : "cursor-default"} ${FOCUS}`}>
					<span className="block text-xs font-semibold uppercase tracking-wide text-gray-400">{d.newEpisodes ? "New since you saw it" : d.started ? "Next episode" : "Start with"}</span>
					<span className="block truncate text-sm font-semibold text-white">
						{epCode(show, d.next)} · {d.next.name}
					</span>
				</button>
				<button type="button" onClick={() => s.markOne(d.next as Ep)} className={`${CHIP} h-11 shrink-0 bg-green-500 px-4 text-sm text-black hover:bg-green-400`}>
					<CheckIcon className="h-4 w-4" />
					Watched
				</button>
			</div>
		)
	if (!d.aired.length) return <p className={`text-sm text-gray-400 ${className}`}>No episode has aired yet.</p>
	return (
		<p className={`text-sm text-gray-300 ${className}`}>
			{d.caughtUp ? (
				<>
					<span className="font-semibold text-white">Caught up.</span> {d.upcoming?.air_date ? `${epCode(show, d.upcoming)} airs ${fmtDay(d.upcoming.air_date)}.` : "The season is still airing."}
				</>
			) : (
				<span className="font-semibold text-white">You've watched every episode.</span>
			)}
		</p>
	)
}

// ---- marking -----------------------------------------------------------------------------

function WhenChoice({ current, onPick, labels }: { current?: When; onPick: (when: When) => void; labels: [string, string, string] }) {
	const { today } = useStore()
	const on = "bg-green-500 text-black"
	return (
		<>
			<button type="button" onClick={() => onPick({ kind: "moment", at: new Date().toISOString() })} className={`${CHIP} ${current?.kind === "moment" ? on : CHIP_OFF}`}>
				{labels[0]}
			</button>
			<label className={`${CHIP} ${current?.kind === "day" ? on : CHIP_OFF}`}>
				{labels[1]}
				<input
					type="date"
					max={today}
					value={current?.kind === "day" ? current.day : ""}
					onChange={(e) => e.target.value && onPick({ kind: "day", day: e.target.value })}
					className="w-[7.25rem] rounded bg-black/30 px-1 py-0.5 text-xs text-white [color-scheme:dark]"
				/>
			</label>
			<button type="button" onClick={() => onPick({ kind: "unknown" })} className={`${CHIP} ${current?.kind === "unknown" ? on : CHIP_OFF}`}>
				{labels[2]}
			</button>
		</>
	)
}

/** The strip under a row: when it was watched, "watched up to here", and removing the watch. */
function MarkStrip({ ep, special, close }: { ep: Ep; special: boolean; close: () => void }) {
	const s = useStore()
	const watch = s.st.watches[ep.id]
	if (!isAired(ep, s.today))
		return <p className="mx-3 mb-2 rounded-lg bg-white/5 px-3 py-2 text-xs text-gray-400">{ep.air_date ? `Airs ${fmtDay(ep.air_date)}. It can be marked from that day.` : "No air date yet."}</p>
	const earlier = special || watch ? 0 : unwatchedUpTo(s.show, s.st, s.today, ep).length - 1
	return (
		<div className="mx-3 mb-2 rounded-lg bg-white/5 px-3 py-2 text-xs text-gray-300">
			{earlier > 0 && FLOW[s.variant].upTo === "inline" && <p className="mb-2 font-semibold text-white">{plural(earlier, "earlier episode")} unwatched. Mark this one, or everything up to here?</p>}
			<div className="flex flex-wrap items-center gap-2">
				<span className="text-gray-400">{watch ? "Watched" : "Watched it"}</span>
				<WhenChoice
					current={watch?.when}
					labels={["Now", "On", "Don't know when"]}
					onPick={(when) => {
						if (watch) s.setWhen(ep, when)
						else s.markOne(ep, when)
						if (when.kind !== "day") close()
					}}
				/>
				{earlier > 0 && (
					<button type="button" onClick={() => {
						s.upTo(ep)
						close()
					}} className={`${CHIP} bg-white/10 text-green-300 ring-1 ring-green-400/40 hover:bg-white/20`}>
						<CheckIcon className="h-3.5 w-3.5" />
						Watched up to here ({earlier + 1})
					</button>
				)}
				{watch && (
					<button type="button" onClick={() => {
						s.unmarkOne(ep)
						close()
					}} className={`${CHIP} text-pink-300 hover:bg-white/10`}>
						Remove watch
					</button>
				)}
			</div>
			{watch && watch.origin !== "hand" && <p className="mt-2 text-gray-500">Marked in bulk ({watch.origin === "seen" ? "the Seen button" : watch.origin === "season" ? "whole season" : "up to here"}).</p>}
		</div>
	)
}

/**
 * One episode. The name is always there. The still and the description stay hidden until the row is opened, for
 * watched episodes too in the plain rows; rows with thumbnails show a watched episode's still at once.
 */
export function EpisodeRow({ ep, special = false, thumb = false }: { ep: Ep; special?: boolean; thumb?: boolean }) {
	const s = useStore()
	const [open, setOpen] = useState<null | "details" | "mark">(null)
	const watch = s.st.watches[ep.id]
	const aired = isAired(ep, s.today)
	const isNext = s.d.next === ep
	const toggle = (what: "details" | "mark") => setOpen(open === what ? null : what)
	const check = () => {
		if (watch) return s.unmarkOne(ep)
		// Variant C asks before it marks an episode that has unwatched episodes before it.
		if (FLOW[s.variant].upTo === "inline" && !special && unwatchedUpTo(s.show, s.st, s.today, ep).length > 1) return setOpen("mark")
		s.markOne(ep)
	}
	const still = ep.still_path ? `${TMDB}/w300${ep.still_path}` : null
	return (
		<li className={`border-t border-white/[0.06] ${isNext ? "bg-green-500/[0.07]" : ""}`} data-ep={ep.id}>
			<div className={`flex items-center gap-2.5 px-2 py-1.5 sm:px-3 ${aired ? "" : "opacity-50"}`}>
				<button
					type="button"
					disabled={!aired}
					onClick={check}
					aria-pressed={!!watch}
					aria-label={`${watch ? "Watched" : "Mark as watched"}: ${ep.name}`}
					className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full cursor-pointer disabled:cursor-not-allowed ${FOCUS}`}
				>
					<span
						className={`flex h-7 w-7 items-center justify-center rounded-full ${
							!aired
								? "border-2 border-dashed border-white/25 text-gray-500"
								: watch
									? special
										? "border-2 border-green-400/70 text-green-300"
										: "bg-green-500 text-black"
									: "border-2 border-white/30 text-transparent hover:border-green-400 hover:text-green-400/60"
						}`}
					>
						{aired ? <CheckIcon className="h-4 w-4" /> : <ClockIcon className="h-3.5 w-3.5" />}
					</span>
				</button>
				{thumb && (
					<button type="button" onClick={() => toggle("details")} aria-label="Show still and description" className={`hidden h-[3.375rem] w-24 shrink-0 overflow-hidden rounded-md bg-white/[0.06] sm:block ${FOCUS}`}>
						{(watch || open === "details") && still ? (
							<img src={still} alt="" loading="lazy" className="h-full w-full object-cover" />
						) : (
							<span className="flex h-full w-full items-center justify-center text-gray-600">
								<EyeSlashIcon className="h-5 w-5" />
							</span>
						)}
					</button>
				)}
				<div className="min-w-0 flex-1">
					<button type="button" onClick={() => toggle("details")} aria-expanded={open === "details"} className={`flex w-full min-w-0 cursor-pointer items-baseline gap-2 text-left ${FOCUS}`}>
						<span className="w-5 shrink-0 text-right text-xs tabular-nums text-gray-500">{ep.n}</span>
						<span className={`truncate text-sm font-medium ${watch ? "text-gray-300" : "text-white"}`}>{ep.name}</span>
						{isNext && <span className="shrink-0 rounded bg-green-500 px-1.5 text-[10px] font-bold uppercase text-black">Next</span>}
					</button>
					<p className="flex flex-wrap items-center gap-x-1.5 pl-7 text-xs text-gray-500">
						<span>{ep.air_date ? (aired ? fmtDay(ep.air_date) : `Airs ${fmtDay(ep.air_date)}`) : "No air date"}</span>
						{ep.runtime ? <span>· {ep.runtime} min</span> : null}
						{watch && (
							<button type="button" onClick={() => toggle("mark")} className={`cursor-pointer rounded text-green-300/90 underline decoration-white/20 underline-offset-2 hover:text-green-200 ${FOCUS}`}>
								watched {fmtWhen(watch.when, s.today)}
								{special ? ", not counted" : ""}
							</button>
						)}
					</p>
				</div>
				<button
					type="button"
					onClick={() => toggle("mark")}
					aria-expanded={open === "mark"}
					aria-label={`Date and more for ${ep.name}`}
					className={`flex h-10 w-9 shrink-0 cursor-pointer items-center justify-center rounded-lg text-gray-400 hover:bg-white/10 hover:text-white ${FOCUS}`}
				>
					<EllipsisHorizontalIcon className="h-5 w-5" />
				</button>
			</div>
			{open === "mark" && <MarkStrip ep={ep} special={special} close={() => setOpen(null)} />}
			{open === "details" && (
				<div className="mx-3 mb-3 flex flex-col gap-3 sm:ml-14 sm:flex-row">
					{still && <img src={still} alt="" loading="lazy" className={`aspect-video w-full rounded-lg object-cover sm:w-52 sm:shrink-0 ${thumb ? "sm:hidden" : ""}`} />}
					<p className="text-sm leading-relaxed text-gray-300">{ep.overview || "No description."}</p>
				</div>
			)}
		</li>
	)
}

/** A season's count, bar, and its whole-season mark. Specials get a count and no bar. */
export function SeasonMeta({ season, showBar = true }: { season: Season; showBar?: boolean }) {
	const s = useStore()
	const p = seasonProgress(season, s.st, s.today)
	const special = season.number === 0
	const done = p.aired > 0 && p.watched === p.aired
	return (
		<span className="flex shrink-0 items-center gap-2.5">
			{showBar && !special && <Bar value={p.watched} max={p.aired} className="hidden w-16 sm:block" />}
			<span className={`text-xs tabular-nums ${done && !special ? "font-semibold text-green-300" : "text-gray-400"}`}>
				{special ? `${p.watched} watched · not counted` : `${p.watched}/${p.aired}`}
				{p.total > p.aired && !special ? ` · ${p.total - p.aired} to air` : ""}
			</span>
			{p.aired > 0 && (
				<button
					type="button"
					onClick={(e) => {
						e.stopPropagation()
						done ? s.unmarkSeason(season) : s.markSeason(season)
					}}
					className={`${CHIP} ${done ? "text-gray-300 hover:bg-white/10" : "bg-white/10 text-green-300 hover:bg-white/20"}`}
				>
					{!done && <CheckIcon className="h-3.5 w-3.5" />}
					{done ? "Unmark" : special ? "Mark all" : "Mark season"}
				</button>
			)}
		</span>
	)
}

export const seasonTitle = (season: Season) => (season.number === 0 ? "Specials" : `Season ${season.number}`)

export function EpisodeRows({ season, thumb }: { season: Season; thumb?: boolean }) {
	return (
		<ul>
			{season.number === 0 && <li className="border-t border-white/[0.06] px-3 py-2 text-xs text-gray-400">Specials can be marked. They never count toward your progress or toward the show being Seen.</li>}
			{season.episodes.map((ep) => (
				<EpisodeRow key={ep.id} ep={ep} special={season.number === 0} thumb={thumb} />
			))}
		</ul>
	)
}

/** Before a bulk mark (A and C), or after one to give it a date (B): don't know when, today, or a chosen day. */
export function BulkDialog() {
	const s = useStore()
	const [choice, setChoice] = useState<"unknown" | "today" | "day">("unknown")
	const [day, setDay] = useState("")
	const request = s.dialog
	if (!request) return null
	const option = (value: typeof choice, label: string, note: string, extra?: ReactNode) => (
		<label className={`flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-2.5 ${choice === value ? "border-green-400 bg-green-500/10" : "border-white/10 hover:bg-white/5"}`}>
			<input type="radio" name="bulk-when" checked={choice === value} onChange={() => setChoice(value)} className="mt-1 accent-green-500" />
			<span className="min-w-0 flex-1">
				<span className="block text-sm font-semibold text-white">{label}</span>
				<span className="block text-xs text-gray-400">{note}</span>
				{extra}
			</span>
		</label>
	)
	return (
		<div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/70 sm:items-center" onClick={s.closeDialog} onKeyDown={(e) => e.key === "Escape" && s.closeDialog()}>
			{/* biome-ignore lint/a11y/useSemanticElements: prototype dialog */}
			<div role="dialog" aria-modal="true" aria-label={request.title} onClick={(e) => e.stopPropagation()} onKeyDown={() => {}} className="w-full max-w-md rounded-t-2xl border border-white/10 bg-gray-900 p-5 text-white sm:rounded-2xl">
				<p className="text-xs font-semibold uppercase tracking-wide text-gray-400">{request.title}</p>
				<h3 className="mt-1 text-lg font-bold">{request.mode === "redate" ? `When did you watch these ${request.eps.length} episodes?` : `Mark ${plural(request.eps.length, "episode")} as watched`}</h3>
				<div className="mt-4 flex flex-col gap-2">
					{option("unknown", "Don't know when", "Counts as watched, with no date.")}
					{option("today", "Today", `All of them get ${fmtDay(s.today)}.`)}
					{option(
						"day",
						"On a date",
						"All of them get the day you pick.",
						<input
							type="date"
							max={s.today}
							value={day}
							onFocus={() => setChoice("day")}
							onChange={(e) => {
								setDay(e.target.value)
								setChoice("day")
							}}
							className="mt-2 rounded bg-black/40 px-2 py-1 text-sm text-white [color-scheme:dark]"
						/>,
					)}
				</div>
				<p className="mt-3 text-xs text-gray-500">Episodes you already marked keep their date. Episodes that haven't aired are left out. The release date is never used.</p>
				<div className="mt-5 flex justify-end gap-2">
					<button type="button" onClick={s.closeDialog} className={`${CHIP} h-11 px-4 text-sm ${CHIP_OFF}`}>
						Cancel
					</button>
					<button
						type="button"
						disabled={choice === "day" && !day}
						onClick={() => s.confirmDialog(choice === "unknown" ? { kind: "unknown" } : { kind: "day", day: choice === "today" ? s.today : day })}
						className={`${CHIP} h-11 bg-green-500 px-4 text-sm text-black hover:bg-green-400 disabled:opacity-40`}
					>
						{request.mode === "redate" ? "Set date" : "Mark as watched"}
					</button>
				</div>
			</div>
		</div>
	)
}

export function ToastBar() {
	const { toast, closeToast } = useStore()
	if (!toast) return null
	return (
		<div key={toast.id} aria-live="polite" className="fixed inset-x-2 bottom-3 z-[90] mx-auto flex max-w-xl flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-white/10 bg-gray-800 px-4 py-3 text-sm text-white shadow-2xl md:bottom-20">
			<span className="min-w-0 flex-1 basis-48">{toast.text}</span>
			{toast.actions.map((a) => (
				<button key={a.label} type="button" onClick={a.run} className={`cursor-pointer font-bold text-green-300 underline underline-offset-2 hover:text-green-200 ${FOCUS}`}>
					{a.label}
				</button>
			))}
			<button type="button" onClick={closeToast} aria-label="Close" className="cursor-pointer text-gray-400 hover:text-white">
				<XMarkIcon className="h-4 w-4" />
			</button>
		</div>
	)
}

/** The one prompt to rate, when the show is watched through. "Not now" puts it away for good. */
export function RatePrompt({ className = "" }: { className?: string }) {
	const s = useStore()
	if (!s.d.ratePrompt) return null
	return (
		<div className={`rounded-xl border border-yellow-400/40 bg-yellow-400/10 p-3 ${className}`}>
			<div className="flex items-start justify-between gap-3">
				<p className="text-sm font-semibold text-white">You've watched all of {s.show.name}. How was it?</p>
				<button type="button" onClick={s.dismissRate} className={`shrink-0 cursor-pointer text-xs text-gray-300 underline underline-offset-2 hover:text-white ${FOCUS}`}>
					Not now
				</button>
			</div>
			<div className="mt-2">
				<ScoreControl size="compact" value={null} onRate={(score) => s.rate(score)} />
			</div>
		</div>
	)
}

// ---- status controls ---------------------------------------------------------------------

const STATUS_LOOK = {
	watching: { Icon: PlayIcon, active: "bg-sky-500 text-black", tint: "text-sky-300", note: "You're watching it. The first watched episode sets this." },
	on_hold: { Icon: PauseIcon, active: "bg-violet-500 text-white", tint: "text-violet-300", note: "Set aside for now. Watching an episode brings it back." },
	dropped: { Icon: NoSymbolIcon, active: "bg-pink-500 text-black", tint: "text-pink-300", note: "Given up. Hidden from your recommendations." },
} as const
type StatusKey = keyof typeof STATUS_LOOK
const STATUSES = Object.keys(STATUS_LOOK) as StatusKey[]

/** A status as a toggle button, in the look of the title action buttons. */
export function StatusButton({ status, className = "" }: { status: StatusKey; className?: string }) {
	const s = useStore()
	const look = STATUS_LOOK[status]
	const active = s.st.status === status
	return (
		<button
			type="button"
			aria-pressed={active}
			title={look.note}
			onClick={() => s.status(active ? null : status)}
			className={`inline-flex h-11 w-full min-w-0 items-center justify-center gap-2 rounded-lg px-3 text-sm font-semibold cursor-pointer transition-colors ${FOCUS} ${active ? look.active : "bg-white/10 text-gray-100 hover:bg-white/20"} ${className}`}
		>
			<look.Icon className={`h-4 w-4 shrink-0 ${active ? "" : look.tint}`} />
			<span className="truncate">{STATUS_LABEL[status]}</span>
		</button>
	)
}

/** Variant B: the status as one pill that opens a menu of the three. */
export function StatusMenu() {
	const s = useStore()
	const [open, setOpen] = useState(false)
	const current = (s.st.status ?? "watching") as StatusKey
	const look = STATUS_LOOK[current]
	return (
		<div className="relative">
			<button type="button" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(!open)} className={`${CHIP} h-9 ${look.active}`}>
				<look.Icon className="h-3.5 w-3.5" />
				{s.d.caughtUp && current === "watching" ? "Watching · caught up" : STATUS_LABEL[current]}
				<ChevronDownIcon className="h-3.5 w-3.5" />
			</button>
			{open && (
				<div role="menu" className="absolute left-0 top-full z-40 mt-1 w-72 rounded-xl border border-white/10 bg-gray-900 p-1 shadow-2xl">
					{STATUSES.map((status) => {
						const l = STATUS_LOOK[status]
						return (
							<button key={status} type="button" role="menuitemradio" aria-checked={current === status} onClick={() => {
								s.status(status)
								setOpen(false)
							}} className="flex w-full cursor-pointer items-start gap-3 rounded-lg px-3 py-2 text-left hover:bg-white/10">
								<l.Icon className={`mt-0.5 h-4 w-4 shrink-0 ${l.tint}`} />
								<span className="min-w-0 flex-1">
									<span className="block text-sm font-semibold text-white">{STATUS_LABEL[status]}</span>
									<span className="block text-xs text-gray-400">{l.note}</span>
								</span>
								{current === status && <CheckIcon className="mt-0.5 h-4 w-4 text-green-400" />}
							</button>
						)
					})}
				</div>
			)}
		</div>
	)
}

/** Variant C: the three statuses side by side, one always on. */
export function StatusSegments({ className = "" }: { className?: string }) {
	const s = useStore()
	const current = s.st.status ?? "watching"
	return (
		<div role="radiogroup" aria-label="Show status" className={`grid grid-cols-3 gap-1 rounded-xl bg-white/[0.06] p-1 ${className}`}>
			{STATUSES.map((status) => {
				const l = STATUS_LOOK[status]
				const on = current === status
				return (
					// biome-ignore lint/a11y/useSemanticElements: a segmented control of buttons
					<button key={status} type="button" role="radio" aria-checked={on} title={l.note} onClick={() => s.status(status)} className={`inline-flex h-9 min-w-0 cursor-pointer items-center justify-center gap-1 rounded-lg px-1 text-[13px] font-semibold sm:gap-1.5 sm:px-2 sm:text-sm ${FOCUS} ${on ? l.active : "text-gray-300 hover:bg-white/10"}`}>
						<l.Icon className={`h-3.5 w-3.5 shrink-0 ${on ? "" : l.tint}`} />
						<span className="truncate">{STATUS_LABEL[status]}</span>
					</button>
				)
			})}
		</div>
	)
}

/** Whether the status controls show: the person has watched an episode and the show is not Seen by watching. */
export const useHasStatus = () => {
	const { st, d } = useStore()
	return (d.started || st.status === "dropped") && !st.seenMarked
}

export function WantButton() {
	const s = useStore()
	return <ActionButton kind="want" label="long" active={s.st.want} onClick={s.want} />
}
export function SeenButton() {
	const s = useStore()
	return <ActionButton kind="seen" label="long" active={s.d.seen} onClick={s.seen} />
}
/** Not interested as on the title page today: off once the show is Seen or scored. */
export function HideButton({ className = "" }: { className?: string }) {
	const s = useStore()
	return <ActionButton kind="hide" label="long" className={className} active={s.st.hidden} disabled={!s.st.hidden && s.d.seen} title={s.d.seen ? "You've seen it. Not interested is for titles you haven't seen." : "Hide it from your recommendations"} onClick={s.hide} />
}

// ---- page frame --------------------------------------------------------------------------

/** The title page's action box, cut down: poster, title, the score control, then each variant's own actions. */
export function Hero({ children }: { children: ReactNode }) {
	const s = useStore()
	const { show } = s
	return (
		<div className="grid gap-4 md:grid-cols-[13rem_minmax(0,1fr)] [&>*]:min-w-0">
			<img src={show.poster_path ? `${TMDB}/w342${show.poster_path}` : undefined} alt="" className="hidden aspect-[2/3] w-full rounded-xl object-cover md:block" />
			<div className="relative isolate flex min-w-0 flex-col rounded-2xl border border-white/10 bg-stone-950 md:rounded-xl">
				<div className="absolute inset-0 -z-10 overflow-hidden rounded-2xl md:rounded-xl" aria-hidden="true">
					{show.backdrop_path && <img src={`${TMDB}/w780${show.backdrop_path}`} alt="" className="h-full w-full scale-110 object-cover object-[center_25%]" />}
					<div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
				</div>
				<div className="flex grow flex-col px-4 pb-5 pt-4 md:p-5 lg:p-6">
					<div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
						<h2 className="min-w-0 truncate text-xl font-bold text-white">
							{show.name} <span className="font-normal text-gray-400">({show.year})</span>
						</h2>
						<StatePill />
					</div>
					<div className="mt-3">
						<ScoreControl value={s.st.score as Score | null} onRate={(score) => s.rate(score)} onClear={() => s.rate(null)} />
					</div>
					<div aria-hidden="true" className="my-4 h-px bg-white/10" />
					{children}
				</div>
			</div>
		</div>
	)
}

/** The real episode grid component, read-only as on the show page, fed stand-in numbers. */
export function GridSection({ action }: { action?: ReactNode }) {
	const { show } = useStore()
	const grid = standInGrid(show)
	if (!grid.seasons.length) return null
	return (
		<div>
			<EpisodeGrid grid={grid} />
			<p className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500">
				<span>Prototype: the grid shows TMDB votes as stand-in numbers. The real one reads IMDb ratings, in IMDb's numbering, and stays read-only.</span>
				{action}
			</p>
		</div>
	)
}

/** Not part of the design: pick the show, a starting point and the day, and read the stored state. */
export function PrototypePanel({ showKey }: { showKey: string }) {
	const s = useStore()
	const [params, setParams] = useSearchParams()
	const link = (changes: Record<string, string | null>) => {
		const p = new URLSearchParams(params)
		p.delete("scenario")
		for (const [k, v] of Object.entries(changes)) v == null ? p.delete(k) : p.set(k, v)
		return `?${p}`
	}
	const origins: Record<string, number> = {}
	const dates: Record<string, number> = {}
	for (const w of Object.values(s.st.watches)) {
		origins[w.origin] = (origins[w.origin] ?? 0) + 1
		dates[w.when.kind] = (dates[w.when.kind] ?? 0) + 1
	}
	return (
		<details open className="rounded-xl bg-white p-3 text-xs text-black ring-2 ring-fuchsia-500">
			<summary className="cursor-pointer text-sm font-bold">Prototype controls and stored state (not part of the design)</summary>
			<div className="mt-2 grid gap-3 lg:grid-cols-2">
				<div className="flex flex-col gap-2">
					<div className="flex flex-wrap gap-1.5">
						{Object.entries(SHOWS).map(([key, label]) => (
							<Link key={key} to={link({ show: key })} preventScrollReset title={label} className={`rounded-full px-2.5 py-1 font-semibold ${key === showKey ? "bg-black text-white" : "bg-neutral-200 hover:bg-neutral-300"}`}>
								{label.split(":")[0]}
							</Link>
						))}
					</div>
					<p className="text-neutral-600">{SHOWS[showKey as keyof typeof SHOWS]}. Episodes are a TMDB snapshot from {s.show.fetched}.</p>
					<div className="flex flex-wrap items-center gap-1.5">
						<span className="font-semibold">Start from:</span>
						{(Object.keys(SCENARIOS) as Scenario[]).map((name) => (
							<button key={name} type="button" onClick={() => s.load(name)} className="cursor-pointer rounded-full bg-neutral-200 px-2.5 py-1 hover:bg-neutral-300">
								{SCENARIOS[name]}
							</button>
						))}
					</div>
					<div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
						<label className="flex items-center gap-1.5">
							<span className="font-semibold">Today is</span>
							<input type="date" value={s.today} onChange={(e) => e.target.value && setParams(new URLSearchParams(link({ today: e.target.value }).slice(1)), { replace: true, preventScrollReset: true })} className="rounded border border-neutral-300 px-1 py-0.5" />
						</label>
						<label className="flex items-center gap-1.5">
							<input type="checkbox" checked={s.allBulk} onChange={(e) => s.setAllBulk(e.target.checked)} />
							Removing Seen also removes season and "up to here" marks
						</label>
					</div>
				</div>
				<div className="rounded-lg bg-neutral-100 p-2 font-mono leading-relaxed">
					<p>
						status: <b>{s.st.status ?? "none"}</b> · seen: <b>{String(s.d.seen)}</b>
						{s.d.seen ? ` (${[s.st.seenMarked && "watched", s.st.score != null && "scored"].filter(Boolean).join(", ")})` : ""} · score: <b>{s.st.score ?? "none"}</b> · want: <b>{String(s.st.want)}</b> · not interested: <b>{String(s.st.hidden)}</b>
					</p>
					<p>
						watched {s.d.watched.length}/{s.d.aired.length} aired regular · {s.d.unaired} unaired · specials watched {s.d.specialsWatched} · season airing: {String(s.d.airing)} · caught up: {String(s.d.caughtUp)}
					</p>
					<p>
						watches by origin: {JSON.stringify(origins)} · by date: {JSON.stringify(dates)}
					</p>
					<p>next episode: {s.d.next ? `${epCode(s.show, s.d.next)} ${s.d.next.name}` : "none"}</p>
					{s.st.log.filter(Boolean).map((line, i) => (
						// biome-ignore lint/suspicious/noArrayIndexKey: a log
						<p key={i} className={i ? "text-neutral-500" : "font-bold"}>
							› {line}
						</p>
					))}
				</div>
			</div>
		</details>
	)
}

export const statusNote = (status: Status) => (status ? STATUS_LOOK[status].note : "")
