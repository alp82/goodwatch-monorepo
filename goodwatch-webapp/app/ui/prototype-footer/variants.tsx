// PROTOTYPE - throwaway. Five footer layouts, switchable with ?footer=A..E on any page (Footer.tsx).
// Shieldaze badge and IMDb line are gone in all of them; TMDB and JustWatch credits stay.
import { ArrowRightIcon, ArrowUpIcon } from "@heroicons/react/20/solid"
import { Link } from "@remix-run/react"
import goodwatchG from "~/img/goodwatch-logo-amber.svg"
import { GoodWatchWordmark } from "~/ui/brand/GoodWatchWordmark"
import { assetUrl } from "~/utils/asset-url"
import {
	Avatar,
	AvatarStack,
	Credits,
	DISCORD_URL,
	DiscordMark,
	DockSpacer,
	ELSEWHERE,
	EXPLORE,
	FLink,
	GITHUB_URL,
	GitHubMark,
	PROJECT,
	REDDIT_URL,
	RedditMark,
	Section,
	Year,
} from "./shared"

const linkCls = "text-sm text-gray-400 transition-colors hover:text-white"

function Wordmark({ size = 24 }: { size?: number }) {
	return (
		<Link to="/" prefetch="intent" aria-label="GoodWatch home" className="inline-flex">
			<GoodWatchWordmark fontSize={size} />
		</Link>
	)
}

function LinkList({ links }: { links: typeof EXPLORE }) {
	return (
		<ul className="flex flex-col gap-2.5">
			{links.map((l) => (
				<li key={l.name}>
					<FLink link={l} className={linkCls} />
				</li>
			))}
		</ul>
	)
}

function SocialIcons() {
	return (
		<div className="flex items-center gap-2">
			{[
				{ name: "Discord", href: DISCORD_URL, icon: <DiscordMark className="h-5 w-5 text-[#8b95ff]" /> },
				{ name: "Reddit", href: REDDIT_URL, icon: <RedditMark className="h-5 w-5" /> },
				{ name: "GitHub", href: GITHUB_URL, icon: <GitHubMark className="h-5 w-5 text-gray-300" /> },
			].map((s) => (
				<a
					key={s.name}
					href={s.href}
					target="_blank"
					rel="noreferrer"
					aria-label={s.name}
					className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/[0.06] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)] transition hover:bg-white/[0.12]"
				>
					{s.icon}
				</a>
			))}
		</div>
	)
}

function DiscordButton({ label = "Join the chat", size = "md" }: { label?: string; size?: "sm" | "md" | "lg" }) {
	const pad = size === "lg" ? "h-14 px-7 text-lg" : size === "sm" ? "h-9 px-3.5 text-sm" : "h-11 px-5 text-[15px]"
	return (
		<a
			href={DISCORD_URL}
			target="_blank"
			rel="noreferrer"
			className={`group inline-flex shrink-0 items-center gap-2.5 rounded-xl bg-[#5865F2] font-bold text-white shadow-[0_8px_30px_-8px_rgba(88,101,242,0.7)] transition-[background-color,transform] hover:bg-[#4752C4] active:scale-[0.98] ${pad}`}
		>
			<DiscordMark className={size === "lg" ? "h-6 w-6" : "h-5 w-5"} />
			{label}
			<ArrowRightIcon className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
		</a>
	)
}

function LiveDot() {
	return (
		<span className="relative flex h-2 w-2">
			<span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
			<span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
		</span>
	)
}

/* ------------------------------------------------------------------ A: Band + columns */
// A slim Discord band sits on the footer's top edge, then a classic four-column sitemap.
export function VariantA() {
	return (
		<footer className="mt-32 border-t border-white/[0.07] bg-gray-950">
			<div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
				<div className="relative -mt-12 overflow-hidden rounded-2xl bg-[#1e2050] shadow-[inset_0_0_0_1px_rgba(139,149,255,0.25),0_20px_50px_-20px_rgba(0,0,0,0.9)]">
					<div className="pointer-events-none absolute -top-20 -left-10 h-48 w-72 rounded-full bg-[#5865F2] opacity-30 blur-[80px]" />
					<div className="relative flex flex-col items-start gap-5 p-5 sm:flex-row sm:items-center sm:p-6">
						<AvatarStack size={36} ring="ring-[#1e2050]" />
						<div className="flex-1">
							<p className="text-lg font-bold text-white">Join the chat</p>
							<p className="text-sm text-indigo-200/80">
								Episode talk, feature requests, and the yearly Die Hard debate.
							</p>
						</div>
						<DiscordButton label="Open Discord" />
					</div>
				</div>

				<div className="grid grid-cols-2 gap-x-6 gap-y-10 py-14 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
					<div className="col-span-2 flex flex-col gap-4 md:col-span-1">
						<Wordmark size={26} />
						<p className="max-w-xs text-sm leading-relaxed text-gray-400">
							Every score, every service, one place. Find what's worth watching tonight.
						</p>
						<SocialIcons />
					</div>
					<Section title="Explore">
						<LinkList links={EXPLORE} />
					</Section>
					<Section title="GoodWatch">
						<LinkList links={PROJECT} />
					</Section>
					<Section title="Elsewhere">
						<LinkList links={ELSEWHERE} />
					</Section>
				</div>

				<div className="flex flex-col items-center justify-between gap-3 border-t border-white/[0.07] py-6 text-xs text-gray-500 sm:flex-row">
					<span>
						<Year />
					</span>
					<Credits />
				</div>
				<DockSpacer />
			</div>
		</footer>
	)
}

