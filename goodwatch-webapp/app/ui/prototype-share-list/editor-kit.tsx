// PROTOTYPE - throwaway. Editor state and widgets shared by the share-list layouts.
// Titles move by drag and drop (pointer events, so touch works via long-press): reorder the list,
// drag picks or search results into the list or onto a card slot, drag card slots onto each other.
// Clicking a card slot, the title, or the signature opens a dialog.
import { useQuery } from "@tanstack/react-query"
import { type PointerEvent as ReactPointerEvent, type ReactNode, useEffect, useLayoutEffect, useRef, useState } from "react"
import { DESIGNS } from "./designs"
import { cardQuery, type Design, fromSearchResult, type ListItem, PROMPTS, THEMES, type ThemeKey } from "./model"

// ------------------------------------------------------------------ list state

export interface ListState {
	title: string
	items: ListItem[]
	name: string
	theme: ThemeKey
	promptId: string
}

// Where a dragged title can land: a gap in the list, or a rank on the card.
type Over = { kind: "list"; index: number } | { kind: "slot"; index: number } | null

export function useList(initial: ListState) {
	const [s, setS] = useState(initial)
	const set = (patch: Partial<ListState>) => setS((prev) => ({ ...prev, ...patch }))
	const setItems = (items: ListItem[], added?: ListItem) => {
		set({ items })
		if (added && added.score == null) {
			fetch(`/prototype/share-list-png?format=json&l=${added.key}`)
				.then((r) => r.json())
				.then(({ items: [full] }: { items: ListItem[] }) => {
					if (full) setS((prev) => ({ ...prev, items: prev.items.map((i) => (i.key === full.key ? full : i)) }))
				})
				.catch(() => {})
		}
	}
	return {
		...s,
		set,
		has: (key: string) => s.items.some((i) => i.key === key),
		remove: (key: string) => set({ items: s.items.filter((i) => i.key !== key) }),
		// Insert at the gap. A full list keeps its size: the last title drops off.
		insert: (item: ListItem, index: number, cap: number) => {
			const rest = s.items.filter((i) => i.key !== item.key)
			const next = [...rest.slice(0, index), item, ...rest.slice(index)].slice(0, Math.max(cap, s.items.length))
			setItems(next, s.items.some((i) => i.key === item.key) ? undefined : item)
		},
		// Put a title on a rank. A title already in the list swaps places; a new one replaces.
		place: (item: ListItem, index: number) => {
			const next = [...s.items]
			const from = next.findIndex((i) => i.key === item.key)
			const at = Math.min(index, next.length - (from >= 0 ? 1 : 0))
			if (from >= 0) {
				if (at < next.length) [next[from], next[at]] = [next[at], next[from]]
			} else if (at < next.length) next[at] = item
			else next.push(item)
			setItems(next, from >= 0 ? undefined : item)
		},
		add: (item: ListItem, cap: number) => {
			if (s.items.some((i) => i.key === item.key) || s.items.length >= cap) return
			setItems([...s.items, item], item)
		},
	}
}
export type List = ReturnType<typeof useList>

export const listParams = (design: string, l: ListState) =>
	new URLSearchParams({ design, t: l.title, l: l.items.map((i) => i.key).join(","), n: l.name, theme: l.theme, p: l.promptId })

// ------------------------------------------------------------------ drag and drop

type Payload = { item: ListItem; from: number | null }
type Drag = { p: Payload; x: number; y: number; over: Over }

function hitTest(x: number, y: number): Over {
	const el = document.elementFromPoint(x, y) as HTMLElement | null
	const slot = el?.closest<HTMLElement>("[data-gw-preview] [data-slot]")
	if (slot) return { kind: "slot", index: Number(slot.dataset.slot) }
	const list = el?.closest<HTMLElement>("[data-droplist]")
	if (!list) return null
	const rows = [...list.querySelectorAll<HTMLElement>("[data-row]")]
	// data-droplist="x" is a horizontal list: gaps are found along x instead of y.
	const across = list.dataset.droplist === "x"
	const before = (r: HTMLElement) => {
		const b = r.getBoundingClientRect()
		return across ? b.left + b.width / 2 < x : b.top + b.height / 2 < y
	}
	return { kind: "list", index: rows.filter(before).length }
}

