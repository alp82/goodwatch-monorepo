// PROTOTYPE (Discover lab, titles h "Steer board"): the panel is for steering, not searching. The query lives only in
// the bar. Three zones (More like, Less like, Like this) take titles: drag a poster in, or tap its thumb. The posters
// come from the bar's text (titles by name) or, with no text, from this list itself, so the strip under the zones
// changes as the zones change.
import { ArrowDownIcon, FilmIcon, QueueListIcon } from "@heroicons/react/20/solid"
import { motion } from "framer-motion"
import { type DragEvent, useRef, useState } from "react"
import { RollingNumber, TAP } from "~/ui/filter-bar/motion"
import { type TitleKey, parseTitleKey } from "~/utils/title-key"
import { type FoundTitle, POSTER_SM, useQuickTitles } from "../../shell-parts"
import type { SectionProps } from "../../types"
import { STEER, SteerChip, SuggestChips } from "./ghi-parts"
import { EXAMPLE_KEYS, SECTION_LABEL, type Use, useKnown, useTitleUses } from "./shared"

const ZONES: Use[] = ["loved", "disliked", "similarTo"]
const DRAG = "application/x-goodwatch-title"

export function TitlesH({ d, phone, text }: SectionProps) {
	const typed = text.trim()
	const finding = typed.length >= 2 && typed !== d.q
	const titles = useQuickTitles(finding ? text : "")
	const uses = useTitleUses(d)
	const known = useKnown(uses.picked.map((p) => p.key))
	const examples = useKnown(EXAMPLE_KEYS.map((t) => t.key))
	const dragged = useRef<{ t: FoundTitle; from?: Use } | null>(null)
	const [over, setOver] = useState<Use | null>(null)
	const [dragging, setDragging] = useState(false)

	/** Puts a title in one zone, out of the others where they exclude each other, in one URL write. */
	const place = (k: TitleKey, to: Use, from?: Use) =>
		d.filters.update((st) => {
			const out = { ...st }
			const set = (u: Use, list: TitleKey[]) => {
				out[u] = list.length ? list : undefined
			}
			if (from && from !== to) set(from, (out[from] ?? []).filter((x) => x !== k))
			if (!(out[to] ?? []).includes(k)) set(to, [...(out[to] ?? []), k])
			if (to !== "similarTo") {
				const other = to === "loved" ? "disliked" : "loved"
				set(other, (out[other] ?? []).filter((x) => x !== k))
			}
			return out
		})
	const tap = (t: FoundTitle, u: Use) => {
		known.remember(t)
		if (uses.has(u, t.key)) uses.toggle(u, t.key)
		else place(t.key, u)
	}

	const fromCards: FoundTitle[] = d.cards.slice(0, 24).map((c) => ({
		key: c.key,
		title: c.title,
		year: c.release_year ? String(c.release_year) : "",
		poster: c.poster_path,
		mediaType: c.media_type === "movie" ? "movie" : "show",
		tmdbId: c.tmdb_id,
	}))
	const exampleTitles: FoundTitle[] = EXAMPLE_KEYS.map((e) => {
		const k = examples.known(e.key)
		const { mediaType, tmdbId } = parseTitleKey(e.key)
		return { key: e.key, title: k?.title ?? e.title, year: k?.year ?? "", poster: k?.poster ?? null, mediaType, tmdbId }
	})
	const source = finding ? titles.found.slice(0, 14) : fromCards.length ? fromCards : exampleTitles

	const startDrag = (e: DragEvent, t: FoundTitle, from?: Use) => {
		dragged.current = { t, from }
		e.dataTransfer.setData(DRAG, String(t.key))
		e.dataTransfer.effectAllowed = "move"
		setDragging(true)
	}
	const endDrag = () => {
		dragged.current = null
		setDragging(false)
		setOver(null)
	}
	const drop = (u: Use) => {
		const g = dragged.current
		if (!g) return
		known.remember(g.t)
		place(g.t.key, u, g.from)
		endDrag()
	}

	const zones = (
		<div className={phone ? "flex flex-col gap-3" : "grid min-h-0 flex-1 grid-cols-3 gap-4"}>
			{ZONES.map((u) => {
				const s = STEER[u]
				const keys = uses.listOf(u)
				const hot = over === u
				return (
					<section
						key={u}
						aria-label={s.label}
						onDragOver={(e) => {
							if (!dragged.current) return
							e.preventDefault()
							if (over !== u) setOver(u)
						}}
						onDragLeave={() => setOver((o) => (o === u ? null : o))}
						onDrop={(e) => {
							e.preventDefault()
							drop(u)
						}}
						className={`relative flex min-h-0 flex-col rounded-2xl p-4 transition-colors ${phone ? "min-h-[96px]" : ""}`}
						style={{
							background: hot ? `${s.color}2a` : keys.length ? `${s.color}12` : "rgba(255,255,255,0.02)",
							boxShadow: `inset 0 0 0 ${hot ? 2 : 1.5}px ${s.color}${hot ? "cc" : keys.length ? "66" : dragging ? "88" : "33"}`,
							outline: keys.length || hot ? undefined : "none",
						}}
					>
						<div className="mb-3 flex items-center gap-2.5">
							<span
								className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-gray-950 [&>svg]:h-4.5 [&>svg]:w-4.5"
								style={{ background: s.color }}
							>
								{s.icon}
							</span>
							<span className="text-[17px] font-semibold text-white">{s.label}</span>
							{keys.length > 0 && <span className="text-[13px] tabular-nums text-gray-400">{keys.length}</span>}
							{keys.length > 0 && (
								<button
									type="button"
									onClick={() => d.filters.set({ [u]: undefined })}
									className="ml-auto rounded-md px-1.5 py-0.5 text-[12px] text-gray-400 cursor-pointer outline-none hover:bg-white/[0.08] hover:text-white focus-visible:ring-2 focus-visible:ring-amber-400"
								>
									Clear
								</button>
							)}
						</div>
						<div className="flex min-h-0 flex-1 flex-wrap content-start gap-2 overflow-y-auto overscroll-contain">
							{/* Empty: a few titles of the list to tap in (the zone stays a drop target). */}
							{keys.length === 0 && (
								<SuggestChips
									titles={source.filter((t) => !uses.usesOf(t.key).length).slice(ZONES.indexOf(u) * 2)}
									use={u}
									n={2}
									onPick={(t) => tap(t, u)}
								/>
							)}
							{keys.map((k) => {
								const t = known.known(k)
								const ft: FoundTitle = {
									key: k,
									title: t?.title ?? "…",
									year: t?.year ?? "",
									poster: t?.poster ?? null,
									...parseTitleKey(k),
								}
								return (
									<span key={k} draggable={!phone} onDragStart={(e) => startDrag(e, ft, u)} onDragEnd={endDrag} className="max-w-full cursor-grab">
										<SteerChip use={u} title={ft.title} poster={ft.poster} onRemove={() => uses.toggle(u, k)} />
									</span>
								)
							})}
						</div>
					</section>
				)
			})}
		</div>
	)

	const strip = (
		<div className={phone ? "" : "flex shrink-0 items-end gap-5"}>
			<div className={phone ? "mb-2 flex items-center gap-2 px-1" : "flex w-[132px] shrink-0 flex-col gap-1 pb-1"}>
				<span className={`${SECTION_LABEL} flex items-center gap-1.5 text-gray-400 [&>svg]:h-3.5 [&>svg]:w-3.5`}>
					{finding ? <FilmIcon /> : <QueueListIcon />}
					{finding ? "Titles" : "This list"}
				</span>
				{!finding && d.total != null && (
					<span className="flex items-center gap-1 text-[20px] font-semibold text-white tabular-nums">
						{!phone && <ArrowDownIcon className="h-4 w-4 text-gray-500" aria-hidden />}
						<RollingNumber value={d.total} />
					</span>
				)}
				{finding && <span className="truncate text-[13px] text-gray-500">{titles.loading ? "Looking…" : titles.found.length ? "" : "None"}</span>}
			</div>
			<div className={`flex min-w-0 flex-1 gap-2.5 overflow-x-auto overscroll-contain pb-1 ${d.loading && !finding ? "opacity-60 transition-opacity" : ""}`}>
				{source.map((t) => (
					<Poster
						key={t.key}
						t={t}
						phone={phone}
						on={ZONES.find((u) => uses.has(u, t.key))}
						onTap={(u) => tap(t, u)}
						onDragStart={(e) => startDrag(e, t)}
						onDragEnd={endDrag}
					/>
				))}
			</div>
		</div>
	)

	if (phone)
		return (
			<div className="flex flex-col gap-6">
				{zones}
				{strip}
			</div>
		)
	return <div className="flex h-full min-h-0 flex-col gap-4 px-6 pt-5 pb-4">{zones}{strip}</div>
}

