// PROTOTYPE (discover-easy) C "Doors": like the member start page's doors. A wall of big picture doors, each a ready
// recipe (a mix, Top rated, New, Short and sweet, Hidden classics, Surprise me), with the search on top. Opening a
// door turns the wall into one wide banner for that door with a few tweaks (type, length, essentials) and the results.
import type { FilterState } from "~/domain/filter-state"
import {
	type EasyContext,
	MIXES,
	backdrop,
	hasChoice,
	usePictures,
	wordHue,
	wordsPatch,
} from "./kit"

export const name = "Doors"

interface Door {
	id: string
	name: string
	line: string
	picture: string
	hue: string
	patch: Partial<FilterState>
	sort?: "top" | "newest" | "popular"
}

const RESET: Partial<FilterState> = { ...wordsPatch([]), runtime: undefined, released: "any", minScore: 0 }

const EXTRA: Door[] = [
	{ id: "top", name: "The very best", line: "Score 80 and up", picture: "m:deep", hue: "#b45309", patch: { minScore: 80 }, sort: "top" },
	{ id: "new", name: "New and good", line: "Recent, score 70+", picture: "m:action", hue: "#0e7490", patch: { released: "recent", minScore: 70 }, sort: "newest" },
	{ id: "short", name: "Short and sweet", line: "Under 90 minutes", picture: "m:funny", hue: "#65a30d", patch: { runtime: { max: 90 } } },
	{ id: "classic", name: "Timeless classics", line: "Before 2000, score 80+", picture: "m:history", hue: "#7c3aed", patch: { released: "before2000", minScore: 80 }, sort: "top" },
]

const DOORS: Door[] = [
	...MIXES.map((m) => ({
		id: m.id,
		name: m.name,
		line: "A mix of moods",
		picture: m.id,
		hue: wordHue(m.parts[0]),
		patch: wordsPatch(m.parts),
	})),
	...EXTRA,
]

/** The door whose recipe the URL holds now. */
const recipe = (s: Partial<FilterState>) =>
	JSON.stringify([
		[...(s.moods ?? []), ...(s.themes ?? []), ...(s.styles ?? [])].sort(),
		s.runtime?.min ?? null,
		s.runtime?.max ?? null,
		s.released ?? "any",
		s.minScore ?? 0,
	])
function openDoor(ctx: EasyContext): Door | null {
	const now = recipe(ctx.filters.state)
	return DOORS.find((d) => recipe({ ...RESET, ...d.patch }) === now && now !== recipe(RESET)) ?? null
}

export function VariantC({ ctx }: { ctx: EasyContext }) {
	const pictures = usePictures()
	const door = openDoor(ctx)
	const enter = (d: Door) => {
		ctx.filters.update((s) => ({ ...s, ...RESET, ...d.patch }))
		if (d.sort) ctx.filters.setSort(d.sort)
	}
	const surprise = () => enter(DOORS[Math.floor(Math.random() * DOORS.length)])
	const chosen = door || hasChoice(ctx)
	return (
		<section className="mt-5">
			<div className="flex items-baseline justify-between">
				<p className="text-[11px] font-bold tracking-[0.08em] text-gray-400 uppercase">{chosen ? "Other doors" : "Or pick a door"}</p>
				<button type="button" onClick={surprise} className="cursor-pointer text-sm font-semibold text-amber-400 hover:text-amber-300">
					Surprise me
				</button>
			</div>
			<div className={chosen ? "-mx-4 mt-3 flex gap-3 overflow-x-auto px-4 pb-1" : "mt-3 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4"}>
				{DOORS.map((d, i) => {
					const big = !chosen && i < 2
					const on = door?.id === d.id
					return (
						<button
							key={d.id}
							type="button"
							aria-pressed={on}
							onClick={() => enter(d)}
							className={`group relative shrink-0 cursor-pointer overflow-hidden rounded-2xl text-left ring-2 transition hover:-translate-y-0.5 ${on ? "ring-amber-400" : "ring-white/10 hover:ring-white/40"} ${
								chosen ? "h-16 w-48" : big ? "col-span-2 h-44 md:col-span-1 lg:col-span-2 lg:h-52" : "h-36 lg:h-40"
							}`}
							style={{ background: d.hue }}
						>
							{pictures[d.picture] && (
								<img src={backdrop(pictures[d.picture], big ? "w1280" : chosen ? "w300" : "w780")} alt="" className="absolute inset-0 h-full w-full object-cover opacity-75 transition duration-700 group-hover:scale-105 group-hover:opacity-95" />
							)}
							<span className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />
							<span className={`absolute right-0 bottom-0 left-0 ${chosen ? "p-2" : "p-4"}`}>
								<span className={`block font-bold text-white ${big ? "text-xl lg:text-2xl" : chosen ? "text-[13px]" : "text-base lg:text-lg"}`}>{d.name}</span>
								{!chosen && <span className="mt-0.5 block text-xs text-gray-300">{d.line}</span>}
							</span>
						</button>
					)
				})}
			</div>
		</section>
	)
}
