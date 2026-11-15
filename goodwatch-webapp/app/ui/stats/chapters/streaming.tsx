// Chapter 7, streaming around the world: the Stats tab's country strip, the biggest subscription catalogs, offers by
// kind, and the movies that stream in the most countries.
import type { StatsSnapshot } from "~/domain/stats/snapshot"
import { posterUrl } from "~/ui/profile/parts"
import { flag } from "~/ui/profile/taste/model"
import { regionName } from "~/utils/display-names"
import { count, rank, short, titleKey } from "../format"
import { Chapter, LABEL, PANEL, PosterLink } from "../parts"

const KIND: Record<string, string> = {
	flatrate: "Subscription",
	rent: "Rent",
	buy: "Buy",
	ads: "Free with ads",
	free: "Free",
}

export function Streaming({ s }: { s: StatsSnapshot }) {
	const st = s.streaming
	const [first, ...rest] = st.topCountries
	const everywhere = st.mostCountries[0]?.countries ?? st.countries
	return (
		<Chapter
			id="streaming"
			n={7}
			name="Streaming around the world"
			lead="We know where to watch in"
			accent={`${st.countries} countries.`}
			sub={`${count(st.offers)} offers on ${count(st.services)} services, for ${count(st.titles)} titles.`}
		>
			<div className={`${PANEL} p-4 sm:p-5`}>
				<p className="mb-3 text-sm font-bold text-gray-200">
					Most offers by country
				</p>
				{/* Every block grows by its offers, so the strip spans the panel and each block is its share of it. */}
				<div className="flex h-28 gap-1.5">
					<div
						className="flex min-w-0 flex-col justify-between rounded-lg bg-amber-400 p-3 text-gray-950"
						style={{ flex: `${first.offers} 1 0` }}
					>
						<span className="truncate text-sm font-bold">
							<span aria-hidden>{flag(first.code)} </span>
							{regionName(first.code)}
						</span>
						<span className="text-3xl font-black tabular-nums">
							{short(first.offers)}
						</span>
					</div>
					{rest.slice(0, 5).map((c, i) => (
						<div
							key={c.code}
							className={`min-w-9 flex-col items-center justify-end rounded-lg bg-amber-400/15 p-1.5 text-amber-200 ring-1 ring-amber-400/20 ${i < 3 ? "flex" : "hidden sm:flex"}`}
							style={{ flex: `${c.offers} 1 0` }}
							title={`${regionName(c.code)}: ${count(c.offers)}`}
						>
							<span aria-hidden className="text-lg">
								{flag(c.code)}
							</span>
							<span className="text-[11px] font-bold tabular-nums">
								{short(c.offers)}
							</span>
						</div>
					))}
				</div>
				<ul className="mt-4 flex flex-wrap gap-x-5 gap-y-1.5 text-sm">
					{st.topCountries.map((c) => (
						<li key={c.code} className="text-gray-300">
							<span aria-hidden>{flag(c.code)} </span>
							{regionName(c.code)}{" "}
							<b className="text-white tabular-nums">{count(c.offers)}</b>
						</li>
					))}
				</ul>
				{st.fewestCountry && (
					<p className="mt-4 text-sm text-gray-400">
						The fewest: {regionName(st.fewestCountry.code)}, with{" "}
						<b className="text-white tabular-nums">
							{count(st.fewestCountry.offers)}
						</b>
						.
					</p>
				)}
			</div>
			<div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
				<div className={`${PANEL} p-4`}>
					<p className={`mb-2 ${LABEL}`}>
						Biggest subscription catalogs · country-title offers
					</p>
					<ol className="flex flex-col divide-y divide-white/5">
						{st.topServices.map((x, i) => (
							<li key={x.id} className="flex items-center gap-3 py-2">
								<span className="w-6 text-sm font-black text-gray-600 tabular-nums">
									{rank(i + 1)}
								</span>
								<img
									src={posterUrl(x.logo, "w92") ?? ""}
									alt=""
									loading="lazy"
									className="size-7 shrink-0 rounded-md"
								/>
								<span className="min-w-0 flex-1 truncate text-sm font-semibold text-gray-200">
									{x.name}
								</span>
								<span className="text-xs text-gray-500 tabular-nums">
									{count(x.offers)}
								</span>
							</li>
						))}
					</ol>
				</div>
				<div className="flex flex-col gap-4">
					<div className={`${PANEL} p-4`}>
						<p className={`mb-3 ${LABEL}`}>Offers by kind</p>
						<dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
							{st.byType.map((x) => (
								<div key={x.type} className="flex flex-col">
									<dt className="order-2 text-[11px] text-gray-500">
										{KIND[x.type] ?? x.type}
									</dt>
									<dd className="font-black text-white tabular-nums">
										{count(x.offers)}
									</dd>
								</div>
							))}
						</dl>
					</div>
					<div className={`${PANEL} p-4`}>
						<p className="mb-3 text-sm font-bold text-gray-200">
							{everywhere === st.countries ? (
								<>
									Streaming in all{" "}
									<span className="text-amber-400">{st.countries}</span>{" "}
									countries
								</>
							) : (
								<>
									Streaming in{" "}
									<span className="text-amber-400">{everywhere}</span> countries
								</>
							)}
						</p>
						<ul
							data-fx-spot="stream-everywhere"
							className="grid grid-cols-5 gap-2"
						>
							{st.mostCountries.map((t) => (
								<li key={titleKey(t)} className="min-w-0">
									<PosterLink t={t} title={t.title} />
								</li>
							))}
						</ul>
					</div>
				</div>
			</div>
		</Chapter>
	)
}
