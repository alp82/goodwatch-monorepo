// /use-with-ai: GoodWatch in Claude, ChatGPT and other AI apps. The page is four numbered steps (pick your app, add
// GoodWatch, sign in and allow, ask), with a chat demo beside them on wide screens and inside "Ask" on phones.
// #<app> opens one app's steps (/use-with-ai#cursor). Fixes for when something goes wrong are on /support.
import {
	BookmarkIcon,
	CheckBadgeIcon,
	LifebuoyIcon,
	LinkSlashIcon,
	SparklesIcon,
	StarIcon,
	TvIcon,
	UserGroupIcon,
	UserIcon,
} from "@heroicons/react/24/outline"
import type { MetaFunction } from "@remix-run/node"
import { Link } from "@remix-run/react"
import type { ComponentType, ReactNode, SVGProps } from "react"
import { APP_GUIDES, useSelectedGuide } from "~/ui/connector/app-guides"
import { CONNECTED_APPS_PATH, USE_WITH_AI_PATH } from "~/ui/connector/connector"
import { USE_WITH_AI_ASKS } from "~/ui/connector/example-prompts"
import { Ui } from "~/ui/connector/help-parts"
import { AI_CHAT_COPY } from "~/ui/og-image/copy"
import { AppPicker, AppSetup } from "~/ui/use-with-ai/AppSetup"
import { ChatDemo } from "~/ui/use-with-ai/ChatDemo"
import { type PageMeta, buildMeta } from "~/utils/meta"

export { pageHeaders as headers } from "~/utils/headers"

export const meta: MetaFunction = () => {
	const pageMeta: PageMeta = {
		title: "Use GoodWatch in Claude, ChatGPT and other AI apps | GoodWatch",
		description:
			"Add GoodWatch to Claude, ChatGPT, Cursor, VS Code and other AI apps in a few steps. Then ask what to watch, log episodes and rate titles by chatting.",
		url: `https://goodwatch.app${USE_WITH_AI_PATH}`,
		image: "https://goodwatch.app/images/heroes/hero-movies.png",
		// Describes the chat card (ChatCard.tsx).
		alt: `A chat asking “${AI_CHAT_COPY.prompt}”, answered with GoodWatch poster cards and their scores`,
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

const linkClass = "font-semibold text-amber-500 hover:text-amber-400"

export default function UseWithAi() {
	const { guide, select } = useSelectedGuide()

	return (
		<div className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-12 px-4 py-8 text-gray-300 sm:px-8 md:py-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,29rem)] lg:gap-14">
			<div className="flex flex-col gap-10">
				<header className="flex flex-col gap-3">
					<h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
						Use GoodWatch in your AI app
					</h1>
					<p className="text-lg leading-relaxed text-gray-300">
						Ask what to watch, log episodes and rate titles by chatting. Every
						answer fits your taste.
					</p>
				</header>

				<ol id="turn-on" className="scroll-mt-24">
					<PageStep n={1} title="Pick your app">
						<AppPicker selected={guide.key} onSelect={select} />
					</PageStep>

					<PageStep
						n={2}
						anchors={APP_GUIDES.map(({ key }) => key)}
						title={
							guide.key === "other"
								? "Add GoodWatch"
								: `Add GoodWatch to ${guide.name}`
						}
					>
						<AppSetup guide={guide} />
					</PageStep>

					<PageStep n={3} title="Sign in and allow">
						<p className="leading-relaxed">
							GoodWatch opens in your browser. Sign in and press <Ui>Allow</Ui>.
						</p>
						{guide.after && <p className="leading-relaxed">{guide.after}</p>}
					</PageStep>

					<PageStep n={4} title="Ask" last>
						{/* On phones the demo uses the step number column too, so its cards have room. */}
						<ChatDemo className="-ml-14 sm:ml-0 lg:hidden" />
						<Asks />
					</PageStep>
				</ol>

				<FinePrint />
			</div>

			<aside
				aria-label="What it looks like"
				className="hidden lg:sticky lg:top-24 lg:block lg:self-start"
			>
				<ChatDemo />
			</aside>
		</div>
	)
}

function PageStep({
	n,
	title,
	last = false,
	anchors = [],
	children,
}: {
	n: number
	title: string
	last?: boolean
	// Ids for links into this step (#cursor). The browser and Remix scroll to them, so a link from another page lands
	// on the app's steps.
	anchors?: string[]
	children: ReactNode
}) {
	return (
		<li className="relative grid grid-cols-[2.5rem_minmax(0,1fr)] gap-x-4 sm:grid-cols-[3rem_minmax(0,1fr)] sm:gap-x-6">
			{anchors.length > 0 && (
				<div aria-hidden="true" className="absolute inset-x-0 top-0">
					{anchors.map((id) => (
						<span key={id} id={id} className="block scroll-mt-24" />
					))}
				</div>
			)}
			<div className="flex flex-col items-center">
				<span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-700 text-lg font-black text-white sm:h-12 sm:w-12 sm:text-xl">
					<span className="sr-only">Step </span>
					{n}
				</span>
				{!last && (
					<span aria-hidden="true" className="mt-2 w-px flex-1 bg-white/15" />
				)}
			</div>
			<div className={`flex min-w-0 flex-col gap-4 ${last ? "" : "pb-12"}`}>
				<h2 className="pt-1.5 text-xl font-bold tracking-tight text-white sm:pt-2.5 sm:text-2xl">
					{title}
				</h2>
				{children}
			</div>
		</li>
	)
}

function Asks() {
	return (
		<ul className="grid gap-3 sm:grid-cols-2">
			{USE_WITH_AI_ASKS.map(({ key, ask, does }) => {
				const Icon = ASK_ICONS[key]
				return (
					<li
						key={key}
						className="flex flex-col gap-2.5 rounded-2xl bg-white/[0.04] p-4 ring-1 ring-white/10"
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
	)
}

// Account, disconnecting and help in one quiet row.
function FinePrint() {
	const item = "flex items-center gap-2"
	const icon = "h-4 w-4 shrink-0 text-gray-500"
	return (
		<ul className="flex flex-col gap-2 border-t border-white/10 pt-6 text-sm text-gray-400 sm:flex-row sm:flex-wrap sm:gap-x-6">
			<li className={item}>
				<UserIcon className={icon} aria-hidden="true" />
				<span>
					Needs a free{" "}
					<Link to="/sign-up" className={linkClass}>
						GoodWatch account
					</Link>
				</span>
			</li>
			<li className={item}>
				<LinkSlashIcon className={icon} aria-hidden="true" />
				<span>
					Disconnect in{" "}
					<Link to={CONNECTED_APPS_PATH} className={linkClass}>
						Connected apps
					</Link>
				</span>
			</li>
			<li className={item}>
				<LifebuoyIcon className={icon} aria-hidden="true" />
				<span>
					Stuck?{" "}
					<Link to="/support" prefetch="intent" className={linkClass}>
						Support
					</Link>
				</span>
			</li>
		</ul>
	)
}