function useDnd(onDrop: (p: Payload, over: NonNullable<Over>) => void) {
	const [drag, setDrag] = useState<Drag | null>(null)
	const dropRef = useRef(onDrop)
	dropRef.current = onDrop
	const start = (e: ReactPointerEvent, p: Payload) => {
		if (e.button !== 0) return
		const touch = e.pointerType !== "mouse"
		const sx = e.clientX
		const sy = e.clientY
		let x = sx
		let y = sy
		let live = false
		let over: Over = null
		const begin = () => {
			live = true
			over = hitTest(x, y)
			setDrag({ p, x, y, over })
			navigator.vibrate?.(10)
		}
		// Touch starts on long-press so a normal swipe still scrolls; mouse starts after a few pixels.
		const timer = touch ? setTimeout(begin, 220) : undefined
		const move = (ev: PointerEvent) => {
			x = ev.clientX
			y = ev.clientY
			if (!live) {
				if (Math.hypot(x - sx, y - sy) < 6) return
				if (touch) return end()
				begin()
			}
			over = hitTest(x, y)
			setDrag({ p, x, y, over })
		}
		const blockScroll = (ev: TouchEvent) => live && ev.preventDefault()
		const up = () => {
			if (live) {
				// Swallow the click that follows the drop so it doesn't open a dialog.
				const swallow = (c: MouseEvent) => c.stopPropagation()
				window.addEventListener("click", swallow, { capture: true, once: true })
				setTimeout(() => window.removeEventListener("click", swallow, true), 50)
				if (over) dropRef.current(p, over)
			}
			end()
		}
		const end = () => {
			clearTimeout(timer)
			setDrag(null)
			document.body.style.userSelect = ""
			window.removeEventListener("pointermove", move)
			window.removeEventListener("pointerup", up)
			window.removeEventListener("pointercancel", end)
			window.removeEventListener("touchmove", blockScroll)
		}
		document.body.style.userSelect = "none"
		window.addEventListener("pointermove", move)
		window.addEventListener("pointerup", up)
		window.addEventListener("pointercancel", end)
		window.addEventListener("touchmove", blockScroll, { passive: false })
	}
	return { drag, start }
}

// ------------------------------------------------------------------ helpers

export function useTitleSearch(q: string) {
	const [debounced, setDebounced] = useState(q)
	useEffect(() => {
		const id = setTimeout(() => setDebounced(q.trim()), 250)
		return () => clearTimeout(id)
	}, [q])
	const { data, isFetching } = useQuery({
		queryKey: ["prototype-share-list-search", debounced],
		enabled: debounced.length >= 2,
		queryFn: async () => {
			const { results } = await (await fetch(`/prototype/share-list-png?format=search&q=${encodeURIComponent(debounced)}`)).json()
			return (results as Parameters<typeof fromSearchResult>[0][]).filter((r) => r.poster_path).map(fromSearchResult)
		},
	})
	return { results: debounced.length >= 2 ? (data ?? []) : null, loading: isFetching }
}

// Share copies a link to the view page, whose og:image is this card. The image renders in the
// background shortly after every change, so the preview is ready by the time the link is pasted.
function useShare(design: Design, l: ListState) {
	const [status, setStatus] = useState<"idle" | "copied" | "failed">("idle")
	const query = cardQuery({ design: design.key, title: l.title, keys: l.items.map((i) => i.key), name: l.name, theme: l.theme })
	const warm = () => {
		if (l.items.length) fetch(`/prototype/share-list-png?${query}`).catch(() => {})
	}
	useEffect(() => {
		const id = setTimeout(warm, 1500)
		return () => clearTimeout(id)
	}, [query])
	return {
		status,
		share: async () => {
			warm()
			const url = `${window.location.origin}/prototype/share-list/view?${query}`
			try {
				await navigator.clipboard.writeText(url)
				setStatus("copied")
			} catch {
				window.prompt("Copy this link", url)
			}
			setTimeout(() => setStatus("idle"), 2000)
		},
	}
}

