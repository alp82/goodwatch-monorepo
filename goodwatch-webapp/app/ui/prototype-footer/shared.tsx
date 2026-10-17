// PROTOTYPE - throwaway. Shared links, icons, and bits for the footer redesign variants (?footer=A..E).
import { ArrowUpRightIcon } from "@heroicons/react/16/solid"
import {
	CpuChipIcon,
	FilmIcon,
	FingerPrintIcon,
	GlobeAltIcon,
	InformationCircleIcon,
	LifebuoyIcon,
	LightBulbIcon,
	MagnifyingGlassIcon,
	NewspaperIcon,
	PlayIcon,
	ScaleIcon,
	SignalIcon,
	SparklesIcon,
	TvIcon,
} from "@heroicons/react/24/solid"
import { Link } from "@remix-run/react"
import type { ReactNode } from "react"
import avatars from "~/img/avatars/avatars.svg"
import justwatchLogo from "~/img/justwatch-logo.svg"
import redditColor from "~/img/reddit-color.svg"
import tmdbLogo from "~/img/tmdb-logo.svg"
import { assetUrl } from "~/utils/asset-url"

export const DISCORD_URL = "https://discord.gg/TVAcrfQzcA"
export const REDDIT_URL = "https://www.reddit.com/r/goodwatchapp/"
export const GITHUB_URL = "https://github.com/alp82/goodwatch-monorepo"
export const STATUS_URL = "https://status.goodwatch.app/status/services"
export const BLOG_URL = "https://dev.to/t/goodwatch"

export type FooterLink = { name: string; href: string; external?: boolean }

export const EXPLORE: FooterLink[] = [
	{ name: "Movies", href: "/movies" },
	{ name: "Shows", href: "/shows" },
	{ name: "Discover", href: "/discover" },
	{ name: "Watch next", href: "/watch-next" },
	{ name: "Taste", href: "/taste" },
]

export const PROJECT: FooterLink[] = [
	{ name: "About", href: "/about" },
	{ name: "How it works", href: "/how-it-works" },
	{ name: "Use with AI", href: "/use-with-ai" },
	{ name: "Support", href: "/support" },
	{ name: "Disclaimer", href: "/disclaimer" },
]

export const ELSEWHERE: FooterLink[] = [
	{ name: "Reddit", href: REDDIT_URL, external: true },
	{ name: "GitHub", href: GITHUB_URL, external: true },
	{ name: "Blog", href: BLOG_URL, external: true },
	{ name: "Status", href: STATUS_URL, external: true },
]

export function FLink({ link, className = "" }: { link: FooterLink; className?: string }) {
	if (link.external) {
		return (
			<a href={link.href} target="_blank" rel="noreferrer" className={className}>
				{link.name}
				<ArrowUpRightIcon className="ml-0.5 inline-block h-3.5 w-3.5 -translate-y-px opacity-50" aria-hidden />
			</a>
		)
	}
	return (
		<Link to={link.href} prefetch="intent" className={className}>
			{link.name}
		</Link>
	)
}

export function DiscordMark({ className = "h-6 w-6" }: { className?: string }) {
	return (
		<svg aria-hidden="true" className={`fill-current ${className}`} viewBox="0 0 127.14 96.36">
			<path d="M107.7,8.07A105.15,105.15,0,0,0,81.47,0a72.06,72.06,0,0,0-3.36,6.83A97.68,97.68,0,0,0,49,6.83,72.37,72.37,0,0,0,45.64,0,105.89,105.89,0,0,0,19.39,8.09C2.79,32.65-1.71,56.6.54,80.21h0A105.73,105.73,0,0,0,32.71,96.36,77.11,77.11,0,0,0,39.6,85.25a68.42,68.42,0,0,1-10.85-5.18c.91-.66,1.8-1.34,2.66-2a75.57,75.57,0,0,0,64.32,0c.87.71,1.76,1.39,2.66,2a68.68,68.68,0,0,1-10.87,5.19,77,77,0,0,0,6.89,11.1A105.89,105.89,0,0,0,126.6,80.22c1.24-23.28-3.28-47.54-18.9-72.15ZM42.45,65.69C36.18,65.69,31,60,31,53s5-12.74,11.43-12.74S54,46,53.89,53,48.84,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.25,60,73.25,53s5-12.74,11.25-12.74S96.23,46,96.12,53,91.08,65.69,84.69,65.69Z" />
		</svg>
	)
}

export function GitHubMark({ className = "h-5 w-5" }: { className?: string }) {
	return (
		<svg fill="currentColor" viewBox="0 0 24 24" aria-hidden="true" className={className}>
			<path
				fillRule="evenodd"
				clipRule="evenodd"
				d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
			/>
		</svg>
	)
}

export function RedditMark({ className = "h-5 w-5" }: { className?: string }) {
	return <img src={assetUrl(redditColor)} alt="" aria-hidden className={className} />
}

const AVATAR_POSITIONS = ["0", "33.33%", "66.67%", "100%"]

/** The four member avatars from the one sprite. `size` in px. */
export function Avatar({ index, size = 36, ring = "ring-gray-950" }: { index: number; size?: number; ring?: string }) {
	return (
		<span
			className={`inline-block shrink-0 overflow-hidden rounded-full bg-gray-700 ring-2 ${ring}`}
			style={{ width: size, height: size }}
		>
			<img
				loading="lazy"
				decoding="async"
				width={size}
				height={size}
				className="h-full w-full object-cover"
				style={{ objectPosition: AVATAR_POSITIONS[index % 4] }}
				src={assetUrl(avatars)}
				alt=""
			/>
		</span>
	)
}