/* ------------------------------------------------------------------ B: Invite card */
// Looks like a Discord server invite: the card is a familiar, trusted shape, so the button reads as safe to press.
export function VariantB() {
	return (
		<footer className="mt-40 bg-gradient-to-b from-transparent to-gray-950">
			<div className="mx-auto grid max-w-7xl gap-12 px-4 pt-12 pb-10 sm:px-6 lg:grid-cols-[1fr_380px] lg:gap-16 lg:px-8">
				<div className="flex flex-col gap-10">
					<div>
						<Wordmark size={34} />
						<p className="mt-3 max-w-md text-[15px] leading-relaxed text-gray-400">
							Every score, every service, one place.
						</p>
					</div>
					<div className="grid grid-cols-2 gap-8 sm:grid-cols-3">
						<Section title="Explore">
							<LinkList links={EXPLORE} />
						</Section>
						<Section title="GoodWatch">
							<LinkList links={PROJECT} />
						</Section>
						<Section title="Elsewhere">
							<LinkList links={ELSEWHERE} />
						</Section>
					</div>
				</div>

				<div className="self-start rounded-2xl bg-[#2b2d31] p-4 shadow-[0_24px_60px_-24px_rgba(0,0,0,0.9),inset_0_0_0_1px_rgba(255,255,255,0.06)]">
					<p className="mb-3 text-[11px] font-bold tracking-wider text-gray-400 uppercase">
						You're invited to join a server
					</p>
					<div className="flex items-center gap-3.5">
						<span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-950 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]">
							<img src={assetUrl(goodwatchG)} alt="" className="h-8 w-8" />
						</span>
						<div className="min-w-0 flex-1">
							<p className="truncate text-base font-bold text-white">GoodWatch</p>
							<p className="mt-0.5 flex items-center gap-3 text-xs text-gray-400">
								<span className="flex items-center gap-1.5">
									<span className="h-2 w-2 rounded-full bg-emerald-400" /> Online now
								</span>
								<span className="flex items-center gap-1.5">
									<span className="h-2 w-2 rounded-full bg-gray-500" /> 100+ members
								</span>
							</p>
						</div>
					</div>
					<div className="mt-4 flex flex-wrap gap-1.5">
						{["#general", "#what-to-watch", "#feature-requests", "#bugs"].map((c) => (
							<span key={c} className="rounded-md bg-white/[0.06] px-2 py-1 text-xs text-gray-300">
								{c}
							</span>
						))}
					</div>
					<a
						href={DISCORD_URL}
						target="_blank"
						rel="noreferrer"
						className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#248046] font-bold text-white transition-colors hover:bg-[#1a6334]"
					>
						Join the chat
					</a>
				</div>
			</div>
			<div className="mx-auto flex max-w-7xl flex-col-reverse items-center justify-between gap-4 border-t border-white/[0.07] px-4 py-6 text-xs text-gray-500 sm:flex-row sm:px-6 lg:px-8">
				<span>
					<Year />
				</span>
				<div className="flex items-center gap-5">
					<Credits />
					<SocialIcons />
				</div>
			</div>
			<DockSpacer />
		</footer>
	)
}