// Renders a card at native pixel size, scaled to fit. With `fill`, it fits the box it is given
// (the parent must give it a definite height); otherwise it fits the width, capped at maxH.
export function Scaled({ design, list, date, maxH = 10000, fill, editing, className = "", children }: { design: Design; list: ListState; date: string; maxH?: number; fill?: boolean; editing?: boolean; className?: string; children?: ReactNode }) {
	const ref = useRef<HTMLDivElement>(null)
	const [box, setBox] = useState({ w: 0, h: 0 })
	useLayoutEffect(() => {
		const el = ref.current
		if (!el) return
		const ro = new ResizeObserver(([e]) => setBox({ w: e.contentRect.width, h: e.contentRect.height }))
		ro.observe(el)
		return () => ro.disconnect()
	}, [])
	const scale = box.w ? Math.min(box.w / design.w, (fill ? box.h : maxH) / design.h, fill ? 10 : maxH / design.h) : 0
	return (
		<div ref={ref} className={`flex w-full min-w-0 items-center justify-center ${fill ? "h-full min-h-0 [contain:size]" : "[contain:inline-size]"}`}>
			<div className={`relative shrink-0 overflow-hidden ${className}`} style={{ width: design.w * scale, height: design.h * scale, visibility: scale ? "visible" : "hidden" }}>
				<div className="absolute top-0 left-0 origin-top-left" style={{ width: design.w, height: design.h, transform: `scale(${scale})` }}>
					<design.Card {...list} items={list.items.slice(0, design.max)} date={date} editing={editing} />
					{children}
				</div>
			</div>
		</div>
	)
}

export const Thumb = ({ item, className = "" }: { item: ListItem; className?: string }) =>
	item.poster ? (
		<img src={item.poster.replace("/w500/", "/w185/")} alt="" draggable={false} className={`aspect-[2/3] object-cover ${className}`} />
	) : (
		<div className={`flex aspect-[2/3] items-center justify-center bg-neutral-800 p-1 text-center text-[10px] leading-tight text-neutral-400 ${className}`}>{item.title}</div>
	)

export const meta = (i: ListItem) => [i.year, i.type === "movie" ? "Movie" : "Series"].filter(Boolean).join(" · ")
export const label = "text-xs font-bold tracking-[0.2em] text-neutral-500 uppercase"

// ------------------------------------------------------------------ editor state

export type Sheet = { kind: "slot"; index: number } | { kind: "title" } | { kind: "name" } | null

// Everything a layout needs: list, drag and drop, sharing, design stepping, dialogs.
export function useEditor({ list, suggestions, date, design, setDesign }: { list: List; suggestions: Record<string, ListItem[]>; date: string; design: Design; setDesign: (key: string) => void }) {
	const cap = Math.max(design.max, 5)
	const [sheet, setSheet] = useState<Sheet>(null)
	const dnd = useDnd((p, over) => {
		if (over.kind === "list") list.insert(p.item, over.index, cap)
		else list.place(p.item, over.index)
	})
	const share = useShare(design, list)
	const di = DESIGNS.findIndex((d) => d.key === design.key)
	return {
		list,
		suggestions,
		date,
		design,
		setDesign,
		cap,
		sheet,
		setSheet,
		dnd,
		share,
		di,
		t: THEMES[list.theme],
		step: (n: number) => setDesign(DESIGNS[(di + n + DESIGNS.length) % DESIGNS.length].key),
		pool: suggestions[list.promptId] ?? [],
	}
}
export type Ed = ReturnType<typeof useEditor> & { saved?: boolean }

// ------------------------------------------------------------------ widgets

// Hover and drop-target highlights for the interactive card.
export function PreviewStyles({ ed }: { ed: Ed }) {
	const over = ed.dnd.drag?.over?.kind === "slot" ? ed.dnd.drag.over.index : null
	const a = ed.t.accent
	return (
		<style>{`
			[data-gw-preview] [data-slot], [data-gw-preview] [data-edit] { cursor: pointer; transition: filter .15s; }
			[data-gw-preview] [data-slot]:hover, [data-gw-preview] [data-edit]:hover { filter: brightness(1.12) drop-shadow(0 0 18px ${a}); }
			${over != null ? `[data-gw-preview] [data-slot="${over}"] { filter: brightness(1.2) drop-shadow(0 0 30px ${a}) drop-shadow(0 0 8px ${a}); }` : ""}
		`}</style>
	)
}

