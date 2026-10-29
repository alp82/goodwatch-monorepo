// PROTOTYPE (Discover lab, mood d): a mixer with a recipe line. One sentence on top says what the picks make ("212
// titles that are Funny or Cozy, Slow burn, about family"), each part removable. Below, four channels side by side:
// Feel, About, Style, Genre; each row's bar shows how much that choice would leave of the list. No folds, no tabs.
import { MagnifyingGlassIcon, XMarkIcon } from "@heroicons/react/20/solid"
import { motion } from "framer-motion"
import type { ReactNode } from "react"
import type { ProtoDiscover, Tag } from "../../../kit"
import type { SectionProps } from "../../types"
import { MOOD_CHOICES, type Moods, PickCount, STYLE_TAGS, THEME_TAGS, type Tap, clearAll, genreOptions, tagName, tagTap, useMoods } from "./parts"

interface Row {
	id: string
	name: string
	color: string
	on: boolean
	dead: boolean
	tap: Tap
	/** What it would leave, for the bar; null for a search mood. */
	n: number | null
	toggle: () => void
	title?: string
}

function Channel({ label, rows, note, phone }: { label: string; rows: Row[]; note?: ReactNode; phone: boolean }) {
	const picked = rows.filter((r) => r.on).length
	// Each channel's own scale: its biggest count fills the row.
	const max = Math.max(1, ...rows.map((r) => r.n ?? 0))
	return (
		<div className={`flex min-h-0 flex-col ${phone ? "" : "flex-1"}`}>
			<div className="mb-1.5 flex h-6 shrink-0 items-center gap-2 px-1">
				<h4 className="text-[13px] font-bold text-gray-100">{label}</h4>
				<span className="text-[12px] text-gray-500">{picked ? `${picked} · any of` : note}</span>
			</div>
			<div className={phone ? "grid grid-cols-2 gap-x-2" : "min-h-0 flex-1 overflow-y-auto overscroll-contain [scrollbar-width:thin]"}>
				{rows.map((r) => (
					<motion.button
						key={r.id}
						type="button"
						role="checkbox"
						aria-checked={r.on}
						title={r.title}
						onClick={r.toggle}
						whileTap={{ scale: 0.98 }}
						className={`relative flex h-5 w-full cursor-pointer items-center gap-2 overflow-hidden rounded-md px-2 text-left text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
							r.on ? "bg-white/[0.14] font-semibold text-white ring-1 ring-white/40" : r.dead ? "text-gray-600" : "text-gray-200 hover:bg-white/[0.06]"
						}`}
					>
						{r.n !== null && max > 0 && (
							<span
								className="absolute inset-y-0 left-0 origin-left rounded-md transition-transform duration-300"
								style={{ width: "100%", transform: `scaleX(${Math.min(1, r.n / max)})`, background: `${r.color}${r.on ? "40" : "22"}` }}
								aria-hidden
							/>
						)}
						<span className="relative h-2 w-2 shrink-0 rounded-full" style={{ background: r.color }} />
						<span className="relative min-w-0 flex-1 truncate">{r.name}</span>
						<span className="relative flex shrink-0 items-center text-[11px] tabular-nums text-gray-400">
							{r.tap.search && !r.on ? <MagnifyingGlassIcon className="h-3 w-3" aria-hidden /> : r.on ? <XMarkIcon className="h-3.5 w-3.5 text-white/80" aria-hidden /> : r.tap.short}
						</span>
					</motion.button>
				))}
			</div>
		</div>
	)
}

const tagRow = (d: ProtoDiscover, t: Tag): Row => {
	const tap = tagTap(d, t)
	const on = d.isOn(t)
	return { id: t.key, name: t.name, color: t.color, on, dead: !on && tap.none, tap, n: d.countFor(t), toggle: () => d.toggle(t) }
}
const byCount = (rows: Row[]) => [...rows].sort((a, b) => (b.n ?? 0) - (a.n ?? 0))

// ---------------------------------------------------------------------------------------------------------------
// The recipe line

function Part({ children, onRemove, color }: { children: ReactNode; onRemove: () => void; color?: string }) {
	return (
		<motion.button
			layout
			type="button"
			onClick={onRemove}
			initial={{ opacity: 0, y: 4 }}
			animate={{ opacity: 1, y: 0 }}
			className="group inline-flex cursor-pointer items-baseline gap-1 rounded-md px-1 font-bold text-white decoration-2 underline-offset-4 hover:bg-white/[0.08]"
			style={{ textDecorationColor: color, textDecorationLine: "underline" }}
			aria-label="Remove"
		>
			{children}
			<XMarkIcon className="h-3.5 w-3.5 self-center text-gray-500 group-hover:text-white" aria-hidden />
		</motion.button>
	)
}

