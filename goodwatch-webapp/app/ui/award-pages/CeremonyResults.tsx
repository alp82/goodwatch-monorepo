// A ceremony's results: two columns of categories on a wide screen; in each, the winner's card large at the left and
// the nominees' small cards beside it.
import { Link } from "@remix-run/react"
import type { CategoryResult } from "~/domain/award-pages"
import type { AwardTitle } from "~/server/award-pages.server"
import { AwardCard, WonMark } from "~/ui/award-pages/parts"

export function CeremonyResults({
	base,
	categories,
}: { base: string; categories: CategoryResult<AwardTitle>[] }) {
	return (
		<div className="mx-auto mt-6 grid max-w-7xl grid-cols-[minmax(0,1fr)] gap-x-10 px-4 lg:grid-cols-2">
			{categories.map((c, ci) => (
				<section key={c.id} className="border-b border-white/5 py-4">
					<h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-400">
						<Link
							to={`${base}/category/${c.slug}`}
							prefetch="intent"
							className="hover:text-amber-300"
						>
							{c.name}
						</Link>
					</h2>
					<div className="flex items-start gap-3 sm:gap-4">
						<div className="flex w-28 shrink-0 flex-col gap-2 sm:w-36">
							{c.winners.map((w) => (
								<AwardCard
									key={`${w.media_type}${w.tmdb_id}`}
									title={w}
									size="winner"
									priority={ci < 4}
								/>
							))}
							<WonMark />
						</div>
						{c.nominees.length > 0 && (
							<div className="grid min-w-0 flex-1 grid-cols-3 gap-2 sm:grid-cols-4 xl:grid-cols-5">
								{c.nominees.map((n) => (
									<div key={`${n.media_type}${n.tmdb_id}`} className="min-w-0">
										<AwardCard title={n} size="small" />
									</div>
								))}
							</div>
						)}
					</div>
				</section>
			))}
		</div>
	)
}
