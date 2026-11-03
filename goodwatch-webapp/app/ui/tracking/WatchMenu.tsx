// How a member says they watched an episode, in the episode's detail. The button says what is true: "Not seen", which
// shows its action ("Mark as watched") on hover, or once watched a green line saying when. Pressing "Not seen" marks
// the episode watched right away (only this episode, just now) and opens the menu with those answers chosen; any other
// answer applies as it is picked, taking the previous mark back first (watch-menu.ts), so the episode list, its ticks
// and its spoiler covers always show what the menu says. The menu closes on Done, its close button, Escape, or a press
// outside; the green line opens it again. Undo, in the menu, takes the mark back.
//
// The answers are cards in the look of the show's status menu, under two questions so they read as two choices:
// which episodes (only when there is more than one to mark) and when. On a phone the menu is a sheet at the bottom of
// the screen; elsewhere it floats beside its button, above or below, wherever it fits.
import {
	CalendarDaysIcon,
	CheckIcon,
	ChevronDownIcon,
	ClockIcon,
	EyeSlashIcon,
	FilmIcon,
	QuestionMarkCircleIcon,
	QueueListIcon,
	XMarkIcon,
} from "@heroicons/react/24/solid"
import {
	type ReactNode,
	type RefObject,
	useEffect,
	useLayoutEffect,
	useRef,
	useState,
} from "react"
import { createPortal } from "react-dom"
import { episodeCode } from "~/domain/episode-label"
import type { WatchedWhen } from "~/domain/tracking/machine"
import type { PageEpisode } from "~/domain/tracking/show-page"
import type { WatchChoice } from "~/domain/tracking/watch-menu"
import type { Model } from "./EpisodeList"
import type { MenuMark } from "./actions"
import { FOCUS } from "./store"

const ANIMATION =
	"@keyframes gw-watch-in{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:none}}.gw-watch-in{animation:gw-watch-in 180ms cubic-bezier(.2,.8,.2,1)}" +
	"@keyframes gw-watch-sheet{from{transform:translateY(100%)}to{transform:none}}.gw-watch-sheet{animation:gw-watch-sheet 260ms cubic-bezier(.2,.8,.2,1)}" +
	"@keyframes gw-watch-dim{from{opacity:0}to{opacity:1}}.gw-watch-dim{animation:gw-watch-dim 200ms ease-out}" +
	"@media (prefers-reduced-motion:reduce){.gw-watch-in,.gw-watch-sheet,.gw-watch-dim{animation:none}}"

/** Above the page's bottom navigation and floating buttons. */
const LAYER = "z-[1290]"
const PHONE = "(max-width: 639.98px)"
/** The site bar and the title page's sticky header, which cover the top of the screen. */
const UNDER_HEADERS = 124

const dayWords = (day: string) =>
	new Date(`${day}T12:00:00`).toLocaleDateString(undefined, {
		month: "short",
		day: "numeric",
		year: "numeric",
	})

/** The green line's words for what the menu chose: "Watched just now", "10 watched Nov 3, 2026", "Watched". */
function choiceWords(choice: WatchChoice, count: number): string {
	const who = choice.upTo ? `${count} watched` : "Watched"
	return choice.when.precision === "unknown"
		? who
		: choice.when.precision === "moment"
			? `${who} just now`
			: `${who} ${dayWords(choice.when.day)}`
}

/** The episode's latest watch of the current pass, in words: "Watched Jan 8, 2025", "Watched today", "Watched, date unknown". */
export function watchedWords(model: Model, e: PageEpisode): string {
	const rows = model.view.watchesOf.get(e.id) ?? []
	const row =
		rows.find((r) => r.pass === model.view.derived.pass) ??
		rows[rows.length - 1]
	if (!row || row.watched_at === null || row.watched_at_precision === "unknown")
		return "Watched, date unknown"
	const day = new Date(row.watched_at).toISOString().slice(0, 10)
	if (day === model.today) return "Watched today"
	return `Watched ${new Date(row.watched_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`
}

/** The answers the menu shows for a watch made elsewhere: this episode, on its logged day or with no date. */
function choiceOf(model: Model, e: PageEpisode): WatchChoice {
	const rows = model.view.watchesOf.get(e.id) ?? []
	const row =
		rows.find((r) => r.pass === model.view.derived.pass) ??
		rows[rows.length - 1]
	if (!row || row.watched_at === null || row.watched_at_precision === "unknown")
		return { upTo: false, when: { precision: "unknown" } }
	return {
		upTo: false,
		when: {
			precision: "day",
			day: new Date(row.watched_at).toISOString().slice(0, 10),
		},
	}
}

