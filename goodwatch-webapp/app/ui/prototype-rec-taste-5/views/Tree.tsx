// PROTOTYPE - throwaway. Merged Sides variant "Side and edge" (existing): a two-level list. Each side of you,
// and under it the edge that sits just past it (the place, era or kind of story you've barely tried that
// shares its genres). The right side splits into two columns: you loved, and try next.
// Phones: the list becomes a dropdown at the top.
import { YourScore } from "~/ui/prototype-rec-taste-2/kit"
import type { Entry } from "../entries"
import { EntrySelect, Empty, Loved, MoreOfThis, Swap, type VariantProps, useTaste } from "../parts"

export default function Tree({ data }: VariantProps) {
	const { groups, entry, select, services } = useTaste(data)
	if (!entry) return <Empty>Rate a few more titles to see what defines your taste.</Empty>
	const orphans = groups.edges.filter((e) => !groups.sides.some((s) => s.id === e.parent))

	return (
		<div className="mx-auto max-w-7xl px-4 pb-32 pt-8 text-white md:px-8 md:pt-12">
			<h1 className="text-2xl font-bold md:text-3xl">The sides of your taste, and their edges</h1>
			<EntrySelect groups={groups} entry={entry} select={select} className="mt-5 lg:hidden" />
			<div className="mt-6 grid gap-10 lg:mt-8 lg:grid-cols-[300px_1fr]">
				<aside className="hidden lg:block">
					<ul className="sticky top-6 space-y-5">
						{groups.sides.map((s) => (
							<li key={s.id}>
								<Node e={s} on={s.id === entry.id} onClick={() => select(s.id)} />
								<ul className="ml-4 mt-1 border-l-2 border-gray-800 pl-3">
									{groups.edges
										.filter((e) => e.parent === s.id)
										.map((e) => (
											<li key={e.id}>
												<Node e={e} on={e.id === entry.id} onClick={() => select(e.id)} />
											</li>
										))}
								</ul>
							</li>
						))}
						{[...orphans, ...groups.moods].map((e) => (
							<li key={e.id}>
								<Node e={e} on={e.id === entry.id} onClick={() => select(e.id)} />
							</li>
						))}
					</ul>
				</aside>

				<Swap id={entry.id} className="min-w-0">
					<p className="text-sm text-gray-400">{entry.kind === "edge" ? "Just past it" : entry.stat}</p>
					<h2 className="mt-1 text-2xl font-bold leading-tight md:text-4xl">{entry.statement}</h2>
					<div className="mt-8 grid gap-8 md:grid-cols-2 md:gap-10">
						<div>
							<div className="mb-4 flex min-h-9 items-center justify-between gap-3">
								<h3 className="text-xl font-bold">You loved</h3>
								{entry.avg != null && (
									<YourScore score={Math.round(entry.avg)} size="sm" label={`${entry.avg} on average`} />
								)}
							</div>
							<Loved entry={entry} n={6} cols="grid-cols-3" />
						</div>
						<MoreOfThis
							data={data}
							entry={entry}
							services={services}
							n={6}
							cols="grid-cols-3"
							title="Try next"
						/>
					</div>
				</Swap>
			</div>
		</div>
	)
}

function Node({ e, on, onClick }: { e: Entry; on: boolean; onClick: () => void }) {
	const top = e.kind !== "edge"
	return (
		<button
			type="button"
			onClick={onClick}
			aria-pressed={on}
			className={`block w-full rounded-lg px-3 py-2 text-left transition ${on ? "bg-amber-950/40 ring-2 ring-amber-500" : "hover:bg-white/5"}`}
		>
			<span className={`block leading-tight ${top ? "text-lg font-bold" : "font-semibold"} ${on ? "text-white" : top ? "text-gray-100" : "text-gray-400"}`}>
				{e.name}
			</span>
			<span className="mt-0.5 block text-sm text-gray-500">{e.stat}</span>
		</button>
	)
}
