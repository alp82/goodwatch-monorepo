// PROTOTYPE - throwaway. Shared pieces for the Watch next variants (#176): the poster card with a
// one-tap add, a title-details hero, service badges, the score picker, the toast, and keyboard reordering.
// The poster card, overlays, ScoreRing, and action buttons copy the production look exactly; only local state changes.
import { Bars2Icon, CheckIcon } from "@heroicons/react/20/solid"
import { BookmarkIcon, ChevronDoubleUpIcon, EyeIcon, PlusIcon, QueueListIcon, StarIcon, XMarkIcon } from "@heroicons/react/24/solid"
import { AnimatePresence, Reorder, motion, useDragControls } from "framer-motion"
import type React from "react"
import { useEffect, useRef, useState } from "react"
import ScoreRing from "~/ui/details/hero/ScoreRing"
import Drawer from "~/ui/modal/Drawer"
import { Poster } from "~/ui/Poster"
import RatingOverlay from "~/ui/ratings/RatingOverlay"
import StreamingOverlay from "~/ui/streaming/StreamingOverlay"
import UserDataOverlay from "~/ui/user/UserDataOverlay"
import { scoreLabels } from "~/utils/ratings"
import { type Offer, type Store, type Title, backdropUrl, ownedOffers, posterUrl } from "./model"

// ------------------------------------------------------------------ keyboard reordering

// Focus a queue item, then Alt+Arrow moves it, Home puts it first, Delete removes it, W marks it watched.
// Stops propagation so the prototype switcher does not also flip variants.
export function queueKeys(store: Store, key: string, index: number) {
	return (e: React.KeyboardEvent) => {
		const t = e.target as HTMLElement
		if (t !== e.currentTarget) return
		const back = e.key === "ArrowUp" || e.key === "ArrowLeft"
		const fwd = e.key === "ArrowDown" || e.key === "ArrowRight"
		if (e.altKey && (back || fwd)) {
			e.preventDefault()
			e.stopPropagation()
			store.move(key, index + (back ? -1 : 1))
			// Keep focus on the moved item once React re-renders.
			requestAnimationFrame(() => (document.querySelector(`[data-qkey="${key}"]`) as HTMLElement | null)?.focus())
		} else if (back || fwd) {
			// Plain arrows move focus between queue items.
			e.preventDefault()
			e.stopPropagation()
			const all = [...document.querySelectorAll<HTMLElement>("[data-qkey]")]
			all[all.indexOf(e.currentTarget as HTMLElement) + (back ? -1 : 1)]?.focus()
		} else if (e.key === "Home") {
			e.preventDefault()
			store.toTop(key)
		} else if (e.key === "Delete" || e.key === "Backspace") {
			e.preventDefault()
			store.remove(key)
		} else if (e.key.toLowerCase() === "w") {
			e.preventDefault()
			store.watched(key)
		}
	}
}

export function KeyHint({ className = "" }: { className?: string }) {
	return (
		<p className={`hidden text-xs text-gray-500 [@media(hover:hover)]:block ${className}`}>
			Drag to reorder. Or focus a title: <Kbd>Alt</Kbd> + arrows move it, <Kbd>Home</Kbd> puts it first, <Kbd>Del</Kbd> removes, <Kbd>W</Kbd> marks watched.
		</p>
	)
}
const Kbd = ({ children }: { children: React.ReactNode }) => (
	<kbd className="rounded border border-white/15 bg-white/5 px-1 py-px font-sans text-[11px] text-gray-300">{children}</kbd>
)

// ------------------------------------------------------------------ long press

