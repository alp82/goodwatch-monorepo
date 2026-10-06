// PROTOTYPE - throwaway. The surfaces of /prototype/watch-log, each a copy of the real one around the Seen control:
// the title page hero's action area, the poster card's row of actions, and Watch next's "I watched it" with its
// finish dialog. Plus the prototype's own switches, toast and state panel.
import { CheckIcon, ChevronDownIcon, EyeIcon, XMarkIcon } from "@heroicons/react/24/solid"
import { useSearchParams } from "@remix-run/react"
import { type ReactNode, useEffect, useRef, useState } from "react"
import Drawer from "~/ui/modal/Drawer"
import { ActionButton, ScoreButton } from "~/ui/title-actions/ActionButton"
import { DateChips, Flyout, RemoveAllConfirm, WatchLog, optionOf } from "./log"
import { FILMS, type Film, NEXT_FILM, type OrderMode, type RemoveMode, TMDB, lastRecorded, summary, whenText } from "./model"
import { useStore } from "./store"

export function Section({ n, title, note, children }: { n: number; title: string; note: ReactNode; children: ReactNode }) {
	return (
		<section className="mt-12 first:mt-6" data-section={n}>
			<header className="mb-4">
				<h2 className="text-base font-bold tracking-tight text-gray-100 sm:text-lg md:text-xl lg:text-2xl">
					<span className="mr-2 text-gray-500">{n}</span>
					{title}
				</h2>
				<p className="mt-1 max-w-3xl text-sm text-gray-400">{note}</p>
			</header>
			{children}
		</section>
	)
}

const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
const SEEN_ON = "bg-green-500 text-black"
const SEEN_OFF = "bg-white/10 text-gray-100 hover:bg-white/20"

function CountPill({ count }: { count: number }) {
	if (count < 2) return null
	return <span className="rounded-full bg-black/20 px-1.5 text-xs font-bold tabular-nums">{count}×</span>
}

/**
 * Pressing Seen on a film that has watches, in variants A and B. Returns what the surface should show next.
 * "latest" removes the watch recorded last; "all" removes the only watch or asks about several; "log" removes the only
 * watch and points at the log when there are several.
 */
function useRemoveSeen(film: Film) {
	const s = useStore()
	return (): "done" | "confirm" | "log" => {
		const watches = s.of(film.id)
		if (watches.length === 1 || s.remove === "latest") {
			const watch = lastRecorded(watches)
			s.removeOne(film.id, watch.id)
			s.say(watches.length === 1 ? `${film.title} is no longer Seen` : `Removed the watch ${whenText(watch)}. ${watches.length - 1} left, still Seen.`, { undo: true })
			return "done"
		}
		return s.remove === "all" ? "confirm" : "log"
	}
}

/**
 * Want to See, Seen, Not interested as on the title page, with the variant's Seen control and whatever it puts under
 * the row. `inline`: inside a sheet already, so menus and the log open in place.
 */
