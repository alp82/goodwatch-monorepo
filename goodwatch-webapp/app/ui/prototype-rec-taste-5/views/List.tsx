// PROTOTYPE - throwaway. Merged Sides variant "Strength list" (existing): the sidebar is a quiet text list in
// four small groups (sides, edges, your mood, your people), each row with a strength bar. The right side
// leads with the entry's best-rated title as a wide backdrop, then what you loved there, then More of this.
// Phones: the list becomes one chip strip above the right side.
import { backdrop } from "~/ui/prototype-rec-taste-2/kit"
import { type Entry, KIND_LABEL, leadOf } from "../entries"
import {
	ChipStrip,
	Empty,
	Loved,
	MoreOfThis,
	Strength,
	Swap,
	type VariantProps,
	useTaste,
} from "../parts"

export default function List({ data }: VariantProps) {
	const { groups, entry, select, services } = useTaste(data)
	if (!entry) return <Empty>Rate a few more titles to see what defines your taste.</Empty>
	const lead = leadOf(entry)
	const sections = [groups.sides, groups.edges, groups.moods, groups.people].filter((g) => g.length)

	return (
		<div className="mx-auto max-w-7xl px-4 pb-32 pt-8 text-white md:px-8 md:pt-12">
			<h1 className="text-2xl font-bold md:text-3xl">What defines your taste</h1>
			<ChipStrip groups={groups} entry={entry} select={select} className="mt-5 lg:hidden" />
			<div className="mt-6 grid gap-10 lg:mt-8 lg:grid-cols-[280px_1fr]">
				<aside className="hidden lg:block">
					<div className="sticky top-6 space-y-7">
						{sections.map((g) => (
							<div key={g[0].kind}>
								<h2 className="mb-2 text-sm text-gray-400">{KIND_LABEL[g[0].kind]}</h2>
								<ul>
									{g.map((e) => (
										<Row key={e.id} e={e} on={e.id === entry.id} onClick={() => select(e.id)} />
									))}
								</ul>
							</div>
						))}
					</div>
				</aside>

				<Swap id={entry.id} className="min-w-0">
					{lead && (
						<div className="relative isolate overflow-hidden rounded-xl border-2 border-gray-800">
							<img
								src={backdrop(lead)}
								alt=""
								className="absolute inset-0 -z-10 h-full w-full object-cover"
							/>
							<div className="absolute inset-0 -z-10 bg-gradient-to-t from-gray-950 via-gray-950/70 to-gray-950/10" />
							<div className="flex min-h-52 flex-col justify-end p-5 md:min-h-72 md:p-8">
								<p className="text-2xl font-bold leading-tight md:text-4xl">{entry.statement}</p>
								<p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-gray-300">
									<span>{entry.stat}</span>
									<span className="inline-flex items-center gap-2">
										Your {lead.mine} for {lead.title}
									</span>
								</p>
							</div>
						</div>
					)}
					<h3 className="mb-4 mt-8 text-xl font-bold">You loved</h3>
					<Loved entry={entry} n={5} cols="grid-cols-5" />
					<MoreOfThis data={data} entry={entry} services={services} n={6} cols="grid-cols-3 md:grid-cols-6" className="mt-10" />
				</Swap>
			</div>
		</div>
	)
}

function Row({ e, on, onClick }: { e: Entry; on: boolean; onClick: () => void }) {
	return (
		<li>
			<button
				type="button"
				onClick={onClick}
				aria-pressed={on}
				className={`group block w-full rounded-lg px-3 py-2.5 text-left transition ${on ? "bg-amber-950/40" : "hover:bg-white/5"}`}
			>
				<span className="block">
					<span className={`font-semibold leading-tight ${on ? "text-white" : "text-gray-300"}`}>{e.name}</span>
				</span>
				<span className="mt-2 block">
					<Strength value={e.strength} on={on} />
				</span>
			</button>
		</li>
	)
}
