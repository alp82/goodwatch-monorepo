// PROTOTYPE (Discover lab, mood f): build your own card. One big picture card on the left is the mix you're making:
// its picture is the list's top title, its count is the real total, and it has a slot each for Mood, About, Style and
// Genre. The open slot's choices sit on the right as picture tiles with honest counts. Pick a mood and the card
// changes picture and count; the next empty slot is the one that stands out.
import { PlusIcon, XMarkIcon } from "@heroicons/react/20/solid"
import { AnimatePresence, motion } from "framer-motion"
import { useState } from "react"
import { ChoiceArt } from "~/ui/watch-next/TasteShelf"
import type { ProtoDiscover, Tag } from "../../../kit"
import type { SectionProps } from "../../types"
import {
	ArtTile,
	GenreChips,
	MAX_MOODS,
	MOOD_CHOICES,
	MoodCount,
	type Moods,
	STYLE_TAGS,
	THEME_TAGS,
	type WorldArt,
	clearAll,
	genreOptions,
	islandOfTag,
	tagName,
	tagTap,
	useMoods,
	useWorldArt,
} from "./parts"

type Slot = "moods" | "themes" | "styles" | "genres"
const SLOTS: Slot[] = ["moods", "themes", "styles", "genres"]
const SLOT_LABEL: Record<Slot, string> = { moods: "Mood", themes: "About", styles: "Style", genres: "Genre" }

interface SlotPick {
	id: string
	name: string
	color: string
	remove: () => void
}

function slotPicks(d: ProtoDiscover, m: Moods, k: Slot): SlotPick[] {
	if (k === "genres")
		return genreOptions(d)
			.filter((o) => o.active)
			.map((o) => ({ id: o.id, name: o.label, color: "#9ca3af", remove: o.toggle }))
	const tags = d.picked.filter((t) => t.group === k)
	const picks = tags.map((t) => ({ id: t.key, name: tagName(t), color: t.color, remove: () => d.toggle(t) }))
	if (k === "moods") for (const c of m.words) picks.push({ id: c.id, name: c.name, color: c.color, remove: () => m.toggle(c) })
	return picks
}

function TheCard({ d, m, slot, setSlot, phone }: { d: ProtoDiscover; m: Moods; slot: Slot; setSlot: (k: Slot) => void; phone: boolean }) {
	const top = d.cards.find((c) => c.backdrop_path) ?? null
	const all = SLOTS.map((k) => ({ k, picks: slotPicks(d, m, k) }))
	const hues = all.flatMap((s) => s.picks.map((p) => p.color)).filter((h) => h !== "#9ca3af")
	const art = hues.length ? hues.slice(0, 2) : ["#1f2937"]
	const nextEmpty = all.find((s) => s.k !== "genres" && s.picks.length === 0)?.k ?? null
	const anything = all.some((s) => s.picks.length)
	const noun = d.filters.state.type === "movie" ? "movies" : d.filters.state.type === "show" ? "shows" : "titles"
	const path = top?.backdrop_path ?? null
	return (
		<div
			className={`relative isolate flex flex-col justify-between overflow-hidden rounded-2xl p-4 text-white ring-1 ring-white/15 ${phone ? "h-[17rem]" : "h-full"}`}
			style={{ boxShadow: anything ? `0 12px 40px -14px ${art[0]}` : undefined }}
		>
			<AnimatePresence initial={false}>
				<motion.span
					key={`${path}|${art.join()}`}
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					exit={{ opacity: 0 }}
					transition={{ duration: 0.35 }}
					className="absolute inset-0 -z-10"
					aria-hidden
				>
					<ChoiceArt hues={art} path={path} split={art.length > 1} />
				</motion.span>
			</AnimatePresence>
			<span className="absolute inset-x-0 bottom-0 -z-10 h-3/4 bg-gradient-to-t from-black/85 to-transparent" aria-hidden />
			<div className="flex items-start justify-between gap-3 [text-shadow:0_1px_6px_rgba(0,0,0,.6)]">
				<div className="min-w-0">
					<div className="text-[28px] font-bold leading-none tabular-nums">
						{d.total === null ? "…" : d.total.toLocaleString("en")} <span className="text-lg font-semibold text-white/80">{noun}</span>
					</div>
					{top && <div className="mt-1 truncate text-sm text-white/90">Like {top.title}</div>}
				</div>
				{anything && (
					<button
						type="button"
						onClick={() => {
							clearAll(d, m)
							if (d.filters.state.genres.length) d.filters.set({ genres: [] })
						}}
						className="shrink-0 cursor-pointer rounded-full bg-black/30 px-2.5 py-1 text-sm font-semibold text-white hover:bg-black/50"
					>
						Clear
					</button>
				)}
			</div>
			<div className="flex flex-col gap-1.5">
				{all.map(({ k, picks }) => {
					const open = slot === k
					const glow = !open && k === nextEmpty && anything
					return (
						<div
							key={k}
							className={`flex h-9 min-w-0 items-center gap-2 rounded-xl px-1.5 transition-colors ${open ? "bg-white/[0.16] ring-1 ring-white/40" : "bg-black/25"}`}
						>
							<button
								type="button"
								aria-pressed={open}
								onClick={() => setSlot(k)}
								className={`flex h-7 shrink-0 cursor-pointer items-center gap-1 rounded-lg px-2 text-[13px] font-bold ${glow ? "bg-white text-gray-950" : "text-white hover:bg-white/10"}`}
							>
								{(glow || (!picks.length && !open)) && <PlusIcon className="h-3.5 w-3.5" aria-hidden />}
								{SLOT_LABEL[k]}
							</button>
							<div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto [scrollbar-width:none]">
								{picks.map((p) => (
									<motion.span
										key={p.id}
										layout
										initial={{ opacity: 0, scale: 0.9 }}
										animate={{ opacity: 1, scale: 1 }}
										className="inline-flex h-7 shrink-0 items-center gap-1.5 rounded-lg bg-black/35 pl-2 pr-1 text-[13px] font-semibold"
									>
										<span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
										{p.name}
										<button
											type="button"
											aria-label={`Remove ${p.name}`}
											onClick={p.remove}
											className="flex h-5 w-5 cursor-pointer items-center justify-center rounded-full hover:bg-white/15"
										>
											<XMarkIcon className="h-3.5 w-3.5" />
										</button>
									</motion.span>
								))}
								{!picks.length && <span className="text-[13px] text-white/50">{k === "moods" ? `Up to ${MAX_MOODS}` : "Any"}</span>}
							</div>
						</div>
					)
				})}
			</div>
		</div>
	)
}

