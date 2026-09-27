// PROTOTYPE - throwaway. People: the directors you keep coming back to, each with the titles that prove it.
import { Frame, Head, RatedPoster, type View3Props, YourScore, itemsOf } from "../kit3"

export default function People({ data }: View3Props) {
	const people = data.report.people.directors.slice(0, 6)
	return (
		<Frame>
			<Head
				title="Your people"
				sub="Directors you keep coming back to, and how you rate them."
			/>
			{people.length === 0 ? (
				<p className="mt-10 text-gray-400">
					Rate a few more films to see who you keep returning to.
				</p>
			) : (
				<div className="mt-10 grid gap-x-12 gap-y-12 md:grid-cols-2">
					{people.map((p) => (
						<div key={p.name} className="min-w-0">
							<div className="flex items-center justify-between gap-4">
								<div className="min-w-0">
									<p className="truncate text-2xl font-bold">{p.name}</p>
									<p className="text-gray-400">{p.count} titles rated</p>
								</div>
								<YourScore score={Math.round(p.avg)} size="lg" />
							</div>
							<div className="mt-4 grid grid-cols-4 gap-3">
								{itemsOf(data, p.keys.slice(0, 4)).map((t) => (
									<RatedPoster key={t.key} t={t} size="w185" />
								))}
							</div>
						</div>
					))}
				</div>
			)}
		</Frame>
	)
}
