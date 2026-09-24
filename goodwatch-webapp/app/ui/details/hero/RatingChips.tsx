import type React from "react"
import imdbLogo from "~/img/imdb-logo-250.png"
import metacriticLogoIcon from "~/img/metacritic-logo-icon-250.png"
import rottenLogoIcon from "~/img/rotten-logo-icon-250.png"
import type { MovieResult, ShowResult } from "~/server/types/details-types"

// IMDb, Metacritic (critics | audience), and Rotten Tomatoes (critics |
// audience) as brand-colored chips. `fill` spreads them over three equal
// columns on phones.
export default function RatingChips({ media, fill = false }: { media: MovieResult | ShowResult; fill?: boolean }) {
	const d = media.details
	const imdb = d.imdb_user_score_original ? d.imdb_user_score_original.toFixed(1) : null
	const mc = d.metacritic_meta_score_original ? String(Math.floor(d.metacritic_meta_score_original)) : null
	const mcUser = d.metacritic_user_score_original ? d.metacritic_user_score_original.toFixed(1) : null
	const rt = d.rotten_tomatoes_tomato_score_original ? `${Math.floor(d.rotten_tomatoes_tomato_score_original)}%` : null
	const rtUser = d.rotten_tomatoes_audience_score_original ? `${Math.floor(d.rotten_tomatoes_audience_score_original)}%` : null

	const pair = (critics: string | null, audience: string | null) => (
		<>
			<span>{critics ?? "–"}</span>
			<span aria-hidden="true" className="h-3.5 w-px bg-current opacity-40" />
			<span className="font-medium opacity-90">{audience ?? "–"}</span>
		</>
	)
	const chip = (href: string | undefined, logo: string, alt: string, value: React.ReactNode, brand: string, title: string) => (
		<a
			href={href || undefined}
			target="_blank"
			rel="noreferrer"
			title={title}
			className={`inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-sm font-semibold tabular-nums md:h-9 ${fill ? "justify-center" : ""} ${brand} ${
				href ? "hover:brightness-110" : "pointer-events-none opacity-50"
			}`}
		>
			<img src={logo} alt={alt} className={alt === "IMDb" ? "h-3.5" : "h-4"} />
			{value}
		</a>
	)
	return (
		<div className={fill ? "grid grid-cols-3 gap-1.5 md:flex md:flex-wrap md:items-center" : "flex flex-wrap items-center gap-1.5"}>
			{chip(d.imdb_url, imdbLogo, "IMDb", imdb ?? "–", "bg-imdb text-black", `IMDb: ${imdb ?? "no score"}`)}
			{chip(d.metacritic_url, metacriticLogoIcon, "Metacritic", pair(mc, mcUser), "bg-metacritic text-white", `Metacritic: critics ${mc ?? "–"}, audience ${mcUser ?? "–"}`)}
			{chip(d.rotten_tomatoes_url, rottenLogoIcon, "Rotten Tomatoes", pair(rt, rtUser), "bg-rotten text-white", `Rotten Tomatoes: critics ${rt ?? "–"}, audience ${rtUser ?? "–"}`)}
		</div>
	)
}