function usePhone() {
	const [phone, setPhone] = useState(false)
	useEffect(() => {
		const query = window.matchMedia(PHONE)
		const on = () => setPhone(query.matches)
		on()
		query.addEventListener("change", on)
		return () => query.removeEventListener("change", on)
	}, [])
	return phone
}

/** A panel fixed to the screen beside its button: below it, or above when there's more room there; never clipped. */
function Floating({
	anchor,
	panel,
	children,
}: {
	anchor: RefObject<HTMLElement | null>
	panel: RefObject<HTMLDivElement>
	children: ReactNode
}) {
	const [at, setAt] = useState<{
		top: number
		left: number
		width: number
		max: number
	} | null>(null)
	useLayoutEffect(() => {
		let first = true
		const place = () => {
			let a = anchor.current?.getBoundingClientRect()
			if (!a) return
			const h = panel.current?.scrollHeight ?? 0
			// No room below: the page first moves the button up under the sticky headers, as far as that helps.
			if (
				first &&
				window.innerHeight - a.bottom - 14 < h &&
				a.top > UNDER_HEADERS
			) {
				window.scrollBy({
					top: Math.min(
						a.top - UNDER_HEADERS,
						h + 20 - (window.innerHeight - a.bottom),
					),
					behavior: "instant" as ScrollBehavior,
				})
				a = anchor.current?.getBoundingClientRect() ?? a
			}
			first = false
			const width = Math.min(window.innerWidth - 16, 320)
			const below = window.innerHeight - a.bottom - 14
			const above = a.top - 14 - UNDER_HEADERS
			const down = below >= h || below >= above
			const max = Math.max(200, down ? below : above)
			setAt({
				top: down ? a.bottom + 6 : a.top - Math.min(h, max) - 6,
				left: Math.max(
					8,
					Math.min(a.right - width, window.innerWidth - width - 8),
				),
				width,
				max,
			})
		}
		place()
		window.addEventListener("scroll", place, true)
		window.addEventListener("resize", place)
		return () => {
			window.removeEventListener("scroll", place, true)
			window.removeEventListener("resize", place)
		}
	}, [anchor, panel])
	return createPortal(
		<div
			ref={panel}
			// biome-ignore lint/a11y/useSemanticElements: a panel fixed beside its button; <dialog> would take it to the top layer
			role="dialog"
			aria-label="Watched"
			className={`gw-watch-in fixed ${LAYER} overflow-y-auto rounded-xl bg-gray-900 shadow-2xl shadow-black/60 ring-1 ring-white/10`}
			style={
				at
					? { top: at.top, left: at.left, width: at.width, maxHeight: at.max }
					: { top: -9999, left: 0, visibility: "hidden" }
			}
		>
			{children}
		</div>,
		document.body,
	)
}