// The live card: click a poster to open its dialog, click the title or signature to edit them,
// drag posters to swap ranks, drop titles onto posters.
export function Preview({ ed, fill, maxH, className = "rounded-[18px] shadow-2xl shadow-black/60" }: { ed: Ed; fill?: boolean; maxH?: number; className?: string }) {
	const onClick = (e: React.MouseEvent) => {
		const el = e.target as HTMLElement
		const slot = el.closest<HTMLElement>("[data-slot]")
		if (slot) return ed.setSheet({ kind: "slot", index: Math.min(Number(slot.dataset.slot), ed.list.items.length) })
		const edit = el.closest<HTMLElement>("[data-edit]")?.dataset.edit
		if (edit === "title" || edit === "name") ed.setSheet({ kind: edit })
	}
	const onPointerDown = (e: ReactPointerEvent) => {
		const index = Number((e.target as HTMLElement).closest<HTMLElement>("[data-slot]")?.dataset.slot)
		const item = ed.list.items[index]
		if (item) ed.dnd.start(e, { item, from: index })
	}
	return (
		<div data-gw-preview onClick={onClick} onPointerDown={onPointerDown} onDragStart={(e) => e.preventDefault()} className={`min-w-0 touch-pan-y select-none ${fill ? "h-full w-full" : "w-full"}`}>
			<Scaled design={ed.design} list={ed.list} date={ed.date} fill={fill} maxH={maxH} editing className={className} />
		</div>
	)
}

// The ranked list as a drop zone. "rows" is the full list; "rail" is a strip of posters.
export function RankList({ ed, variant = "rows", axis = "y" }: { ed: Ed; variant?: "rows" | "rail" | "compact"; axis?: "x" | "y" }) {
	const { list, design, dnd, t, cap } = ed
	const drag = dnd.drag
	const dragKey = drag?.p.item.key
	const overList = drag?.over?.kind === "list" ? drag.over.index : null
	const rows = list.items.filter((i) => i.key !== dragKey)
	const pushedOut = drag && !list.has(drag.p.item.key) && overList != null && list.items.length >= cap ? list.items[list.items.length - 1]?.key : null
	const rail = variant === "rail"
	const gap = <DropGap item={drag?.p.item} accent={t.accent} rail={rail} />
	return (
		<ol data-droplist={axis} className={`flex gap-1.5 rounded-2xl transition ${axis === "x" ? "flex-row items-start" : "flex-col"} ${overList != null ? "bg-white/[0.04] ring-1 ring-white/10" : ""}`}>
			{list.items.map((item, rank) => {
				// The dragged row stays mounted (hidden): removing it would strand touch events.
				const lifted = item.key === dragKey
				const i = rows.indexOf(item)
				const off = rank >= design.max
				const shownRank = i + 1 + (overList != null && overList <= i ? 1 : 0)
				const dim = off || pushedOut === item.key ? "opacity-35" : ""
				const grab = (e: ReactPointerEvent) => {
					if ((e.target as HTMLElement).closest("button")) return
					dnd.start(e, { item, from: rank })
				}
				return (
					<li key={item.key} className={`flex gap-1.5 ${axis === "x" ? "flex-row" : "flex-col"} ${lifted ? "hidden" : ""}`}>
						{!lifted && overList === i && gap}
						{rail ? (
							<div data-row={lifted ? undefined : ""} onPointerDown={grab} className={`group relative w-12 shrink-0 cursor-grab touch-pan-y select-none ${dim}`} title={item.title}>
								<Thumb item={item} className="w-12 rounded-md shadow-lg shadow-black/50" />
								<span className="absolute -top-1.5 -left-1.5 flex size-5 items-center justify-center rounded-full text-[11px] font-black text-black" style={{ backgroundColor: t.accent }}>
									{shownRank}
								</span>
								<button type="button" aria-label={`Remove ${item.title}`} onClick={() => list.remove(item.key)} className="absolute -top-1.5 -right-1.5 hidden size-5 items-center justify-center rounded-full bg-black text-[10px] text-white group-hover:flex">
									✕
								</button>
							</div>
						) : (
							<div
								data-row={lifted ? undefined : ""}
								onPointerDown={grab}
								className={`flex cursor-grab touch-pan-y items-center select-none active:cursor-grabbing ${variant === "compact" ? "gap-2 rounded-lg bg-white/5 p-1.5 pr-2" : "gap-3 rounded-xl bg-neutral-900 p-2 pr-3"} ${dim}`}
							>
								<span className={`text-center font-black ${variant === "compact" ? "w-5 text-sm" : "w-8 text-2xl"}`} style={{ color: off ? undefined : t.accent }}>
									{shownRank}
								</span>
								<Thumb item={item} className={`rounded ${variant === "compact" ? "w-7" : "w-10"}`} />
								<div className="min-w-0 flex-1">
									<div className={`truncate font-bold ${variant === "compact" ? "text-sm" : ""}`}>{item.title}</div>
									{(variant !== "compact" || off || pushedOut === item.key) && (
										<div className="text-xs text-neutral-500">{pushedOut === item.key ? "Drops off the list" : off ? "Not on this card" : meta(item)}</div>
									)}
								</div>
								<button type="button" aria-label={`Remove ${item.title}`} onClick={() => list.remove(item.key)} className="rounded-md px-1.5 py-0.5 text-neutral-500 hover:bg-white/10 hover:text-white">
									✕
								</button>
							</div>
						)}
					</li>
				)
			})}
			{overList != null && overList >= rows.length && gap}
			{!drag && list.items.length < design.max && (
				<li className={`flex items-center justify-center rounded-lg border border-dashed border-white/15 text-xs text-neutral-500 ${rail ? "aspect-[2/3] w-12" : "gap-3 p-2"}`}>
					{rail ? "+" : `Drop a title here · ${design.max - list.items.length} left`}
				</li>
			)}
		</ol>
	)
}