// Long-press on touch fires `onLong` and swallows the click that follows, so the card link stays put.
export function useLongPress(onLong: () => void, ms = 450) {
	const timer = useRef<ReturnType<typeof setTimeout>>()
	const start = useRef<{ x: number; y: number } | null>(null)
	const fired = useRef(false)
	const clear = () => {
		clearTimeout(timer.current)
		start.current = null
	}
	return {
		onPointerDown: (e: React.PointerEvent) => {
			if (e.pointerType === "mouse") return
			fired.current = false
			start.current = { x: e.clientX, y: e.clientY }
			timer.current = setTimeout(() => {
				fired.current = true
				navigator.vibrate?.(15)
				onLong()
			}, ms)
		},
		onPointerMove: (e: React.PointerEvent) => {
			if (start.current && Math.hypot(e.clientX - start.current.x, e.clientY - start.current.y) > 10) clear()
		},
		onPointerUp: clear,
		onPointerCancel: clear,
		onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
		onClickCapture: (e: React.MouseEvent) => {
			if (fired.current) {
				e.preventDefault()
				e.stopPropagation()
				fired.current = false
			}
		},
	}
}

// ------------------------------------------------------------------ poster card

const overlayLinks = (offers: Offer[]) =>
	offers.map((o) => ({ provider_id: o.id, provider_name: o.name, provider_logo_path: o.logo.split("/original/")[1] })) as never

// MovieTvCard, same markup and overlays, with a Watch next button on hover and long-press on touch.
// A click opens the title in the variant's details hero instead of leaving the page.
export function PosterCard({
	title: t,
	store,
	onOpen,
	addLabel = "Watch next",
	onAdd,
}: {
	title: Title
	store: Store
	onOpen?: (t: Title) => void
	addLabel?: string
	onAdd?: (t: Title) => void
}) {
	const inQueue = store.has(t.key)
	const add = () => (onAdd ? onAdd(t) : inQueue ? store.remove(t.key) : store.add(t.key))
	const press = useLongPress(add)
	const [hover, setHover] = useState(false)
	// Hover a card and press N to add it without reaching for the mouse button.
	useEffect(() => {
		if (!hover) return
		const onKey = (e: KeyboardEvent) => {
			if ((e.target as HTMLElement).closest("input, textarea")) return
			if (e.key.toLowerCase() === "n") add()
		}
		window.addEventListener("keydown", onKey)
		return () => window.removeEventListener("keydown", onKey)
	})
	const rating = store.state.ratings[t.key]
	return (
		<div className="relative select-none [-webkit-touch-callout:none]" onPointerEnter={() => setHover(true)} onPointerLeave={() => setHover(false)} {...press}>
			<a
				href={`#${t.key}`}
				onClick={(e) => {
					e.preventDefault()
					onOpen?.(t)
				}}
				className="@container flex flex-col w-full bg-gray-900 hover:bg-gray-800 border-4 rounded-lg border-gray-800 hover:border-amber-700/50 transition-transform duration-100 transform scale-95 hover:scale-100 group"
				draggable="false"
			>
				<div className="relative">
					<UserDataOverlay score={(rating ?? null) as never} onWishList={store.onWishlist(t.key) && !inQueue} />
					<RatingOverlay ratings={{ goodwatch_overall_score_normalized_percent: t.score } as never} />
					<StreamingOverlay links={overlayLinks(ownedOffers(t))} />
					<Poster path={t.poster ?? undefined} title={t.title} />
					<div className="hidden @6xs:flex items-end absolute bottom-0 w-full min-h-40 px-2 py-2 bg-linear-to-t from-black/70 to-transparent group-hover:from-black/90 group-hover:via-90% overflow-hidden">
						<span className="text-sm font-bold text-white transition-transform duration-200 group-hover:-translate-y-1 pr-10">
							{t.title}
							{t.year ? ` (${t.year})` : ""}
						</span>
					</div>
				</div>
			</a>
			<button
				type="button"
				onClick={add}
				aria-pressed={inQueue}
				aria-label={inQueue ? `Remove ${t.title} from Watch next` : `${addLabel}: ${t.title}`}
				title={inQueue ? "In Watch next. Click to remove." : `${addLabel} (or hover and press N)`}
				className={`absolute bottom-4 right-4 z-10 flex h-9 items-center gap-1 rounded-full px-2.5 text-xs font-bold shadow-lg shadow-black/50 transition-opacity cursor-pointer focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-white ${
					inQueue ? "bg-amber-400 text-black" : `bg-white/90 text-black hover:bg-white ${hover ? "[@media(hover:hover)]:opacity-100 opacity-0" : "opacity-0"}`
				}`}
			>
				{inQueue ? <CheckIcon className="h-4 w-4" /> : <PlusIcon className="h-4 w-4" />}
				{!inQueue && <span>{addLabel}</span>}
			</button>
		</div>
	)
}

