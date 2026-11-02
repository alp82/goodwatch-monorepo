// PROTOTYPE (discover-easy) C "Doors": like the member start page's doors. A wall of big picture doors, each a ready
// recipe (a mix, Top rated, New, Short and sweet, Hidden classics, Surprise me), with the search on top. Opening a
// door turns the wall into one wide banner for that door with a few tweaks (type, length, essentials) and the results.
import type { FilterState } from "~/domain/filter-state"
import {
	BigSearch,
	ChoiceChips,
	Count,
	type EasyContext,
	Essentials,
	FineTune,
	MIXES,
	ModeSwitch,
	Segmented,
	TIME_CHOICES,
	TYPE_CHOICES,
	backdrop,
	hasChoice,
	timeKey,
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
	const leave = () => {
		ctx.filters.update((s) => ({ ...s, ...RESET }))
		ctx.filters.setSort("popular")
	}
	const wall = !door && !hasChoice(ctx)
	return (
		<section>
			<div className="flex items-center justify-between gap-3">
				<h1 className="brand-header text-[23px] leading-tight text-white lg:text-[30px]">Discover</h1>
				<ModeSwitch />
			</div>
			<div className="mt-4">
				<BigSearch ctx={ctx} placeholder="Or describe it in your words…" />
			</div>

			{wall ? (
				<>
					<div className="mt-6 flex items-baseline justify-between">
						<p className="text-xl font-semibold text-white lg:text-2xl">Pick a door</p>
						<button type="button" onClick={surprise} className="cursor-pointer text-sm font-semibold text-amber-400 hover:text-amber-300">
							Surprise me
						</button>
					</div>
					<div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
						{DOORS.map((d, i) => (
							<button
								key={d.id}
								type="button"
								onClick={() => enter(d)}
								className={`group relative cursor-pointer overflow-hidden rounded-2xl text-left ring-1 ring-white/10 transition hover:-translate-y-0.5 hover:ring-white/40 ${
									i < 2 ? "col-span-2 h-44 lg:h-56 md:col-span-1 lg:col-span-2" : "h-36 lg:h-44"
								}`}
								style={{ background: d.hue }}
							>
								{pictures[d.picture] && (
									<img src={backdrop(pictures[d.picture], i < 2 ? "w1280" : "w780")} alt="" className="absolute inset-0 h-full w-full object-cover opacity-75 transition duration-700 group-hover:scale-105 group-hover:opacity-95" />
								)}
								<span className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />
								<span className="absolute bottom-0 left-0 right-0 p-4">
									<span className={`block font-bold text-white ${i < 2 ? "text-xl lg:text-2xl" : "text-base lg:text-lg"}`}>{d.name}</span>
									<span className="mt-0.5 block text-xs text-gray-300">{d.line}</span>
								</span>
							</button>
						))}
					</div>
					<p className="mb-2 mt-10 text-lg font-semibold text-white">Popular right now</p>
				</>
			) : (
				<>
					<div
						className="relative mt-5 overflow-hidden rounded-3xl ring-1 ring-white/10"
						style={{ background: door?.hue ?? "#1f2937" }}
					>
						{door && pictures[door.picture] && (
							<img src={backdrop(pictures[door.picture], "w1280")} alt="" className="absolute inset-0 h-full w-full object-cover opacity-50" />
						)}
						<span className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/60 to-black/20" />
						<div className="relative flex flex-col gap-4 p-5 lg:p-7">
							<div className="flex flex-wrap items-start justify-between gap-3">
								<div>
									<button type="button" onClick={leave} className="cursor-pointer text-sm font-semibold text-gray-300 hover:text-white">
										← All doors
									</button>
									<p className="mt-1 text-2xl font-bold text-white lg:text-4xl">
										{door?.name ?? (ctx.q ? `“${ctx.q}”` : "Your picks")}
									</p>
									<p className="mt-1 text-sm text-gray-300">
										<Count ctx={ctx} />
										{door ? ` · ${door.line}` : ""}
									</p>
								</div>
								<FineTune label="More filters →" />
							</div>
							<div className="flex flex-wrap items-center gap-2">
								<Segmented label="Type" value={ctx.filters.state.type} options={TYPE_CHOICES} onChange={(type) => ctx.filters.set({ type })} />
								<Segmented
									label="Length"
									value={timeKey(ctx.filters.state)}
									options={TIME_CHOICES}
									onChange={(k) => {
										const c = TIME_CHOICES.find((t) => t.key === k)
										ctx.filters.set({ runtime: c?.runtime ? { ...c.runtime } : undefined })
									}}
								/>
								<Essentials ctx={ctx} />
							</div>
						</div>
					</div>
					{!door && (
						<div className="mt-3">
							<ChoiceChips ctx={ctx} />
						</div>
					)}
				</>
			)}
		</section>
	)
}
