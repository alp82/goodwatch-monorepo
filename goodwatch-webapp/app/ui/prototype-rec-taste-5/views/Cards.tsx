// PROTOTYPE - throwaway. Merged Sides variant "Card stack" (existing): round 2's side tabs, the cards with a
// faint backdrop, stacked down the sidebar. Sides get full cards; edges and your mood follow as slimmer
// cards. The right side is a poster wall: what you loved there, large, then More of this.
// Phones: the cards turn into one sideways strip.
import { YourScore, backdrop } from "~/ui/prototype-rec-taste-2/kit"
import { type Entry, leadOf } from "../entries"
import { Empty, Loved, MoreOfThis, Swap, type VariantProps, useTaste } from "../parts"

export default function Cards({ data }: VariantProps) {
	const { groups, entry, select, services } = useTaste(data)
	if (!entry) return <Empty>Rate a few more titles to see what defines your taste.</Empty>
	const slim = [...groups.edges, ...groups.moods]

	return (
		<div className="mx-auto max-w-7xl px-4 pb-32 pt-8 text-white md:px-8 md:pt-12">
			<h1 className="text-2xl font-bold md:text-3xl">The sides of your taste</h1>
			<p className="mt-1 text-gray-400">
				What you rate highest, grouped by what the title analysis says the titles share.
			</p>
			<div className="mt-6 grid gap-8 lg:mt-8 lg:grid-cols-[300px_1fr] lg:gap-10">
				<aside className="min-w-0">
					<div className="t5-noscroll -mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-1 lg:sticky lg:top-6 lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0">
						{groups.sides.map((e) => (
							<Card key={e.id} e={e} on={e.id === entry.id} onClick={() => select(e.id)} />
						))}
						{slim.length > 0 && (
							<p className="hidden pt-3 text-sm text-gray-400 lg:block">At your edges</p>
						)}
						{slim.map((e) => (
							<Card key={e.id} e={e} slim on={e.id === entry.id} onClick={() => select(e.id)} />
						))}
					</div>
				</aside>

				<Swap id={entry.id} className="min-w-0">
					<div className="flex flex-wrap items-center gap-x-4 gap-y-2">
						<h2 className="text-2xl font-bold md:text-3xl">{entry.statement}</h2>
						{entry.avg != null && (
							<YourScore score={Math.round(entry.avg)} label={`Your average here: ${entry.avg}`} />
						)}
					</div>
					<div className="mt-5">
						<Loved entry={entry} n={8} cols="grid-cols-4" size="w342" />
					</div>
					<MoreOfThis
						data={data}
						entry={entry}
						services={services}
						n={4}
						cols="grid-cols-2 md:grid-cols-4"
						className="mt-10"
					/>
				</Swap>
			</div>
		</div>
	)
}

function Card({ e, on, onClick, slim = false }: { e: Entry; on: boolean; onClick: () => void; slim?: boolean }) {
	const lead = leadOf(e)
	return (
		<button
			type="button"
			onClick={onClick}
			aria-pressed={on}
			className={`relative isolate w-56 shrink-0 snap-start overflow-hidden rounded-xl border-2 text-left transition lg:w-full ${slim ? "px-4 py-3" : "p-4"} ${on ? "border-amber-500 bg-amber-950/40" : "border-gray-800 bg-gray-950/60 hover:border-gray-600"}`}
		>
			{lead && (
				<img
					src={backdrop(lead, "w780")}
					alt=""
					className={`absolute inset-0 -z-10 h-full w-full object-cover ${slim ? "opacity-10" : "opacity-25"}`}
				/>
			)}
			<span className={`block font-bold leading-tight ${slim ? "text-base" : "text-lg"}`}>{e.name}</span>
			<span className={`mt-1 block text-sm ${on ? "text-amber-100" : "text-gray-300"}`}>{e.stat}</span>
		</button>
	)
}
