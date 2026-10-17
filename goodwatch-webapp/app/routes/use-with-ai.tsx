// /use-with-ai: GoodWatch inside Claude, ChatGPT and other AI apps, shown rather than explained. A chat demo with the
// connector's poster cards, things to ask, and drawn setup steps per app. The exact menus, plans, commands and fixes
// stay on /connect, which this page links to.
import {
	ArrowRightIcon,
	BookmarkIcon,
	CheckBadgeIcon,
	SparklesIcon,
	StarIcon,
	TvIcon,
	UserGroupIcon,
} from "@heroicons/react/24/outline"
import type { MetaFunction } from "@remix-run/node"
import { Link } from "@remix-run/react"
import { type ComponentType, type SVGProps, useState } from "react"
import { CopyField } from "~/ui/connector/CopyField"
import {
	CONNECTOR_HELP_PATH,
	CONNECTOR_URL,
	USE_WITH_AI_PATH,
} from "~/ui/connector/connector"
import { USE_WITH_AI_ASKS } from "~/ui/connector/example-prompts"
import { ChatDemo } from "~/ui/use-with-ai/ChatDemo"
import { AppBadges, SETUP_APPS } from "~/ui/use-with-ai/SetupSteps"
import { type PageMeta, buildMeta } from "~/utils/meta"

export { pageHeaders as headers } from "~/utils/headers"

export const meta: MetaFunction = () => {
	const pageMeta: PageMeta = {
		title: "Use GoodWatch with your AI | GoodWatch",
		description:
			"Ask Claude, ChatGPT or your coding app what to watch, and get answers that fit your taste, with posters, scores and where to stream. See how to turn it on.",
		url: `https://goodwatch.app${USE_WITH_AI_PATH}`,
		image: "https://goodwatch.app/images/heroes/hero-movies.png",
		alt: "GoodWatch in an AI chat",
	}

	return buildMeta({ pageMeta, items: [] })
}

const ASK_ICONS: Record<
	(typeof USE_WITH_AI_ASKS)[number]["key"],
	ComponentType<SVGProps<SVGSVGElement>>
> = {
	tonight: TvIcon,
	like: SparklesIcon,
	add: BookmarkIcon,
	log: CheckBadgeIcon,
	score: StarIcon,
	person: UserGroupIcon,
}

const h2 = "text-2xl font-bold tracking-tight text-white sm:text-3xl"
const linkClass = "font-semibold text-amber-500 hover:text-amber-400"