function TagTiles({ d, tags, art, cols, tile }: { d: ProtoDiscover; tags: Tag[]; art: WorldArt; cols: string; tile: string }) {
	const sorted = [...tags].sort((a, b) => Number(d.isOn(b)) - Number(d.isOn(a)) || (d.countFor(b) ?? 0) - (d.countFor(a) ?? 0))
	return (
		<div className={`grid gap-2 ${cols}`}>
			{sorted.map((t) => {
				const tap = tagTap(d, t)
				const on = d.isOn(t)
				return (
					<ArtTile
						key={t.key}
						name={t.name}
						hues={[t.color]}
						path={art.get(islandOfTag(t))?.path ?? null}
						on={on}
						dim={tap.none}
						foot={tap.text}
						onClick={() => d.toggle(t)}
						className={tile}
						small
					/>
				)
			})}
		</div>
	)
}

function MoodTileGrid({ m, art, cols, tile }: { m: Moods; art: WorldArt; cols: string; tile: string }) {
	return (
		<div className={`grid gap-2 ${cols}`}>
			{MOOD_CHOICES.map((c) => {
				const on = m.isOn(c)
				const tap = m.tap(c)
				return (
					<ArtTile
						key={c.id}
						name={c.name}
						hues={[c.color]}
						path={art.get(`mood:${c.id}`)?.path ?? null}
						on={on}
						dim={(!on && m.full) || tap.none}
						search={tap.search}
						foot={tap.text}
						onClick={() => m.toggle(c)}
						className={tile}
						small
						title={c.alias ? `Discover's ${c.alias} filter` : c.word ? `Adds "${c.word}" to the search` : undefined}
					/>
				)
			})}
		</div>
	)
}

function Picker({ d, m, art, slot, phone }: { d: ProtoDiscover; m: Moods; art: WorldArt; slot: Slot; phone: boolean }) {
	const cols = phone ? "grid-cols-3" : slot === "moods" ? "grid-cols-6" : "grid-cols-5"
	const tile = phone ? "h-[4.25rem]" : slot === "moods" ? "h-[5.25rem]" : "h-[4.25rem]"
	return (
		<motion.div key={slot} initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.16 }}>
			{slot === "moods" && <MoodTileGrid m={m} art={art} cols={cols} tile={tile} />}
			{slot === "themes" && <TagTiles d={d} tags={THEME_TAGS} art={art} cols={cols} tile={tile} />}
			{slot === "styles" && <TagTiles d={d} tags={STYLE_TAGS} art={art} cols={cols} tile={tile} />}
			{slot === "genres" && <GenreChips d={d} />}
		</motion.div>
	)
}

export function MoodF({ d, phone }: SectionProps) {
	const m = useMoods(d)
	const art = useWorldArt()
	const [slot, setSlot] = useState<Slot>("moods")
	const head = (
		<div className="flex h-9 shrink-0 items-center gap-3">
			<h4 className="text-[15px] font-bold text-white">{SLOT_LABEL[slot]}</h4>
			{slot === "moods" ? <MoodCount m={m} /> : <span className="text-sm text-gray-400">Any of</span>}
		</div>
	)
	if (phone)
		return (
			<div className="flex flex-col gap-4">
				<TheCard d={d} m={m} slot={slot} setSlot={setSlot} phone />
				{head}
				<Picker d={d} m={m} art={art} slot={slot} phone />
			</div>
		)
	return (
		<div className="flex h-full min-h-0 gap-5 px-6 py-4">
			<div className="w-[460px] shrink-0">
				<TheCard d={d} m={m} slot={slot} setSlot={setSlot} phone={false} />
			</div>
			<div className="flex min-w-0 flex-1 flex-col gap-2">
				<div className="flex items-center justify-between gap-4">
					{head}
				</div>
				<div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-1 [scrollbar-width:thin]">
					<Picker d={d} m={m} art={art} slot={slot} phone={false} />
				</div>
			</div>
		</div>
	)
}