/* ------------------------------------------------------------------ C: Quiet */
// Small and centered. The page above is the star; the footer only answers "where else can I go".
export function VariantC() {
	const all = [...EXPLORE.slice(0, 3), ...PROJECT, ...ELSEWHERE]
	return (
		<footer className="mt-32 border-t border-white/[0.07] bg-gray-950">
			<div className="mx-auto flex max-w-3xl flex-col items-center gap-7 px-4 py-14 text-center">
				<Wordmark size={24} />
				<a
					href={DISCORD_URL}
					target="_blank"
					rel="noreferrer"
					className="group inline-flex items-center gap-3 rounded-full bg-[#5865F2]/15 py-1.5 pr-4 pl-1.5 text-sm text-indigo-100 shadow-[inset_0_0_0_1px_rgba(139,149,255,0.35)] transition-colors hover:bg-[#5865F2]/25"
				>
					<span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#5865F2] text-white">
						<DiscordMark className="h-4 w-4" />
					</span>
					<span className="font-semibold text-white">Join the chat</span>
					<span className="flex items-center gap-1.5 text-indigo-200/70">
						<LiveDot /> on Discord
					</span>
					<ArrowRightIcon className="h-4 w-4 text-indigo-200 transition-transform group-hover:translate-x-0.5" />
				</a>
				<nav aria-label="Footer" className="flex max-w-xl flex-wrap justify-center gap-x-5 gap-y-2.5">
					{all.map((l) => (
						<FLink key={l.name} link={l} className={linkCls} />
					))}
				</nav>
				<div className="flex flex-col items-center gap-2 text-xs text-gray-600">
					<Credits />
					<Year />
				</div>
			</div>
			<DockSpacer />
		</footer>
	)
}

/* ------------------------------------------------------------------ D: Chat preview */
// Shows what the chat is like before you join: a few sample messages and a composer that is the join link.
const SAMPLE = [
	{ who: "mira", text: "finished Severance s2 last night. that finale 😶", time: "21:04" },
	{ who: "jonas", text: "anyone know if Andor is on any free service in DE?", time: "21:06" },
	{ who: "kat", text: "GoodWatch says Disney+ only, but the taste match is 94% for you lol", time: "21:07" },
	{ who: "sam", text: "feature request: hide everything I already rated on Discover", time: "21:11" },
]

export function VariantD() {
	return (
		<footer className="mt-40 bg-gray-950">
			<div className="mx-auto grid max-w-7xl items-center gap-12 px-4 pt-16 pb-12 sm:px-6 lg:grid-cols-[1fr_1.1fr] lg:gap-20 lg:px-8">
				<div>
					<p className="flex items-center gap-2 text-xs font-bold tracking-wider text-indigo-300 uppercase">
						<LiveDot /> Community
					</p>
					<h2 className="mt-3 text-3xl font-bold text-white sm:text-4xl">Join the chat</h2>
					<p className="mt-3 max-w-md text-[15px] leading-relaxed text-gray-400">
						Ask what to watch, tell us what's broken, and shape what GoodWatch builds next.
					</p>
					<div className="mt-6 flex flex-wrap items-center gap-4">
						<DiscordButton label="Join on Discord" />
						<a href={REDDIT_URL} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm text-gray-400 hover:text-white">
							<RedditMark className="h-5 w-5" /> or r/goodwatchapp
						</a>
					</div>
				</div>

				<a
					href={DISCORD_URL}
					target="_blank"
					rel="noreferrer"
					aria-label="Join the GoodWatch Discord chat"
					className="group block overflow-hidden rounded-2xl bg-[#313338] shadow-[0_30px_80px_-30px_rgba(0,0,0,0.95),inset_0_0_0_1px_rgba(255,255,255,0.06)] transition-transform hover:-translate-y-1"
				>
					<div className="flex items-center gap-2 border-b border-black/30 px-4 py-3 text-sm font-semibold text-gray-200">
						<span className="text-lg text-gray-500">#</span> general
						<span className="ml-auto flex items-center gap-1.5 text-xs font-normal text-gray-400">
							<LiveDot /> live
						</span>
					</div>
					<ul className="flex flex-col gap-4 px-4 py-4">
						{SAMPLE.map((m, i) => (
							<li key={m.time} className={`gap-3 ${i > 1 ? "hidden sm:flex" : "flex"}`}>
								<Avatar index={i} size={36} ring="ring-transparent" />
								<div className="min-w-0">
									<p className="text-sm">
										<span className="font-semibold text-white">{m.who}</span>
										<span className="ml-2 text-[11px] text-gray-500">today at {m.time}</span>
									</p>
									<p className="text-sm text-gray-300">{m.text}</p>
								</div>
							</li>
						))}
						<li className="flex items-center gap-1.5 pl-1 text-xs text-gray-400">
							<span className="flex gap-0.5">
								{[0, 150, 300].map((d) => (
									<span key={d} className="h-1.5 w-1.5 animate-pulse rounded-full bg-gray-400" style={{ animationDelay: `${d}ms` }} />
								))}
							</span>
							Several people are typing…
						</li>
					</ul>
					<div className="px-4 pb-4">
						<div className="flex h-11 items-center justify-between rounded-lg bg-[#383a40] px-4 text-sm text-gray-400">
							Message #general
							<span className="rounded-md bg-[#5865F2] px-2.5 py-1 text-xs font-bold text-white transition-colors group-hover:bg-[#4752C4]">
								Join to reply
							</span>
						</div>
					</div>
				</a>
			</div>

			<div className="mx-auto max-w-7xl border-t border-white/[0.07] px-4 py-8 sm:px-6 lg:px-8">
				<div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
					<div className="flex items-center gap-5">
						<Wordmark size={22} />
						<Credits className="hidden sm:flex" />
					</div>
					<nav aria-label="Footer" className="flex flex-wrap gap-x-5 gap-y-2.5">
						{[...EXPLORE.slice(0, 3), ...PROJECT, ...ELSEWHERE.slice(1)].map((l) => (
							<FLink key={l.name} link={l} className={linkCls} />
						))}
					</nav>
				</div>
				<div className="mt-6 flex items-center justify-between text-xs text-gray-600">
					<Year />
					<Credits className="sm:hidden" />
				</div>
			</div>
			<DockSpacer />
		</footer>
	)
}

