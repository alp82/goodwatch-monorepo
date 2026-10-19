// The streaming study's pieces besides the charts, in the site's existing look: the about page's number row, links to
// the title pages the text names, the table of every country, the CSV files and the credits TMDB's terms ask for.
import { Link } from "@remix-run/react"
import justwatchLogo from "~/img/justwatch-logo.svg"
import tmdbLogo from "~/img/tmdb-logo.svg"
import { assetUrl } from "~/utils/asset-url"
import { titlePath } from "~/utils/helpers"
import { COUNTRY_TABLE_ID } from "./StudyChart"
import { type StudyData, type TitleRef, fmt } from "./study-charts"

export function KeyNumbers({
	items,
}: { items: { n: string; label: string }[] }) {
	return (
		<dl className="my-10 grid grid-cols-2 gap-x-6 gap-y-6 border-y border-white/10 py-8 sm:grid-cols-4">
			{items.map(({ n, label }) => (
				<div key={label} className="flex flex-col gap-1">
					<dt className="order-2 text-sm text-gray-400">{label}</dt>
					<dd className="text-3xl font-black tracking-tight text-white">{n}</dd>
				</div>
			))}
		</dl>
	)
}

const linkClass = "font-semibold text-amber-500 hover:text-amber-400"

export function TitleLink({ item }: { item: TitleRef }) {
	return (
		<Link
			to={titlePath(item.kind, item.tmdb_id, item.title)}
			prefetch="intent"
			className={linkClass}
		>
			{item.name}
		</Link>
	)
}

/** Titles as a sentence: "A (2001), B (1988) and C (2004)". */
export function TitleRun({ items }: { items: TitleRef[] }) {
	return (
		<>
			{items.map((item, index) => (
				<span key={item.tmdb_id}>
					{index > 0 ? (index === items.length - 1 ? " and " : ", ") : null}
					<TitleLink item={item} />
					{item.year ? ` (${item.year})` : null}
				</span>
			))}
		</>
	)
}

export function CountryTable({ data }: { data: StudyData }) {
	const rows = [...data.countries].sort((a, b) =>
		a.name.localeCompare(b.name, "en"),
	)
	return (
		<section
			id={COUNTRY_TABLE_ID}
			aria-labelledby="every-country-heading"
			className="my-12 scroll-mt-24"
		>
			<h2
				id="every-country-heading"
				className="mt-12 mb-4 text-2xl font-bold tracking-tight text-white"
			>
				Every country
			</h2>
			<details className="rounded-2xl bg-white/[0.04] ring-1 ring-white/10">
				<summary className="cursor-pointer px-4 py-3 font-semibold text-amber-500 hover:text-amber-400">
					Show the numbers for all {rows.length} countries
				</summary>
				<div className="overflow-x-auto px-2 pb-4">
					<table className="w-full text-left text-sm tabular-nums">
						<caption className="px-2 pb-3 text-left text-xs text-gray-400">
							Of {fmt(data.movies.titles)} movies and {fmt(data.shows.titles)}{" "}
							shows, how many are on a subscription in each country, on{" "}
							{data.snapshot.date}.
						</caption>
						<thead className="text-xs text-gray-400">
							<tr>
								<th scope="col" className="px-2 py-2 font-semibold">
									Country
								</th>
								<th scope="col" className="px-2 py-2 text-right font-semibold">
									Movies
								</th>
								<th scope="col" className="px-2 py-2 font-semibold">
									Biggest service
								</th>
								<th scope="col" className="px-2 py-2 text-right font-semibold">
									On Netflix
								</th>
								<th scope="col" className="px-2 py-2 text-right font-semibold">
									Shows
								</th>
							</tr>
						</thead>
						<tbody className="text-gray-300">
							{rows.map((c) => (
								<tr key={c.code} className="border-t border-white/5">
									<th
										scope="row"
										className="px-2 py-1.5 font-normal text-gray-100"
									>
										{c.name}
									</th>
									<td className="px-2 py-1.5 text-right">
										{fmt(c.movies?.subscription ?? 0)}
									</td>
									<td className="px-2 py-1.5">
										{c.movies?.biggest_service
											? `${c.movies.biggest_service} (${fmt(c.movies.biggest_service_titles)})`
											: "None"}
									</td>
									<td className="px-2 py-1.5 text-right">
										{fmt(c.movies?.netflix ?? 0)}
									</td>
									<td className="px-2 py-1.5 text-right">
										{fmt(c.shows?.subscription ?? 0)}
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			</details>
		</section>
	)
}

export function Downloads({ data }: { data: StudyData }) {
	const base = data.csv.base
	const files = [
		{
			file: data.csv.countries,
			label: "Every country",
			line: "One row per country: the counts in this post and more.",
		},
		{
			file: data.csv.titles,
			label: "Every title",
			line: "One row per movie and show: in how many countries it streams.",
		},
	]
	return (
		<ul className="my-6 grid gap-3 sm:grid-cols-2">
			{files.map(({ file, label, line }) => (
				<li key={file}>
					<a
						href={`${base}/${file}`}
						download={file}
						className="flex h-full flex-col rounded-2xl bg-white/[0.04] p-4 ring-1 ring-white/10 transition hover:bg-white/[0.08]"
					>
						<span className="font-semibold text-white">
							{label} <span className="text-gray-400">(CSV)</span>
						</span>
						<span className="text-sm text-gray-400">{line}</span>
					</a>
				</li>
			))}
		</ul>
	)
}

/** The sources, as TMDB's terms and JustWatch's attribution rule ask. */
export function StudyCredits() {
	return (
		<div className="mt-12 flex flex-col gap-4 border-t border-white/10 pt-6 text-sm text-gray-400">
			<div className="flex flex-wrap items-center gap-x-5 gap-y-3">
				<span>Data from</span>
				<img
					src={assetUrl(tmdbLogo)}
					alt="TMDB"
					className="h-3 w-auto opacity-80"
				/>
				{/* The JustWatch file's viewBox doesn't parse, so it has no ratio of its own: give it its drawing's size. */}
				<img
					src={assetUrl(justwatchLogo)}
					alt="JustWatch"
					className="h-[10px] w-[66px] opacity-80"
				/>
			</div>
			<p>
				This product uses the TMDB API but is not endorsed or certified by TMDB.
			</p>
			<p>
				Streaming data from{" "}
				<a
					href="https://www.justwatch.com/"
					className={linkClass}
					rel="noreferrer"
				>
					JustWatch
				</a>
				, through{" "}
				<a
					href="https://www.themoviedb.org/"
					className={linkClass}
					rel="noreferrer"
				>
					TMDB
				</a>
				. Information courtesy of IMDb (
				<a href="https://www.imdb.com" className={linkClass} rel="noreferrer">
					https://www.imdb.com
				</a>
				). Used with permission.
			</p>
		</div>
	)
}