export function BrowseGrid({ titles, store, onOpen, heading = "Popular on your services", addLabel, onAdd, className = "" }: {
	titles: Title[]
	store: Store
	onOpen?: (t: Title) => void
	heading?: string
	addLabel?: string
	onAdd?: (t: Title) => void
	className?: string
}) {
	const shown = titles.filter((t) => !store.isSeen(t.key))
	return (
		<section className={className}>
			<div className="mb-3 flex items-baseline justify-between gap-3">
				<h2 className="text-xl font-bold text-white md:text-2xl">{heading}</h2>
				<p className="hidden text-xs text-gray-500 [@media(hover:hover)]:block">Hover a poster for {addLabel ?? "Watch next"}, or press N</p>
				<p className="text-xs text-gray-500 [@media(hover:hover)]:hidden">Long-press a poster to add it</p>
			</div>
			<div className="grid grid-cols-3 gap-1 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7">
				{shown.map((t) => (
					<div key={t.key} className="group/card">
						<PosterCard title={t} store={store} onOpen={onOpen} addLabel={addLabel} onAdd={onAdd} />
					</div>
				))}
			</div>
		</section>
	)
}

// ------------------------------------------------------------------ services

// Offer tiles as WhereToWatch draws them: logo square, green ring and check on your services.
export function ServiceTiles({ title: t, size = 40, max = 4, names = false, className = "" }: { title: Title; size?: number; max?: number; names?: boolean; className?: string }) {
	const mine = ownedOffers(t)
	const list = (mine.length ? mine : t.offers).slice(0, max)
	if (!t.offers.length) return <p className={`text-xs text-gray-400 ${className}`}>Not streaming in your country</p>
	return (
		<div className={`flex flex-wrap items-center gap-2 ${className}`}>
			{list.map((o) => (
				<span
					key={o.id}
					title={o.owned ? `${o.name}: one of your services` : `Stream on ${o.name}`}
					className={`relative flex shrink-0 items-center gap-2 rounded-lg border-2 bg-white/10 ${names ? "pr-2.5" : ""} ${o.owned ? "border-green-500" : "border-white/15 opacity-70"}`}
					style={{ height: size }}
				>
					<img src={o.logo} alt={o.name} className="aspect-square h-full rounded-md" />
					{names && <span className="truncate text-sm font-medium text-white">{o.name}</span>}
					{o.owned && (
						<span className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-green-500 text-black ring-2 ring-stone-950">
							<CheckIcon className="h-3 w-3" />
						</span>
					)}
				</span>
			))}
			{!mine.length && <span className="text-xs text-gray-400">Not on your services</span>}
		</div>
	)
}

// The "Stream on X" line for the first of your services, or the first offer at all.
export function watchLine(t: Title) {
	const mine = ownedOffers(t)[0]
	if (mine) return { text: `On ${mine.name}`, owned: true, offer: mine }
	if (t.offers[0]) return { text: `On ${t.offers[0].name}, not yours`, owned: false, offer: t.offers[0] }
	return { text: "Not streaming here", owned: false, offer: null }
}

// ------------------------------------------------------------------ action buttons (ListActions look)

const ACTIONS = {
	next: { Icon: QueueListIcon, short: "Next", off: "Watch next", on: "In Watch next", active: "bg-amber-400 text-black", tint: "text-amber-300" },
	want: { Icon: BookmarkIcon, short: "Want", off: "Want to See", on: "Want to See", active: "bg-amber-500 text-black", tint: "text-amber-300" },
	seen: { Icon: EyeIcon, short: "Seen", off: "Mark as Seen", on: "Seen", active: "bg-green-500 text-black", tint: "text-green-300" },
} as const