// Search plus quick picks, all draggable onto the card or into the list, or click to add.
export function Picks({ ed, layout = "grid", autoFocus, limit = 24, scroll, fill }: { ed: Ed; layout?: "grid" | "row"; autoFocus?: boolean; limit?: number; scroll?: boolean; fill?: boolean }) {
	const [q, setQ] = useState("")
	const { results, loading } = useTitleSearch(q)
	const { list, dnd, cap } = ed
	const shown = (results ?? ed.pool).slice(0, limit)
	return (
		<div className={`flex min-w-0 gap-3 ${layout === "row" ? "items-center" : "flex-col"} ${fill ? "min-h-0 flex-1" : ""}`}>
			<div className={`relative shrink-0 ${layout === "row" ? "w-44 sm:w-56" : ""}`}>
				<input
					autoFocus={autoFocus}
					value={q}
					onChange={(e) => setQ(e.target.value)}
					placeholder="Search movies & shows"
					className="w-full rounded-full border-0 bg-white/10 px-4 py-2.5 text-sm placeholder:text-neutral-500 focus:ring-2 focus:ring-white"
				/>
				{loading && <div className="absolute top-1/2 right-3 size-3.5 -translate-y-1/2 animate-spin rounded-full border-2 border-neutral-600 border-t-white" />}
			</div>
			{results && !results.length && !loading && <div className="text-sm text-neutral-500">No matches</div>}
			<div className={layout === "row" ? "flex min-w-0 flex-1 gap-2 overflow-x-auto pb-1 [scrollbar-width:thin]" : `grid content-start gap-2 ${fill ? "min-h-0 flex-1 grid-cols-[repeat(auto-fill,minmax(84px,1fr))] overflow-y-auto overscroll-contain pr-1 [scrollbar-width:thin]" : "grid-cols-4 sm:grid-cols-6"} ${scroll ? "max-h-80 overflow-y-auto overscroll-contain pr-1 [scrollbar-width:thin]" : ""}`}>
				{shown.map((p) => {
					const rank = list.items.findIndex((i) => i.key === p.key)
					return (
						<button
							key={p.key}
							type="button"
							onPointerDown={(e) => dnd.start(e, { item: p, from: rank >= 0 ? rank : null })}
							onClick={() => (rank >= 0 ? list.remove(p.key) : list.add(p, cap))}
							className={`group relative cursor-grab touch-pan-x text-left select-none ${layout === "row" ? "w-14 shrink-0" : ""}`}
							title={p.title}
							aria-label={`${rank >= 0 ? "Remove" : "Add"} ${p.title}`}
						>
							<Thumb item={p} className={`w-full rounded-md transition ${rank >= 0 ? "opacity-30" : "group-hover:-translate-y-0.5"} ${dnd.drag?.p.item.key === p.key ? "opacity-20" : ""}`} />
							{rank >= 0 && <span className="absolute inset-x-0 top-[28%] text-center text-2xl font-black">{rank + 1}</span>}
						</button>
					)
				})}
			</div>
		</div>
	)
}

