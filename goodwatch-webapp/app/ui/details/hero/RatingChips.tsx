import type React from "react"
import imdbLogo from "~/img/imdb-logo-250.png"
import metacriticLogoIcon from "~/img/metacritic-logo-icon-250.png"
import rottenLogoIcon from "~/img/rotten-logo-icon-250.png"
import type { MovieResult, ShowResult } from "~/server/types/details-types"

// IMDb, Metacritic (critics | audience), and Rotten Tomatoes (critics | audience) as compact
// brand-colored chips in a wrapping row. A site with no score at all is left out.
export default function RatingChips({ media }: { media: MovieResult | ShowResult }) {
	const d = media.details
	const imdb = d.imdb_user_score_original ? d.imdb_user_score_original.toFixed(1) : null
	const mc = d.metacritic_meta_score_original ? String(Math.floor(d.metacritic_meta_score_original)) : null
	const mcUser = d.metacritic_user_score_original ? d.metacritic_user_score_original.toFixed(1) : null
	const rt = d.rotten_tomatoes_tomato_score_original ? `${Math.floor(d.rotten_tomatoes_tomato_score_original)}%` : null
	const rtUser = d.rotten_tomatoes_audience_score_original ? `${Math.floor(d.rotten_tomatoes_audience_score_original)}%` : null

	const pair = (critics: string | null, audience: string | null) => (
		<>
			<span>{critics ?? "–"}</span>
			<span aria-hidden="true" className="h-3 w-px bg-current opacity-40" />
			<span className="font-medium opacity-90">{audience ?? "–"}</span>
		</>
	)
	const chip = (key: string, href: string | undefined, logo: string, alt: string, value: React.ReactNode, brand: string, title: string) => (
		<a
			key={key}
			href={href || undefined}
			target="_blank"
			rel="noreferrer"
			title={title}
			className={`inline-flex h-7 shrink-0 items-center gap-1 whitespace-nowrap rounded-md px-1.5 text-[13px] font-semibold tabular-nums ${brand} ${
				href ? "hover:brightness-110" : "pointer-events-none"
			}`}
		>
			<img src={logo} alt={alt} className={alt === "IMDb" ? "h-3" : "h-3.5"} />
			{value}
		</a>
	)
	const chips = [
		imdb && chip("imdb", d.imdb_url, imdbLogo, "IMDb", imdb, "bg-imdb text-black", `IMDb: ${imdb}`),
		(mc || mcUser) &&
			chip("mc", d.metacritic_url, metacriticLogoIcon, "Metacritic", pair(mc, mcUser), "bg-metacritic text-white", `Metacritic: critics ${mc ?? "–"}, audience ${mcUser ?? "–"}`),
		(rt || rtUser) &&
			chip("rt", d.rotten_tomatoes_url, rottenLogoIcon, "Rotten Tomatoes", pair(rt, rtUser), "bg-rotten text-white", `Rotten Tomatoes: critics ${rt ?? "–"}, audience ${rtUser ?? "–"}`),
	].filter(Boolean)
	if (chips.length === 0) return null
	return <div className="flex flex-wrap items-center gap-1.5">{chips}</div>
}
