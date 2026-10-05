// PROTOTYPE - throwaway. Third-view candidate "Your hidden gems" (bolder): titles you love that few people
// know. The hero is your rarest one, its rating count set large; below, the wall of your gems with how
// few people rated each, then unseen ones close to your taste.
import { Link } from "@remix-run/react"
import {
	PickRow,
	RatedPoster,
	ServicesSwitch,
	backdrop,
	href,
	itemsOf,
	useOnMine,
} from "~/ui/prototype-rec-taste-2/kit"
import type { Payload4 } from "../model"
import { article, fewRatings } from "../parts"

export default function Gems({ data }: { data: Payload4 }) {
	const g = data.extra.gems
	const gems = itemsOf(data, g.keys)
	const services = useOnMine(data)
	const top = gems[0]
	if (!top)
		return (
			<p className="mx-auto max-w-7xl px-4 py-16 text-lg text-gray-300 md:px-8">
				Rate the titles you love, including the ones nobody else has heard of,
				to see your hidden gems.
			</p>
		)

	return (
		<div className="pb-32 text-white">
			<section className="relative isolate overflow-hidden border-b border-gray-800 bg-gray-950">
				<img
					src={backdrop(top, "w1280")}
					alt=""
					className="absolute inset-0 -z-10 h-full w-full object-cover opacity-30"
				/>
				<div className="absolute inset-0 -z-10 bg-linear-to-r from-gray-950 via-gray-950/90 to-gray-950/40" />
				<div className="mx-auto grid max-w-7xl items-center gap-8 px-4 py-10 md:grid-cols-[1.6fr_1fr] md:px-8 md:py-16">
					<div>
						<p className="text-sm text-gray-400">
							{g.relative
								? "Your least-known favorite"
								: "Your rarest favorite"}
						</p>
						<p className="mt-3 text-6xl font-bold leading-none text-amber-300 tabular-nums md:text-[7.5rem]">
							{top.votes.toLocaleString("en-US")}
						</p>
						<h1 className="mt-4 max-w-2xl text-3xl font-bold leading-tight md:text-5xl">
							{g.relative
								? `ratings for ${top.title}, and still it's the least known title you love.`
								: `ratings is all ${top.title} has.`}
						</h1>
						<p className="mt-3 text-xl text-gray-300 md:text-2xl">
							You gave it {article(top.mine ?? 0)}{" "}
							<span className="font-bold text-sky-300">{top.mine}</span>.
						</p>
						<p className="mt-5 max-w-xl text-gray-400">
							{g.relative
								? "Your favorites are titles most people know. These are the least-known of them."
								: `${g.few} of the ${g.loved} titles you love have fewer than ${g.limit.toLocaleString("en-US")} ratings.`}
						</p>
					</div>
					<Link
						to={href(top)}
						className="mx-auto block w-40 rotate-2 overflow-hidden rounded-lg border-4 border-gray-800 shadow-2xl md:w-64"
					>
						<img
							src={top.poster}
							alt={`Poster for ${top.title}`}
							className="block aspect-[2/3] w-full object-cover"
						/>
					</Link>
				</div>
			</section>

			<section className="mx-auto mt-12 max-w-7xl px-4 md:px-8">
				<h2 className="text-2xl font-bold md:text-3xl">
					{g.relative
						? "Your least-known favorites"
						: "Loved by you, known by few"}
				</h2>
				<p className="mt-1 text-gray-400">
					How many ratings each one has across the sites behind the GoodWatch
					score.
				</p>
				<div className="mt-6 grid grid-cols-3 gap-3 md:grid-cols-8">
					{gems.map((t, i) => (
						<div key={t.key} className={i >= 12 ? "hidden md:block" : ""}>
							<RatedPoster t={t} size="w185" />
							<p className="mt-1.5 text-sm font-semibold tabular-nums text-amber-200">
								{fewRatings(t.votes)}
							</p>
						</div>
					))}
				</div>
			</section>

			<section className="mx-auto mt-16 max-w-7xl px-4 md:px-8">
				<div className="mb-5 flex flex-wrap items-end justify-between gap-3">
					<div>
						<h2 className="text-2xl font-bold md:text-3xl">
							Gems you haven't found yet
						</h2>
						<p className="mt-1 text-gray-400">
							Well-rated, fewer than {g.limit.toLocaleString("en-US")} ratings,
							and close to your taste.
						</p>
					</div>
					<ServicesSwitch state={services} />
				</div>
				<PickRow data={data} refs={services.filter(g.picks)} n={6} />
			</section>
		</div>
	)
}
