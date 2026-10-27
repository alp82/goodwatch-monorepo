// PROTOTYPE (start page lab, round 2): stage c "Shelves are results": the room fills the first screen; the H1, a big
// field and mood fans sit on the scene's calm top; results fill the shelves and frames, mirrored by a fixed-height strip
// of real poster cards at the bottom. Tap three you loved (on a shelf or in the strip) and the shelves restock with
// picks in a sweep.
import { HeartIcon } from "@heroicons/react/20/solid"
import { HeartIcon as HeartOutline } from "@heroicons/react/24/outline"
import { Link } from "@remix-run/react"
import { useEffect, useMemo, useRef, useState } from "react"
import { ScorePill } from "~/ui/poster-card/ScorePill"
import { TitleBand } from "~/ui/poster-card/TitleBand"
import { titleHref } from "../../lab/kit"
import type { BlockVariant, LabCard } from "../../lab/types"
import { useLab } from "../../lab/types"
import { type SceneLayout, SceneStage } from "../../scene/SceneStage"
import { ReadingLine, SearchField, discoverHref } from "../hero/shared"
import { joinNames } from "../recs/shared"
import { canHover } from "../shelf/store"
import { StageSlot } from "./c-slot"
import { CD_KEYFRAMES, HeartBadge, LoveCard, MoodFan, ReadingWait, SkeletonCard } from "./cd-parts"
import { NEED, type StageState, useMoods, useStage } from "./cd-state"

const CARD_W = "w-[84px] sm:w-[100px]"
const ROW_H = "h-[126px] sm:h-[150px]"

type Zone = { top: number; bottom: number }

/** Whether a slot's center is in the open band between the top block and the strip. */
const inZone = (layout: SceneLayout, i: number, zone: Zone | null) => {
	if (!zone) return true
	const r = layout.slots[i].rect
	const cy = r.top + r.height / 2
	return cy > zone.top && cy < zone.bottom
}

/** The slots in the open band first, frames (the most visible) before shelves, then the rest in the scene's order. */
function slotOrder(layout: SceneLayout | null, zone: Zone | null): number[] {
	if (!layout) return []
	const rank = (i: number) => (inZone(layout, i, zone) ? 0 : 2) + (layout.slots[i].slot.kind === "frame" ? 0 : 1)
	return layout.slots.map((_, i) => i).sort((a, b) => rank(a) - rank(b) || a - b)
}

/** The open band of the scene between the top block and the strip, in the section's px. */
function useZone(top: React.RefObject<HTMLDivElement | null>, strip: React.RefObject<HTMLDivElement | null>) {
	const [zone, setZone] = useState<Zone | null>(null)
	useEffect(() => {
		const t = top.current
		const s = strip.current
		if (!t || !s) return
		const measure = () => {
			const next = { top: t.offsetTop + t.offsetHeight, bottom: s.offsetTop }
			setZone((z) => (z && z.top === next.top && z.bottom === next.bottom ? z : next))
		}
		measure()
		const ro = new ResizeObserver(measure)
		ro.observe(t)
		ro.observe(s)
		ro.observe(t.parentElement as Element)
		return () => ro.disconnect()
	}, [top, strip])
	return zone
}