// Title suggestions as small inline links that wrap.
export function PromptChips({ ed }: { ed: Ed; wrap?: boolean }) {
	return (
		<div className="flex flex-wrap gap-x-3 gap-y-1 text-[13px] leading-snug">
			<span className="text-neutral-500">Try:</span>
			{PROMPTS.map((p) => {
				const active = ed.list.title === p.title
				return (
					<button
						key={p.id}
						type="button"
						onClick={() => ed.list.set({ title: p.title, promptId: p.id })}
						className={`underline decoration-1 underline-offset-4 transition ${active ? "text-white decoration-white" : "text-neutral-400 decoration-white/20 hover:text-white hover:decoration-white"}`}
					>
						{p.title}
					</button>
				)
			})}
		</div>
	)
}

export function TitleInput({ ed, className = "", autoFocus }: { ed: Ed; className?: string; autoFocus?: boolean }) {
	return (
		<input
			autoFocus={autoFocus}
			value={ed.list.title}
			onChange={(e) => ed.list.set({ title: e.target.value.slice(0, 80) })}
			placeholder="Name your list"
			aria-label="List title"
			className={`w-full border-0 bg-transparent font-black tracking-tight placeholder:text-neutral-600 focus:ring-0 ${className}`}
		/>
	)
}

export function NameInput({ ed, autoFocus }: { ed: Ed; autoFocus?: boolean }) {
	return (
		<input
			autoFocus={autoFocus}
			value={ed.list.name}
			onChange={(e) => ed.list.set({ name: e.target.value.slice(0, 28) })}
			placeholder="your name or @handle"
			aria-label="Signature"
			className="w-full rounded-full border-0 bg-white/10 px-4 py-2.5 text-sm placeholder:text-neutral-500 focus:ring-2 focus:ring-white"
		/>
	)
}

export function Swatches({ ed, size = "size-8" }: { ed: Ed; size?: string }) {
	return (
		<div className="flex gap-2" role="radiogroup" aria-label="Color theme">
			{(Object.keys(THEMES) as ThemeKey[]).map((k) => (
				<button
					key={k}
					type="button"
					role="radio"
					aria-checked={ed.list.theme === k}
					aria-label={THEMES[k].label}
					title={THEMES[k].label}
					onClick={() => ed.list.set({ theme: k })}
					className={`${size} shrink-0 rounded-full transition ${ed.list.theme === k ? "scale-110 ring-2 ring-white ring-offset-2 ring-offset-black" : "opacity-70 hover:opacity-100"}`}
					style={{ backgroundImage: `linear-gradient(135deg, ${THEMES[k].accent}, ${THEMES[k].accent2})` }}
				/>
			))}
		</div>
	)
}

// ← Design name →
export function DesignNav({ ed, className = "" }: { ed: Ed; className?: string }) {
	return (
		<div className={`flex items-center gap-1 rounded-full bg-white/10 p-1 ${className}`}>
			<button type="button" onClick={() => ed.step(-1)} aria-label="Previous design" className="rounded-full px-2.5 py-1 hover:bg-white/10">
				←
			</button>
			<span className="min-w-24 text-center text-sm font-bold whitespace-nowrap">{ed.design.name}</span>
			<button type="button" onClick={() => ed.step(1)} aria-label="Next design" className="rounded-full px-2.5 py-1 hover:bg-white/10">
				→
			</button>
		</div>
	)
}

