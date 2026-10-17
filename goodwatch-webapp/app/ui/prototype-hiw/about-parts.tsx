// PROTOTYPE - throwaway. Pieces the /about variants share, in the site's existing look (footer chip, Settings tiles).
import { Link } from "@remix-run/react"
import imdbLogo from "~/img/imdb-logo-250.webp?no-inline"
import justwatchLogo from "~/img/justwatch-logo.svg"
import metacriticLogo from "~/img/metacritic-logo-96.webp"
import rottenLogo from "~/img/rotten-logo-96.webp"
import tmdbLogo from "~/img/tmdb-logo.svg"
import { assetUrl } from "~/utils/asset-url"
import { ABOUT, ABOUT_LINKS, XMark } from "./about-content"

export const LOGOS = {
	imdb: { src: imdbLogo, alt: "IMDb" },
	metacritic: { src: metacriticLogo, alt: "Metacritic" },
	rotten: { src: rottenLogo, alt: "Rotten Tomatoes" },
	justwatch: { src: justwatchLogo, alt: "JustWatch" },
	tmdb: { src: tmdbLogo, alt: "TMDB" },
}

/** The footer's "Created by" chip, a little bigger. */
export function CreatorChip({ className = "" }: { className?: string }) {
	return (
		<a
			href={ABOUT.creator.url}
			target="_blank"
			rel="noreferrer"
			className={`group inline-flex w-fit items-center gap-2.5 rounded-full bg-white/[0.05] py-1.5 pr-4 pl-1.5 text-sm text-gray-400 ring-1 ring-white/10 transition-colors hover:bg-white/[0.1] hover:text-white ${className}`}
		>
			<span className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-black">
				<XMark className="h-4 w-4" />
			</span>
			<span>
				By <span className="font-semibold text-gray-100 group-hover:text-amber-300">{ABOUT.creator.name}</span>{" "}
				<span className="text-gray-500">{ABOUT.creator.handle}</span>
			</span>
		</a>
	)
}

/** The ways to reach GoodWatch, as tiles (`tiles`) or one quiet row. */
export function FindUs({ tiles = false }: { tiles?: boolean }) {
	if (!tiles)
		return (
			<ul className="flex flex-wrap gap-x-6 gap-y-3 text-sm">
				{ABOUT_LINKS.map(({ icon: Icon, name, href }) => (
					<li key={name}>
						<Out href={href} className="flex items-center gap-2 font-semibold text-gray-300 transition hover:text-amber-400">
							<Icon className="h-4 w-4 text-gray-500" />
							{name}
						</Out>
					</li>
				))}
			</ul>
		)
	return (
		<ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
			{ABOUT_LINKS.map(({ icon: Icon, name, line, href, tone }) => (
				<li key={name}>
					<Out
						href={href}
						className="flex h-full items-center gap-3 rounded-2xl bg-white/[0.04] p-4 ring-1 ring-white/10 transition hover:bg-white/[0.08] hover:ring-white/20"
					>
						<span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/[0.06]" style={{ color: tone }}>
							<Icon className="h-5 w-5" />
						</span>
						<span className="flex min-w-0 flex-col">
							<span className="font-semibold text-white">{name}</span>
							<span className="text-sm break-words text-gray-400">{line}</span>
						</span>
					</Out>
				</li>
			))}
		</ul>
	)
}

function Out({ href, className, children }: { href: string; className: string; children: React.ReactNode }) {
	return href.startsWith("/") ? (
		<Link to={href} prefetch="intent" className={className}>
			{children}
		</Link>
	) : (
		<a href={href} target="_blank" rel="noreferrer" className={className}>
			{children}
		</a>
	)
}

/** Where the data comes from: the footer's credits plus the score sources, as logos. */
export function Credits({ className = "" }: { className?: string }) {
	return (
		<div className={`flex flex-wrap items-center gap-x-5 gap-y-3 text-sm text-gray-400 ${className}`}>
			<span>Data from</span>
			<img src={assetUrl(LOGOS.tmdb.src)} alt="TMDB" className="h-3 w-auto opacity-80" />
			<img src={assetUrl(LOGOS.justwatch.src)} alt="JustWatch" className="h-[10px] w-[66px] opacity-80" />
			<img src={assetUrl(LOGOS.imdb.src)} alt="IMDb" className="h-5 w-auto opacity-80" />
			<img src={assetUrl(LOGOS.rotten.src)} alt="Rotten Tomatoes" className="h-5 w-auto opacity-80" />
			<img src={assetUrl(LOGOS.metacritic.src)} alt="Metacritic" className="h-5 w-auto opacity-80" />
		</div>
	)
}
