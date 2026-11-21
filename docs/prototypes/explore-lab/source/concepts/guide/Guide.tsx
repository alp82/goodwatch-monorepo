// PROTOTYPE - throwaway (prototype/explore-r4, concept `guide`). The guide: channels as rows of real poster cards under
// the pinned screen. One cell is in focus at a time and the screen shows it.
//
// How focus moves:
// - mouse: the card under the pointer;
// - keyboard: left/right through a channel's titles, up/down between channels (the page scrolls to keep the row
//   under the screen);
// - touch: the channel right under the screen as you scroll the page, and the card at the row's left edge as you
//   swipe the row. Nothing is hijacked: both are the browser's own scrolling.
import { CheckBadgeIcon, FireIcon, PlusIcon, ViewColumnsIcon } from "@heroicons/react/20/solid"
import { Link } from "@remix-run/react"
import { type CSSProperties, type ReactNode, useCallback, useEffect, useRef, useState } from "react"
import { RowArrows, useStepRow } from "~/ui/row-arrows"
import { TitlePosterCard } from "~/ui/title-card/TitlePosterCard"
import type { Address } from "../../kit/address"
import { PlaceMark, TraitWord, WRAP, wash } from "../../kit/ui"
import { NowShowing, PinnedScreen } from "./Screen"
import type { Cell, Channel } from "./types"

export interface Focus {
	ch: string
	key: number
}

type To = (a: Address, extra?: Record<string, string | undefined>) => string

const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches
const PHONE = "(max-width: 1023.98px)"

const cellOf = (channels: Channel[], f: Focus | null) => {
	const channel = channels.find((c) => c.id === f?.ch) ?? channels[0]
	const cell = channel?.cells.find((x) => x.card.key === f?.key) ?? channel?.cells[0]
	return channel && cell ? { channel, cell } : null
}

/** The bottom edge of whatever part of the screen is pinned right now. */
function pinBottom(root: HTMLElement) {
	let bottom = 0
	for (const el of root.querySelectorAll("[data-pinned-screen], [data-screen-pin]"))
		bottom = Math.max(bottom, el.getBoundingClientRect().bottom)
	return bottom
}

/** Brings a cell into view: sideways inside its row, and its row under the pinned screen. */
function reveal(root: HTMLElement, cell: HTMLElement) {
	const smooth: ScrollBehavior = reducedMotion() ? "auto" : "smooth"
	const rail = cell.closest<HTMLElement>("[data-rail]")
	if (rail) {
		const pad = 8
		const left = cell.offsetLeft
		const right = left + cell.offsetWidth
		if (left - pad < rail.scrollLeft) rail.scrollTo({ left: left - pad, behavior: smooth })
		else if (right + pad > rail.scrollLeft + rail.clientWidth)
			rail.scrollTo({ left: right + pad - rail.clientWidth, behavior: smooth })
	}
	const row = cell.closest<HTMLElement>("[data-row]")
	if (!row) return
	const box = row.getBoundingClientRect()
	const top = pinBottom(root) + 12
	if (box.top < top) window.scrollBy({ top: box.top - top, behavior: smooth })
	else if (box.bottom > window.innerHeight - 12)
		window.scrollBy({
			top: box.bottom - window.innerHeight + 12,
			behavior: smooth,
		})
}