export default function UseWithAi() {
	const [appKey, setAppKey] = useState(SETUP_APPS[0].key)
	const app = SETUP_APPS.find(({ key }) => key === appKey) ?? SETUP_APPS[0]
	return (
		<div className="mx-auto flex w-full max-w-6xl flex-col gap-16 px-4 py-8 text-gray-300 sm:px-8 md:py-14">
			<header className="grid items-center gap-10 lg:grid-cols-[1fr_1.15fr]">
				<div className="flex flex-col gap-5">
					<p className="text-sm font-semibold tracking-wider text-amber-500 uppercase">
						GoodWatch in your AI app
					</p>
					<h1 className="text-4xl font-black tracking-tight text-white sm:text-5xl">
						Ask your AI what to watch. It knows your taste.
					</h1>
					<p className="text-lg leading-relaxed text-gray-300">
						Connect GoodWatch to Claude, ChatGPT or your coding app. Then ask
						for tonight's pick, sort your Wishlist or log an episode, in your
						own words. Answers come with posters, scores and where to stream.
					</p>
					<div className="flex flex-wrap gap-3">
						<a
							href="#turn-on"
							className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-amber-700 px-5 py-3 font-semibold text-white transition hover:bg-amber-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900"
						>
							Turn it on
							<ArrowRightIcon className="h-5 w-5" aria-hidden="true" />
						</a>
						<Link
							to={CONNECTOR_HELP_PATH}
							prefetch="intent"
							className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg border border-gray-600 px-5 py-3 font-semibold text-gray-200 hover:border-gray-400 hover:text-white"
						>
							All apps and details
						</Link>
					</div>
					<div className="flex flex-wrap items-center gap-3 text-sm text-gray-400">
						<span className="flex -space-x-2">
							{SETUP_APPS.map((item) => (
								<AppBadges
									key={item.key}
									app={{ ...item, badges: item.badges.slice(0, 1) }}
								/>
							))}
						</span>
						Works with Claude, ChatGPT, Cursor, VS Code and more
					</div>
				</div>
				<ChatDemo />
			</header>

			<section aria-labelledby="ask" className="flex flex-col gap-5">
				<div>
					<h2 id="ask" className={h2}>
						Ask in your own words
					</h2>
					<p className="mt-1 text-gray-400">
						Type it the way you'd text a friend. Your ratings, shows and
						services come along, so every answer fits you.
					</p>
				</div>
				<ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
					{USE_WITH_AI_ASKS.map(({ key, ask, does }) => {
						const Icon = ASK_ICONS[key]
						return (
							<li
								key={key}
								className="flex flex-col gap-3 rounded-2xl bg-white/[0.04] p-4 ring-1 ring-white/10"
							>
								<p className="self-end rounded-2xl rounded-br-md bg-gray-700/70 px-3 py-2 text-gray-100">
									{ask}
								</p>
								<p className="flex items-center gap-2 text-sm text-gray-400">
									<Icon
										className="h-5 w-5 shrink-0 text-amber-400"
										aria-hidden="true"
									/>
									{does}
								</p>
							</li>
						)
					})}
				</ul>
			</section>

			<section
				id="turn-on"
				aria-labelledby="turn-on-heading"
				className="flex scroll-mt-24 flex-col gap-5"
			>
				<div>
					<h2 id="turn-on-heading" className={h2}>
						Turn it on in four steps
					</h2>
					<p className="mt-1 text-gray-400">
						Pick your app. The pictures are drawings of each step, not the real
						apps.
					</p>
				</div>
				<div
					role="tablist"
					aria-label="Pick your app"
					className="grid grid-cols-2 gap-2 lg:grid-cols-4"
				>
					{SETUP_APPS.map((item) => {
						const on = item.key === app.key
						return (
							<button
								key={item.key}
								type="button"
								role="tab"
								id={`setup-tab-${item.key}`}
								aria-selected={on}
								aria-controls="setup-steps"
								onClick={() => setAppKey(item.key)}
								className={`flex cursor-pointer items-center gap-3 rounded-2xl p-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${on ? "bg-amber-950/40 ring-2 ring-amber-500" : "bg-white/[0.04] ring-1 ring-white/10 hover:bg-white/[0.07]"}`}
							>
								<AppBadges app={item} />
								<span className="min-w-0">
									<span className="block font-semibold leading-tight text-white">
										{item.name}
									</span>
									<span className="block truncate text-xs text-gray-400 sm:text-sm">
										{item.sub}
									</span>
								</span>
							</button>
						)
					})}
				</div>
				{/* Phones swipe through the steps; wider screens show them side by side. */}
				<ol
					id="setup-steps"
					role="tabpanel"
					aria-labelledby={`setup-tab-${app.key}`}
					className="relative -mx-4 flex snap-x snap-mandatory scroll-px-4 gap-4 overflow-x-auto px-4 pb-2 md:mx-0 md:grid md:grid-cols-2 md:overflow-visible md:px-0 xl:grid-cols-4"
				>
					{app.steps.map((step, index) => (
						<li
							key={step.title}
							className="flex w-[85%] shrink-0 snap-start flex-col gap-3 md:w-auto"
						>
							{step.screen}
							<div className="flex gap-3">
								<span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gray-800 text-sm font-bold text-amber-400 ring-1 ring-gray-700">
									<span className="sr-only">Step </span>
									{index + 1}
								</span>
								<div>
									<p className="font-semibold text-white">{step.title}</p>
									<p className="text-sm leading-relaxed text-gray-400 [&_b]:font-semibold [&_b]:text-gray-200">
										{step.text}
									</p>
								</div>
							</div>
						</li>
					))}
				</ol>
				<p className="text-sm text-gray-400">
					Stuck, or using another app?{" "}
					<Link to={app.guide} prefetch="intent" className={linkClass}>
						Full {app.name} guide
					</Link>
				</p>
			</section>

			<Details />
		</div>
	)
}

function Details() {
	return (
		<section
			aria-labelledby="details"
			className="flex flex-col gap-4 rounded-2xl bg-gradient-to-br from-amber-950/60 via-gray-900 to-gray-900 p-5 ring-1 ring-amber-500/30 sm:p-8 md:flex-row md:items-center md:justify-between"
		>
			<div className="flex max-w-xl flex-col gap-2">
				<h2 id="details" className="text-xl font-bold text-white">
					Need the details?
				</h2>
				<p className="text-gray-300">
					Every app, the exact menus, plans that allow it, terminal commands and
					fixes are on the{" "}
					<Link
						to={CONNECTOR_HELP_PATH}
						prefetch="intent"
						className={linkClass}
					>
						Connect page
					</Link>
					. You need a free GoodWatch account.
				</p>
			</div>
			<div className="flex flex-col gap-2 md:w-96">
				<p className="text-sm font-semibold text-gray-300">
					Your GoodWatch address
				</p>
				<CopyField text={CONNECTOR_URL} label="Copy the connector address" />
			</div>
		</section>
	)
}
