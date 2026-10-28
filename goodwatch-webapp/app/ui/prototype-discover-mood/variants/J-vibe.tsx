// PROTOTYPE - throwaway. The vibe pieces variant J's mood panel is built from: mood chips with hue dots and counts
// (the sheet's Chip), About and Style as folded rows (a few honest suggestions, the rest on demand), and the picked
// moods as hue dots for the heading.
import { ChevronDownIcon } from "@heroicons/react/20/solid"
import { AnimatePresence, motion } from "framer-motion"
import { useState } from "react"
import { Chip, type Option, byCount } from "~/ui/filter-bar/SheetControls"
import { GROUP_LABEL, type ProtoDiscover, TAGS, type Tag, type TagGroup, tagId } from "../kit"

export const MOOD_TAGS = TAGS.filter((t) => t.group === "moods")
const ABOUT_TAGS = TAGS.filter((t) => t.group === "themes")
const STYLE_TAGS = TAGS.filter((t) => t.group === "styles")
const BY_GROUP: Record<TagGroup, Tag[]> = { moods: MOOD_TAGS, themes: ABOUT_TAGS, styles: STYLE_TAGS }

export const tagOption = (d: ProtoDiscover, t: Tag): Option => ({
	id: tagId(t),
	label: t.name,
	active: d.isOn(t),
	count: d.countFor(t),
	toggle: () => d.toggle(t),
	swatch: <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: t.color }} />,
})

/** Overlapping hue dots for the picked tags (moods first), or the mood hues dimmed when nothing is picked. */
export function HueDots({ tags, size = 12, idle = false }: { tags: Tag[]; size?: number; idle?: boolean }) {
	const shown = tags.length ? tags.slice(0, 4) : idle ? MOOD_TAGS.slice(0, 4) : []
	if (!shown.length) return null
	return (
		<span className="flex shrink-0 items-center" aria-hidden>
			{shown.map((t, i) => (
				<span
					key={tagId(t)}
					className={`rounded-full ring-2 ring-gray-950 ${tags.length ? "" : "opacity-60"}`}
					style={{ width: size, height: size, background: t.color, marginLeft: i ? -size / 3 : 0 }}
				/>
			))}
		</span>
	)
}

/** How the picked tags read in one line: "Funny + Feel-good", "+1" past two. */
export function pickedLabel(picked: Tag[]) {
	const sorted = [...picked.filter((t) => t.group === "moods"), ...picked.filter((t) => t.group !== "moods")]
	if (!sorted.length) return null
	const head = sorted.slice(0, 2).map((t) => t.name).join(" + ")
	return sorted.length > 2 ? `${head} +${sorted.length - 2}` : head
}

/** The note beside a group's title: with picks, a further tag widens ("any of"). */
function groupNote(d: ProtoDiscover, group: TagGroup) {
	const n = d.picked.filter((t) => t.group === group).length
	return n ? `Any of these · ${n} of 3` : "Up to 3"
}

function GroupHead({ d, group, right }: { d: ProtoDiscover; group: TagGroup; right?: React.ReactNode }) {
	const picks = d.picked.filter((t) => t.group === group)
	return (
		<div className="mb-2.5 flex h-6 items-center gap-2">
			<h3 className="text-[14px] font-semibold text-gray-100">{GROUP_LABEL[group]}</h3>
			<span className="text-[12px] text-gray-500">{groupNote(d, group)}</span>
			<span className="ml-auto flex items-center gap-1">
				{picks.length > 0 && (
					<button
						type="button"
						onClick={() => {
							for (const t of picks) d.toggle(t)
						}}
						className="rounded-md px-1.5 py-0.5 text-[12px] text-gray-400 cursor-pointer outline-none hover:bg-white/[0.08] hover:text-white focus-visible:ring-2 focus-visible:ring-amber-400"
					>
						Clear
					</button>
				)}
				{right}
			</span>
		</div>
	)
}