export function ActionButton({ kind, active, label, ...rest }: { kind: keyof typeof ACTIONS; active: boolean; label?: string } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
	const a = ACTIONS[kind]
	return (
		<button
			type="button"
			aria-pressed={active}
			className={`inline-flex h-11 w-full min-w-0 items-center justify-center gap-2 rounded-lg px-2 text-xs font-semibold cursor-pointer transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:px-4 sm:text-sm ${
				active ? a.active : "bg-white/10 text-gray-100 hover:bg-white/20"
			}`}
			{...rest}
		>
			<a.Icon className={`h-4 w-4 shrink-0 ${active ? "" : a.tint}`} />
			<span className="truncate sm:hidden">{active && kind === "next" ? "Queued" : a.short}</span>
			<span className="hidden truncate sm:inline">{label ?? (active ? a.on : a.off)}</span>
		</button>
	)
}

// ------------------------------------------------------------------ title-details hero

// DetailsHero at a smaller scale: poster, backdrop panel with glass bars, ScoreRing, where to watch,
// and the list actions with Watch next added as the first action.
export function TitleHero({ title: t, store, nextLabel, onNext, compact = false }: { title: Title; store: Store; nextLabel?: string; onNext?: (t: Title) => void; compact?: boolean }) {
	const inQueue = store.has(t.key)
	const GLASS = "md:rounded-xl md:border md:border-white/10 md:bg-black/55 md:backdrop-blur-md"
	return (
		<section aria-label={`${t.title} details`} className="min-w-0">
			<h2 className="mb-3 text-2xl font-bold text-white md:text-3xl">
				{t.title} <span className="font-normal text-gray-400">({t.year})</span>
			</h2>
			<div className={`grid gap-4 md:grid-cols-[auto_1fr] md:grid-rows-[minmax(0,1fr)] [&>*]:min-w-0 ${compact ? "md:h-[20rem]" : "md:h-[24rem]"}`}>
				<img src={posterUrl(t, "w500")} alt="" className={`hidden aspect-[2/3] rounded-xl object-cover md:block md:h-full ${compact ? "md:w-[13.3rem]" : "md:w-[16rem]"}`} />
				<div className="relative flex min-h-0 flex-col rounded-2xl border border-white/10 bg-stone-950 md:rounded-xl md:bg-transparent">
					<div className="absolute inset-0 hidden overflow-hidden rounded-xl md:block" aria-hidden="true">
						<img src={backdropUrl(t)} alt="" className="h-full w-full object-cover object-[center_25%]" />
						<div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/70" />
					</div>
					<img src={backdropUrl(t, "w780")} alt="" className="h-40 w-full rounded-t-2xl object-cover md:hidden" />
					<div className={`relative z-10 flex items-center gap-4 px-4 pt-3 md:m-3 md:py-3 ${GLASS}`}>
						<ScoreRing media={{ details: { goodwatch_overall_score_normalized_percent: t.score } } as never} size={48} />
						<p className="hidden min-w-0 flex-1 truncate text-sm text-gray-300 lg:block">{t.genres.join(", ")}</p>
					</div>
					<div className="hidden min-h-4 grow md:block" aria-hidden="true" />
					<div className={`relative flex flex-col gap-3 p-4 md:m-3 md:mt-0 ${GLASS}`}>
						<div className="flex items-center gap-3">
							<h3 className="shrink-0 text-sm font-semibold text-gray-200">Where to watch</h3>
							<ServiceTiles title={t} size={36} max={5} />
						</div>
						<div className="flex items-center gap-2 [&>*]:min-w-0 [&>*]:flex-1">
							<ActionButton
								kind="next"
								active={inQueue}
								label={inQueue ? `In Watch next #${store.queue.indexOf(t.key) + 1}` : (nextLabel ?? "Watch next")}
								onClick={() => (onNext ? onNext(t) : inQueue ? store.remove(t.key) : store.add(t.key))}
							/>
							<ActionButton kind="want" active={store.onWishlist(t.key) && !inQueue} onClick={() => store.wantToSee(t.key)} />
							<ActionButton kind="seen" active={store.isSeen(t.key)} onClick={() => store.watched(t.key)} />
						</div>
					</div>
				</div>
			</div>
		</section>
	)
}

