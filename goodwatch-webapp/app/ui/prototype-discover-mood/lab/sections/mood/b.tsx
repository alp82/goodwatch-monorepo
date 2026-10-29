// PROTOTYPE (Discover lab, mood b): Explorer-style islands. Mood, About and Style as three small maps; each island sits
// where the Explorer puts it (similar islands close together) and is sized by its Explorer island, so nothing moves
// while filters change. The line under a name is Discover's count. Genre in a side column.
import { MagnifyingGlassIcon } from "@heroicons/react/20/solid"
import { motion } from "framer-motion"
import { useMemo } from "react"
import type { ProtoDiscover, Tag } from "../../../kit"
import type { SectionProps } from "../../types"
import {
	GenreChips,
	MOOD_CHOICES,
	PickRow,
	STYLE_TAGS,
	THEME_TAGS,
	type Tap,
	type WorldArt,
	islandOfTag,
	tagTap,
	useMoods,
	useWorldArt,
} from "./parts"

interface Isle {
	id: string
	name: string
	color: string
	island: string
	on: boolean
	dim: boolean
	tap: Tap
	toggle: () => void
	title?: string
}

interface Placed extends Isle {
	cx: number
	cy: number
	r: number
}

/** Explorer positions scaled into the box, sizes by Explorer island size, then pushed apart until none overlap. */
function place(isles: Isle[], art: WorldArt, w: number, h: number, rMin: number, rMax: number): Placed[] {
	const sizes = isles.map((i) => art.get(i.island)?.count ?? 0)
	const most = Math.max(1, ...sizes)
	const pad = rMax + 4
	const cols = Math.ceil(Math.sqrt(isles.length * (w / h)))
	const out = isles.map((i, k) => {
		const a = art.get(i.island)
		const r = rMin + (rMax - rMin) * Math.sqrt(sizes[k] / most)
		// Without the world yet: a plain grid.
		const gx = ((k % cols) + 0.5) / cols
		const gy = (Math.floor(k / cols) + 0.5) / Math.ceil(isles.length / cols)
		return {
			...i,
			r,
			cx: pad + (a ? (a.x + 1) / 2 : gx) * (w - 2 * pad),
			cy: pad + (a ? (a.y + 1) / 2 : gy) * (h - 2 * pad),
		}
	})
	for (let step = 0; step < 120; step++) {
		for (let a = 0; a < out.length; a++)
			for (let b = a + 1; b < out.length; b++) {
				const p = out[a]
				const q = out[b]
				const dx = q.cx - p.cx || 0.01
				const dy = q.cy - p.cy || 0.01
				const dist = Math.hypot(dx, dy)
				const need = p.r + q.r + 10
				if (dist >= need) continue
				const push = (need - dist) / 2
				p.cx -= (dx / dist) * push
				p.cy -= (dy / dist) * push
				q.cx += (dx / dist) * push
				q.cy += (dy / dist) * push
			}
		for (const p of out) {
			p.cx = Math.min(w - p.r - 2, Math.max(p.r + 2, p.cx))
			p.cy = Math.min(h - p.r - 14, Math.max(p.r + 2, p.cy))
		}
	}
	return out
}

function IslandButton({ p, art }: { p: Placed; art: WorldArt }) {
	const path = art.get(p.island)?.path
	return (
		<motion.button
			type="button"
			role="checkbox"
			aria-checked={p.on}
			title={p.title}
			onClick={p.toggle}
			whileTap={{ scale: 0.95 }}
			animate={{ scale: p.on ? 1.06 : 1, opacity: p.dim ? 0.35 : 1 }}
			transition={{ duration: 0.18 }}
			className="group absolute flex cursor-pointer flex-col items-center justify-center rounded-full text-center text-white outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
			style={{ left: p.cx - p.r, top: p.cy - p.r, width: p.r * 2, height: p.r * 2 }}
		>
			<span
				className={`absolute inset-0 -z-0 overflow-hidden rounded-full ${p.on ? "ring-2 ring-white" : "ring-1 ring-white/15"}`}
				style={{
					background: `radial-gradient(circle at 40% 35%, ${p.color}ee, ${p.color}88 60%, ${p.color}44)`,
					boxShadow: p.on ? `0 0 0 4px ${p.color}55, 0 10px 30px -8px ${p.color}` : `0 6px 20px -10px ${p.color}`,
				}}
				aria-hidden
			>
				{path && (
					<img
						src={`https://image.tmdb.org/t/p/w300${path}`}
						alt=""
						loading="lazy"
						className="absolute inset-0 h-full w-full object-cover opacity-30 mix-blend-luminosity transition-transform duration-500 group-hover:scale-110"
					/>
				)}
				<span className="absolute inset-0 bg-black/20" />
			</span>
			<span
				className="relative whitespace-nowrap font-extrabold leading-none [text-shadow:0_1px_8px_rgba(3,6,14,.9)]"
				style={{ fontSize: Math.max(12, Math.min(19, p.r * 0.4)) }}
			>
				{p.name}
			</span>
			<span className="relative mt-1 flex items-center gap-0.5 whitespace-nowrap text-[11px] font-semibold tabular-nums text-white/80 [text-shadow:0_1px_4px_rgba(0,0,0,.9)]">
				{p.tap.search && <MagnifyingGlassIcon className="h-3 w-3" aria-hidden />}
				{p.tap.search && !p.on ? "Search" : p.tap.short}
			</span>
		</motion.button>
	)
}

