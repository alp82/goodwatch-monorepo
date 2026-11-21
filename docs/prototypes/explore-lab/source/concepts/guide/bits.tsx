// PROTOTYPE - throwaway (prototype/explore-r4, concept `guide`). Small parts the guide's pages share.
import { CheckIcon, ChevronDownIcon, XMarkIcon } from "@heroicons/react/20/solid"
import { Link, useFetcher, useLocation } from "@remix-run/react"
import { type ReactNode, useEffect, useRef, useState } from "react"
import { MENU, SHELL } from "~/ui/filter-bar/motion"
import type { Address } from "../../kit/address"
import { PlaceMark } from "../../kit/ui"
import type { EraShift, PlaceRef } from "../../kit/types"
import type { Channel, GuideData } from "./types"

type To = (a: Address, extra?: Record<string, string | undefined>) => string

// ---------------------------------------------------------------------------------------------------------
// More channels: the next batch of rows arrives when the end of the list comes near.

/**
 * The rows of a hub or family page: what the server sent, plus every batch fetched since. Without JavaScript the
 * "More channels" link opens the next batch as a page of its own.
 */
export function useMoreChannels(first: Channel[], next: number | null, key: string) {
	const location = useLocation()
	const fetcher = useFetcher<{ data?: GuideData }>()
	const [more, setMore] = useState<{
		key: string
		channels: Channel[]
		next: number | null
	}>({
		key,
		channels: [],
		next,
	})
	// A new page (other kind, other family) starts over.
	const state = more.key === key ? more : { key, channels: [], next }
	const asked = useRef<number | null>(null)
	const sentinel = useRef<HTMLDivElement>(null)

	useEffect(() => {
		const got = fetcher.data?.data
		if (!got || (got.view !== "hub" && got.view !== "family")) return
		if (asked.current === null) return
		const from = asked.current
		asked.current = null
		setMore((m) => {
			const base = m.key === key ? m : { key, channels: [], next }
			if (base.next !== from) return base
			const have = new Set([...first, ...base.channels].map((c) => c.id))
			return {
				key,
				channels: [...base.channels, ...got.channels.filter((c) => !have.has(c.id))],
				next: got.next,
			}
		})
	}, [fetcher.data, first, key, next])

	useEffect(() => {
		const el = sentinel.current
		if (!el || state.next === null) return
		const io = new IntersectionObserver(
			(entries) => {
				if (!entries.some((e) => e.isIntersecting)) return
				if (asked.current !== null || fetcher.state !== "idle" || state.next === null) return
				asked.current = state.next
				const q = new URLSearchParams(location.search)
				q.set("from", String(state.next))
				fetcher.load(`${location.pathname}?${q}`)
			},
			{ rootMargin: "0px 0px 500px 0px" },
		)
		io.observe(el)
		return () => io.disconnect()
	}, [fetcher, location.pathname, location.search, state.next])

	const q = new URLSearchParams(location.search)
	if (state.next !== null) q.set("from", String(state.next))
	return {
		channels: [...first, ...state.channels],
		loader:
			state.next === null ? null : (
				<div ref={sentinel} className="flex min-h-24 items-center justify-center pt-6">
					{fetcher.state !== "idle" ? (
						<span className="flex items-center gap-2 text-sm font-semibold text-gray-400">
							<span
								aria-hidden
								className="size-4 animate-spin rounded-full border-2 border-white/20 border-t-white/70 motion-reduce:animate-none"
							/>
							More channels
						</span>
					) : (
						<a
							href={`${location.pathname}?${q}`}
							className="rounded-full bg-white/[0.06] px-4 py-2 text-sm font-bold text-gray-200 ring-1 ring-white/10 outline-none hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-amber-400"
						>
							More channels
						</a>
					)}
				</div>
			),
	}
}

// ---------------------------------------------------------------------------------------------------------
// A menu of links with the look of the real sort menu (ui/filter-bar/controls.tsx). It is a <details>, so it opens
// without JavaScript and every choice is a link in the server's HTML.