function ShelvesStage() {
	const lab = useLab()
	const st = useStage("c")
	const [layout, setLayout] = useState<SceneLayout | null>(null)
	const [hoverKey, setHoverKey] = useState<number | null>(null)

	const list = st.done ? st.picks : st.results
	const topRef = useRef<HTMLDivElement>(null)
	const stripRef = useRef<HTMLDivElement>(null)
	const zone = useZone(topRef, stripRef)
	const order = useMemo(() => slotOrder(layout, zone), [layout, zone])
	const slotCards = useMemo(() => {
		const out: (LabCard | null)[] = layout ? layout.slots.map(() => null) : []
		order.forEach((slot, rank) => {
			out[slot] = list[rank] ?? null
		})
		return out
	}, [order, list, layout])

	return (
		<section aria-label="Search and picks" className="relative h-[calc(100svh-8.5rem)] min-h-[560px] overflow-hidden bg-gray-950 lg:h-[calc(100svh-65px)] lg:min-h-[660px]">
			<style>{CD_KEYFRAMES}</style>
			<SceneStage
				pair={lab.scene}
				style={{ position: "absolute", inset: 0 }}
				focal={[0.5, 0.12]}
				onLayout={setLayout}
				renderSlot={(slot, i) => {
					// Wait for the open band, so the first titles land where they are seen (no flip on load).
					if (!zone) return null
					const card = slotCards[i] ?? null
					return (
						<StageSlot
							card={card}
							slot={slot}
							lifted={card != null && card.key === hoverKey}
							loved={card != null && st.lovedKeys.has(card.key)}
						/>
					)
				}}
			>
				{/* A typed search on its way: the room dims a little while it reads. */}
				<div
					aria-hidden
					className="pointer-events-none absolute inset-0 bg-gray-950 transition-opacity duration-300"
					style={{ opacity: st.pending ? 0.3 : 0 }}
				/>
				{layout ? <SlotHits layout={layout} cards={slotCards} zone={zone} st={st} setHoverKey={setHoverKey} /> : null}
			</SceneStage>
			{/* Scrims: the calm top and the strip at the foot stay readable. No blur. */}
			<div
				aria-hidden
				className="pointer-events-none absolute inset-x-0 top-0 h-[260px] sm:h-[300px]"
				style={{ background: "linear-gradient(to bottom, rgb(3 7 18 / .92) 0%, rgb(3 7 18 / .7) 45%, rgb(3 7 18 / 0) 100%)" }}
			/>
			<div
				aria-hidden
				className="pointer-events-none absolute inset-x-0 bottom-0 h-[280px] sm:h-[310px]"
				style={{ background: "linear-gradient(to top, rgb(3 7 18) 0%, rgb(3 7 18 / .92) 55%, rgb(3 7 18 / 0) 100%)" }}
			/>
			<Top st={st} boxRef={topRef} />
			<Strip st={st} list={list} setHoverKey={setHoverKey} boxRef={stripRef} />
		</section>
	)
}

function Top({ st, boxRef }: { st: StageState; boxRef: React.Ref<HTMLDivElement> }) {
	const moods = useMoods()
	const [hover, setHover] = useState<string | null>(null)
	const activeMood = st.src?.kind === "mood" ? st.src.v : null
	const hinted = moods.find((m) => m.key === (hover ?? activeMood))
	const prompts = st.data.guest.prompts.slice(0, 2)
	return (
		<div ref={boxRef} className="absolute inset-x-0 top-0 z-30 px-4 pt-3 sm:px-6 sm:pt-6 lg:pt-7">
			<div className="mx-auto max-w-[1200px]">
				<h1 className="text-center text-[15px] font-semibold text-gray-300 sm:text-lg">Find something to watch by mood or anything</h1>
				<div className="mx-auto mt-1 max-w-3xl">
					<SearchField
						value={st.draft}
						onChange={st.setDraft}
						onSubmit={(v) => st.typed(v)}
						onClear={st.clear}
						placeholder="A mood, a title, anything"
					/>
				</div>
				{/* Mood fans: phones scroll sideways to the edge; wide screens show all eleven. */}
				<div className="-mx-4 mt-2.5 overflow-x-auto px-4 [scrollbar-width:none] sm:-mx-6 sm:px-6">
					<div className="mx-auto flex w-max gap-1.5 sm:gap-2">
						{moods.map((m) => {
							const on = activeMood === m.key
							return (
								<button
									key={m.key}
									type="button"
									aria-pressed={on}
									onClick={() => st.mood(m.key)}
									onPointerEnter={(e) => e.pointerType === "mouse" && setHover(m.key)}
									onPointerLeave={() => setHover(null)}
									onFocus={() => setHover(m.key)}
									onBlur={() => setHover(null)}
									className={`group flex w-[78px] shrink-0 cursor-pointer flex-col items-center rounded-xl px-1 pt-1.5 pb-1 outline-none ring-1 ring-inset transition-colors focus-visible:ring-2 focus-visible:ring-amber-400 sm:w-[100px] ${on ? "bg-white/[0.12] ring-amber-400" : "ring-transparent hover:bg-white/[0.06]"}`}
								>
									<MoodFan titles={m.titles} hue={m.hue} spread={on || hover === m.key} className="h-[46px] w-full" poster="w-[29px]" />
									<span className={`mt-1 flex max-w-full items-center gap-1 text-[11px] font-semibold leading-4 sm:text-xs ${on ? "text-white" : "text-gray-300"}`}>
										<span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: m.hue }} />
										<span className="truncate">{m.name}</span>
									</span>
								</button>
							)
						})}
					</div>
				</div>
				{/* One fixed line: the mood's example titles, or two example searches. */}
				<div className="mt-1 h-5 overflow-hidden text-center text-xs leading-5 whitespace-nowrap text-gray-400 sm:text-[13px]">
					{hinted ? (
						<span key={hinted.key} className="inline-block max-w-full truncate animate-[cd-fade_.2s_ease-out]">
							<span className="font-semibold" style={{ color: hinted.hue }}>
								{hinted.name}
							</span>{" "}
							· {hinted.examples}
						</span>
					) : (
						<span className="inline-flex max-w-full items-center gap-1.5">
							<span className="shrink-0">Try</span>
							{prompts.map((p, i) => (
								<button
									key={p.q}
									type="button"
									onClick={() => st.prompt(p.q)}
									className={`min-w-0 truncate italic text-gray-200 underline decoration-white/20 underline-offset-4 hover:text-amber-300 hover:decoration-amber-300 ${i > 0 ? "hidden sm:inline" : ""}`}
								>
									“{p.q}”
								</button>
							))}
						</span>
					)}
				</div>
			</div>
		</div>
	)
}

