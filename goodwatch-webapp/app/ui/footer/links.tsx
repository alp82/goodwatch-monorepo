// Where the footer links go, grouped into its four columns, with the icon and the line that the footer's caption
// shows while a link is pointed at.
import footerIcons from "~/img/footer-icons.svg?no-inline"
import { TASTE_FALLBACK_PATH } from "~/domain/member-paths"
import { WATCH_PATHS } from "../../domain/member-paths.ts"

/** The "New on streaming" link's address until the footer puts the viewer's country in: /new/us. */
export const NEW_ON_STREAMING = "/new"

export const DISCORD_URL = "https://discord.gg/TVAcrfQzcA"
export const CREATOR_URL = "https://x.com/alperortac"

type IconProps = { className?: string }

export interface FooterLink {
	name: string
	href: string
	/** Opens in a new tab. */
	external?: boolean
	blurb: string
	icon: string
}

export interface FooterColumn {
	title: string
	links: FooterLink[]
}

/** External SVG use elements require a same-origin symbol sheet. The site serves its build files on both origins. */
export function FooterIcon({ name, className }: IconProps & { name: string }) {
	return (
		<svg aria-hidden="true" focusable="false" className={className}>
			<use href={footerIcons + "#" + name} />
		</svg>
	)
}

export function DiscordMark({ className }: IconProps) {
	return <FooterIcon name="discord" className={className} />
}

export function GitHubMark({ className }: IconProps) {
	return <FooterIcon name="git-hub" className={className} />
}

export function RedditMark({ className }: IconProps) {
	return <FooterIcon name="reddit" className={className} />
}

export function XMark({ className }: IconProps) {
	return <FooterIcon name="x" className={className} />
}

export const FOOTER_COLUMNS: FooterColumn[] = [
	{
		title: "Explore",
		links: [
			{
				name: "Movies",
				href: "/movies",
				blurb: "Every film, every score",
				icon: "film",
			},
			{
				name: "Shows",
				href: "/shows",
				blurb: "Series, seasons, episodes",
				icon: "tv",
			},
			{
				name: "Discover",
				href: "/discover",
				blurb: "Filter by score, service, mood",
				icon: "magnifying-glass",
			},
			{
				name: "Hot",
				href: "/hot",
				blurb: "What people talk about now",
				icon: "fire",
			},
			{
				// The page of the viewer's country: the footer puts the country in (NEW_ON_STREAMING, #489).
				name: "New on streaming",
				href: NEW_ON_STREAMING,
				blurb: "What arrived in the last 14 days",
				// The calendar of the Browse menu and the search palette; the signal is Status's.
				icon: "calendar-days",
			},
			{
				name: "Watch next",
				href: WATCH_PATHS.tonight,
				blurb: "Picks for tonight",
				icon: "play",
			},
			{
				name: "Taste",
				href: TASTE_FALLBACK_PATH,
				blurb: "Your taste fingerprint",
				icon: "finger-print",
			},
		],
	},
	// The sitemap's titles and people, each list one link from every page. The icons are ones the page already draws
	// (Movies, Shows, and the header's Sign in), so the column adds no new image to every page's HTML.
	{
		title: "Top",
		links: [
			{
				name: "Top movies",
				href: "/movies/top",
				blurb: "The well-known movies, ranked",
				icon: "film",
			},
			{
				name: "Top TV shows",
				href: "/shows/top",
				blurb: "The well-known shows, ranked",
				icon: "tv",
			},
			{
				name: "People",
				href: "/people",
				blurb: "Popular actors and their titles",
				icon: "user-circle",
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
				icon: "information-circle",
			},
			{
				name: "How it works",
				href: "/how-it-works",
				blurb: "Where the scores come from",
				icon: "light-bulb",
			},
			{
				name: "Stats",
				href: "/stats",
				blurb: "GoodWatch in numbers",
				icon: "chart-bar",
			},
			{
				name: "Use with AI",
				href: "/use-with-ai",
				blurb: "GoodWatch in your AI chat",
				icon: "cpu-chip",
			},
			{
				name: "Discord bot",
				href: "/discord",
				blurb: "GoodWatch in your server",
				icon: "discord",
			},
			{
				name: "Support",
				href: "/support",
				blurb: "Something broken? Write us",
				icon: "lifebuoy",
			},
			{
				name: "Disclaimer",
				href: "/disclaimer",
				blurb: "The legal bits",
				icon: "scale",
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
				icon: "discord",
			},
			{
				name: "Reddit",
				href: "https://www.reddit.com/r/goodwatchapp/",
				external: true,
				blurb: "r/goodwatchapp",
				icon: "reddit",
			},
			{
				name: "GitHub",
				href: "https://github.com/alp82/goodwatch-monorepo",
				external: true,
				blurb: "Read the source",
				icon: "git-hub",
			},
			{
				name: "Blog",
				href: "/blog",
				blurb: "Data studies and build notes",
				icon: "newspaper",
			},
			{
				name: "Status",
				href: "https://status.goodwatch.app/status/services",
				external: true,
				blurb: "Is everything up?",
				icon: "signal",
			},
		],
	},
]