export interface Pick {
	key: string
	label: ReactNode
	to: string
	on?: boolean
}

export function PickMenu({
	label,
	value,
	picks,
	align = "left",
}: {
	label: string
	/** The chosen pick's name; nothing chosen reads "Any". */
	value: ReactNode | null
	picks: Pick[]
	align?: "left" | "right"
}) {
	const root = useRef<HTMLDetailsElement>(null)
	useEffect(() => {
		const close = (e: Event) => {
			const el = root.current
			if (!el?.open) return
			if (e.type === "keydown" && (e as KeyboardEvent).key !== "Escape") return
			if (e.type === "pointerdown" && el.contains(e.target as Node)) return
			el.open = false
		}
		document.addEventListener("pointerdown", close)
		document.addEventListener("keydown", close)
		return () => {
			document.removeEventListener("pointerdown", close)
			document.removeEventListener("keydown", close)
		}
	}, [])
	return (
		<details ref={root} className="group/pick relative">
			<summary
				className={`flex h-9 cursor-pointer list-none items-center gap-1.5 px-3 text-sm whitespace-nowrap outline-none transition-colors hover:ring-white/25 focus-visible:ring-2 focus-visible:ring-amber-400 [&::-webkit-details-marker]:hidden ${SHELL}`}
			>
				<span className="text-gray-400">{label}</span>
				<span className={`font-bold ${value ? "text-white" : "text-gray-300"}`}>
					{value ?? "Any"}
				</span>
				<ChevronDownIcon
					aria-hidden
					className="size-4 shrink-0 text-gray-400 transition-transform duration-200 group-open/pick:rotate-180"
				/>
			</summary>
			<div
				className={`absolute z-40 mt-2 max-h-[min(24rem,60vh)] w-60 overflow-y-auto p-1.5 ${
					align === "right" ? "right-0" : "left-0"
				} ${MENU}`}
			>
				{picks.map((p) => (
					<Link
						key={p.key}
						to={p.to}
						preventScrollReset
						onClick={() => {
							if (root.current) root.current.open = false
						}}
						aria-current={p.on ? "true" : undefined}
						className={`flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-bold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-amber-400 ${
							p.on
								? "bg-white/[0.07] text-white ring-1 ring-white/10"
								: "text-gray-300 hover:bg-white/[0.05] hover:text-white"
						}`}
					>
						<span className="flex min-w-0 flex-1 items-center gap-2">{p.label}</span>
						<CheckIcon aria-hidden className={`size-4 shrink-0 ${p.on ? "" : "invisible"}`} />
					</Link>
				))}
			</div>
		</details>
	)
}

// ---------------------------------------------------------------------------------------------------------
// Eras along time: the decades on one line. Where you are is lit; every other tick is that decade's channel.

export function EraLine({
	decades,
	here,
	to,
}: {
	decades: PlaceRef[]
	here: string
	to: (p: PlaceRef) => string
}) {
	return (
		<nav aria-label="Other decades" className="min-w-0">
			<ol className="relative flex min-w-0 items-end justify-between gap-1">
				<span aria-hidden className="absolute inset-x-2 bottom-[5px] h-px bg-white/15" />
				{decades.map((d) => {
					const on = d.slug === here
					return (
						<li key={d.slug} className="relative min-w-0">
							<Link
								to={to(d)}
								prefetch="intent"
								aria-current={on ? "page" : undefined}
								className="group/era flex flex-col items-center gap-1.5 rounded-md px-1 pt-1 outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
							>
								<span
									className={`font-display leading-none font-black tracking-tight tabular-nums transition-colors duration-200 ${
										on
											? "text-xl text-white sm:text-2xl"
											: "text-sm text-gray-500 group-hover/era:text-gray-200"
									}`}
								>
									{on ? d.label : `’${d.label.slice(2)}`}
								</span>
								<span
									aria-hidden
									className={`rounded-full ring-4 ring-gray-900 transition-transform duration-200 group-hover/era:scale-125 ${
										on
											? "size-[11px] bg-white"
											: "size-[7px] bg-gray-500 group-hover/era:bg-gray-200"
									}`}
								/>
							</Link>
						</li>
					)
				})}
			</ol>
		</nav>
	)
}