export function ActionArea({ film, inline = false }: { film: Film; inline?: boolean }) {
	const s = useStore()
	const watches = s.of(film.id)
	const seen = watches.length > 0
	const removeSeen = useRemoveSeen(film)
	const [want, setWant] = useState(false)
	const [hidden, setHidden] = useState(false)
	const [menu, setMenu] = useState(false)
	const [logOpen, setLogOpen] = useState(false)
	const [panel, setPanel] = useState<false | { editing?: string }>(false)
	const [confirm, setConfirm] = useState(false)
	const [pointed, setPointed] = useState(false)
	const [strip, setStrip] = useState<string | null>(null)
	const log = useRef<HTMLDivElement>(null)
	const made = watches.find((watch) => watch.id === strip)

	const press = () => {
		setConfirm(false)
		setPointed(false)
		if (!seen) {
			const watch = s.add(film.id, { precision: "moment" })
			setHidden(false)
			if (s.variant === "B") return setStrip(watch.id)
			s.say(`${film.title} is Seen, watched just now`, {
				undo: true,
				action: s.variant === "C" ? { label: "Change date", run: () => setPanel({ editing: watch.id }) } : undefined,
			})
			return
		}
		if (s.variant === "C") return setPanel(panel ? false : {})
		setStrip(null)
		const next = removeSeen()
		if (next === "confirm") setConfirm(true)
		if (next === "log") {
			setPointed(true)
			setLogOpen(true)
			log.current?.scrollIntoView({ block: "nearest", behavior: "smooth" })
		}
	}

	const addMenu = (
		<>
			<p className="mb-2 text-sm font-semibold text-gray-200">{seen ? `Watched ${film.title} again?` : `When did you watch ${film.title}?`}</p>
			<DateChips
				options={["now", "yesterday", "day", "unknown"]}
				onPick={(when) => {
					const watch = s.add(film.id, when)
					setHidden(false)
					setMenu(false)
					s.say(`Added a watch ${whenText(watch)}`, { undo: true })
				}}
			/>
		</>
	)
	const label = (
		<>
			<EyeIcon className={`h-4 w-4 shrink-0 ${seen ? "" : "text-green-300"}`} />
			<span className="truncate">{seen ? "Seen" : s.variant === "A" ? "Seen" : "Mark as Seen"}</span>
			<CountPill count={watches.length} />
		</>
	)
	const BUTTON = `inline-flex h-11 min-w-0 items-center justify-center gap-2 px-3 text-sm font-semibold cursor-pointer transition-colors ${FOCUS} ${seen ? SEEN_ON : SEEN_OFF}`

	return (
		<div className="@container" data-action-area={film.id}>
			<div className="grid grid-cols-2 gap-2 @lg:grid-cols-3">
				<ActionButton kind="want" label="long" active={want} onClick={() => setWant(!want)} />

				{s.variant === "A" && (
					<div className="relative flex min-w-0">
						<button type="button" aria-pressed={seen} onClick={press} className={`${BUTTON} grow rounded-l-lg`} data-seen>
							{label}
						</button>
						<button
							type="button"
							aria-haspopup="true"
							aria-expanded={menu}
							aria-label={seen ? "Add another watch" : "Watched it another day"}
							title={seen ? "Add another watch" : "Watched it another day"}
							onClick={() => setMenu(!menu)}
							className={`${BUTTON} w-10 shrink-0 rounded-r-lg border-l px-0 ${seen ? "border-black/25" : "border-white/15"}`}
							data-seen-caret
						>
							<ChevronDownIcon className="h-4 w-4" />
						</button>
						{!inline && (
							<Flyout open={menu} onClose={() => setMenu(false)}>
								{addMenu}
							</Flyout>
						)}
					</div>
				)}

				{s.variant === "B" && (
					<button type="button" aria-pressed={seen} onClick={press} className={`${BUTTON} w-full rounded-lg`} data-seen>
						{label}
					</button>
				)}

				{s.variant === "C" && (
					<div className="relative min-w-0">
						<button type="button" aria-pressed={seen} aria-haspopup={seen ? "dialog" : undefined} aria-expanded={seen ? !!panel : undefined} onClick={press} className={`${BUTTON} w-full rounded-lg`} data-seen>
							{label}
							{seen && <ChevronDownIcon className="h-4 w-4 shrink-0" />}
						</button>
						{!inline && (
							<Flyout open={!!panel} onClose={() => setPanel(false)}>
								<p className="truncate text-sm font-bold">{film.title}</p>
								<p className="mb-2 text-xs text-gray-400">{summary(watches)}</p>
								<WatchLog film={film} canAdd canRemoveAll editing={panel ? panel.editing : undefined} />
							</Flyout>
						)}
					</div>
				)}

				<ActionButton
					kind="hide"
					label="long"
					className="col-span-2 @lg:col-span-1"
					active={hidden}
					disabled={seen}
					title={seen ? "You've seen it. Not interested is for titles you haven't seen." : "Hide it from your recommendations"}
					onClick={() => setHidden(!hidden)}
				/>
			</div>

			{s.variant === "A" && inline && (
				<Flyout open={menu} onClose={() => setMenu(false)} inline>
					{addMenu}
				</Flyout>
			)}
			{s.variant === "C" && inline && (
				<Flyout open={!!panel} onClose={() => setPanel(false)} inline>
					<WatchLog film={film} canAdd canRemoveAll editing={panel ? panel.editing : undefined} />
				</Flyout>
			)}

			{confirm && <RemoveAllConfirm film={film} onDone={() => setConfirm(false)} />}
			{pointed && watches.length > 1 && (
				<p className="mt-3 rounded-lg bg-white/5 px-3 py-2 text-sm text-gray-200" data-pointed>
					{film.title} stays Seen while it has watches. Delete the ones that are wrong below.
				</p>
			)}

			{s.variant === "B" && made && (
				<div className="mt-3 rounded-lg bg-green-500/10 p-3 ring-1 ring-green-400/30" data-strip>
					<div className="mb-2 flex items-start gap-2">
						<p className="grow text-sm text-gray-100">
							<CheckIcon className="mr-1 inline h-4 w-4 text-green-300" aria-hidden />
							Watched {whenText(made)}. <span className="text-gray-400">Not right?</span>
						</p>
						<button type="button" onClick={() => setStrip(null)} aria-label="Close" className="-m-1 cursor-pointer rounded p-1 text-gray-400 hover:text-white">
							<XMarkIcon className="h-4 w-4" />
						</button>
					</div>
					<DateChips options={["now", "yesterday", "day", "unknown"]} chosen={optionOf(made)} chosenDay={made.at?.slice(0, 10)} onPick={(when) => s.update(film.id, made.id, when)} />
				</div>
			)}

			{s.variant === "A" && seen && (
				<div ref={log} className="mt-3">
					<button
						type="button"
						onClick={() => setLogOpen(!logOpen)}
						aria-expanded={logOpen}
						className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-1 py-1 text-left text-sm text-gray-300 hover:text-white"
						data-log-line
					>
						<span className="grow">{summary(watches)}</span>
						<span className="text-xs font-semibold text-gray-400">{logOpen ? "Hide" : "Show"}</span>
						<ChevronDownIcon className={`h-4 w-4 text-gray-400 transition-transform ${logOpen ? "rotate-180" : ""}`} />
					</button>
					{logOpen && <WatchLog film={film} canRemoveAll className="mt-1 rounded-lg bg-black/30 px-3 py-1.5" />}
				</div>
			)}

			{s.variant === "B" && (
				<div ref={log} className={`mt-4 rounded-lg bg-black/30 px-3 py-2 ring-1 ${pointed ? "ring-green-400/60" : "ring-white/10"}`}>
					<p className="text-xs font-bold uppercase tracking-wide text-gray-400">Your watches</p>
					<WatchLog film={film} canAdd canRemoveAll />
				</div>
			)}
		</div>
	)
}

