import type React from "react"
import imdbLogo from "~/img/imdb-logo-250.webp?no-inline"
import metacriticLogoIcon from "~/img/metacritic-logo-icon-64.webp?no-inline"
import rottenLogoIcon from "~/img/rotten-logo-icon-64.webp"
import type { MovieResult, ShowResult } from "~/server/types/details-types"
import { assetUrl } from "~/utils/asset-url"

// IMDb, Metacritic (critics | audience), and Rotten Tomatoes (critics | audience) as compact
// brand-colored chips in a wrapping row. A site with no score at all is left out.
// `fill`: the chips share the row's whole width, for a row that has nothing else to end it.
export default function RatingChips({
	media,
	fill = false,
}: { media: MovieResult | ShowResult; fill?: boolean }) {
	const d = media.details
	return (
		<RatingChipRow
			fill={fill}
			imdb={
				d.imdb_user_score_original
					? d.imdb_user_score_original.toFixed(1)
					: null
			}
			mc={
				d.metacritic_meta_score_original
					? String(Math.floor(d.metacritic_meta_score_original))
					: null
			}
			mcUser={
				d.metacritic_user_score_original
					? d.metacritic_user_score_original.toFixed(1)
					: null
			}
			rt={
				d.rotten_tomatoes_tomato_score_original
					? `${Math.floor(d.rotten_tomatoes_tomato_score_original)}%`
					: null
			}
			rtUser={
				d.rotten_tomatoes_audience_score_original
					? `${Math.floor(d.rotten_tomatoes_audience_score_original)}%`
					: null
			}
			urls={{
				imdb: d.imdb_url,
				mc: d.metacritic_url,
				rt: d.rotten_tomatoes_url,
			}}
		/>
	)
}

/** The chips from values. `small` is the size a popup uses: the season scores behind an episode list season's score. */
export function RatingChipRow({
	imdb,
	mc,
	mcUser,
	rt,
	rtUser,
	urls = {},
	fill = false,
	small = false,
}: {
	imdb: string | null
	mc: string | null
	mcUser: string | null
	rt: string | null
	rtUser: string | null
	urls?: { imdb?: string; mc?: string; rt?: string }
	fill?: boolean
	small?: boolean
}) {
	const d = {
		imdb_url: urls.imdb,
		metacritic_url: urls.mc,
		rotten_tomatoes_url: urls.rt,
	}

	const pair = (critics: string | null, audience: string | null) => (
		<>
			<span>{critics ?? "–"}</span>
			<span aria-hidden="true" className="h-3 w-px bg-current opacity-40" />
			<span className="font-medium opacity-90">{audience ?? "–"}</span>
		</>
	)
	const chip = (
		key: string,
		href: string | undefined,
		logo: string,
		alt: string,
		value: React.ReactNode,
		brand: string,
		title: string,
	) => (
		<a
			key={key}
			href={href || undefined}
			target="_blank"
			rel="noreferrer"
			title={title}
			className={`inline-flex ${small ? "h-6 text-[12px]" : "h-7 text-[13px]"} shrink-0 items-center gap-1 whitespace-nowrap rounded-md px-1.5 font-semibold tabular-nums ${fill ? "flex-1 justify-center" : ""} ${brand} ${
				href ? "hover:brightness-110" : "pointer-events-none"
			}`}
		>
			<img
				src={assetUrl(logo)}
				alt={alt}
				className={
					alt === "IMDb" ? (small ? "h-2.5" : "h-3") : small ? "h-3" : "h-3.5"
				}
			/>
			{value}
		</a>
	)
	const chips = [
		imdb &&
			chip(
				"imdb",
				d.imdb_url,
				imdbLogo,
				"IMDb",
				imdb,
				"bg-imdb text-black",
				`IMDb: ${imdb}`,
			),
		(mc || mcUser) &&
			chip(
				"mc",
				d.metacritic_url,
				metacriticLogoIcon,
				"Metacritic",
				pair(mc, mcUser),
				"bg-metacritic text-white",
				`Metacritic: critics ${mc ?? "–"}, audience ${mcUser ?? "–"}`,
			),
		(rt || rtUser) &&
			chip(
				"rt",
				d.rotten_tomatoes_url,
				rottenLogoIcon,
				"Rotten Tomatoes",
				pair(rt, rtUser),
				"bg-rotten text-white",
				`Rotten Tomatoes: critics ${rt ?? "–"}, audience ${rtUser ?? "–"}`,
			),
	].filter(Boolean)
	if (chips.length === 0) return null
	return (
		<div
			className={`flex items-center gap-1.5 ${fill ? "min-w-0 flex-1" : "flex-wrap"}`}
		>
			{chips}
		</div>
	)
}