const names = (shifts: EraShift[], to: (p: PlaceRef) => string) =>
	shifts.slice(0, 2).map((s, i) => (
		<span key={s.label}>
			{i > 0 && " and "}
			{s.place ? (
				<Link
					to={to(s.place)}
					prefetch="intent"
					title={`${Math.round(s.from)}% of the decade before, ${Math.round(s.to)}% now`}
					className="inline-flex items-baseline gap-1.5 font-semibold text-white underline decoration-white/25 decoration-dotted underline-offset-4 outline-none hover:decoration-white focus-visible:ring-2 focus-visible:ring-amber-400"
				>
					{s.place.family === "mood" && <PlaceMark place={s.place} size={13} />}
					{s.label.toLowerCase()}
				</Link>
			) : (
				<span className="font-semibold text-white">{s.label.toLowerCase()}</span>
			)}
		</span>
	))

/** What changed in a decade against the one before, as a sentence (the shares wait in each word's tooltip). */
export function EraShifts({
	label,
	rose,
	fell,
	to,
}: {
	label: string
	rose: EraShift[]
	fell: EraShift[]
	to: (p: PlaceRef) => string
}) {
	if (!rose.length && !fell.length) return null
	return (
		<p className="text-base leading-relaxed text-pretty text-gray-300">
			{rose.length > 0 && (
				<>
					The {label} brought more {names(rose, to)}
				</>
			)}
			{rose.length > 0 && fell.length > 0 && ", and "}
			{fell.length > 0 && (
				<>
					{rose.length ? "less" : `The ${label} had less`} {names(fell, to)}
				</>
			)}
			{" than the decade before."}
		</p>
	)
}

// ---------------------------------------------------------------------------------------------------------
// A split's plate: one of the channels on screen, with the way out of the split.

export function Plate({ place, leave }: { place: PlaceRef; leave: string }) {
	return (
		<span className="flex min-w-0 items-center gap-2 rounded-full bg-black/35 py-1 pr-1 pl-3 ring-1 ring-white/15 backdrop-blur">
			<PlaceMark place={place} size={16} />
			<span className="min-w-0 truncate text-sm font-bold text-white">{place.label}</span>
			<Link
				to={leave}
				prefetch="intent"
				aria-label={`Leave ${place.label}`}
				title={`Leave ${place.label}`}
				className="grid size-7 shrink-0 place-items-center rounded-full text-gray-300 outline-none transition-colors hover:bg-white/15 hover:text-white focus-visible:ring-2 focus-visible:ring-amber-400"
			>
				<XMarkIcon aria-hidden className="size-4" />
			</Link>
		</span>
	)
}

/** The channel a title is on, as the screen's eyebrow. */
export function ChannelTag({ channel, to, rank }: { channel: Channel; to: To; rank?: number }) {
	const body = (
		<>
			{channel.place && channel.sort !== "kind" && <PlaceMark place={channel.place} size={15} />}
			<span className="truncate">{channel.name}</span>
		</>
	)
	return (
		<>
			{channel.open ? (
				<Link
					to={to(channel.open)}
					prefetch="intent"
					className="flex min-w-0 items-center gap-2 rounded-sm outline-none hover:text-white focus-visible:ring-2 focus-visible:ring-amber-400"
				>
					{body}
				</Link>
			) : (
				<span className="flex min-w-0 items-center gap-2">{body}</span>
			)}
			{rank != null && (
				<span className="shrink-0 font-bold tabular-nums text-white">No. {rank}</span>
			)}
		</>
	)
}
