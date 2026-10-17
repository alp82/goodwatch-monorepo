// PROTOTYPE - throwaway. What every /about variant says, checked against the code on 2026-10-18:
// - The story: the live about.tsx (first person: IMDb, Metacritic, Rotten Tomatoes and JustWatch, "That's why I built
//   GoodWatch"). Creator: footer "Created by @alperortac" (links.tsx CREATOR_URL).
// - Since 2023: the repo's first commit (2023-02-24); public on GitHub (footer link, repo visibility PUBLIC).
// - Free: sign-up.tsx "Free.", SignInPrompt "It's 100% free.". Data: footer "Powered by TMDB and JustWatch".
// - Numbers: server/living-room/intro/content.json (capturedAt 2026-10-17).
import {
	EnvelopeIcon,
	FingerPrintIcon,
	NewspaperIcon,
	SignalIcon,
	SparklesIcon,
	StarIcon,
	TvIcon,
} from "@heroicons/react/24/outline"
import type { ComponentType } from "react"
import { CREATOR_URL, DISCORD_URL, DiscordMark, XMark } from "~/ui/footer/links"

type Icon = ComponentType<{ className?: string }>

export const ABOUT = {
	tagline: "Every score, every service, one place.",
	story: [
		"I used to jump between IMDb, Metacritic, Rotten Tomatoes and JustWatch to decide what to watch next.",
		"So I built one place for all of it. Now it also learns your taste and picks for you.",
	],
	creator: { name: "Alper Ortac", handle: "@alperortac", url: CREATOR_URL },
	since: 2023,
}

export const ABOUT_FEATURES: { icon: Icon; title: string; line: string; to: string }[] = [
	{ icon: StarIcon, title: "One score", line: "Critics and audiences from four sites, in one number", to: "/how-it-works#score" },
	{ icon: TvIcon, title: "Where it streams", line: "325 services in 139 countries", to: "/how-it-works#streaming" },
	{ icon: SparklesIcon, title: "Picks for your taste", line: "From the titles you loved", to: "/how-it-works#for-you" },
	{ icon: FingerPrintIcon, title: "How it feels", line: "Every title read on 74 traits", to: "/how-it-works#title-analysis" },
]

export const ABOUT_NUMBERS = [
	{ n: "1.5M", label: "movies and shows" },
	{ n: "325", label: "streaming services" },
	{ n: "139", label: "countries" },
	{ n: "Free", label: "to use" },
]

function GitHubMark({ className }: { className?: string }) {
	return (
		<svg aria-hidden="true" viewBox="0 0 24 24" className={`fill-current ${className ?? ""}`}>
			<path
				fillRule="evenodd"
				clipRule="evenodd"
				d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
			/>
		</svg>
	)
}

function RedditMark({ className }: { className?: string }) {
	return (
		<svg aria-hidden="true" viewBox="0 0 24 24" className={`fill-current ${className ?? ""}`}>
			<path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701zM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.687-.562-1.249-1.25-1.249zm-5.466 3.99a.327.327 0 0 0-.231.094.33.33 0 0 0 0 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 0 0 .029-.463.33.33 0 0 0-.464 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.196-2.512-.73a.326.326 0 0 0-.232-.095z" />
		</svg>
	)
}

/** Where to find GoodWatch: the footer's Elsewhere links plus the support email. */
export const ABOUT_LINKS: { icon: Icon; name: string; line: string; href: string; tone: string }[] = [
	{ icon: DiscordMark, name: "Discord", line: "Chat with members", href: DISCORD_URL, tone: "#5865f2" },
	{ icon: RedditMark, name: "Reddit", line: "r/goodwatchapp", href: "https://www.reddit.com/r/goodwatchapp/", tone: "#ff4500" },
	{ icon: GitHubMark, name: "GitHub", line: "Read the source", href: "https://github.com/alp82/goodwatch-monorepo", tone: "#e5e7eb" },
	{ icon: NewspaperIcon, name: "Blog", line: "Build notes on dev.to", href: "https://dev.to/t/goodwatch", tone: "#e5e7eb" },
	{ icon: SignalIcon, name: "Status", line: "Is everything up?", href: "https://status.goodwatch.app/status/services", tone: "#22c55e" },
	{ icon: EnvelopeIcon, name: "Email", line: "hello@goodwatch.app", href: "/support", tone: "#f59e0b" },
]

export { XMark }