// ------------------------------------------------------------------ score picker (RateButton look)

function ScorePicker({ title: t, onPick }: { title: Title; onPick: (n: number | null) => void }) {
	const [hover, setHover] = useState<number | null>(null)
	return (
		<div>
			<p className="flex h-9 items-baseline gap-2">
				{hover ? (
					<>
						<span className="text-3xl font-bold tabular-nums" style={{ color: `var(--color-vibe-${hover * 10})` }}>
							{hover}
						</span>
						<span className="text-lg font-semibold text-white">{scoreLabels[hover]}</span>
					</>
				) : (
					<span className="text-lg text-gray-400">Pick a score from 1 to 10</span>
				)}
			</p>
			<div className="mt-4 flex h-24 items-end gap-1.5" onPointerLeave={() => setHover(null)}>
				{Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
					<button
						key={n}
						type="button"
						aria-label={`${n}, ${scoreLabels[n]}`}
						onPointerEnter={() => setHover(n)}
						onFocus={() => setHover(n)}
						onClick={() => onPick(n)}
						className="flex h-full flex-1 cursor-pointer items-end rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
					>
						<span
							className="block w-full rounded-md transition-[height,background-color] duration-150 motion-reduce:transition-none"
							style={{ height: `${28 + n * 7.2}%`, background: hover != null && n <= hover ? `var(--color-vibe-${n * 10})` : "rgba(255,255,255,.1)" }}
						/>
					</button>
				))}
			</div>
			<div className="mt-1.5 flex justify-between text-[11px] text-gray-500">
				<span>1 {scoreLabels[1]}</span>
				<span>10 {scoreLabels[10]}</span>
			</div>
		</div>
	)
}

// After "I watched it": the title is already in Seen; this asks for the score with the RateButton picker.
export function RateDialog({ store }: { store: Store }) {
	const t = store.rate ? store.byKey.get(store.rate.key) : null
	const [mobile, setMobile] = useState(false)
	useEffect(() => setMobile(window.matchMedia("(max-width: 767px)").matches), [])
	const body = t && (
		<div className="text-white">
			<div className="flex items-center gap-3">
				<img src={posterUrl(t, "w154")} alt="" className="h-20 w-[3.35rem] shrink-0 rounded-md object-cover" />
				<div className="min-w-0">
					<p className="text-xs font-semibold text-green-300">
						<CheckIcon className="mr-1 inline h-3.5 w-3.5" />
						{store.rate?.episodeFinish ? "Last episode done. Moved to Seen" : "Moved to Seen"}
					</p>
					<h3 className="truncate text-lg font-bold">How was {t.title}?</h3>
					<p className="text-xs text-gray-400">Your score sharpens what we suggest next.</p>
				</div>
			</div>
			<div className="mt-4">
				<ScorePicker title={t} onPick={(n) => store.score(t.key, n)} />
			</div>
			<div className="mt-4 flex justify-end gap-2">
				<button type="button" onClick={() => store.score(t.key, null)} className="rounded-lg px-3 py-2 text-sm text-gray-300 hover:bg-white/10 cursor-pointer">
					Rate later
				</button>
			</div>
		</div>
	)
	if (mobile)
		return (
			<Drawer open={!!t} onClose={() => t && store.score(t.key, null)}>
				<div className="p-2">{body}</div>
			</Drawer>
		)
	return (
		<AnimatePresence>
			{t && (
				<motion.div className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/60 p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => store.score(t.key, null)}>
					<motion.div
						role="dialog"
						aria-label={`Rate ${t.title}`}
						initial={{ y: 16, scale: 0.98 }}
						animate={{ y: 0, scale: 1 }}
						className="w-[26rem] max-w-full rounded-2xl border border-white/10 bg-stone-900 p-5 shadow-2xl shadow-black/70"
						onClick={(e) => e.stopPropagation()}
					>
						{body}
					</motion.div>
				</motion.div>
			)}
		</AnimatePresence>
	)
}

