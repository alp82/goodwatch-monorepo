// The title's plain facts as a two-column list, and its tropes from TV Tropes.
import type { MovieResult, ShowResult } from "~/server/types/details-types"
import { titleFacts, tropeNames } from "~/ui/details/title-words"

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
	if (!names.length) return null
	return (
		<div>
			<ul className="flex flex-wrap gap-2">
				{names.map((name) => (
					<li
						key={name}
						className="rounded-md border border-white/10 bg-white/5 px-2 py-1 text-sm text-gray-200"
					>
						{name}
					</li>
				))}
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