function Recipe({ d, m }: { d: ProtoDiscover; m: Moods }) {
	const s = d.filters.state
	const of = (g: Tag["group"]) => d.picked.filter((t) => t.group === g)
	const moods = of("moods")
	const styles = of("styles")
	const themes = of("themes")
	const noun = s.type === "movie" ? "movies" : s.type === "show" ? "shows" : "titles"
	const join = (items: ReactNode[], word: string) =>
		items.flatMap((it, i) => (i === 0 ? [it] : [<span key={`j${i}`} className="text-gray-400"> {word} </span>, it]))
	const tagParts = (tags: Tag[]) =>
		tags.map((t) => (
			<Part key={t.key} onRemove={() => d.toggle(t)} color={t.color}>
				{tagName(t)}
			</Part>
		))
	const groups: ReactNode[] = []
	if (moods.length) groups.push(<span key="moods">{join(tagParts(moods), "or")}</span>)
	if (m.words.length)
		groups.push(
			<span key="words">
				{join(
					m.words.map((c) => (
						<Part key={c.id} onRemove={() => m.toggle(c)} color={c.color}>
							{c.name}
						</Part>
					)),
					"and",
				)}
			</span>,
		)
	if (styles.length) groups.push(<span key="styles">{join(tagParts(styles), "or")}</span>)
	if (themes.length)
		groups.push(
			<span key="about">
				<span className="text-gray-400">about </span>
				{join(
					themes.map((t) => (
						<Part key={t.key} onRemove={() => d.toggle(t)} color={t.color}>
							{t.name.toLowerCase()}
						</Part>
					)),
					"or",
				)}
			</span>,
		)
	if (s.genres.length)
		groups.push(
			<span key="genre">
				<span className="text-gray-400">in </span>
				<Part onRemove={() => d.filters.set({ genres: [] })}>{genreOptions(d).filter((o) => o.active).map((o) => o.label).join(" or ")}</Part>
			</span>,
		)
	const total = d.total
	return (
		<div className="flex min-h-10 min-w-0 items-center gap-3">
			<p className="min-w-0 flex-1 truncate text-[19px] leading-tight text-gray-300">
				<span className="font-bold tabular-nums text-white">{total === null ? "…" : total.toLocaleString("en")}</span> {noun}
				{groups.length > 0 && (
					<>
						{" "}
						that are{" "}
						{groups.flatMap((g, i) => (i === 0 ? [g] : [<span key={`c${i}`} className="text-gray-400">, </span>, g]))}
					</>
				)}
			</p>
			<PickCount n={d.picked.length + m.words.length + genreOptions(d).filter((o) => o.active).length} m={m} />
			{groups.length > 0 && (
				<button
					type="button"
					onClick={() => {
						clearAll(d, m)
						if (s.genres.length) d.filters.set({ genres: [] })
					}}
					className="shrink-0 cursor-pointer rounded-full px-2.5 py-1 text-sm font-semibold text-gray-200 hover:bg-white/10"
				>
					Clear
				</button>
			)}
		</div>
	)
}

export function MoodD({ d, phone }: SectionProps) {
	const m = useMoods(d)
	const feel: Row[] = MOOD_CHOICES.map((c) => {
		const tap = m.tap(c)
		const on = m.isOn(c)
		return {
			id: c.id,
			name: c.name,
			color: c.color,
			on,
			dead: !on && (m.full || tap.none),
			tap,
			n: c.tag ? d.countFor(c.tag) : null,
			toggle: () => m.toggle(c),
			title: c.alias ? `Discover's ${c.alias} filter` : c.word ? `Adds "${c.word}" to the search` : undefined,
		}
	})
	const about = byCount(THEME_TAGS.map((t) => tagRow(d, t)))
	const style = byCount(STYLE_TAGS.map((t) => tagRow(d, t)))
	const genres: Row[] = genreOptions(d)
		.sort((a, b) => (b.count ?? 0) - (a.count ?? 0))
		.map((o) => ({
			id: o.id,
			name: o.label,
			color: "#9ca3af",
			on: o.active,
			dead: !o.active && o.count === 0,
			tap: { text: "", short: o.count !== null ? (o.count >= 1000 ? `${(o.count / 1000).toFixed(1)}k` : String(o.count)) : "", none: false, search: false },
			n: o.count,
			toggle: o.toggle,
		}))
	const channels = (
		<>
			<Channel label="Feel" rows={feel} note="Up to 3" phone={phone} />
			<Channel label="About" rows={about} note="Any of" phone={phone} />
			<Channel label="Style" rows={style} note="Any of" phone={phone} />
			<Channel label="Genre" rows={genres} note="Any of" phone={phone} />
		</>
	)
	if (phone)
		return (
			<div className="flex flex-col gap-4">
				<Recipe d={d} m={m} />
				{channels}
			</div>
		)
	return (
		<div className="flex h-full min-h-0 flex-col gap-3 px-6 py-3">
			<div className="flex items-center gap-4">
				<div className="min-w-0 flex-1">
					<Recipe d={d} m={m} />
				</div>
			</div>
			<div className="flex min-h-0 flex-1 gap-5">{channels}</div>
		</div>
	)
}