// ------------------------------------------------------------------ toast

export function ToastBar({ store, bottom = "bottom-24 lg:bottom-6" }: { store: Store; bottom?: string }) {
	const { toast } = store
	useEffect(() => {
		if (!toast) return
		const id = setTimeout(() => store.setToast(null), 3500)
		return () => clearTimeout(id)
	}, [toast])
	return (
		<div className={`pointer-events-none fixed inset-x-0 z-[1050] flex justify-center px-4 ${bottom}`} aria-live="polite">
			<AnimatePresence>
				{toast && (
					<motion.div
						key={toast.id}
						initial={{ y: 12, opacity: 0 }}
						animate={{ y: 0, opacity: 1 }}
						exit={{ y: 12, opacity: 0 }}
						className="pointer-events-auto flex max-w-full items-center gap-3 rounded-2xl border border-white/10 bg-stone-900/95 py-2 pl-4 pr-2 text-sm text-white shadow-2xl shadow-black/60 backdrop-blur"
					>
						<span className="min-w-0">{toast.text}</span>
						{toast.undo && (
							<button type="button" onClick={store.undo} className="shrink-0 rounded-full bg-white/10 px-3 py-1 font-semibold text-amber-300 hover:bg-white/20 cursor-pointer">
								Undo
							</button>
						)}
					</motion.div>
				)}
			</AnimatePresence>
		</div>
	)
}

// ------------------------------------------------------------------ small bits

export function RateBadge({ n }: { n: number }) {
	return (
		<span className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-bold text-white" style={{ background: `var(--color-vibe-${n * 10})` }}>
			<StarIcon className="h-3 w-3" />
			{n}
		</span>
	)
}

export function EpisodeLine({ store, title: t, className = "" }: { store: Store; title: Title; className?: string }) {
	const ep = store.nextEpisode(t)
	if (!ep) return <span className={className}>{t.runtime ? `${Math.floor(t.runtime / 60)}h ${t.runtime % 60}m` : "Movie"}</span>
	return (
		<span className={className}>
			<span className="font-semibold">S{ep.s} E{ep.e}</span> <span className="opacity-75">{ep.name}</span>
		</span>
	)
}

export function ResetLink({ store }: { store: Store }) {
	return (
		<button type="button" onClick={store.reset} className="text-xs text-gray-500 underline decoration-white/20 underline-offset-2 hover:text-gray-300 cursor-pointer">
			Reset this demo
		</button>
	)
}

// ------------------------------------------------------------------ reorderable queue item

// A Reorder.Item that mouse users drag anywhere (except on buttons and links) and touch users drag by
// the grip, so a finger on the poster still scrolls the strip. Focusable for the keyboard scheme above.
export function QItem({
	store,
	k,
	index,
	className = "",
	grip = true,
	gripClassName = "",
	children,
	label,
}: {
	store: Store
	k: string
	index: number
	className?: string
	grip?: boolean
	gripClassName?: string
	children: React.ReactNode
	label: string
}) {
	const controls = useDragControls()
	return (
		<Reorder.Item
			value={k}
			dragListener={false}
			dragControls={controls}
			data-qkey={k}
			tabIndex={0}
			aria-label={`${index + 1}. ${label}`}
			onKeyDown={queueKeys(store, k, index)}
			onPointerDown={(e) => {
				if (e.pointerType !== "mouse") return
				if ((e.target as HTMLElement).closest("button, [data-nodrag]")) return
				e.preventDefault()
				controls.start(e)
			}}
			whileDrag={{ scale: 1.04, zIndex: 20, boxShadow: "0 24px 48px rgba(0,0,0,.6)" }}
			className={`relative select-none outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900 [@media(hover:hover)]:cursor-grab active:cursor-grabbing ${className}`}
		>
			{children}
			{grip && (
				<span
					data-nodrag
					aria-hidden="true"
					onPointerDown={(e) => {
						e.preventDefault()
						controls.start(e)
					}}
					className={`absolute z-10 flex touch-none items-center justify-center rounded-md bg-black/60 text-white/80 [@media(hover:hover)]:hidden ${gripClassName || "right-1 top-1 h-7 w-7"}`}
				>
					<Bars2Icon className="h-4 w-4" />
				</span>
			)}
		</Reorder.Item>
	)
}

