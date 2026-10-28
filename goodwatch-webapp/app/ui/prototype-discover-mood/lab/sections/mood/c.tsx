// PROTOTYPE (Discover lab, mood c): mixes first. A guest's stand-in for My movies' taste groups: big picture cards of
// ready combinations, each with its real count and its top title. Everything else (Moods, About, Style, Genre) folds
// in the side column as compact chips, one open at a time, under Movies or shows.
import { ChevronDownIcon, MagnifyingGlassIcon } from "@heroicons/react/20/solid"
import { motion } from "framer-motion"
import { useState } from "react"
import type { ProtoDiscover } from "../../../kit"
import { TypeControl } from "../../shell-parts"
import type { SectionProps } from "../../types"
import {
	ArtTile,
	Dots,
	FoldBody,
	FoldHead,
	type FoldKey,
	MOOD_CHOICES,
	type Moods,
	type Mixes,
	type WorldArt,
	PickRow,
	TypeSwitch,
	islandOfTag,
	mixName,
	useMixes,
	useMoods,
	useWorldArt,
} from "./parts"

function MixCards({ x, art, cols, tile }: { x: Mixes; art: WorldArt; cols: string; tile: string }) {
	return (
		<div className={`grid gap-2 ${cols}`}>
			{x.mixes.map((mx, i) => {
				const c = x.count(i)
				const on = x.isOn(mx)
				return (
					<ArtTile
						key={mx.id}
						name={mixName(mx)}
						line={c.top ? `Like ${c.top}` : null}
						hues={mx.tags.map((t) => t.color)}
						path={c.path ?? art.get(islandOfTag(mx.tags[0]))?.path ?? null}
						on={on}
						dim={!on && c.total === 0}
						foot={c.total !== null ? `${c.total.toLocaleString("en")} titles` : ""}
						onClick={() => x.toggle(mx)}
						className={tile}
					/>
				)
			})}
		</div>
	)
}

function MoodChips({ m }: { m: Moods }) {
	return (
		<div className="flex flex-wrap gap-1.5">
			{MOOD_CHOICES.map((c) => {
				const on = m.isOn(c)
				const tap = m.tap(c)
				const dead = !on && (m.full || tap.none)
				return (
					<motion.button
						key={c.id}
						type="button"
						aria-pressed={on}
						whileTap={{ scale: 0.96 }}
						onClick={() => m.toggle(c)}
						title={c.alias ? `Discover's ${c.alias} filter` : c.word ? `Adds "${c.word}" to the search` : undefined}
						className={`flex h-8 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-full px-3 text-[13px] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-amber-400 ${
							on ? "bg-white font-semibold text-gray-950" : dead ? "bg-white/[0.02] text-gray-600" : "bg-white/[0.06] text-gray-200 hover:bg-white/[0.11] hover:text-white"
						}`}
					>
						<span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: c.color }} />
						{c.name}
						{!on && (tap.search ? <MagnifyingGlassIcon className="h-3 w-3 text-gray-500" aria-hidden /> : tap.short && <span className="text-[11px] tabular-nums text-gray-500">{tap.short}</span>)}
					</motion.button>
				)
			})}
		</div>
	)
}

type Kind = "moods" | FoldKey

function Shelf({ d, m, phone }: { d: ProtoDiscover; m: Moods; phone: boolean }) {
	const [open, setOpen] = useState<Kind | null>("moods")
	const kinds: Kind[] = ["moods", "themes", "styles", "genres"]
	return (
		<div className={`flex flex-col gap-2 ${phone ? "" : "min-h-0 flex-1"}`}>
			{kinds.map((k) => {
				const on = open === k
				const head =
					k === "moods" ? (
						<button
							type="button"
							aria-expanded={on}
							onClick={() => setOpen(on ? null : k)}
							className={`flex h-11 w-full shrink-0 cursor-pointer items-center gap-2.5 rounded-xl px-3 text-left text-sm font-semibold text-white ring-1 transition-colors ${on ? "bg-white/10 ring-white/25" : "bg-white/5 ring-white/10 hover:bg-white/10"}`}
						>
							<Dots hues={MOOD_CHOICES.slice(0, 5).map((c) => c.color)} />
							<span>Moods</span>
							<span className="font-normal text-gray-400">{MOOD_CHOICES.length} · kinds of evening</span>
							<span className="ml-auto flex items-center gap-2">
								{m.used > 0 && <span className="rounded-full bg-white px-1.5 text-xs font-bold tabular-nums text-black">{m.used}</span>}
								<ChevronDownIcon className={`h-4 w-4 opacity-70 transition-transform ${on ? "rotate-180" : ""}`} aria-hidden />
							</span>
						</button>
					) : (
						<FoldHead d={d} k={k} on={on} onClick={() => setOpen(on ? null : k)} />
					)
				return (
					<div key={k} className={on && !phone ? "flex min-h-0 flex-1 flex-col gap-2" : "contents"}>
						{head}
						{on && (
							<motion.div
								initial={{ opacity: 0, y: -4 }}
								animate={{ opacity: 1, y: 0 }}
								transition={{ duration: 0.14 }}
								className={phone ? "pb-1" : "min-h-0 flex-1 overflow-y-auto overscroll-contain pb-1"}
							>
								{k === "moods" ? <MoodChips m={m} /> : <FoldBody d={d} k={k} />}
							</motion.div>
						)}
					</div>
				)
			})}
		</div>
	)
}

export function MoodC({ d, phone }: SectionProps) {
	const m = useMoods(d)
	const art = useWorldArt()
	const x = useMixes(d)
	const empty = <span className="text-sm font-semibold text-white">Mixes</span>
	if (phone)
		return (
			<div className="flex flex-col gap-4">
				<PickRow d={d} m={m} art={art} empty={empty} />
				<MixCards x={x} art={art} cols="grid-cols-2" tile="h-[5.5rem]" />
				<TypeControl d={d} />
				<Shelf d={d} m={m} phone />
			</div>
		)
	return (
		<div className="flex h-full min-h-0">
			<div className="flex min-w-0 flex-1 flex-col gap-3 px-6 py-4">
				<PickRow d={d} m={m} art={art} empty={empty} right={<TypeSwitch d={d} />} />
				<MixCards x={x} art={art} cols="grid-cols-4" tile="h-[8.5rem]" />
			</div>
			<aside className="flex w-[420px] shrink-0 flex-col gap-4 border-l border-white/[0.06] px-5 py-4">
				<Shelf d={d} m={m} phone={false} />
			</aside>
		</div>
	)
}
