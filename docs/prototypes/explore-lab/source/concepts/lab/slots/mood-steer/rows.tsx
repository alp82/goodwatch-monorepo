// PROTOTYPE - throwaway (prototype/explore-r7). "Steer rows": every way to steer is a row, in four small groups (how
// it feels, narrow it down, blend one in, for you). An off row is plainly off: grey question, a one-line hint of what
// it does, a dashed plus. Tap it and its control unfolds in place (one at a time) with one smooth eased height; the
// rows under it move with that height and nothing else animates, so nothing jumps or bounces. A set row keeps its
// color and value, with a cross to take it off.
import { Link } from "@remix-run/react"
import { ChevronUpIcon, PlusIcon, XMarkIcon } from "@heroicons/react/20/solid"
import { useState } from "react"
import { CAPTION } from "~/ui/eyebrow"
import { FOCUS, PANEL } from "../../../../kit/ui"
import { QUICK_T } from "../../../../kit/ui/motion"
import type { SlotVariant } from "../../contract"
import { Together } from "../mood/head"
import { Reveal, STEER_GROUPS, type SteerModel, type SteerRow } from "../mood/steer"

function Row({ row, open, onToggle }: { row: SteerRow; open: boolean; onToggle: () => void }) {
	const on = row.value != null
	const tint = row.color ?? "#ffffff"
	const x = <XMarkIcon aria-hidden className="h-4 w-4" />
	const xClass = `grid h-8 w-8 shrink-0 place-items-center rounded-full text-gray-400 ${QUICK_T} hover:bg-white/10 hover:text-white ${FOCUS}`
	return (
		<li
			data-steer-row={row.id}
			data-on={on ? "" : undefined}
			className={`relative rounded-xl ring-1 ${QUICK_T} ${
				open && !on
					? "bg-white/[0.06] ring-white/12"
					: on
						? ""
						: "ring-transparent hover:bg-white/[0.03]"
			}`}
			// Round 9: a set row is unmistakable: tinted in its color with a ring, its value in its color, a cross.
			style={
				on
					? {
							background: `color-mix(in oklab, ${tint} 11%, transparent)`,
							["--tw-ring-color" as string]: `color-mix(in oklab, ${tint} 38%, transparent)`,
						}
					: undefined
			}
		>
			{/* A set row wears its color as a bar on its edge. */}
			<span
				aria-hidden
				className={`absolute top-2 bottom-2 left-0 w-[3px] rounded-full ${QUICK_T} ${on ? "opacity-100" : "opacity-0"}`}
				style={{ background: tint }}
			/>
			<div className="flex items-center">
				<button
					type="button"
					onClick={onToggle}
					aria-expanded={open}
					className={`group/row flex min-w-0 flex-1 items-center gap-3 rounded-xl py-2 pr-1 pl-3 text-left ${FOCUS}`}
				>
					<span
						className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${QUICK_T} ${
							on
								? "bg-black/25 text-white"
								: open
									? "bg-white/[0.08] text-white"
									: "bg-white/[0.025] text-gray-500 group-hover/row:text-gray-200"
						}`}
					>
						{row.glyph}
					</span>
					<span className="min-w-0 flex-1">
						<span
							className={`block truncate leading-tight ${QUICK_T} ${
								on
									? "text-[11px] font-bold tracking-wide text-gray-400 uppercase"
									: open
										? "text-[14px] font-bold text-white"
										: "text-[14px] font-bold text-gray-400 group-hover/row:text-gray-100"
							}`}
						>
							{row.question}
						</span>
						<span
							className={`block truncate ${on ? "mt-0.5 text-[15px] leading-tight font-bold" : "mt-0.5 text-xs text-gray-500"}`}
							style={on ? { color: row.color ?? "#f9fafb" } : undefined}
						>
							{on ? row.value : row.hint}
						</span>
					</span>
					{!on && (
						<span
							aria-hidden
							className={`grid h-7 w-7 shrink-0 place-items-center rounded-full ${QUICK_T} ${
								open
									? "text-white"
									: "border border-dashed border-white/20 text-gray-500 group-hover/row:border-white/45 group-hover/row:text-white"
							}`}
						>
							{open ? (
								<ChevronUpIcon className="h-4 w-4" />
							) : (
								<PlusIcon className={`h-3.5 w-3.5 ${QUICK_T} group-hover/row:rotate-90`} />
							)}
						</span>
					)}
				</button>
				{on &&
					(row.clearTo ? (
						<Link
							to={row.clearTo}
							replace
							preventScrollReset
							aria-label={`Take off ${row.value}`}
							title={`Take off ${row.value}`}
							className={`${xClass} mr-1.5`}
						>
							{x}
						</Link>
					) : (
						<button
							type="button"
							onClick={row.clear}
							aria-label={`Take off ${row.value}`}
							title={`Take off ${row.value}`}
							className={`${xClass} mr-1.5`}
						>
							{x}
						</button>
					))}
			</div>
			<Reveal open={open}>
				<div className="px-3 pt-0.5 pb-3">{row.control}</div>
			</Reveal>
		</li>
	)
}

function View({ model }: { model: SteerModel }) {
	// Nothing is open at first: the list reads as a list of questions you could ask.
	const [open, setOpen] = useState<string | null>(null)
	const groups = STEER_GROUPS.map((g) => ({
		...g,
		rows: model.rows.filter((r) => r.group === g.id),
	})).filter((g) => g.rows.length > 0)
	return (
		<section className={`${PANEL} flex h-full flex-col overflow-hidden`}>
			<div className="flex h-12 shrink-0 items-center gap-2 border-b border-white/[0.06] px-5">
				<h2 className={CAPTION}>Steer</h2>
				<p className="truncate text-xs text-gray-500">
					{model.on.length ? `${model.on.length} on` : "Tap a question"}
				</p>
				<button
					type="button"
					onClick={model.clearAll}
					tabIndex={model.on.length ? 0 : -1}
					className={`-mr-2 ml-auto rounded-full px-2.5 py-1 text-xs font-bold text-gray-300 ${QUICK_T} hover:bg-white/10 hover:text-white ${FOCUS} ${model.on.length ? "opacity-100" : "pointer-events-none opacity-0"}`}
				>
					Clear all
				</button>
			</div>
			<div className="min-h-0 flex-1 overflow-y-auto px-2 pt-1 pb-2 [scrollbar-width:thin]">
				{groups.map((g) => (
					<div key={g.id} className="pt-2">
						<p className="px-3 pb-1 text-[10.5px] font-bold tracking-[0.12em] text-gray-500 uppercase">
							{g.label}
						</p>
						<ul className="space-y-0.5">
							{g.rows.map((r) => (
								<Row
									key={r.id}
									row={r}
									open={open === r.id}
									onToggle={() => setOpen((o) => (o === r.id ? null : r.id))}
								/>
							))}
						</ul>
					</div>
				))}
				{/* A blend has fewer rows: its foot says what only the blend has, instead of empty panel. */}
				{model.together && (
					<div className="mx-3 mt-5 border-t border-white/[0.06] pt-4 pb-1">
						<p className="pb-1.5 text-[10.5px] font-bold tracking-[0.12em] text-gray-500 uppercase">
							In this blend
						</p>
						<Together {...model.together} />
					</div>
				)}
			</div>
		</section>
	)
}

export const variant: SlotVariant<never, { model: SteerModel }> = {
	id: "rows",
	name: "Steer rows",
	what: "Every way to steer is a plainly-off row in four groups (how it feels, narrow it down, blend one in, for you). Tap one and its own control unfolds in place: a dial, the kinds, decades you drag across, flag-filled countries, genres or moods to blend in.",
	order: 1,
	View,
}