// Live thumbnails of every design with the person's own list.
export function DesignStrip({ ed, h = 110, wrap }: { ed: Ed; h?: number; wrap?: boolean }) {
	return (
		<div className={`flex gap-3 ${wrap ? "flex-wrap justify-center" : "overflow-x-auto pb-2 [scrollbar-width:thin]"}`} aria-label="Designs">
			{DESIGNS.map((d) => (
				<button key={d.key} type="button" onClick={() => ed.setDesign(d.key)} className="flex shrink-0 flex-col items-center gap-1" style={{ width: h * 0.72 }} aria-pressed={d.key === ed.design.key}>
					<div className={`pointer-events-none flex w-full items-center rounded-lg p-1 transition ${d.key === ed.design.key ? "bg-white/15 ring-2" : "hover:bg-white/5"}`} style={{ height: h, ["--tw-ring-color" as string]: ed.t.accent }}>
						<Scaled design={d} list={ed.list} date={ed.date} maxH={h - 8} className="rounded" />
					</div>
					<span className={`text-[11px] font-semibold ${d.key === ed.design.key ? "text-white" : "text-neutral-500"}`}>{d.name}</span>
				</button>
			))}
		</div>
	)
}

export function ShareButtons({ ed, compact }: { ed: Ed; compact?: boolean }) {
	const { share, list, t } = ed
	return (
		<button
			type="button"
			disabled={!list.items.length}
			onClick={share.share}
			title="Copies a link. The card is its preview image."
			className={`rounded-full font-black text-black transition hover:brightness-110 disabled:opacity-40 ${compact ? "w-40 py-2.5 text-center text-base whitespace-nowrap" : "w-full px-6 py-3 text-lg"}`}
			style={{ backgroundImage: `linear-gradient(90deg, ${t.accent}, ${t.accent2})` }}
		>
			{share.status === "copied" ? "Link copied ✓" : "Share"}
		</button>
	)
}

export function DragGhost({ ed }: { ed: Ed }) {
	const drag = ed.dnd.drag
	if (!drag) return null
	return (
		<div className="pointer-events-none fixed z-[60] w-16 -translate-x-1/2 -translate-y-1/2 rotate-6" style={{ left: drag.x, top: drag.y }}>
			<Thumb item={drag.p.item} className="w-16 rounded-lg shadow-2xl ring-2 ring-white" />
			{drag.over?.kind === "slot" && (
				<span className="absolute -top-3 -right-3 rounded-full px-2 py-0.5 text-sm font-black text-black" style={{ backgroundColor: ed.t.accent }}>
					#{drag.over.index + 1}
				</span>
			)}
		</div>
	)
}

// Slot, title, and signature dialogs opened from the card.
export function Dialogs({ ed }: { ed: Ed }) {
	const { sheet, setSheet } = ed
	if (!sheet) return null
	const close = () => setSheet(null)
	if (sheet.kind === "slot") return <SlotSheet list={ed.list} index={sheet.index} pool={ed.pool} cap={ed.cap} onClose={close} />
	return (
		<div className="fixed inset-0 z-40 flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center" onClick={close}>
			<form
				role="dialog"
				aria-label={sheet.kind === "title" ? "List title" : "Signature"}
				onSubmit={(e) => {
					e.preventDefault()
					close()
				}}
				className="flex w-full max-w-xl flex-col gap-4 rounded-t-[28px] bg-neutral-900 p-5 pb-10 text-white shadow-2xl ring-1 ring-white/10 sm:rounded-[28px] sm:pb-5"
				onClick={(e) => e.stopPropagation()}
			>
				<div className={label}>{sheet.kind === "title" ? "List title" : "Signed by"}</div>
				{sheet.kind === "title" ? (
					<>
						<TitleInput ed={ed} autoFocus className="rounded-2xl bg-white/10 px-4 py-3 text-2xl" />
						<PromptChips ed={ed} wrap />
					</>
				) : (
					<NameInput ed={ed} autoFocus />
				)}
				<button type="submit" className="rounded-full bg-white py-2.5 font-black text-black">
					Done
				</button>
			</form>
		</div>
	)
}