/** The hero's box (~/ui/details/hero/DetailsHero.tsx) without the score, trailer and where-to-watch parts. */
export function HeroSection({ film }: { film: Film }) {
	const s = useStore()
	return (
		<div className="grid gap-4 md:grid-cols-[14rem_minmax(0,1fr)] [&>*]:min-w-0">
			<img src={`${TMDB}/w342${film.poster}`} alt="" className="hidden aspect-[2/3] w-full rounded-xl object-cover md:block" />
			<div className="relative isolate z-30 flex min-w-0 flex-col rounded-2xl border border-white/10 bg-stone-950 md:rounded-xl">
				<div className="absolute inset-0 -z-10 overflow-hidden rounded-2xl md:rounded-xl" aria-hidden="true">
					<img src={`${TMDB}/w780${film.backdrop ?? film.poster}`} alt="" className="h-full w-full scale-110 object-cover object-[center_25%]" />
					<div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
					<div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/70" />
				</div>
				<div className="flex grow flex-col px-4 pb-5 pt-4 md:p-5 lg:p-7">
					<p className="truncate text-lg font-bold text-white">
						{film.title} ({film.year})
					</p>
					<p className="text-xs text-gray-300">Score and where to watch are unchanged and left out here.</p>
					<div className="min-h-6 grow" />
					<div aria-hidden="true" className="mb-5 h-px bg-white/10" />
					<ActionArea key={`${film.id}-${s.variant}`} film={film} />
				</div>
			</div>
		</div>
	)
}

export function FilmPicker({ current }: { current: string }) {
	const [params, setParams] = useSearchParams()
	const s = useStore()
	return (
		<div className="mb-4 flex flex-wrap gap-2" data-film-picker>
			{FILMS.map((film) => (
				<button
					key={film.id}
					type="button"
					aria-pressed={film.id === current}
					onClick={() => {
						const next = new URLSearchParams(params)
						next.set("film", film.id)
						setParams(next, { replace: true, preventScrollReset: true })
					}}
					data-film={film.id}
					className={`cursor-pointer rounded-xl px-3 py-2 text-left ${film.id === current ? "bg-white text-black" : "bg-white/10 text-gray-200 hover:bg-white/20"}`}
				>
					<span className="block text-sm font-bold">{film.title}</span>
					<span className={`block text-xs ${film.id === current ? "text-gray-700" : "text-gray-400"}`}>{summary(s.of(film.id))}</span>
				</button>
			))}
		</div>
	)
}

