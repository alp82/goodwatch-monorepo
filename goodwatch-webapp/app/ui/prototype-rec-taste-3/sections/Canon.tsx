// PROTOTYPE - throwaway. Your canon: the titles that define you, large, with the one reason each belongs.
import { Frame, Head, RatedPoster, type View3Props } from "../kit3"

export default function Canon({ data }: View3Props) {
	const r = data.report
	return (
		<Frame>
			<Head
				title="Your canon"
				sub="The titles that define your taste: favorites and top ratings that sit closest to everything else you love."
			/>
			{r.canon.length === 0 ? (
				<p className="mt-10 text-gray-400">
					Rate a few titles 9 or 10 to see your canon.
				</p>
			) : (
				<div className="mt-10 grid grid-cols-2 gap-x-5 gap-y-10 sm:grid-cols-4 md:gap-x-8">
					{r.canon.map((c) => {
						const t = data.items[c.key]
						if (!t) return null
						return (
							<div key={c.key} className="min-w-0">
								<RatedPoster t={t} />
								<p className="mt-3 truncate text-lg font-bold">{t.title}</p>
								<p className="text-sm text-gray-400">
									{c.reason}
								</p>
							</div>
						)
					})}
				</div>
			)}
		</Frame>
	)
}