export function DropGap({ item, accent, rail }: { item?: ListItem; accent: string; rail?: boolean }) {
	if (rail) return <div className="aspect-[2/3] w-12 shrink-0 rounded-md border-2 border-dashed" style={{ borderColor: accent }} />
	return (
		<div className="flex items-center gap-3 rounded-xl border-2 border-dashed p-2" style={{ borderColor: accent }}>
			<span className="w-8" />
			{item && <Thumb item={item} className="w-10 rounded-md opacity-60" />}
			<span className="truncate text-sm font-semibold" style={{ color: accent }}>
				{item?.title}
			</span>
		</div>
	)
}

export function SlotSheet({ list, index, pool, cap, onClose }: { list: List; index: number; pool: ListItem[]; cap: number; onClose: () => void }) {
	const [q, setQ] = useState("")
	const { results, loading } = useTitleSearch(q)
	const current = list.items[index]
	const shown = results ?? pool
	useEffect(() => {
		const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose()
		window.addEventListener("keydown", onKey)
		return () => window.removeEventListener("keydown", onKey)
	}, [onClose])
	return (
		<div className="fixed inset-0 z-40 flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center" onClick={onClose}>
			<div role="dialog" aria-label={`Rank ${index + 1}`} className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-t-[28px] bg-neutral-900 p-5 pb-10 text-white shadow-2xl ring-1 ring-white/10 sm:rounded-[28px]" onClick={(e) => e.stopPropagation()}>
				<div className="flex items-center justify-between gap-4">
					<div className="flex min-w-0 items-center gap-3">
						<span className="text-4xl font-black">#{index + 1}</span>
						{current && <span className="truncate text-lg text-neutral-400">{current.title}</span>}
					</div>
					<div className="flex shrink-0 gap-1 text-sm font-bold">
						{current && (
							<>
								<button
									type="button"
									disabled={index === 0}
									onClick={() => {
										list.place(current, index - 1)
										onClose()
									}}
									className="rounded-full bg-white/5 px-3 py-1.5 hover:bg-white/10 disabled:opacity-30"
								>
									Move up
								</button>
								<button
									type="button"
									onClick={() => {
										list.remove(current.key)
										onClose()
									}}
									className="rounded-full bg-white/5 px-3 py-1.5 hover:bg-red-600"
								>
									Remove
								</button>
							</>
						)}
						<button type="button" onClick={onClose} aria-label="Close" className="rounded-full px-3 py-1.5 hover:bg-white/10">
							✕
						</button>
					</div>
				</div>
				<input
					autoFocus
					value={q}
					onChange={(e) => setQ(e.target.value)}
					placeholder={current ? "Swap for…" : "Search any movie or show"}
					className="mt-4 w-full rounded-2xl border-0 bg-neutral-800 px-4 py-3 text-lg placeholder:text-neutral-500 focus:ring-2 focus:ring-white"
				/>
				<div className={`${label} mt-3 mb-2`}>{loading ? "Searching…" : results ? "Results" : "Quick picks"}</div>
				<div className="grid grid-cols-4 gap-3 sm:grid-cols-6">
					{shown.slice(0, 24).map((p) => {
						const rank = list.items.findIndex((i) => i.key === p.key)
						return (
							<button
								key={p.key}
								type="button"
								onClick={() => {
									if (rank < 0 && index >= list.items.length) list.add(p, cap)
									else list.place(p, index)
									onClose()
								}}
								className="relative text-left"
								title={rank >= 0 ? `Swap with #${rank + 1}` : p.title}
							>
								<Thumb item={p} className={`w-full rounded-lg transition hover:scale-105 ${rank >= 0 ? "opacity-40" : ""}`} />
								{rank >= 0 && <span className="absolute top-1 left-1 rounded-full bg-black/80 px-2 text-xs font-bold">#{rank + 1}</span>}
								<div className="mt-1 truncate text-xs text-neutral-400">{p.title}</div>
							</button>
						)
					})}
				</div>
			</div>
		</div>
	)
}