/**
 * A poster card with its row of four actions (~/ui/title-actions/CardActions.tsx). The real row shows on hover; here
 * it is always there. The real phone card opens the sheet by press and hold; here a button under the card does.
 */
function PosterCard({ film, align }: { film: Film; align: "left" | "right" }) {
	const s = useStore()
	const watches = s.of(film.id)
	const seen = watches.length > 0
	const removeSeen = useRemoveSeen(film)
	const [want, setWant] = useState(false)
	const [hidden, setHidden] = useState(false)
	const [panel, setPanel] = useState<false | { editing?: string; confirm?: boolean }>(false)
	const [sheet, setSheet] = useState(false)
	const press = () => {
		if (!seen) {
			const watch = s.add(film.id, { precision: "moment" })
			setHidden(false)
			s.say(`${film.title} is Seen, watched just now`, { undo: true, action: { label: "Change date", run: () => setPanel({ editing: watch.id }) } })
			return
		}
		if (s.variant === "C") return setPanel(panel ? false : {})
		const next = removeSeen()
		if (next !== "done") setPanel({ confirm: next === "confirm" })
	}
	return (
		<div className="relative min-w-0" data-card={film.id}>
			<div className="relative overflow-hidden rounded-lg">
				<img src={`${TMDB}/w342${film.poster}`} alt="" className="aspect-[2/3] w-full object-cover" />
				<div className="absolute inset-x-2.5 bottom-2.5 z-20 flex gap-1 rounded-lg bg-gray-900/90 p-1">
					<ScoreButton score={null} />
					<ActionButton kind="want" label="none" size="sm" active={want} onClick={() => setWant(!want)} />
					<div className="relative w-full min-w-0">
						<ActionButton kind="seen" label="none" size="sm" active={seen} onClick={press} data-seen />
						{watches.length > 1 && (
							<span className="pointer-events-none absolute -right-1 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-white px-1 text-[10px] font-bold tabular-nums text-black ring-2 ring-gray-900">
								{watches.length}
							</span>
						)}
					</div>
					<ActionButton kind="hide" label="none" size="sm" active={hidden} disabled={seen} onClick={() => setHidden(!hidden)} />
				</div>
			</div>
			<p className="mt-1.5 truncate text-sm font-semibold text-gray-100">{film.title}</p>
			<p className="truncate text-xs text-gray-400">{summary(watches)}</p>
			<button type="button" onClick={() => setSheet(true)} className="mt-1 cursor-pointer text-xs text-gray-400 underline decoration-white/20 underline-offset-2 hover:text-white" data-open-sheet>
				Open the phone sheet
			</button>
			<Flyout open={!!panel} onClose={() => setPanel(false)} align={align}>
				<p className="truncate text-sm font-bold">{film.title}</p>
				<p className="mb-2 text-xs text-gray-400">{summary(watches)}</p>
				{panel && <WatchLog film={film} canAdd canRemoveAll editing={panel.editing} confirmAtStart={panel.confirm} />}
			</Flyout>
			<Drawer open={sheet} onClose={() => setSheet(false)} allSizes>
				<div className="mx-auto max-w-md p-1 text-white">
					<h3 className="mb-3 truncate text-sm font-semibold text-gray-300">{film.title}</h3>
					{sheet && <ActionArea key={s.variant} film={film} inline />}
				</div>
			</Drawer>
		</div>
	)
}

export function CardsSection() {
	return (
		<div className="grid max-w-3xl grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-4">
			{FILMS.map((film, index) => (
				<PosterCard key={film.id} film={film} align={index >= 2 ? "right" : "left"} />
			))}
		</div>
	)
}

/**
 * Watch next's hero button and the panel of ~/ui/watch-next/FinishPrompt.tsx, drawn in the page instead of in a
 * dialog. "I watched it" records a watch for now, as today; the panel gains the date.
 */