function useGuideFocus(channels: Channel[], root: React.RefObject<HTMLElement>) {
	const [focus, setFocus] = useState<Focus | null>(null)
	const current = cellOf(channels, focus)
	const live = useRef({ channels, current })
	live.current = { channels, current }
	/** Per channel: the title it was last on. */
	const last = useRef<Record<string, number>>({})
	const hoverTimer = useRef<ReturnType<typeof setTimeout>>()

	const put = useCallback((ch: string, key: number) => {
		last.current[ch] = key
		setFocus((f) => (f?.ch === ch && f.key === key ? f : { ch, key }))
	}, [])

	/** The pointer rests on a card for a moment before the screen follows, so a pass across the row doesn't flicker. */
	const hover = useCallback(
		(ch: string, key: number) => {
			clearTimeout(hoverTimer.current)
			hoverTimer.current = setTimeout(() => put(ch, key), 70)
		},
		[put],
	)
	const unhover = useCallback(() => clearTimeout(hoverTimer.current), [])
	useEffect(() => () => clearTimeout(hoverTimer.current), [])

	// Arrow keys, once focus is inside the guide.
	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return
			if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) return
			const el = root.current
			const { channels: list, current: at } = live.current
			if (!el || !at) return
			// Only while the guide has the keyboard: a card (or its row's label) is focused.
			const active = document.activeElement as HTMLElement | null
			if (!active || !active.closest("[data-row]") || !el.contains(active)) return
			if (active.closest("input, textarea, select, [contenteditable], [role=menu], [role=dialog]"))
				return
			// The prototype switcher listens for the same keys on the window; inside the guide they are the guide's.
			e.stopPropagation()
			let ci = list.findIndex((c) => c.id === at.channel.id)
			let xi = at.channel.cells.findIndex((x) => x.card.key === at.cell.card.key)
			if (e.key === "ArrowLeft") xi--
			else if (e.key === "ArrowRight") xi++
			else {
				ci += e.key === "ArrowUp" ? -1 : 1
				const next = list[ci]
				if (!next) return
				const kept = next.cells.findIndex((x) => x.card.key === last.current[next.id])
				// The title under the one you came from, by where it sits on screen.
				const from = el.querySelector<HTMLElement>(
					`[data-row="${CSS.escape(at.channel.id)}"] [data-cell="${at.cell.card.key}"]`,
				)
				const rail = el.querySelector<HTMLElement>(
					`[data-row="${CSS.escape(next.id)}"] [data-rail]`,
				)
				if (kept >= 0) xi = kept
				else if (from && rail) {
					const x = from.getBoundingClientRect().left
					const cells = [...rail.querySelectorAll<HTMLElement>("[data-cell]")]
					const near = cells.reduce(
						(best, c, i) =>
							Math.abs(c.getBoundingClientRect().left - x) <
							Math.abs(cells[best].getBoundingClientRect().left - x)
								? i
								: best,
						0,
					)
					xi = near
				}
			}
			const channel = list[ci]
			const cell = channel?.cells[Math.min(xi, (channel?.cells.length ?? 1) - 1)]
			if (!channel || !cell || xi < 0 || xi >= channel.cells.length) return
			e.preventDefault()
			put(channel.id, cell.card.key)
			const node = el.querySelector<HTMLElement>(
				`[data-row="${CSS.escape(channel.id)}"] [data-cell="${cell.card.key}"]`,
			)
			if (!node) return
			node.querySelector<HTMLElement>("a")?.focus({ preventScroll: true })
			reveal(el, node)
		}
		window.addEventListener("keydown", onKey, true)
		return () => window.removeEventListener("keydown", onKey, true)
	}, [put, root])

	// Touch: the channel right under the pinned screen is the one in focus.
	useEffect(() => {
		const el = root.current
		if (!el) return
		const phone = window.matchMedia(PHONE)
		let frame = 0
		const pick = () => {
			frame = 0
			if (!phone.matches) return
			const line = pinBottom(el)
			for (const row of el.querySelectorAll<HTMLElement>("[data-row]")) {
				const box = row.getBoundingClientRect()
				// More than half of the row is still below the screen.
				if (box.bottom - line < box.height * 0.5) continue
				const id = row.dataset.row as string
				const channel = live.current.channels.find((c) => c.id === id)
				const key = last.current[id] ?? channel?.cells[0]?.card.key
				if (key != null) put(id, key)
				return
			}
		}
		const onScroll = () => {
			if (!frame) frame = requestAnimationFrame(pick)
		}
		window.addEventListener("scroll", onScroll, { passive: true })
		return () => {
			window.removeEventListener("scroll", onScroll)
			if (frame) cancelAnimationFrame(frame)
		}
	}, [put, root])

	/** Touch: swiping a row puts the card at its left edge in focus. */
	const railScrolled = useCallback(
		(ch: string, rail: HTMLElement) => {
			if (!window.matchMedia(PHONE).matches) return
			const edge = rail.scrollLeft + 24
			for (const cell of rail.querySelectorAll<HTMLElement>("[data-cell]")) {
				if (cell.offsetLeft + cell.offsetWidth * 0.5 < edge - 24) continue
				const key = Number(cell.dataset.cell)
				last.current[ch] = key
				if (live.current.current?.channel.id === ch) put(ch, key)
				return
			}
		},
		[put],
	)

	return { current, put, hover, unhover, railScrolled }
}

// ---------------------------------------------------------------------------------------------------------
// A channel's label: what family it is, its name (the link to its own page) and one line about it.

function ChannelMark({ channel }: { channel: Channel }) {
	if (channel.sort === "best")
		return <CheckBadgeIcon aria-hidden className="size-5 shrink-0 text-amber-300" />
	if (channel.sort === "popular")
		return <FireIcon aria-hidden className="size-5 shrink-0 text-gray-300" />
	if (channel.sort === "add")
		return <PlusIcon aria-hidden className="size-5 shrink-0 text-gray-300" />
	if (channel.sort === "kind" || !channel.place) return null
	return <PlaceMark place={channel.place} size={18} />
}

