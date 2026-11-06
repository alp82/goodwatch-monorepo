import type { PersonAwards } from "~/server/person-awards"

export function AwardsShelf({ awards }: { awards: PersonAwards | undefined }) {
	if (!awards?.results.length) return null
	return (
		<section aria-label="Awards" className="space-y-3">
			<h2 className="text-xl font-semibold text-gray-100">Awards</h2>
			<p className="text-xs text-gray-400">{awards.note}</p>
			<ul className="grid gap-3 sm:grid-cols-2">
				{awards.results.map((award, index) => (
					<li
						key={`${award.award}:${award.category}:${award.year}:${index}`}
						className="rounded-lg border border-white/10 p-3"
					>
						<p className="text-sm font-medium text-gray-200">
							{award.award} · {award.category}
						</p>
						<p className="mt-1 text-xs text-gray-400">
							{award.year} · {award.won ? "Won" : "Nominated"}
							{award.ceremony ? ` · ${award.ceremony}` : ""}
						</p>
						{award.works.length ? (
							<p className="mt-1 text-xs text-gray-300">
								{[...new Set(award.works.map((work) => work.name))].join(", ")}
							</p>
						) : null}
						{award.portrayals.some((p) => p.character_name) ? (
							<p className="mt-1 text-xs text-gray-300">
								As{" "}
								{award.portrayals
									.map((p) => p.character_name)
									.filter(Boolean)
									.join(", ")}
							</p>
						) : null}
						{award.sources?.length ? (
							<p className="mt-1 text-[10px] text-gray-500">
								Source: {award.sources.join(", ")}
							</p>
						) : null}
					</li>
				))}
			</ul>
		</section>
	)
}