/* ------------------------------------------------------------------ E: End credits */
// The footer as a film's end credits: centered roll, then the "post-credits scene" is the Discord invite.
function CreditRow({ role, links }: { role: string; links: typeof EXPLORE }) {
	return (
		<div className="grid grid-cols-[1fr_auto_1fr] items-baseline gap-4 sm:gap-6">
			<span className="text-right text-[11px] font-semibold tracking-[0.2em] text-gray-500 uppercase">{role}</span>
			<span className="h-px w-6 translate-y-[-3px] bg-white/15 sm:w-10" aria-hidden />
			<span className="flex flex-col items-start gap-1.5">
				{links.map((l) => (
					<FLink key={l.name} link={l} className="text-[15px] text-gray-300 transition-colors hover:text-amber-300" />
				))}
			</span>
		</div>
	)
}

export function VariantE() {
	return (
		<footer className="mt-40 bg-gradient-to-b from-transparent via-gray-950 to-black">
			<div className="mx-auto flex max-w-2xl flex-col items-center px-4 pt-16 pb-10">
				<Wordmark size={40} />
				<p className="mt-3 text-xs tracking-[0.3em] text-gray-500 uppercase">Every score · every service</p>

				<div className="mt-14 flex w-full flex-col gap-10">
					<CreditRow role="Explore" links={EXPLORE} />
					<CreditRow role="Learn more" links={PROJECT} />
					<CreditRow role="Find us" links={ELSEWHERE} />
				</div>

				<div className="mt-16 w-full rounded-3xl bg-gradient-to-b from-[#5865F2]/60 via-[#5865F2]/15 to-transparent p-px">
					<div className="flex flex-col items-center rounded-[23px] bg-gray-950 px-6 py-10 text-center">
						<p className="text-[11px] font-semibold tracking-[0.3em] text-indigo-300 uppercase">Post-credits scene</p>
						<h2 className="mt-3 text-2xl font-bold text-white sm:text-3xl">Join the chat</h2>
						<p className="mt-2 max-w-sm text-sm text-gray-400">
							Stay after the credits with people who also read every score twice.
						</p>
						<div className="mt-5 flex items-center gap-3">
							<AvatarStack size={30} />
							<span className="text-xs text-gray-500">100+ members</span>
						</div>
						<div className="mt-6">
							<DiscordButton label="Join on Discord" />
						</div>
					</div>
				</div>

				<div className="mt-12 flex flex-col items-center gap-3 text-xs text-gray-600">
					<Credits />
					<span className="flex items-center gap-4">
						<Year />
						<button
							type="button"
							onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
							className="flex items-center gap-1 text-gray-500 hover:text-white"
						>
							<ArrowUpIcon className="h-3.5 w-3.5" /> Back to top
						</button>
					</span>
				</div>
			</div>
			<DockSpacer />
		</footer>
	)
}

export const FOOTER_VARIANTS: Record<string, string> = {
	A: "Band + columns",
	B: "Invite card",
	C: "Quiet",
	D: "Chat preview",
	E: "End credits",
}