export function WatchNextSection() {
	const s = useStore()
	const film = NEXT_FILM
	const watches = s.of(film.id)
	const watch = watches[0]
	const [prompt, setPrompt] = useState(false)
	const [changing, setChanging] = useState(false)
	const [score, setScore] = useState<number | null>(null)
	useEffect(() => {
		if (!watch) setPrompt(false)
	}, [watch])
	return (
		<div className="grid gap-4 lg:grid-cols-2 [&>*]:min-w-0">
			<div className="flex items-center gap-4 rounded-2xl bg-stone-950 p-4 ring-1 ring-white/10">
				<img src={`${TMDB}/w154${film.poster}`} alt="" className="h-36 w-24 shrink-0 rounded-md object-cover" />
				<div className="min-w-0">
					<p className="text-xs font-semibold uppercase tracking-wide text-amber-300">Tonight's pick</p>
					<p className="truncate text-xl font-bold text-white">{film.title}</p>
					{watch ? (
						<div className="mt-3">
							<p className="text-sm text-green-300">
								<CheckIcon className="mr-1 inline h-4 w-4" aria-hidden />
								Moved to Seen, watched {whenText(watch)}
							</p>
							<button
								type="button"
								onClick={() => {
									s.removeAll(film.id)
									setScore(null)
									setChanging(false)
								}}
								className="mt-1 cursor-pointer text-xs text-gray-400 underline decoration-white/20 underline-offset-2 hover:text-white"
								data-replay
							>
								Put it back to try again
							</button>
						</div>
					) : (
						<button
							type="button"
							onClick={() => {
								s.add(film.id, { precision: "moment" })
								setPrompt(true)
							}}
							className="mt-3 inline-flex h-12 cursor-pointer items-center gap-2 rounded-lg bg-white/10 px-4 font-semibold text-white backdrop-blur hover:bg-white/20"
							data-finish
						>
							<CheckIcon className="h-5 w-5 text-green-400" aria-hidden />I watched it
						</button>
					)}
				</div>
			</div>
			{prompt && watch ? (
				<div className="w-full rounded-2xl border border-white/10 bg-stone-900 p-5 text-white shadow-2xl shadow-black/70 sm:w-[26rem]" data-finish-prompt>
					<div className="flex items-center gap-3">
						<img src={`${TMDB}/w154${film.poster}`} alt="" className="h-20 w-[3.35rem] shrink-0 rounded-md object-cover" />
						<div className="min-w-0">
							<p className="text-xs font-semibold text-green-300">
								<CheckIcon className="mr-1 inline h-3.5 w-3.5" aria-hidden />
								Moved to Seen
							</p>
							<p className="truncate text-lg font-bold">How was {film.title}?</p>
							<p className="text-xs text-gray-400">Your score sharpens what we suggest next.</p>
						</div>
					</div>
					<div className="mt-4 grid grid-cols-10 gap-1" aria-label="The score control (unchanged, a stand-in here)">
						{[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
							<button key={n} type="button" onClick={() => setScore(n)} className={`h-9 cursor-pointer rounded-md text-sm font-bold ${score === n ? `bg-vibe-${n * 10} text-white` : "bg-white/10 text-gray-200 hover:bg-white/20"}`}>
								{n}
							</button>
						))}
					</div>
					<div className="mt-4 border-t border-white/10 pt-3" data-finish-date>
						{s.variant === "B" ? (
							<>
								<p className="mb-2 text-xs text-gray-400">When did you watch it?</p>
								<DateChips options={["now", "yesterday", "day", "unknown"]} chosen={optionOf(watch)} chosenDay={watch.at?.slice(0, 10)} onPick={(when) => s.update(film.id, watch.id, when)} />
							</>
						) : (
							<>
								<p className="text-sm text-gray-300">
									Watched {whenText(watch)}.{" "}
									<button type="button" onClick={() => setChanging(!changing)} aria-expanded={changing} className="cursor-pointer font-semibold text-white underline decoration-white/30 underline-offset-2" data-change>
										Change
									</button>
								</p>
								{changing && (
									<div className="mt-2">
										<DateChips
											options={["now", "yesterday", "day", "unknown"]}
											chosen={optionOf(watch)}
											chosenDay={watch.at?.slice(0, 10)}
											onPick={(when) => {
												s.update(film.id, watch.id, when)
												setChanging(false)
											}}
										/>
									</div>
								)}
							</>
						)}
					</div>
					<div className="mt-3 flex justify-end">
						<button type="button" onClick={() => setPrompt(false)} className="cursor-pointer rounded-lg px-3 py-2 text-sm text-gray-300 hover:bg-white/10">
							{score ? "Done" : "Rate later"}
						</button>
					</div>
				</div>
			) : (
				<p className="self-center text-sm text-gray-500">{watch ? "The dialog is closed." : "Press I watched it to open the dialog that follows."}</p>
			)}
		</div>
	)
}

const TOAST_MS = 8000

