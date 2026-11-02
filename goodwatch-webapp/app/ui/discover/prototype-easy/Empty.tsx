// PROTOTYPE (discover-easy) round 9: what the reading line shows while nothing is searched or filtered. All of it in the
// reading line's quiet style, left of Sort.
import { PlusIcon } from "@heroicons/react/20/solid"
import { useNavigate } from "@remix-run/react"
import { Fragment } from "react"
import { WORDS } from "~/domain/taste-picker"
import { START_PRESETS } from "~/ui/start/search/presets"
import { useInterpretedSearch } from "./ProtoSearch"
import { Label } from "./reading"
import type { Easy } from "./types"

export type EmptyKind = "summary" | "examples" | "quick" | "moods" | "type"
/** Round 10: what follows the type switch on an empty line. */
export type EmptyAfterType = "moods" | "examples"

const QUICK: { label: string; field: string; patch: (e: Easy) => void }[] = [
	{ field: "Format", label: "Movies", patch: (e) => e.filters.set({ type: "movie" }) },
	{ field: "Format", label: "Shows", patch: (e) => e.filters.set({ type: "show" }) },
	{ field: "Released", label: "Recent", patch: (e) => e.filters.set({ released: "recent" }) },
	{ field: "GW score", label: "80+", patch: (e) => e.filters.set({ minScore: 80 }) },
	{ field: "Mood", label: "Funny", patch: (e) => e.filters.set({ moods: ["funny"] as never }) },
	{ field: "Mood", label: "Thrilling", patch: (e) => e.filters.set({ moods: ["action"] as never }) },
]

const MOODS = WORDS.filter((w) => w.kind === "mood").slice(0, 8)

export function EmptyReading({ e, kind }: { e: Easy; kind: EmptyKind }) {
	const { run } = useInterpretedSearch()
	if (kind === "summary")
		return (
			<span className="flex items-center gap-3">
				<Label>Filters</Label>
				<span className="text-[13px] text-gray-400">None, so every movie and show is in.</span>
				<button type="button" onClick={e.customize} className="cursor-pointer text-[12px] font-semibold text-amber-400 hover:text-amber-300">
					Add filter
				</button>
			</span>
		)
	if (kind === "examples")
		return (
			<span className="flex min-w-0 items-center gap-3 whitespace-nowrap">
				<Label>Try</Label>
				{START_PRESETS.slice(0, 5).map((p, i) => (
					<Fragment key={p}>
						{i > 0 && <span className="text-gray-600">·</span>}
						<button type="button" onClick={() => run(p)} className="cursor-pointer text-[13px] text-gray-300 hover:text-white">
							{p}
						</button>
					</Fragment>
				))}
			</span>
		)
	if (kind === "quick")
		return (
			<span className="flex min-w-0 items-center gap-1 whitespace-nowrap">
				<span className="mr-2">
					<Label>Add</Label>
				</span>
				{QUICK.map((q) => (
					<button
						key={q.label}
						type="button"
						onClick={() => q.patch(e)}
						className="flex cursor-pointer items-baseline gap-[5px] rounded-md px-1.5 py-0.5 hover:bg-white/[0.05]"
					>
						<PlusIcon className="h-3 w-3 self-center text-gray-500" />
						<span className="text-[12px] text-[#92a5bf]">{q.field}</span>
						<strong className="text-[12px] font-[650] text-white">{q.label}</strong>
					</button>
				))}
			</span>
		)
	if (kind === "moods")
		return (
			<span className="flex min-w-0 items-center gap-3 whitespace-nowrap">
				<Label>Mood</Label>
				{MOODS.map((w) => (
					<button
						key={w.id}
						type="button"
						onClick={() => e.filters.set({ moods: [w.key] as never })}
						className="flex cursor-pointer items-center gap-1.5 text-[13px] text-gray-300 hover:text-white"
					>
						<span className="h-2 w-2 rounded-full" style={{ background: w.hue }} />
						{w.name}
					</button>
				))}
			</span>
		)
	return null
}

/** Variant "type": Both | Movies | Shows leads the reading line all the time. */
export function TypeSwitch({ e }: { e: Easy }) {
	const t = e.filters.state.type
	return (
		<span role="radiogroup" aria-label="Movies or shows" className="flex shrink-0 rounded-full bg-white/[0.04] p-0.5 ring-1 ring-white/10">
			{(
				[
					["all", "Both"],
					["movie", "Movies"],
					["show", "Shows"],
				] as const
			).map(([k, label]) => (
				<button
					key={k}
					type="button"
					role="radio"
					aria-checked={t === k}
					onClick={() => e.filters.set({ type: k })}
					className={`cursor-pointer rounded-full px-3 py-1 text-[12px] font-semibold ${t === k ? "bg-white/15 text-white" : "text-gray-400 hover:text-white"}`}
				>
					{label}
				</button>
			))}
		</span>
	)
}

/** Moods inside the search field's focus menu (variant H): a tap filters by that mood. */
export function MoodMenuRow() {
	const navigate = useNavigate()
	const pick = (key: string) => {
		const p = new URLSearchParams(window.location.search)
		p.set("moods", key)
		p.delete("page")
		navigate({ search: `?${p}` }, { replace: true, preventScrollReset: true })
	}
	return (
		<>
			<p className="px-2 pt-3 pb-1.5 text-[10px] font-bold tracking-[0.08em] text-gray-500 uppercase">Or a mood</p>
			<div className="flex flex-wrap gap-x-4 gap-y-2 px-2">
				{MOODS.map((w) => (
					<button
						key={w.id}
						type="button"
						onMouseDown={(ev) => ev.preventDefault()}
						onClick={() => pick(w.key)}
						className="flex cursor-pointer items-center gap-1.5 text-[13px] text-gray-300 hover:text-white"
					>
						<span className="h-2 w-2 rounded-full" style={{ background: w.hue }} />
						{w.name}
					</button>
				))}
			</div>
		</>
	)
}