export function AvatarStack({ size = 32, ring }: { size?: number; ring?: string }) {
	return (
		<span className="flex -space-x-2.5">
			{[0, 1, 2, 3].map((i) => (
				<Avatar key={i} index={i} size={size} ring={ring} />
			))}
		</span>
	)
}

/** TMDB and JustWatch attribution, kept small. */
export function Credits({ className = "" }: { className?: string }) {
	return (
		<div className={`flex items-center gap-2 whitespace-nowrap text-xs text-gray-500 ${className}`}>
			<span>Data from</span>
			<a href="https://www.themoviedb.org" target="_blank" rel="noreferrer" className="opacity-70 hover:opacity-100">
				<img alt="TMDB" className="h-2.5 w-auto" src={assetUrl(tmdbLogo)} />
			</a>
			<span>and</span>
			<a href="https://justwatch.com" target="_blank" rel="noreferrer" className="opacity-70 hover:opacity-100">
				<img alt="JustWatch" className="h-3 w-auto" loading="lazy" src={assetUrl(justwatchLogo)} />
			</a>
		</div>
	)
}

export function Year() {
	return <span className="whitespace-nowrap">© {new Date().getFullYear()} GoodWatch</span>
}

/** Room for the phone dock, which covers the bottom of the page below lg. */
export function DockSpacer() {
	return <div className="h-24 lg:hidden" aria-hidden />
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
	return (
		<div>
			<h3 className="mb-3 text-xs font-bold tracking-wider text-gray-500 uppercase">{title}</h3>
			{children}
		</div>
	)
}

/* ---------------------------------------------------------------- round 2 (F, G, H) */
export const X_URL = "https://x.com/alperortac"

export function XMark({ className = "h-4 w-4" }: { className?: string }) {
	return (
		<svg viewBox="0 0 24 24" aria-hidden="true" className={`fill-current ${className}`}>
			<path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
		</svg>
	)
}

export type RichLink = FooterLink & { blurb: string; icon: (p: { className?: string }) => JSX.Element }

const hero = (I: typeof FilmIcon) => (p: { className?: string }) => <I className={p.className} aria-hidden />

export const RICH: { title: string; icon: (p: { className?: string }) => JSX.Element; links: RichLink[] }[] = [
	{
		title: "Explore",
		icon: hero(SparklesIcon),
		links: [
			{ name: "Movies", href: "/movies", blurb: "Every film, every score", icon: hero(FilmIcon) },
			{ name: "Shows", href: "/shows", blurb: "Series, seasons, episodes", icon: hero(TvIcon) },
			{ name: "Discover", href: "/discover", blurb: "Filter by score, service, mood", icon: hero(MagnifyingGlassIcon) },
			{ name: "Watch next", href: "/watch-next", blurb: "Picks for tonight", icon: hero(PlayIcon) },
			{ name: "Taste", href: "/taste", blurb: "Your taste fingerprint", icon: hero(FingerPrintIcon) },
		],
	},
	{
		title: "GoodWatch",
		icon: hero(InformationCircleIcon),
		links: [
			{ name: "About", href: "/about", blurb: "Why it exists", icon: hero(InformationCircleIcon) },
			{ name: "How it works", href: "/how-it-works", blurb: "Where the scores come from", icon: hero(LightBulbIcon) },
			{ name: "Use with AI", href: "/use-with-ai", blurb: "GoodWatch in your AI chat", icon: hero(CpuChipIcon) },
			{ name: "Support", href: "/support", blurb: "Something broken? Write us", icon: hero(LifebuoyIcon) },
			{ name: "Disclaimer", href: "/disclaimer", blurb: "The legal bits", icon: hero(ScaleIcon) },
		],
	},
	{
		title: "Elsewhere",
		icon: hero(GlobeAltIcon),
		links: [
			{ name: "Discord", href: DISCORD_URL, external: true, blurb: "Chat with members", icon: (p) => <DiscordMark className={p.className} /> },
			{ name: "Reddit", href: REDDIT_URL, external: true, blurb: "r/goodwatchapp", icon: (p) => <RedditGlyph className={p.className} /> },
			{ name: "GitHub", href: GITHUB_URL, external: true, blurb: "Read the source", icon: (p) => <GitHubMark className={p.className} /> },
			{ name: "Blog", href: BLOG_URL, external: true, blurb: "Build notes on dev.to", icon: hero(NewspaperIcon) },
			{ name: "Status", href: STATUS_URL, external: true, blurb: "Is everything up?", icon: hero(SignalIcon) },
		],
	},
]

/** Reddit's alien as a single-color glyph, so it can take the link's color like the other icons. */
function RedditGlyph({ className = "" }: { className?: string }) {
	return (
		<svg viewBox="0 0 24 24" aria-hidden="true" className={`fill-current ${className}`}>
			<path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701zM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.687-.562-1.249-1.25-1.249zm-5.466 3.99a.327.327 0 0 0-.231.094.33.33 0 0 0 0 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 0 0 .029-.463.33.33 0 0 0-.464 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.196-2.512-.73a.326.326 0 0 0-.232-.095z" />
		</svg>
	)
}