function Poster({
	t,
	on,
	phone,
	onTap,
	onDragStart,
	onDragEnd,
}: {
	t: FoundTitle
	on: Use | undefined
	phone: boolean
	onTap: (u: Use) => void
	onDragStart: (e: DragEvent) => void
	onDragEnd: () => void
}) {
	const w = phone ? 72 : 62
	return (
		<div className="group relative shrink-0" style={{ width: w }} title={t.title}>
			<div
				draggable={!phone}
				onDragStart={onDragStart}
				onDragEnd={onDragEnd}
				className="relative block cursor-grab overflow-hidden rounded-lg bg-white/[0.06] ring-1 ring-white/10 active:cursor-grabbing"
				style={{ width: w, height: Math.round(w * 1.5), boxShadow: on ? `0 0 0 2px ${STEER[on].color}` : undefined }}
			>
				{t.poster ? (
					<img src={`${POSTER_SM}${t.poster}`} alt={t.title} draggable={false} loading="lazy" className="h-full w-full object-cover" />
				) : (
					<span className="grid h-full place-items-center p-1 text-center text-[9px] leading-tight text-gray-400">{t.title}</span>
				)}
				{on && (
					<span
						className="absolute top-1 left-1 grid h-5 w-5 place-items-center rounded-full text-gray-950 [&>svg]:h-3 [&>svg]:w-3"
						style={{ background: STEER[on].color }}
					>
						{STEER[on].icon}
					</span>
				)}
			</div>
			<div
				className={`mt-1 flex justify-between transition-opacity ${phone ? "" : "opacity-0 group-focus-within:opacity-100 group-hover:opacity-100"}`}
			>
				{ZONES.map((u) => (
					<motion.button
						key={u}
						type="button"
						whileTap={TAP}
						aria-label={`${STEER[u].label} ${t.title}`}
						aria-pressed={on === u}
						onClick={() => onTap(u)}
						className="grid h-6 w-6 place-items-center rounded-full cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-amber-400 [&>svg]:h-3.5 [&>svg]:w-3.5"
						style={on === u ? { background: STEER[u].color, color: "#030712" } : { background: "rgba(255,255,255,0.07)", color: STEER[u].color }}
					>
						{STEER[u].icon}
					</motion.button>
				))}
			</div>
		</div>
	)
}
