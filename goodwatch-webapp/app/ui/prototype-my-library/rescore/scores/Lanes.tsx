// PROTOTYPE - throwaway. Variant B, "Lanes": one lane per score, 10 down to 1, each a wall of small posters. Titles
// with the same score sit together, so an 8 that doesn't belong among the other 8s stands out. Press a poster to
// get the ten keys in the bar at the bottom (the library's rate bar), or drag it onto another lane.
import { XMarkIcon } from "@heroicons/react/20/solid"
import { Link } from "@remix-run/react"
import { memo, useState } from "react"
import type { RatedTitle } from "~/server/prototype-my-library-rescore.server"
import { Poster } from "~/ui/my-pages/bits"
import { ChangeBar, KindTabs, SCORES, ScoreKeys, Search, Select, gwOnTen, kindCounts, titleHref, useView } from "../shared"

const Tile = memo(function Tile({
	t,
	picked,
	moved,
	onPick,
}: {
	t: RatedTitle
	picked: boolean
	moved: boolean
	onPick: (t: RatedTitle) => void
}) {
	return (
		<li>
			<button
				type="button"
				draggable
				onDragStart={(e) => e.dataTransfer.setData("text/plain", t.key)}
				onClick={() => onPick(t)}
				title={`${t.title} (${t.release_year ?? "?"})`}
				aria-label={`${t.title}, ${t.release_year ?? ""}`}
				className={`relative block w-full cursor-pointer overflow-hidden rounded outline-none ring-offset-2 ring-offset-gray-950 focus-visible:ring-2 focus-visible:ring-amber-400 ${picked ? "ring-2 ring-amber-400" : ""} `}
			>
				<Poster path={t.poster_path} className="aspect-[2/3] w-full" />
				{moved && <span aria-label="changed" className="absolute right-1 top-1 h-2.5 w-2.5 rounded-full bg-amber-400 ring-2 ring-gray-950" />}
			</button>
		</li>
	)
})

export function Lanes({ titles }: { titles: RatedTitle[] }) {
	const v = useView(titles, "score", "rated")
	const [picked, setPicked] = useState<RatedTitle | null>(null)
	const [over, setOver] = useState<number | null>(null)
	// Lanes go by the score as it is now: a rescored poster moves to its lane at once.
	const byScore = new Map<number, RatedTitle[]>()
	for (const t of v.groups.flatMap((g) => g.titles)) {
		const n = v.scoreOf(t)
		byScore.set(n, [...(byScore.get(n) ?? []), t])
	}
	const drop = (n: number, key: string) => {
		const t = titles.find((x) => x.key === key)
		if (t) v.rescore(t, n)
	}
	return (
		<div className="flex flex-col gap-3">
			<div className="flex flex-wrap items-center gap-2">
				<KindTabs kind={v.filters.kind} onPick={(kind) => v.set({ kind })} counts={kindCounts(titles)} />
				<Search q={v.filters.q} onChange={(q) => v.set({ q })} className="flex-1 basis-44 sm:max-w-xs" />
				<Select
					label="Genre"
					value={v.filters.genre}
					options={[["", "All"], ...v.genres.map((g) => [g, g] as [string, string])]}
					onPick={(genre) => v.set({ genre })}
				/>
				<span className="hidden grow lg:block" />
				<Select
					label="In a lane"
					value={v.sortBy}
					options={[
						["rated", "Last rated first"],
						["year", "Newest first"],
						["title", "By title"],
						["gap", "Most different from GoodWatch"],
					]}
					onPick={v.setSortBy}
				/>
			</div>
			<p className="text-xs text-gray-500">
				{v.total.toLocaleString("en-US")} titles. Press a poster to rescore it, or drag it onto another lane. A dot
				marks what you changed.
			</p>
			{[...SCORES].reverse().map((n) => {
				const list = byScore.get(n) ?? []
				return (
					<section
						key={n}
						onDragOver={(e) => {
							e.preventDefault()
							setOver(n)
						}}
						onDragLeave={() => setOver((o) => (o === n ? null : o))}
						onDrop={(e) => {
							e.preventDefault()
							setOver(null)
							drop(n, e.dataTransfer.getData("text/plain"))
						}}
						className={`flex gap-3 rounded-2xl p-2 ring-1 transition-colors [content-visibility:auto] [contain-intrinsic-size:auto_200px] ${over === n ? "bg-amber-400/10 ring-amber-400" : "bg-white/[0.02] ring-white/5"}`}
					>
						<div className="sticky top-[calc(var(--nav-header-height,0px)+0.5rem)] flex w-10 shrink-0 flex-col items-center self-start pt-1 md:w-14">
							<span className="flex h-10 w-10 items-center justify-center rounded-lg text-lg font-black tabular-nums text-amber-300 ring-1 ring-amber-400/40 md:h-12 md:w-12 md:text-xl">
								{n}
							</span>
							<span className="mt-1 text-[11px] tabular-nums text-gray-500">{list.length}</span>
						</div>
						{list.length ? (
							<ul className="grid min-w-0 flex-1 grid-cols-[repeat(auto-fill,minmax(3.25rem,1fr))] gap-1.5 md:grid-cols-[repeat(auto-fill,minmax(4rem,1fr))]">
								{list.map((t) => (
									<Tile key={t.key} t={t} picked={picked?.key === t.key} moved={v.changed(t)} onPick={setPicked} />
								))}
							</ul>
						) : (
							<p className="self-center text-xs text-gray-600">Nothing scored {n} here. Drop a poster to give it {n}.</p>
						)}
					</section>
				)
			})}
			{picked ? (
				<section
					aria-label={`Your score for ${picked.title}`}
					className="fixed inset-x-2 bottom-20 z-[60] mx-auto flex max-w-md flex-col gap-2 rounded-2xl bg-gray-950 p-3 text-gray-100 shadow-2xl ring-1 ring-white/20"
				>
					<div className="flex items-center gap-2">
						<Poster path={picked.poster_path} className="h-12 w-8 shrink-0 rounded" />
						<Link to={titleHref(picked)} className="min-w-0 flex-1 hover:text-amber-200">
							<b className="block truncate text-sm">{picked.title}</b>
							<span className="block text-xs text-gray-400">
								{picked.release_year} · Your score is {v.scoreOf(picked)}
								{picked.gw != null && ` · GoodWatch ${picked.gw}%`}
							</span>
						</Link>
						<button
							type="button"
							onClick={() => setPicked(null)}
							aria-label="Close"
							className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-lg text-gray-400 hover:bg-white/10 hover:text-white"
						>
							<XMarkIcon className="h-5 w-5" aria-hidden />
						</button>
					</div>
					<ScoreKeys
						score={v.scoreOf(picked)}
						gw={gwOnTen(picked)}
						label={`Your score for ${picked.title}`}
						onPick={(n) => {
							v.rescore(picked, n)
							setPicked(null)
						}}
					/>
				</section>
			) : (
				<ChangeBar changes={v.changes} onUndo={v.undo} />
			)}
		</div>
	)
}