function Strip({
	st,
	list,
	setHoverKey,
	boxRef,
}: { st: StageState; list: LabCard[]; setHoverKey: (k: number | null) => void; boxRef: React.Ref<HTMLDivElement> }) {
	const sig = `${st.done ? "p" : "r"}:${list.map((c) => c.key).join(",")}`
	const q = st.answer?.q ?? ""
	const row = useRef<HTMLDivElement>(null)
	// New cards start at the first one.
	// biome-ignore lint/correctness/useExhaustiveDependencies: keyed by the cards
	useEffect(() => {
		row.current?.scrollTo({ left: 0 })
	}, [sig])
	return (
		<div ref={boxRef} className="absolute inset-x-0 bottom-0 z-30 px-4 pb-3 sm:px-6 sm:pb-5">
			<div className="mx-auto max-w-[1360px]">
				{/* Line 1: what the cards are. */}
				<div className="flex h-7 min-w-0 items-center gap-3">
					<div className="min-w-0 flex-1">
						{st.done ? (
							<h2 className="text-xs font-extrabold tracking-[0.16em] text-amber-400 uppercase">Picked for you</h2>
						) : st.pending ? (
							st.pending.reading ? (
								<ReadingLine
									answer={{ q: st.pending.q, answeredAs: st.pending.q, kind: "prompt", reading: st.pending.reading, titles: [] }}
									className="animate-[cd-fade_.2s_ease-out]"
								/>
							) : (
								<ReadingWait q={st.pending.q} />
							)
						) : st.answer ? (
							<ReadingLine answer={st.answer} />
						) : (
							<h2 className="text-xs font-extrabold tracking-[0.16em] text-gray-300 uppercase">Popular now</h2>
						)}
					</div>
					{!st.done && st.answer && !st.pending ? (
						<Link to={discoverHref(q)} prefetch="none" className="shrink-0 text-sm font-semibold text-amber-400 hover:text-amber-300">
							See all <span aria-hidden>→</span>
						</Link>
					) : null}
				</div>
				{/* Line 2: the taps, or why these picks. */}
				<div className="mb-1.5 flex h-7 min-w-0 items-center gap-3 text-sm">
					{st.done ? (
						<>
							<p className="min-w-0 flex-1 truncate text-gray-200">
								Because you loved <b className="text-white">{joinNames(st.loved)}</b>
							</p>
							<button type="button" onClick={st.restart} className="shrink-0 text-sm font-semibold text-gray-400 hover:text-white">
								Start over
							</button>
						</>
					) : (
						<p className="flex min-w-0 items-center gap-2 text-gray-200" aria-live="polite">
							<span className="font-semibold text-white">Tap three you loved</span>
							<span className="flex gap-0.5" aria-label={`${st.loved.length} of ${NEED}`}>
								{Array.from({ length: NEED }, (_, i) =>
									i < st.loved.length ? (
										// biome-ignore lint/suspicious/noArrayIndexKey: three fixed places
										<HeartIcon key={i} className="h-4 w-4 text-amber-400" />
									) : (
										// biome-ignore lint/suspicious/noArrayIndexKey: three fixed places
										<HeartOutline key={i} className="h-4 w-4 text-white/35" />
									),
								)}
							</span>
							<span className="hidden truncate text-gray-400 sm:inline">for picks for your taste</span>
						</p>
					)}
				</div>
				<div ref={row} className={`-mx-4 overflow-x-auto overflow-y-hidden px-4 [scrollbar-width:none] sm:-mx-6 sm:px-6 ${ROW_H}`}>
					<div key={sig} className="flex w-max gap-2 sm:mx-auto sm:gap-3">
						{st.pending
							? // biome-ignore lint/suspicious/noArrayIndexKey: placeholders
								Array.from({ length: 12 }, (_, i) => <SkeletonCard key={i} i={i} className={`${CARD_W} shrink-0`} />)
							: list.slice(0, st.done ? 11 : 12).map((card, i) => (
									<div
										key={card.key}
										className={`${CARD_W} shrink-0 animate-[cd-in_.3s_ease-out_both]`}
										style={{ animationDelay: `${Math.min(i, 11) * 35}ms` }}
									>
										<LoveCard
											card={card}
											loved={st.lovedKeys.has(card.key)}
											onLove={st.done ? undefined : () => st.toggleLove(card)}
											full={st.loved.length >= NEED}
											priority={i < 4}
											onHover={(on) => setHoverKey(on ? card.key : null)}
										/>
									</div>
								))}
						{st.done ? (
							<div
								className={`flex h-full w-[136px] shrink-0 sm:w-[168px] animate-[cd-in_.3s_ease-out_both] flex-col justify-end rounded-md bg-white/[0.05] p-2 ring-1 ring-white/10`}
								style={{ animationDelay: "380ms" }}
							>
								<p className="text-xs leading-snug text-gray-300 sm:text-sm">Keep these picks and get new ones every day.</p>
								<Link to="/sign-up" className="mt-1.5 text-xs font-semibold text-amber-400 hover:text-amber-300 sm:text-sm">
									Sign up free
								</Link>
							</div>
						) : null}
					</div>
				</div>
			</div>
		</div>
	)
}