function Region({ label, isles, art, w, h, rMin, rMax }: { label: string; isles: Isle[]; art: WorldArt; w: number; h: number; rMin: number; rMax: number }) {
	const placed = useMemo(() => place(isles, art, w, h, rMin, rMax), [isles, art, w, h, rMin, rMax])
	const n = isles.filter((i) => i.on).length
	return (
		<div className="shrink-0">
			<div className="mb-1 flex h-6 items-center gap-2 px-1">
				<h4 className="text-[13px] font-bold uppercase tracking-wide text-gray-400">{label}</h4>
				{n > 0 && <span className="rounded-full bg-white px-1.5 text-xs font-bold tabular-nums text-black">{n}</span>}
			</div>
			<div className="relative rounded-2xl bg-white/[0.025] ring-1 ring-white/[0.05]" style={{ width: w, height: h }}>
				{placed.map((p) => (
					<IslandButton key={p.id} p={p} art={art} />
				))}
			</div>
		</div>
	)
}

const tagIsle = (d: ProtoDiscover, t: Tag): Isle => {
	const tap = tagTap(d, t)
	const on = d.isOn(t)
	return { id: t.key, name: t.name, color: t.color, island: islandOfTag(t), on, dim: !on && tap.none, tap, toggle: () => d.toggle(t) }
}

export function MoodB({ d, phone }: SectionProps) {
	const m = useMoods(d)
	const art = useWorldArt()
	// Stable inputs for place(): only rebuilt when picks or counts change.
	const moods: Isle[] = MOOD_CHOICES.map((c) => {
		const on = m.isOn(c)
		const tap = m.tap(c)
		return {
			id: c.id,
			name: c.name,
			color: c.color,
			island: `mood:${c.id}`,
			on,
			dim: (!on && m.full) || tap.none,
			tap,
			toggle: () => m.toggle(c),
			title: c.alias ? `Discover's ${c.alias} filter` : c.word ? `Adds "${c.word}" to the search` : undefined,
		}
	})
	const themes = THEME_TAGS.map((t) => tagIsle(d, t))
	const styles = STYLE_TAGS.map((t) => tagIsle(d, t))
	if (phone)
		return (
			<div className="flex flex-col gap-4">
				<PickRow d={d} m={m} art={art} />
				<Region label="Mood" isles={moods} art={art} w={358} h={300} rMin={30} rMax={44} />
				<Region label="About" isles={themes} art={art} w={358} h={290} rMin={24} rMax={36} />
				<Region label="Style" isles={styles} art={art} w={358} h={240} rMin={24} rMax={36} />
				<div>
					<h4 className="mb-2 text-[14px] font-semibold text-gray-100">Genre</h4>
					<GenreChips d={d} limit={10} />
				</div>
			</div>
		)
	return (
		<div className="flex h-full min-h-0">
			<div className="flex min-w-0 flex-1 flex-col gap-2 px-5 pt-3 pb-4">
				<PickRow d={d} m={m} art={art} />
				<div className="flex gap-3">
					<Region label="Mood" isles={moods} art={art} w={440} h={296} rMin={32} rMax={48} />
					<Region label="About" isles={themes} art={art} w={280} h={296} rMin={23} rMax={34} />
					<Region label="Style" isles={styles} art={art} w={230} h={296} rMin={23} rMax={34} />
				</div>
			</div>
			<aside className="flex w-[320px] shrink-0 flex-col gap-4 overflow-y-auto overscroll-contain border-l border-white/[0.06] px-5 py-4">
				<div>
					<h4 className="mb-2.5 text-[14px] font-semibold text-gray-100">Genre</h4>
					<GenreChips d={d} limit={14} />
				</div>
			</aside>
		</div>
	)
}