export default function WatchMenu({
	e,
	model,
	before,
}: {
	e: PageEpisode
	model: Model
	/** The unwatched aired episodes before this one, which "Everything up to here" also marks. */
	before: number
}) {
	const watched = model.view.watched.has(e.id)
	const phone = usePhone()
	const [open, setOpen] = useState(false)
	const [choice, setChoice] = useState<WatchChoice | null>(null)
	// How many episodes "Everything up to here" covers, fixed when the menu opened.
	const [reach, setReach] = useState(before + 1)
	const mark = useRef<MenuMark | null>(null)
	// Each change waits for the one before: a new group made before the old one is gone would miss its episodes.
	const queue = useRef<Promise<void>>(Promise.resolve())
	const anchor = useRef<HTMLDivElement>(null)
	const panel = useRef<HTMLDivElement>(null)
	const { actions } = model

	useEffect(() => {
		if (!open) return
		const onEscape = (event: KeyboardEvent) =>
			event.key === "Escape" && setOpen(false)
		const outside = (event: PointerEvent) => {
			const target = event.target as Node
			if (
				!phone &&
				!anchor.current?.contains(target) &&
				!panel.current?.contains(target)
			)
				setOpen(false)
		}
		window.addEventListener("keydown", onEscape)
		document.addEventListener("pointerdown", outside)
		return () => {
			window.removeEventListener("keydown", onEscape)
			document.removeEventListener("pointerdown", outside)
		}
	}, [open, phone])

	// Unticked elsewhere (the row's tick, Unmark season, a refused save) while the menu is closed: it starts over.
	useEffect(() => {
		if (!watched && !open && choice) {
			setChoice(null)
			mark.current = null
		}
	}, [watched, open, choice])

	const run = (step: () => Promise<void> | void) => {
		queue.current = queue.current.then(step).catch(() => {})
	}
	const press = () => {
		if (open) return setOpen(false)
		if (!watched) {
			const first: WatchChoice = { upTo: false, when: { precision: "moment" } }
			mark.current = actions.markFromMenu(e, first)
			// The page refused it, and said why.
			if (!mark.current) return
			setReach(before + 1)
			setChoice(first)
		} else if (!choice) {
			// A watch made elsewhere: the menu starts from it, and its Undo removes it.
			setReach(before + 1)
			setChoice(choiceOf(model, e))
			mark.current = actions.existingMark(e)
		}
		setOpen(true)
	}
	const change = (patch: Partial<WatchChoice>) => {
		if (!choice) return
		const next = { ...choice, ...patch }
		setChoice(next)
		run(async () => {
			if (mark.current) await actions.unmarkFromMenu(mark.current)
			mark.current = actions.markFromMenu(e, next)
		})
	}
	const undo = () => {
		setOpen(false)
		setChoice(null)
		run(async () => {
			if (mark.current) await actions.unmarkFromMenu(mark.current)
			mark.current = null
		})
	}

	const current = choice ?? {
		upTo: false,
		when: { precision: "moment" } as WatchedWhen,
	}
	const kind = current.when.precision
	const many = reach > 1
	const card = (
		on: boolean,
		icon: ReactNode,
		name: string,
		hint: string,
		onPick: () => void,
		extra?: ReactNode,
	) => (
		<div
			className={`rounded-xl ring-1 transition-colors ${on ? "bg-green-500/[0.1] ring-green-400/50" : "bg-white/[0.04] ring-white/10 hover:bg-white/[0.08]"}`}
		>
			<button
				type="button"
				// biome-ignore lint/a11y/useSemanticElements: radio answers drawn as cards
				role="radio"
				aria-checked={on}
				onClick={onPick}
				className={`flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2 text-left sm:py-2.5 ${FOCUS}`}
			>
				{icon}
				<span className="min-w-0 flex-1 leading-tight">
					<span className="block text-sm font-bold text-white">{name}</span>
					<span className="block truncate text-xs text-gray-400">{hint}</span>
				</span>
				<CheckIcon
					className={`h-4 w-4 shrink-0 ${on ? "text-green-300" : "text-transparent"}`}
				/>
			</button>
			{on && extra}
		</div>
	)
	const question = (text: string) => (
		<p className="px-1 pb-1.5 text-xs font-semibold text-gray-300">{text}</p>
	)
	const body = (
		<div className="flex flex-col gap-3">
			<div className="flex items-start gap-2 px-1">
				<div className="min-w-0 flex-1">
					<p className="text-base font-semibold text-white">
						{current.upTo ? `${reach} episodes watched` : "Watched"}
					</p>
					<p className="truncate text-xs text-gray-400">
						{episodeCode(e)}
						{e.name ? ` · ${e.name}` : ""}
					</p>
				</div>
				<button
					type="button"
					aria-label="Close"
					onClick={() => setOpen(false)}
					className={`-mr-1 -mt-1 h-8 w-8 shrink-0 cursor-pointer rounded-full text-gray-400 hover:bg-white/10 hover:text-white ${FOCUS}`}
				>
					<XMarkIcon className="mx-auto h-4 w-4" />
				</button>
			</div>
			{many && (
				<div role="radiogroup" aria-label="Which episodes">
					{question("Which episodes?")}
					<div className="flex flex-col gap-2">
						{card(
							!current.upTo,
							<FilmIcon className="h-5 w-5 shrink-0 text-sky-300" />,
							`Only ${episodeCode(e)}`,
							"Just this episode",
							() => current.upTo && change({ upTo: false }),
						)}
						{card(
							current.upTo,
							<QueueListIcon className="h-5 w-5 shrink-0 text-violet-300" />,
							"Everything up to here",
							`${reach} episodes, this one included`,
							() => !current.upTo && change({ upTo: true }),
						)}
					</div>
				</div>
			)}
			<div role="radiogroup" aria-label="When">
				{question("When did you watch?")}
				<div className="flex flex-col gap-2">
					{card(
						kind === "moment",
						<ClockIcon className="h-5 w-5 shrink-0 text-amber-300" />,
						"Just now",
						"Today, at this time",
						() =>
							kind !== "moment" && change({ when: { precision: "moment" } }),
					)}
					{card(
						kind === "day",
						<CalendarDaysIcon className="h-5 w-5 shrink-0 text-emerald-300" />,
						"On a date",
						current.when.precision === "day"
							? dayWords(current.when.day)
							: "Pick the day",
						() =>
							kind !== "day" &&
							change({ when: { precision: "day", day: model.today } }),
						current.when.precision === "day" && (
							<div className="px-3 pb-3">
								<input
									type="date"
									value={current.when.day}
									max={model.today}
									onChange={(event) =>
										event.target.value &&
										change({
											when: { precision: "day", day: event.target.value },
										})
									}
									aria-label="The day you watched it"
									className="h-10 w-full rounded-lg bg-white/[0.06] px-3 text-sm text-white ring-1 ring-inset ring-white/10 [color-scheme:dark]"
								/>
							</div>
						),
					)}
					{card(
						kind === "unknown",
						<QuestionMarkCircleIcon className="h-5 w-5 shrink-0 text-gray-400" />,
						"Not sure when",
						"Saved without a date",
						() =>
							kind !== "unknown" && change({ when: { precision: "unknown" } }),
					)}
				</div>
			</div>
			<div className="flex items-center gap-2 border-t border-white/[0.08] px-1 pt-2">
				<button
					type="button"
					onClick={undo}
					className={`h-9 cursor-pointer rounded-lg px-3 text-sm font-semibold text-red-300 hover:bg-red-500/10 hover:text-red-200 ${FOCUS}`}
				>
					Undo
				</button>
				<button
					type="button"
					onClick={() => setOpen(false)}
					className={`ml-auto h-9 cursor-pointer rounded-lg bg-white/10 px-5 text-sm font-semibold text-white hover:bg-white/15 ${FOCUS}`}
				>
					Done
				</button>
			</div>
		</div>
	)

	return (
		<div ref={anchor} className="relative" data-watch-menu>
			<style>{ANIMATION}</style>
			{watched || choice ? (
				<button
					type="button"
					aria-expanded={open}
					aria-haspopup="dialog"
					onClick={press}
					className={`gw-watch-in flex h-10 w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-green-500/10 px-3 ring-1 ring-green-500/30 hover:bg-green-500/[0.16] ${FOCUS}`}
				>
					<CheckIcon className="h-4 w-4 shrink-0 text-green-300" />
					<span className="min-w-0 truncate text-sm font-semibold text-green-200">
						{choice ? choiceWords(choice, reach) : watchedWords(model, e)}
					</span>
					<ChevronDownIcon
						className={`h-4 w-4 shrink-0 text-green-300/70 transition-transform ${open ? "rotate-180" : ""}`}
					/>
				</button>
			) : (
				<button
					type="button"
					aria-haspopup="dialog"
					aria-label="Not seen. Mark as watched"
					onClick={press}
					className={`group flex h-10 w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-white/[0.06] text-sm font-semibold text-gray-300 ring-1 ring-inset ring-white/[0.08] transition-colors hover:bg-white hover:text-gray-900 focus-visible:bg-white focus-visible:text-gray-900 ${FOCUS}`}
				>
					<EyeSlashIcon className="h-4 w-4 group-hover:hidden group-focus-visible:hidden" />
					<CheckIcon className="hidden h-4 w-4 group-hover:block group-focus-visible:block" />
					<span className="group-hover:hidden group-focus-visible:hidden">
						Not seen
					</span>
					<span className="hidden group-hover:inline group-focus-visible:inline">
						Mark as watched
					</span>
				</button>
			)}
			{open &&
				(phone ? (
					createPortal(
						<div className={`fixed inset-0 ${LAYER} flex flex-col justify-end`}>
							<button
								type="button"
								aria-label="Close"
								onClick={() => setOpen(false)}
								className="gw-watch-dim absolute inset-0 cursor-default bg-black/60"
							/>
							<div
								ref={panel}
								// biome-ignore lint/a11y/useSemanticElements: a sheet that slides in; <dialog> can't animate in from the edge here
								role="dialog"
								aria-label="Watched"
								className="gw-watch-sheet relative max-h-[85dvh] overflow-y-auto rounded-t-2xl bg-gray-900 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 shadow-2xl ring-1 ring-white/10"
							>
								<div
									className="mx-auto mb-2 h-1 w-10 rounded-full bg-white/20"
									aria-hidden
								/>
								{body}
							</div>
						</div>,
						document.body,
					)
				) : (
					<Floating anchor={anchor} panel={panel}>
						<div className="p-2">{body}</div>
					</Floating>
				))}
		</div>
	)
}