function ChannelLabel({
	channel,
	to,
	on,
	timeline,
	arrows,
}: {
	channel: Channel
	to: To
	on: boolean
	timeline: boolean
	arrows: ReactNode
}) {
	const hue =
		channel.sort === "place" && channel.place?.family === "mood" ? channel.place.hue : null
	const decade = channel.place?.family === "decade" && channel.sort === "place"
	const href = channel.open
		? `${to(channel.open)}${channel.sort === "kind" ? "#all" : ""}`
		: (channel.out ?? null)
	const name = (
		<>
			<span className={decade ? "font-display text-2xl font-black tracking-tight lg:text-3xl" : ""}>
				{channel.name}
			</span>
			{href && (
				<span
					aria-hidden
					className="inline-block text-gray-500 transition-transform duration-200 group-hover/name:translate-x-0.5 group-hover/name:text-amber-300"
				>
					{"\u00a0›"}
				</span>
			)}
		</>
	)
	// A mood's label carries its hue (from `lg`, where the label is a panel of its own).
	const style = hue
		? ({
				"--wash": `linear-gradient(135deg, ${wash(hue, 30)}, ${wash(hue, 10)})`,
			} as CSSProperties)
		: undefined
	return (
		<div
			className={`relative flex min-w-0 flex-col gap-1 rounded-xl lg:h-full lg:gap-2.5 lg:p-4 lg:ring-1 ${
				hue
					? "lg:[background:var(--wash)] lg:ring-white/10"
					: on
						? "lg:bg-white/[0.06] lg:ring-white/15"
						: "lg:bg-white/[0.03] lg:ring-white/[0.07]"
			} ${timeline ? "lg:ml-6" : ""}`}
			style={style}
		>
			{timeline && (
				<>
					<span
						aria-hidden
						className="absolute top-0 -bottom-4 -left-[1.05rem] w-px bg-white/15 max-lg:hidden"
					/>
					<span
						aria-hidden
						className={`absolute top-6 -left-[1.3rem] size-[9px] rounded-full ring-4 ring-gray-900 transition-colors duration-200 max-lg:hidden ${
							on ? "bg-white" : "bg-gray-500"
						}`}
					/>
				</>
			)}
			<div className="flex min-w-0 flex-col gap-1 lg:my-auto lg:gap-2.5">
				<h3 className="flex min-w-0 items-center gap-2 text-lg leading-tight font-semibold tracking-tight text-balance text-white lg:text-[1.375rem] lg:leading-[1.15]">
					<ChannelMark channel={channel} />
					{href ? (
						<Link
							to={href}
							prefetch="intent"
							className="group/name min-w-0 rounded-sm outline-none hover:text-amber-200 focus-visible:ring-2 focus-visible:ring-amber-400"
						>
							{name}
						</Link>
					) : (
						<span className="min-w-0">{name}</span>
					)}
				</h3>
				{channel.line && (
					<p className="flex min-w-0 items-baseline gap-1.5 text-sm leading-snug text-pretty text-gray-400 lg:text-[0.9375rem] lg:text-gray-300">
						{channel.sort === "kind" && channel.place && (
							<PlaceMark place={channel.place} size={13} />
						)}
						{channel.line}
					</p>
				)}
				{channel.words && channel.words.length > 0 && (
					<p
						className={`min-w-0 text-sm leading-snug text-gray-500 ${
							channel.line ? "max-lg:hidden" : ""
						}`}
					>
						{channel.words.map((w, i) => (
							<span key={w.key}>
								{i > 0 && " · "}
								<TraitWord trait={w} />
							</span>
						))}
					</p>
				)}
			</div>
			<div className="flex items-center justify-between gap-2 pt-1 max-lg:hidden">
				{channel.split ? (
					<Link
						to={to(channel.split)}
						prefetch="intent"
						className="inline-flex items-center gap-1.5 rounded-md py-1 text-sm font-semibold whitespace-nowrap text-gray-300 outline-none hover:text-white focus-visible:ring-2 focus-visible:ring-amber-400"
					>
						<ViewColumnsIcon aria-hidden className="size-4 text-gray-500" />
						Split screen
					</Link>
				) : channel.sort === "kind" && href ? (
					<Link
						to={href}
						prefetch="intent"
						className="rounded-md py-1 text-sm font-semibold whitespace-nowrap text-gray-300 outline-none hover:text-white focus-visible:ring-2 focus-visible:ring-amber-400"
					>
						See them all
					</Link>
				) : channel.sort === "essentials" ? (
					<a
						href="#all"
						className="rounded-md py-1 text-sm font-semibold whitespace-nowrap text-gray-300 outline-none hover:text-white focus-visible:ring-2 focus-visible:ring-amber-400"
					>
						See them all
					</a>
				) : (
					<span />
				)}
				{arrows}
			</div>
		</div>
	)
}

