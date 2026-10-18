// Where the footer links go, grouped into its three columns, with the icon and the line that the footer's caption
// shows while a link is pointed at.
import {
	CpuChipIcon,
	FilmIcon,
	FingerPrintIcon,
	FireIcon,
	InformationCircleIcon,
	LifebuoyIcon,
	LightBulbIcon,
	MagnifyingGlassIcon,
	NewspaperIcon,
	PlayIcon,
	ScaleIcon,
	SignalIcon,
	TvIcon,
} from "@heroicons/react/24/solid"
import type { ComponentType } from "react"

export const DISCORD_URL = "https://discord.gg/TVAcrfQzcA"
export const CREATOR_URL = "https://x.com/alperortac"

type IconProps = { className?: string }

export interface FooterLink {
	name: string
	href: string
	/** Opens in a new tab. */
	external?: boolean
	blurb: string
	icon: ComponentType<IconProps>
}

export interface FooterColumn {
	title: string
	links: FooterLink[]
}

export function DiscordMark({ className }: IconProps) {
	return (
		<svg
			aria-hidden="true"
			viewBox="0 0 127.14 96.36"
			className={`fill-current ${className ?? ""}`}
		>
			<path d="M107.7,8.07A105.15,105.15,0,0,0,81.47,0a72.06,72.06,0,0,0-3.36,6.83A97.68,97.68,0,0,0,49,6.83,72.37,72.37,0,0,0,45.64,0,105.89,105.89,0,0,0,19.39,8.09C2.79,32.65-1.71,56.6.54,80.21h0A105.73,105.73,0,0,0,32.71,96.36,77.11,77.11,0,0,0,39.6,85.25a68.42,68.42,0,0,1-10.85-5.18c.91-.66,1.8-1.34,2.66-2a75.57,75.57,0,0,0,64.32,0c.87.71,1.76,1.39,2.66,2a68.68,68.68,0,0,1-10.87,5.19,77,77,0,0,0,6.89,11.1A105.89,105.89,0,0,0,126.6,80.22c1.24-23.28-3.28-47.54-18.9-72.15ZM42.45,65.69C36.18,65.69,31,60,31,53s5-12.74,11.43-12.74S54,46,53.89,53,48.84,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.25,60,73.25,53s5-12.74,11.25-12.74S96.23,46,96.12,53,91.08,65.69,84.69,65.69Z" />
		</svg>
	)
}

export function RedditMark({ className }: IconProps) {
	return (
		<svg
			aria-hidden="true"
			viewBox="0 0 24 24"
			className={`fill-current ${className ?? ""}`}
		>
			<path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701zM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.687-.562-1.249-1.25-1.249zm-5.466 3.99a.327.327 0 0 0-.231.094.33.33 0 0 0 0 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 0 0 .029-.463.33.33 0 0 0-.464 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.196-2.512-.73a.326.326 0 0 0-.232-.095z" />
		</svg>
	)
}

export function GitHubMark({ className }: IconProps) {
	return (
		<svg
			aria-hidden="true"
			viewBox="0 0 24 24"
			className={`fill-current ${className ?? ""}`}
		>
			<path
				fillRule="evenodd"
				clipRule="evenodd"
				d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
			/>
		</svg>
	)
}

export function XMark({ className }: IconProps) {
	return (
		<svg
			aria-hidden="true"
			viewBox="0 0 24 24"
			className={`fill-current ${className ?? ""}`}
		>
			<path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
		</svg>
	)
}

export const FOOTER_COLUMNS: FooterColumn[] = [
	{
		title: "Explore",
		links: [
			{
				name: "Movies",
				href: "/movies",
				blurb: "Every film, every score",
				icon: FilmIcon,
			},
			{
				name: "Shows",
				href: "/shows",
				blurb: "Series, seasons, episodes",
				icon: TvIcon,
			},
			{
				name: "Discover",
				href: "/discover",
				blurb: "Filter by score, service, mood",
				icon: MagnifyingGlassIcon,
			},
			{
				name: "Hot on socials",
				href: "/hot-on-socials",
				blurb: "What people talk about now",
				icon: FireIcon,
			},
			{
				name: "Watch next",
				href: "/watch-next",
				blurb: "Picks for tonight",
				icon: PlayIcon,
			},
			{
				name: "Taste",
				href: "/taste",
				blurb: "Your taste fingerprint",
				icon: FingerPrintIcon,
			},
		],
	},
	{
		title: "GoodWatch",
		links: [
			{
				name: "About",
				href: "/about",
				blurb: "Why it exists",
				icon: InformationCircleIcon,
			},
			{
				name: "How it works",
				href: "/how-it-works",
				blurb: "Where the scores come from",
				icon: LightBulbIcon,
			},
			{
				name: "Use with AI",
				href: "/use-with-ai",
				blurb: "GoodWatch in your AI chat",
				icon: CpuChipIcon,
			},
			{
				name: "Support",
				href: "/support",
				blurb: "Something broken? Write us",
				icon: LifebuoyIcon,
			},
			{
				name: "Disclaimer",
				href: "/disclaimer",
				blurb: "The legal bits",
				icon: ScaleIcon,
			},
		],
	},
	{
		title: "Elsewhere",
		links: [
			{
				name: "Discord",
				href: DISCORD_URL,
				external: true,
				blurb: "Chat with members",
				icon: DiscordMark,
			},
			{
				name: "Reddit",
				href: "https://www.reddit.com/r/goodwatchapp/",
				external: true,
				blurb: "r/goodwatchapp",
				icon: RedditMark,
			},
			{
				name: "GitHub",
				href: "https://github.com/alp82/goodwatch-monorepo",
				external: true,
				blurb: "Read the source",
				icon: GitHubMark,
			},
			{
				name: "Blog",
				href: "https://dev.to/t/goodwatch",
				external: true,
				blurb: "Build notes on dev.to",
				icon: NewspaperIcon,
			},
			{
				name: "Status",
				href: "https://status.goodwatch.app/status/services",
				external: true,
				blurb: "Is everything up?",
				icon: SignalIcon,
			},
		],
	},
]
