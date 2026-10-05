// PROTOTYPE - throwaway. Merged Sides variant "Poster stacks" (bolder): every entry in the sidebar is led by a
// small fan of the posters you rated highest there, so the list reads as your shelf before you read a word.
// The right side is a poster wall: your top title large with four more beside it, then More of this.
// Phones: the stacks become one sideways strip.
import { RatedPoster, YourScore, poster } from "~/ui/prototype-rec-taste-2/kit"
import type { Entry } from "../entries"
import { Empty, MoreOfThis, Swap, type VariantProps, useTaste } from "../parts"

export default function Stacks({ data }: VariantProps) {
	const { groups, entry, select, services } = useTaste(data)
	if (!entry) return <Empty>Rate a few more titles to see what defines your taste.</Empty>
	const shown = [...groups.sides, ...groups.edges.slice(0, 3), ...groups.moods.slice(0, 1)].filter(
		(e) => e.loved.length > 0,
	)
	const [top, ...more] = entry.loved

	return (
		<div className="mx-auto max-w-7xl px-4 pb-32 pt-8 text-white md:px-8 md:pt-12">
			<h1 className="text-2xl font-bold md:text-3xl">Your shelves</h1>
			<div className="mt-6 grid gap-8 lg:mt-8 lg:grid-cols-[300px_1fr] lg:gap-10">
				<aside className="min-w-0">
					<ul className="t5-noscroll -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 lg:sticky lg:top-6 lg:mx-0 lg:flex-col lg:gap-1 lg:overflow-visible lg:px-0">
						{shown.map((e, i) => (
							<li key={e.id} className={`shrink-0 lg:shrink ${i === groups.sides.length ? "lg:mt-4" : ""}`}>
								<Shelf e={e} on={e.id === entry.id} onClick={() => select(e.id)} />
							</li>
						))}
					</ul>
				</aside>

				<Swap id={entry.id} className="min-w-0">
					<div className="flex flex-wrap items-center gap-x-4 gap-y-2">
						<h2 className="text-2xl font-bold leading-tight md:text-3xl">{entry.statement}</h2>
						{entry.avg != null && (
							<YourScore score={Math.round(entry.avg)} label={entry.stat} />
						)}
					</div>
					{top && (
						<div className="mt-5 grid grid-cols-4 gap-2 md:gap-3">
							<RatedPoster t={top} size="w500" className="col-span-2 row-span-2" />
							{more.slice(0, 4).map((t) => (
								<RatedPoster key={t.key} t={t} size="w342" />
							))}
						</div>
					)}
					<MoreOfThis data={data} entry={entry} services={services} n={6} cols="grid-cols-3 md:grid-cols-6" className="mt-10" />
				</Swap>
			</div>
		</div>
	)
}

function Shelf({ e, on, onClick }: { e: Entry; on: boolean; onClick: () => void }) {
	const fan = e.loved.filter((t) => t.poster).slice(0, 3)
	return (
		<button
			type="button"
			onClick={onClick}
			aria-pressed={on}
			className={`flex w-60 items-center gap-4 rounded-xl border-2 px-3 py-2.5 text-left transition lg:w-full ${on ? "border-amber-500 bg-amber-950/40" : "border-transparent hover:bg-white/5"}`}
		>
			<span className="relative h-16 w-16 shrink-0">
				{fan.map((t, i) => (
					<img
						key={t.key}
						src={poster(t, "w185")}
						alt=""
						className="absolute top-0 h-16 w-11 rounded border-2 border-gray-800 object-cover shadow-lg"
						style={{
							left: `${i * 10}px`,
							transform: `rotate(${(i - 1) * 7}deg)`,
							zIndex: 3 - i,
						}}
					/>
				))}
			</span>
			<span className="min-w-0">
				<span className={`block font-bold leading-tight ${on ? "text-white" : "text-gray-200"}`}>{e.name}</span>
				<span className="mt-1 block text-sm text-gray-400">{e.stat}</span>
			</span>
		</button>
	)
}