function Row({
	channel,
	to,
	focus,
	guide,
	timeline,
	eager,
}: {
	channel: Channel
	to: To
	focus: number | null
	guide: ReturnType<typeof useGuideFocus>
	timeline: boolean
	eager: boolean
}) {
	const row = useStepRow<HTMLUListElement>([channel.cells.length])
	const frame = useRef(0)
	const ranked = channel.sort === "best"
	return (
		<li
			data-row={channel.id}
			className="grid min-w-0 gap-2 lg:grid-cols-[14.5rem_minmax(0,1fr)] lg:gap-4"
		>
			<ChannelLabel
				channel={channel}
				to={to}
				on={focus !== null}
				timeline={timeline}
				arrows={<RowArrows row={row} label={`titles on ${channel.name}`} />}
			/>
			<ul
				ref={row.ref}
				data-rail=""
				onScroll={(e) => {
					row.measure()
					const rail = e.currentTarget
					if (frame.current) return
					frame.current = requestAnimationFrame(() => {
						frame.current = 0
						guide.railScrolled(channel.id, rail)
					})
				}}
				className="relative -mx-4 flex min-w-0 snap-x gap-2 overflow-x-auto scroll-px-4 px-4 py-1.5 [scrollbar-width:none] sm:-mx-6 sm:gap-3 sm:scroll-px-6 sm:px-6 lg:mx-0 lg:snap-none lg:scroll-px-2 lg:px-2"
			>
				{channel.cells.map((cell: Cell, i) => {
					const on = focus === cell.card.key
					return (
						<li
							key={cell.card.key}
							data-cell={cell.card.key}
							data-on={on || undefined}
							onPointerEnter={(e) =>
								e.pointerType === "mouse" && guide.hover(channel.id, cell.card.key)
							}
							onPointerLeave={guide.unhover}
							onFocusCapture={() => guide.put(channel.id, cell.card.key)}
							className="group/cell relative w-[calc((100%-2*0.5rem)/3.3)] shrink-0 snap-start sm:w-[calc((100%-4*0.75rem)/5.5)] lg:w-[8.9rem]"
						>
							{ranked && (
								<span className="mb-2 block pl-0.5 text-sm leading-none font-bold tabular-nums text-gray-400 transition-colors duration-200 group-data-[on]/cell:text-white">
									{cell.rank}
								</span>
							)}
							<div className="relative transition-transform duration-200 ease-out will-change-transform motion-reduce:transition-none lg:group-data-[on]/cell:-translate-y-0.5">
								<TitlePosterCard
									card={cell.card}
									posterPriority={eager && i < 7 ? "high" : "lazy"}
									skipOffscreen={i > 7}
								/>
								{/* The focus mark: the white of a selection, never amber. */}
								<span
									aria-hidden
									className="pointer-events-none absolute -inset-[3px] rounded-[11px] opacity-0 ring-2 ring-white transition-opacity duration-200 group-data-[on]/cell:opacity-100 motion-reduce:transition-none"
								/>
							</div>
						</li>
					)
				})}
			</ul>
		</li>
	)
}

/**
 * The screen pinned over a list of channels. `screen` gives the words around the focused title; `lead` is a channel
 * page's character block (the screen's left half on a desktop).
 */
export function Guide({
	channels,
	to,
	screen,
	lead,
	leadClassName,
	leadStyle,
	intro,
	timeline = false,
	children,
}: {
	channels: Channel[]
	to: To
	screen: (now: { channel: Channel; cell: Cell }) => {
		eyebrow?: ReactNode
		corner?: ReactNode
		action?: ReactNode
		phone?: "corner" | "eyebrow"
	}
	lead?: ReactNode
	leadClassName?: string
	leadStyle?: CSSProperties
	/** A line or two above the first row. */
	intro?: ReactNode
	timeline?: boolean
	/** After the last row, still under the pinned screen (the "more channels" loader). */
	children?: ReactNode
}) {
	const root = useRef<HTMLElement>(null)
	const guide = useGuideFocus(channels, root)
	const now = guide.current
	const words: ReturnType<typeof screen> = now ? screen(now) : {}
	return (
		<section ref={root} aria-label="Channels" className="relative">
			<PinnedScreen lead={lead} leadClassName={leadClassName} leadStyle={leadStyle}>
				<NowShowing
					cell={now?.cell ?? null}
					eyebrow={words.eyebrow}
					corner={words.corner}
					action={words.action}
					phone={words.phone}
					className="h-[13.75rem] sm:h-[17rem] lg:h-full"
				/>
			</PinnedScreen>
			<div className={`${WRAP} pt-4 lg:pt-2`}>
				{intro}
				<ul className="space-y-5 lg:space-y-4">
					{channels.map((channel, i) => (
						<Row
							key={channel.id}
							channel={channel}
							to={to}
							guide={guide}
							focus={now?.channel.id === channel.id ? now.cell.card.key : null}
							timeline={timeline}
							eager={i === 0}
						/>
					))}
				</ul>
				{children}
			</div>
		</section>
	)
}