/** The look of ~/ui/title-actions/UndoToast.tsx, with room for a second button. */
export function Toast() {
	const s = useStore()
	const toast = s.toast
	const id = toast?.id
	useEffect(() => {
		if (id == null) return
		const timer = setTimeout(s.dismiss, TOAST_MS)
		return () => clearTimeout(timer)
	}, [id])
	return (
		<div className="pointer-events-none fixed inset-x-0 bottom-28 z-[1050] flex justify-center px-4 lg:bottom-20" aria-live="polite">
			{toast && (
				<div
					key={toast.id}
					className="pointer-events-auto flex max-w-full items-center gap-2 rounded-2xl border border-white/10 bg-stone-900/95 py-2 pl-4 pr-2 text-sm text-white shadow-2xl shadow-black/60 backdrop-blur"
					data-toast
				>
					<span className="min-w-0">{toast.text}</span>
					{toast.action && (
						<button
							type="button"
							onClick={() => {
								toast.action?.run()
								s.dismiss()
							}}
							className="shrink-0 cursor-pointer rounded-full bg-white/10 px-3 py-1 font-semibold text-white hover:bg-white/20"
							data-toast-action
						>
							{toast.action.label}
						</button>
					)}
					{toast.undo && (
						<button
							type="button"
							onClick={() => {
								toast.undo?.()
								s.dismiss()
							}}
							className="shrink-0 cursor-pointer rounded-full bg-white/10 px-3 py-1 font-semibold text-amber-300 hover:bg-white/20"
							data-toast-undo
						>
							Undo
						</button>
					)}
				</div>
			)}
		</div>
	)
}

const REMOVE: Record<RemoveMode, string> = { latest: "Removes the last one", all: "Removes all, asks first", log: "Stays on, points at the log" }
const ORDER: Record<OrderMode, string> = { dated: "Dated first, unknown last", recorded: "As recorded" }

function Switch<T extends string>({ name, label, options, current }: { name: string; label: string; options: Record<T, string>; current: T }) {
	const [params, setParams] = useSearchParams()
	return (
		<div className="flex flex-wrap items-center gap-1.5">
			<span className="text-gray-500">{label}</span>
			{(Object.keys(options) as T[]).map((key) => (
				<button
					key={key}
					type="button"
					aria-pressed={current === key}
					onClick={() => {
						const next = new URLSearchParams(params)
						next.set(name, key)
						setParams(next, { replace: true, preventScrollReset: true })
					}}
					data-switch={`${name}-${key}`}
					className={`cursor-pointer rounded-full px-2.5 py-1 font-semibold ${current === key ? "bg-white text-black" : "bg-white/10 text-gray-200 hover:bg-white/20"}`}
				>
					{options[key]}
				</button>
			))}
		</div>
	)
}

/** The prototype's own switches (independent of the variant) and every watch in the store. */
export function StatePanel() {
	const s = useStore()
	return (
		<aside className="rounded-xl border border-fuchsia-500/50 bg-gray-950/95 p-3 text-xs text-gray-300" data-state-panel>
			<div className="mb-2 flex items-center gap-2">
				<span className="font-bold text-fuchsia-300">Prototype switches and state</span>
				<button type="button" onClick={s.reset} className="ml-auto cursor-pointer rounded-full bg-white/10 px-2.5 py-1 font-semibold text-gray-200 hover:bg-white/20" data-reset>
					Reset the samples
				</button>
			</div>
			<div className="flex flex-col gap-1.5">
				<Switch name="remove" label={s.variant === "C" ? "Pressing Seen again (cards and A, B only; C opens the log):" : "Pressing Seen again, several watches:"} options={REMOVE} current={s.remove} />
				<Switch name="order" label="Order of the log:" options={ORDER} current={s.order} />
			</div>
			<dl className="mt-2 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 font-mono text-[11px] leading-relaxed">
				{[...FILMS, NEXT_FILM].map((film) => (
					<div key={film.id} className="contents">
						<dt className="text-gray-500">{film.id}</dt>
						<dd data-state={film.id}>
							{s.of(film.id).length
								? s
										.of(film.id)
										.map((watch) => `${watch.precision}${watch.at ? ` ${watch.at.slice(0, 16)}` : ""} (${watch.origin === "import" ? watch.source : "by hand"})`)
										.join(" · ")
								: "no watches"}
						</dd>
					</div>
				))}
				<dt className="text-gray-500">last action</dt>
				<dd data-state="last">{s.lastAction}</dd>
			</dl>
		</aside>
	)
}