const MIN_TAP = 44
const CAP_W = 184
const CAP_H = 96

/** Flat, unrotated targets over the slots (at least finger-sized), the hearts, and the caption of the slot in focus. */
function SlotHits({
	layout,
	cards,
	zone,
	st,
	setHoverKey,
}: {
	layout: SceneLayout
	cards: (LabCard | null)[]
	zone: Zone | null
	st: StageState
	setHoverKey: (k: number | null) => void
}) {
	const [cap, setCap] = useState<{ i: number; pinned: boolean } | null>(null)
	const leave = useRef<ReturnType<typeof setTimeout> | null>(null)
	const keep = () => {
		if (leave.current) clearTimeout(leave.current)
	}
	const drop = () => {
		keep()
		leave.current = setTimeout(() => {
			setCap((c) => (c?.pinned ? c : null))
			setHoverKey(null)
		}, 140)
	}

	// A tap elsewhere drops a pinned caption.
	useEffect(() => {
		if (!cap?.pinned) return
		const off = (e: PointerEvent) => {
			if ((e.target as Element | null)?.closest("[data-c-slot],[data-c-caption]")) return
			setCap(null)
			setHoverKey(null)
		}
		document.addEventListener("pointerdown", off)
		return () => document.removeEventListener("pointerdown", off)
	}, [cap?.pinned, setHoverKey])

	// New titles on the shelves: the old caption goes.
	const sig = cards.map((c) => c?.key ?? 0).join(",")
	// biome-ignore lint/correctness/useExhaustiveDependencies: keyed by the titles
	useEffect(() => setCap(null), [sig])

	const capCard = cap ? cards[cap.i] : null
	const capRect = cap ? layout.slots[cap.i]?.rect : null
	const { cw, ch } = layout.cover

	return (
		<div className="absolute inset-0 z-10">
			{layout.slots.map(({ rect }, i) => {
				const card = cards[i]
				// Slots under the top block or the strip are scenery: their titles are in the strip anyway.
				if (!card || !inZone(layout, i, zone)) return null
				const w = Math.max(MIN_TAP, rect.width)
				const h = Math.max(MIN_TAP, rect.height)
				const loved = st.lovedKeys.has(card.key)
				const style = { left: rect.left + rect.width / 2 - w / 2, top: rect.top + rect.height / 2 - h / 2, width: w, height: h }
				const hover = {
					onPointerEnter: (e: React.PointerEvent) => {
						if (e.pointerType !== "mouse") return
						keep()
						setCap((c) => (c?.pinned ? c : { i, pinned: false }))
						setHoverKey(card.key)
					},
					onPointerLeave: (e: React.PointerEvent) => e.pointerType === "mouse" && drop(),
				}
				return (
					// biome-ignore lint/suspicious/noArrayIndexKey: slots are fixed per scene
					<div key={i} className="absolute" style={style}>
						{st.done ? (
							<Link
								to={titleHref(card)}
								prefetch="none"
								data-c-slot=""
								aria-label={card.title}
								className="absolute inset-0 outline-none [-webkit-tap-highlight-color:transparent] focus-visible:ring-2 focus-visible:ring-amber-400"
								onClick={(e) => {
									if (canHover() || (cap?.i === i && cap.pinned)) return
									e.preventDefault()
									setCap({ i, pinned: true })
									setHoverKey(card.key)
								}}
								{...hover}
							/>
						) : (
							<button
								type="button"
								data-c-slot=""
								aria-pressed={loved}
								aria-label={`${card.title}: ${loved ? "loved" : "tap if you loved it"}`}
								className="absolute inset-0 cursor-pointer outline-none [-webkit-tap-highlight-color:transparent] focus-visible:ring-2 focus-visible:ring-amber-400"
								onClick={() => {
									st.toggleLove(card)
									if (!canHover()) {
										setCap({ i, pinned: true })
										setHoverKey(card.key)
									}
								}}
								{...hover}
							/>
						)}
						<HeartBadge on={loved && !st.done} size="sm" className="absolute -right-1.5 -top-1.5" />
					</div>
				)
			})}
			{capCard && capRect
				? (() => {
						const w = Math.min(CAP_W, cw - 16)
						const left = Math.max(8, Math.min(cw - w - 8, capRect.left + capRect.width / 2 - w / 2))
						const below = capRect.top + capRect.height + 8
						const above = capRect.top - CAP_H - 8
						const top = below + CAP_H <= ch - 8 ? below : above >= 8 ? above : Math.max(8, Math.min(ch - CAP_H - 8, below))
						const loved = st.lovedKeys.has(capCard.key)
						return (
							<Link
								key={`${cap?.i}-${capCard.key}`}
								to={titleHref(capCard)}
								prefetch="none"
								data-c-caption=""
								onPointerEnter={keep}
								onPointerLeave={drop}
								className="@container/card absolute z-20 block animate-[cd-in_.18s_ease-out_both] overflow-hidden rounded-md bg-gray-900 shadow-lg shadow-black/60 ring-1 ring-white/10"
								style={{ left, top, width: w, height: CAP_H }}
							>
								{capCard.backdrop_path ? (
									<img src={`https://image.tmdb.org/t/p/w300${capCard.backdrop_path}`} alt="" className="absolute inset-0 h-full w-full object-cover opacity-60" />
								) : null}
								{st.done ? null : (
									<span
										className={`absolute left-1.5 top-1.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${loved ? "bg-amber-400 text-gray-950" : "bg-gray-950/80 text-gray-200"}`}
									>
										{loved ? <HeartIcon className="h-3 w-3" /> : null}
										{loved ? "Loved" : canHover() ? "Click if you loved it" : "Tap if you loved it"}
									</span>
								)}
								<TitleBand
									title={capCard.title}
									year={capCard.release_year}
									top={
										<ScorePill
											goodwatch={capCard.goodwatch_overall_score_normalized_percent}
											score={null}
											mark={null}
											size="M"
											className="mb-1.5"
										/>
									}
								/>
							</Link>
						)
					})()
				: null}
		</div>
	)
}

export const variant: BlockVariant = { key: "c", name: "Shelves are results", C: ShelvesStage }
