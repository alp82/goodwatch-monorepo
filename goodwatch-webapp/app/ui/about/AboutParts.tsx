// Pieces of /about: who makes GoodWatch (the footer's "Created by" chip, a little bigger), where to find us (the
// footer's Elsewhere links plus Support) and where the data comes from (the footer's credits plus the score sources).
import {
	EnvelopeIcon,
	NewspaperIcon,
	SignalIcon,
} from "@heroicons/react/24/outline"
import { Link } from "@remix-run/react"
import type { ComponentType, ReactNode } from "react"
import imdbLogo from "~/img/imdb-logo-250.webp?no-inline"
import justwatchLogo from "~/img/justwatch-logo.svg"
import metacriticLogo from "~/img/metacritic-logo-96.webp"
import rottenLogo from "~/img/rotten-logo-96.webp"
import tmdbLogo from "~/img/tmdb-logo.svg"
import {
	CREATOR_URL,
	DISCORD_URL,
	DiscordMark,
	GitHubMark,
	RedditMark,
	XMark,
} from "~/ui/footer/links"
import { assetUrl } from "~/utils/asset-url"

export function CreatorChip() {
	return (
		<a
			href={CREATOR_URL}
			target="_blank"
			rel="noreferrer"
			className="group inline-flex w-fit items-center gap-2.5 rounded-full bg-white/[0.05] py-1.5 pr-4 pl-1.5 text-sm text-gray-400 ring-1 ring-white/10 transition-colors hover:bg-white/[0.1] hover:text-white"
		>
			<span className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-black">
				<XMark className="h-4 w-4" />
			</span>
			<span>
				By{" "}
				<span className="font-semibold text-gray-100 group-hover:text-amber-300">
					Alper Ortac
				</span>{" "}
				<span className="text-gray-500">@alperortac</span>
			</span>
		</a>
	)
}

const FIND_US: {
	icon: ComponentType<{ className?: string }>
	name: string
	href: string
}[] = [
	{ icon: DiscordMark, name: "Discord", href: DISCORD_URL },
	{
		icon: RedditMark,
		name: "Reddit",
		href: "https://www.reddit.com/r/goodwatchapp/",
	},
	{
		icon: GitHubMark,
		name: "GitHub",
		href: "https://github.com/alp82/goodwatch-monorepo",
	},
	{ icon: NewspaperIcon, name: "Blog", href: "https://dev.to/t/goodwatch" },
	{
		icon: SignalIcon,
		name: "Status",
		href: "https://status.goodwatch.app/status/services",
	},
	{ icon: EnvelopeIcon, name: "Email", href: "/support" },
]

export function FindUs() {
	return (
		<ul className="flex flex-wrap gap-x-6 gap-y-3 text-sm">
			{FIND_US.map(({ icon: Icon, name, href }) => (
				<li key={name}>
					<Out
						href={href}
						className="flex items-center gap-2 font-semibold text-gray-300 transition hover:text-amber-400"
					>
						<Icon className="h-4 w-4 text-gray-500" />
						{name}
					</Out>
				</li>
			))}
		</ul>
	)
}

function Out({
	href,
	className,
	children,
}: { href: string; className: string; children: ReactNode }) {
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

export function Credits({ className = "" }: { className?: string }) {
	const logo = "w-auto opacity-80"
	return (
		<div
			className={`flex flex-wrap items-center gap-x-5 gap-y-3 text-sm text-gray-400 ${className}`}
		>
			<span>Data from</span>
			<img src={assetUrl(tmdbLogo)} alt="TMDB" className={`h-3 ${logo}`} />
			{/* The JustWatch file's viewBox doesn't parse, so it has no ratio of its own: give it its drawing's size. */}
			<img
				src={assetUrl(justwatchLogo)}
				alt="JustWatch"
				className="h-[10px] w-[66px] opacity-80"
			/>
			<img src={assetUrl(imdbLogo)} alt="IMDb" className={`h-5 ${logo}`} />
			<img
				src={assetUrl(rottenLogo)}
				alt="Rotten Tomatoes"
				className={`h-5 ${logo}`}
			/>
			<img
				src={assetUrl(metacriticLogo)}
				alt="Metacritic"
				className={`h-5 ${logo}`}
			/>
		</div>
	)
}