// ------------------------------------------------------------------ item actions, peek, media query

export function ItemActions({ store, title: t, size = "sm", className = "", top = true }: { store: Store; title: Title; size?: "sm" | "md"; className?: string; top?: boolean }) {
	const ep = store.nextEpisode(t)
	const btn = `inline-flex items-center justify-center gap-1 rounded-lg font-semibold cursor-pointer transition-colors focus-visible:outline-2 focus-visible:outline-white ${size === "md" ? "h-10 px-3 text-sm" : "h-8 px-2 text-xs"}`
	const icon = size === "md" ? "h-4.5 w-4.5" : "h-4 w-4"
	const first = store.queue[0] === t.key
	return (
		<div className={`flex items-center gap-1.5 ${className}`} data-nodrag>
			<button type="button" onClick={() => (ep ? store.episodeWatched(t.key) : store.watched(t.key))} className={`${btn} bg-green-500 text-black hover:bg-green-400`} title={ep ? `Mark S${ep.s} E${ep.e} watched` : "I watched it"}>
				<CheckIcon className={icon} />
				{ep ? `E${ep.e}` : "Watched"}
			</button>
			{top && !first && (
				<button type="button" onClick={() => store.toTop(t.key)} className={`${btn} bg-white/10 text-gray-100 hover:bg-white/20`} title="Move to top" aria-label={`Move ${t.title} to top`}>
					<ChevronDoubleUpIcon className={icon} />
				</button>
			)}
			<button type="button" onClick={() => store.remove(t.key)} className={`${btn} bg-white/10 text-gray-100 hover:bg-white/20`} title="Remove from Watch next" aria-label={`Remove ${t.title}`}>
				<XMarkIcon className={icon} />
			</button>
		</div>
	)
}

// Title details in an overlay, for variants whose page has no room for an inline hero.
export function HeroPeek({ title, store, onClose, nextLabel, onNext }: { title: Title | null; store: Store; onClose: () => void; nextLabel?: string; onNext?: (t: Title) => void }) {
	useEffect(() => {
		if (!title) return
		const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose()
		window.addEventListener("keydown", onKey)
		return () => window.removeEventListener("keydown", onKey)
	}, [title])
	return (
		<AnimatePresence>
			{title && (
				<motion.div className="fixed inset-0 z-[1080] flex items-end justify-center bg-black/70 md:items-center md:p-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
					<motion.div
						initial={{ y: 40 }}
						animate={{ y: 0 }}
						exit={{ y: 40 }}
						className="relative max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-t-2xl bg-gray-900 p-4 md:rounded-2xl md:p-6"
						onClick={(e) => e.stopPropagation()}
					>
						<button type="button" onClick={onClose} aria-label="Close" className="absolute right-3 top-3 z-20 rounded-full bg-white/10 p-2 text-white hover:bg-white/20 cursor-pointer">
							<XMarkIcon className="h-5 w-5" />
						</button>
						<TitleHero title={title} store={store} nextLabel={nextLabel} onNext={onNext} />
					</motion.div>
				</motion.div>
			)}
		</AnimatePresence>
	)
}

export function useIsMobile(query = "(max-width: 767px)") {
	const [m, setM] = useState(false)
	useEffect(() => {
		const mq = window.matchMedia(query)
		const on = () => setM(mq.matches)
		on()
		mq.addEventListener("change", on)
		return () => mq.removeEventListener("change", on)
	}, [query])
	return m
}

export function MiniLogo({ title: t, className = "h-6 w-6" }: { title: Title; className?: string }) {
	const o = ownedOffers(t)[0]
	if (!o) return null
	return <img src={o.logo} alt={o.name} title={`On ${o.name}`} className={`rounded-md border border-green-500 ${className}`} />
}
