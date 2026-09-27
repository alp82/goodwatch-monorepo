// PROTOTYPE - throwaway. The pieces round 5's merged Sides variants share: the selection, the right side's
// "you loved" and "More of this" blocks, and the two mobile pickers (a chip strip and a dropdown).
// Variants compose these freely; each owns its own layout.
import { AnimatePresence, motion } from "framer-motion"
import { type ReactNode, useMemo, useState } from "react"
import {
	PickRow,
	RatedPoster,
	ServicesSwitch,
	useOnMine,
} from "~/ui/prototype-rec-taste-2/kit"
import type { Payload4 } from "~/ui/prototype-rec-taste-4/model"
import { type Entry, type Groups, KIND_LABEL, buildEntries } from "./entries"

export type VariantProps = { data: Payload4 }

/** The entries, the selected one and the services filter, shared by every variant. */
export function useTaste(data: Payload4) {
	const groups = useMemo(() => buildEntries(data), [data])
	const [id, setId] = useState(groups.all[0]?.id)
	const entry = groups.all.find((e) => e.id === id) ?? groups.all[0]
	const services = useOnMine(data)
	return { groups, entry, select: setId, services }
}

/** Swaps its children with a short fade when the entry changes. */
export function Swap({ id, children, className = "" }: { id: string; children: ReactNode; className?: string }) {
	return (
		<AnimatePresence mode="wait">
			<motion.div
				key={id}
				initial={{ opacity: 0, y: 8 }}
				animate={{ opacity: 1, y: 0 }}
				exit={{ opacity: 0 }}
				transition={{ duration: 0.2 }}
				className={className}
			>
				{children}
			</motion.div>
		</AnimatePresence>
	)
}

/** The titles rated highly in an entry, each with the person's own score. */
export function Loved({
	entry,
	n = 10,
	cols = "grid-cols-5",
	size = "w185",
}: { entry: Entry; n?: number; cols?: string; size?: "w185" | "w342" }) {
	return (
		<div className={`grid gap-2 ${cols}`}>
			{entry.loved.slice(0, n).map((t) => (
				<RatedPoster key={t.key} t={t} size={size} />
			))}
		</div>
	)
}

/** "More of this": unseen picks for an entry, on the person's services unless they switch to everywhere. */
export function MoreOfThis({
	data,
	entry,
	services,
	n = 5,
	cols = "grid-cols-2 sm:grid-cols-3 md:grid-cols-5",
	title = "More of this",
	className = "",
}: {
	data: Payload4
	entry: Entry
	services: ReturnType<typeof useOnMine>
	n?: number
	cols?: string
	title?: ReactNode
	className?: string
}) {
	return (
		<div className={className}>
			<div className="mb-4 flex flex-wrap items-end justify-between gap-3">
				<h3 className="text-xl font-bold">{title}</h3>
				<ServicesSwitch state={services} />
			</div>
			<PickRow data={data} refs={services.filter(entry.picks)} n={n} cols={cols} />
		</div>
	)
}

/** A thin bar for how strongly an entry defines the person. */
export function Strength({ value, on }: { value: number; on: boolean }) {
	return (
		<span className="block h-1 w-full overflow-hidden rounded-full bg-white/10">
			<span
				className={`block h-full rounded-full ${on ? "bg-amber-400" : "bg-gray-500"}`}
				style={{ width: `${Math.round(Math.max(0.06, value) * 100)}%` }}
			/>
		</span>
	)
}

/** Phones: every entry as a chip in one sideways strip. */
export function ChipStrip({
	groups,
	entry,
	select,
	className = "",
}: {
	groups: Groups
	entry: Entry
	select: (id: string) => void
	className?: string
}) {
	return (
		<div className={`t5-noscroll -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 ${className}`}>
			{groups.all.map((e, i) => {
				const on = e.id === entry.id
				const first = i === 0 || groups.all[i - 1].kind !== e.kind
				return (
					<button
						key={e.id}
						type="button"
						onClick={() => select(e.id)}
						aria-pressed={on}
						className={`shrink-0 whitespace-nowrap rounded-full border-2 px-4 py-2 text-sm font-semibold transition ${first && i > 0 ? "ml-3" : ""} ${on ? "border-amber-500 bg-amber-900/30 text-amber-100" : e.kind === "side" ? "border-gray-600 text-gray-100" : "border-gray-800 text-gray-400"}`}
					>
						{e.name}
					</button>
				)
			})}
		</div>
	)
}

/** Phones: every entry in one dropdown, grouped as the sidebar is. */
export function EntrySelect({
	groups,
	entry,
	select,
	label = "What defines you",
	className = "",
}: {
	groups: Groups
	entry: Entry
	select: (id: string) => void
	label?: string
	className?: string
}) {
	const kinds = (["side", "edge", "mood", "person"] as const).filter((k) =>
		groups.all.some((e) => e.kind === k),
	)
	return (
		<label className={`block ${className}`}>
			<span className="text-sm text-gray-400">{label}</span>
			<span className="relative mt-1 block">
				<select
					value={entry.id}
					onChange={(ev) => select(ev.target.value)}
					className="block w-full appearance-none rounded-xl border-2 border-amber-500 bg-gray-950 py-3 pl-4 pr-10 text-lg font-bold text-white"
				>
					{kinds.map((k) => (
						<optgroup key={k} label={KIND_LABEL[k]}>
							{groups.all
								.filter((e) => e.kind === k)
								.map((e) => (
									<option key={e.id} value={e.id}>
										{e.name}
									</option>
								))}
						</optgroup>
					))}
				</select>
				<svg
					aria-hidden="true"
					viewBox="0 0 20 20"
					className="pointer-events-none absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-amber-300"
					fill="currentColor"
				>
					<path d="M5.3 7.3a1 1 0 0 1 1.4 0L10 10.6l3.3-3.3a1 1 0 1 1 1.4 1.4l-4 4a1 1 0 0 1-1.4 0l-4-4a1 1 0 0 1 0-1.4Z" />
				</svg>
			</span>
		</label>
	)
}

export function Empty({ children }: { children: ReactNode }) {
	return <p className="mx-auto max-w-7xl px-4 py-16 text-lg text-gray-300 md:px-8">{children}</p>
}
