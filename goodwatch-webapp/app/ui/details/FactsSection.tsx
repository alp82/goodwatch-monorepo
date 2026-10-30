// The title's plain facts as a two-column list, and its tropes from TV Tropes. For a signed-in member, a trope among
// their top tropes links to its picks on By your tropes; everyone else sees plain names.
import { Link } from "@remix-run/react"
import { useMemo } from "react"
import { tropeByName, tropeRecsPath } from "~/domain/trope-recs"
import type { MovieResult, ShowResult } from "~/server/types/details-types"
import { titleFacts, tropeNames } from "~/ui/details/title-words"
import { useMyTropes } from "~/ui/trope-recs/api"

type Media = MovieResult | ShowResult

export function FactsList({
	media,
	country,
}: { media: Media; country: string }) {
	return (
		<dl
			data-feedback-area="details"
			className="grid grid-cols-[minmax(7rem,auto)_1fr] gap-x-6 gap-y-2 text-sm"
		>
			{titleFacts(media, country).map((f) => (
				<div key={f.label} className="contents">
					<dt className="text-gray-400">{f.label}</dt>
					<dd className="text-gray-100">{f.value}</dd>
				</div>
			))}
		</dl>
	)
}

export function TropesList({ media }: { media: Media }) {
	const { names, total } = tropeNames(media)
	const mine = useMyTropes(names.length > 0).data?.tropes
	const mineOf = useMemo(() => tropeByName(mine ?? []), [mine])
	if (!names.length) return null
	return (
		<div>
			<ul className="flex flex-wrap gap-2">
				{names.map((name) => {
					const trope = mineOf(name)
					return (
						<li
							key={name}
							className="rounded-md border border-white/10 bg-white/5 text-sm text-gray-200"
						>
							{trope ? (
								<Link
									to={tropeRecsPath({ trope: trope.id })}
									prefetch="intent"
									title={`Your #${trope.rank} trope: picks with it`}
									className="block px-2 py-1 underline decoration-gray-600 decoration-dotted underline-offset-4 hover:text-white hover:decoration-gray-300"
								>
									{name}
								</Link>
							) : (
								<span className="block px-2 py-1">{name}</span>
							)}
						</li>
					)
				})}
			</ul>
			<p className="mt-3 text-xs text-gray-500">
				{total > names.length ? `${names.length} of ${total} tropes. ` : ""}From{" "}
				<a
					href="https://tvtropes.org/"
					target="_blank"
					rel="noreferrer"
					className="underline decoration-gray-600 underline-offset-2 hover:text-amber-300"
				>
					TV Tropes
				</a>
				.
			</p>
		</div>
	)
}