/** All the moods, with hue dots and what each would leave. */
export function MoodSection({ d }: { d: ProtoDiscover }) {
	return (
		<section aria-label="Mood">
			<GroupHead d={d} group="moods" />
			<div className="flex flex-wrap gap-1.5">
				{MOOD_TAGS.map((t) => (
					<Chip key={tagId(t)} o={tagOption(d, t)} />
				))}
			</div>
		</section>
	)
}

/**
 * About or Style, folded: one fixed-height line with the picks and the best few to add (by what they'd leave), and
 * "+N" to unfold the rest. Unfolded: every option by count.
 */
export function FoldedGroup({ d, group, few = 4 }: { d: ProtoDiscover; group: "themes" | "styles"; few?: number }) {
	const [open, setOpen] = useState(false)
	const options = byCount(BY_GROUP[group].map((t) => tagOption(d, t)))
	const keep = Math.max(few, options.filter((o) => o.active).length)
	const head = options.slice(0, keep)
	const rest = options.length - keep
	return (
		<section aria-label={GROUP_LABEL[group]}>
			<GroupHead
				d={d}
				group={group}
				right={
					<button
						type="button"
						onClick={() => setOpen(!open)}
						aria-expanded={open}
						className="flex h-6 items-center gap-0.5 rounded-md px-1.5 text-[12px] font-medium text-amber-300/90 cursor-pointer outline-none hover:text-amber-200 focus-visible:ring-2 focus-visible:ring-amber-400"
					>
						{open ? "Fewer" : `All ${options.length}`}
						<ChevronDownIcon className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
					</button>
				}
			/>
			{open ? (
				<motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-wrap gap-1.5">
					{options.map((o) => (
						<Chip key={o.id} o={o} />
					))}
				</motion.div>
			) : (
				<div className="flex h-8 gap-1.5 overflow-hidden">
					{head.map((o) => (
						<Chip key={o.id} o={o} />
					))}
					{rest > 0 && (
						<button
							type="button"
							onClick={() => setOpen(true)}
							className="flex h-8 shrink-0 items-center rounded-full px-2.5 text-[13px] font-medium text-amber-300/90 cursor-pointer outline-none hover:text-amber-200 focus-visible:ring-2 focus-visible:ring-amber-400"
						>
							+{rest}
						</button>
					)}
				</div>
			)}
		</section>
	)
}

/** Expands its children under a quiet, link-like row. */
export function Disclosure({
	label,
	icon,
	badge,
	open,
	onToggle,
	children,
}: {
	label: string
	icon?: React.ReactNode
	badge?: number
	open: boolean
	onToggle: () => void
	children: React.ReactNode
}) {
	return (
		<div>
			<button
				type="button"
				onClick={onToggle}
				aria-expanded={open}
				className="group flex h-11 w-full items-center gap-2 rounded-xl text-[14px] font-semibold text-gray-200 cursor-pointer outline-none hover:text-white focus-visible:ring-2 focus-visible:ring-amber-400"
			>
				{icon}
				{label}
				{badge ? (
					<span className="grid h-5 min-w-5 place-items-center rounded-full bg-amber-500 px-1.5 text-xs font-bold tabular-nums text-gray-950">
						{badge}
					</span>
				) : null}
				<span className="h-px flex-1 bg-white/[0.07]" />
				<ChevronDownIcon
					className={`h-4 w-4 text-gray-500 transition-transform group-hover:text-gray-300 ${open ? "rotate-180" : ""}`}
				/>
			</button>
			<AnimatePresence initial={false}>
				{open && (
					<motion.div
						initial={{ opacity: 0, y: -6 }}
						animate={{ opacity: 1, y: 0 }}
						exit={{ opacity: 0 }}
						transition={{ duration: 0.16 }}
						className="pt-2"
					>
						{children}
					</motion.div>
				)}
			</AnimatePresence>
		</div>
	)
}
