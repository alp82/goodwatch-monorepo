// /use-with-ai: the GoodWatch MCP server in Claude, ChatGPT and other AI apps. Built like /discord: an intro with the
// chat demo, four numbered setup steps (pick your app, add GoodWatch, sign in and allow, ask), what you can ask in
// three groups, how the MCP server works with what an app can see and change, and a short FAQ.
// #<app> opens one app's steps (/use-with-ai#cursor). Fixes for when something goes wrong are on /support.
import {
	AdjustmentsHorizontalIcon,
	ArrowRightIcon,
	BookmarkIcon,
	CheckBadgeIcon,
	CheckIcon,
	EyeIcon,
	FingerPrintIcon,
	ForwardIcon,
	GlobeEuropeAfricaIcon,
	LockClosedIcon,
	MagnifyingGlassIcon,
	NoSymbolIcon,
	PauseCircleIcon,
	PencilSquareIcon,
	PlayCircleIcon,
	PuzzlePieceIcon,
	QueueListIcon,
	RectangleStackIcon,
	SparklesIcon,
	Squares2X2Icon,
	StarIcon,
	TvIcon,
	UserGroupIcon,
	UserIcon,
} from "@heroicons/react/24/outline"
import type { MetaFunction } from "@remix-run/node"
import { Link } from "@remix-run/react"
import type { ComponentType, ReactNode, SVGProps } from "react"
import { CopyField } from "~/ui/connector/CopyField"
import { APP_GUIDES, useSelectedGuide } from "~/ui/connector/app-guides"
import {
	APP_CAN_CHANGE,
	APP_CAN_NEVER,
	APP_CAN_SEE,
	CONNECTED_APPS_PATH,
	CONNECTOR_URL,
	PRIVACY_CONNECTED_APPS_PATH,
	RANKED_SEARCHES_PER_DAY,
	USE_WITH_AI_PATH,
} from "~/ui/connector/connector"
import {
	DESCRIPTION_SEARCH_EXAMPLE,
	USE_WITH_AI_GROUPS,
} from "~/ui/connector/example-prompts"
import { Ui } from "~/ui/connector/help-parts"
import { Kicker, Question, SectionHeading } from "~/ui/info-page"
import { AI_CHAT_COPY } from "~/ui/og-image/copy"
import { AppPicker, AppSetup } from "~/ui/use-with-ai/AppSetup"
import { ChatDemo } from "~/ui/use-with-ai/ChatDemo"
import { type PageMeta, buildMeta } from "~/utils/meta"

export { pageHeaders as headers } from "~/utils/headers"

export const meta: MetaFunction = () => {
	const pageMeta: PageMeta = {
		title: "GoodWatch MCP server for Claude, ChatGPT and more | GoodWatch",
		description:
			"Add the GoodWatch MCP server to Claude, ChatGPT, Cursor, VS Code and other AI apps in a few steps. Then ask what to watch, log episodes and rate titles by chatting.",
		url: `https://goodwatch.app${USE_WITH_AI_PATH}`,
		image: "https://goodwatch.app/images/heroes/hero-movies.png",
		// Describes the chat card (ChatCard.tsx).
		alt: `A chat asking “${AI_CHAT_COPY.prompt}”, answered with GoodWatch poster cards and their scores`,
	}

	return buildMeta({ pageMeta, items: [] })
}

type Group = (typeof USE_WITH_AI_GROUPS)[number]
type AskKey = Group["asks"][number]["key"]
type Icon = ComponentType<SVGProps<SVGSVGElement>>

const GROUP_ICONS: Record<Group["key"], Icon> = {
	find: MagnifyingGlassIcon,
	library: RectangleStackIcon,
	taste: FingerPrintIcon,
}

const ASK_ICONS: Record<AskKey, Icon> = {
	tonight: TvIcon,
	like: SparklesIcon,
	discover: AdjustmentsHorizontalIcon,
	stream: PlayCircleIcon,
	person: UserGroupIcon,
	log: CheckBadgeIcon,
	many: QueueListIcon,
	score: StarIcon,
	add: BookmarkIcon,
	next: ForwardIcon,
	hold: PauseCircleIcon,
	taste: FingerPrintIcon,
	list: PencilSquareIcon,
	services: Squares2X2Icon,
	country: GlobeEuropeAfricaIcon,
}

// The apps with their own steps on this page, for the intro and the FAQ ("Other app" is the rest).
const APP_NAMES = APP_GUIDES.filter(({ key }) => key !== "other").map(
	({ name }) => name,
)

const linkClass = "font-semibold text-amber-500 hover:text-amber-400"

export default function UseWithAi() {
	return (
		<div className="mx-auto flex w-full max-w-6xl flex-col gap-20 px-4 py-8 pb-24 text-gray-300 sm:px-8 md:gap-28 md:py-14">
			<Hero />
			<Setup />
			<UseCases />
			<HowItWorks />
			<Faq />
		</div>
	)
}

function SetupButton({ className = "" }: { className?: string }) {
	return (
		<a
			href="#setup"
			className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-amber-700 px-5 py-3 font-semibold text-white transition hover:bg-amber-600 focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900 focus-visible:outline-none ${className}`}
		>
			Set it up
		</a>
	)
}

function Hero() {
	return (
		<header className="grid grid-cols-1 items-center gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,29rem)] lg:gap-14">
			<div className="flex flex-col gap-5">
				<Kicker>MCP server</Kicker>
				<h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl">
					GoodWatch in your AI app
				</h1>
				<p className="max-w-xl text-lg leading-relaxed text-gray-300 sm:text-xl">
					Ask what to watch tonight, log the episode you finished, and rate what
					you saw, all by chatting. Every answer fits your taste and your
					streaming services.
				</p>
				<p className="max-w-xl leading-relaxed text-gray-400">
					GoodWatch is a remote MCP server. It works in Claude, ChatGPT, Cursor,
					VS Code, and any other app that supports MCP with sign-in.
				</p>
				<div className="flex flex-wrap items-center gap-3">
					<SetupButton />
					<a
						href="#ask"
						className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-white/[0.06] px-5 py-3 font-semibold text-gray-100 ring-1 ring-white/10 transition hover:bg-white/10"
					>
						What you can ask
					</a>
				</div>
				<ul className="flex flex-col gap-2 text-sm text-gray-400 sm:flex-row sm:flex-wrap sm:gap-x-6">
					<HeroFact icon={SparklesIcon}>Free</HeroFact>
					<HeroFact icon={UserIcon}>Free GoodWatch account</HeroFact>
					<HeroFact icon={PuzzlePieceIcon}>Set up in about a minute</HeroFact>
				</ul>
			</div>
			<ChatDemo />
		</header>
	)
}

function HeroFact({
	icon: Icon,
	children,
}: { icon: Icon; children: ReactNode }) {
	return (
		<li className="flex items-center gap-2">
			<Icon className="h-4 w-4 shrink-0 text-amber-400" aria-hidden="true" />
			{children}
		</li>
	)
}

function Setup() {
	const { guide, select } = useSelectedGuide()

	return (
		<section aria-labelledby="setup" className="flex flex-col gap-10">
			<SectionHeading id="setup" title="Set it up in four steps">
				Add the GoodWatch MCP server to your app once. After that, GoodWatch is
				there in every chat.
			</SectionHeading>
			<ol className="max-w-3xl">
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
					<p className="leading-relaxed">
						Start a new chat and ask in your own words, like{" "}
						<q className="text-white">{USE_WITH_AI_GROUPS[0].asks[0].ask}</q>.
						Your app picks the GoodWatch tools it needs.{" "}
						<a href="#ask" className={linkClass}>
							See what you can ask
						</a>
					</p>
				</PageStep>
			</ol>
		</section>
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
				<h3 className="pt-1.5 text-xl font-bold tracking-tight text-white sm:pt-2.5 sm:text-2xl">
					{title}
				</h3>
				{children}
			</div>
		</li>
	)
}

function UseCases() {
	return (
		<section aria-labelledby="ask" className="flex flex-col gap-10">
			<SectionHeading id="ask" title="What you can ask">
				Type the way you'd text a friend. The GoodWatch MCP server gives your
				app 25 tools for picks, search, your library, lists, and settings.
			</SectionHeading>
			<div className="grid grid-cols-1 items-start gap-4 md:grid-cols-2 lg:grid-cols-3">
				{USE_WITH_AI_GROUPS.map((group) => (
					<AskGroup key={group.key} group={group} />
				))}
			</div>
		</section>
	)
}

function AskGroup({ group }: { group: Group }) {
	const GroupIcon = GROUP_ICONS[group.key]
	return (
		<div className="flex flex-col gap-4 rounded-2xl bg-white/[0.04] p-5 ring-1 ring-white/10">
			<div className="flex items-center gap-3">
				<span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 ring-1 ring-amber-500/30">
					<GroupIcon className="h-5 w-5 text-amber-400" aria-hidden="true" />
				</span>
				<div className="flex flex-col">
					<h3 className="font-semibold text-white">{group.title}</h3>
					<p className="text-sm text-gray-400">{group.hint}</p>
				</div>
			</div>
			<ul className="flex flex-col gap-4">
				{group.asks.map(({ key, ask, does }) => {
					const AskIcon = ASK_ICONS[key]
					return (
						<li key={key} className="flex flex-col gap-1.5">
							<p className="w-fit max-w-full rounded-2xl rounded-bl-md bg-gray-700/70 px-3 py-2 text-gray-100">
								{ask}
							</p>
							<p className="flex items-center gap-2 pl-1 text-sm text-gray-400">
								<AskIcon
									className="h-4 w-4 shrink-0 text-amber-400"
									aria-hidden="true"
								/>
								{does}
							</p>
						</li>
					)
				})}
			</ul>
		</div>
	)
}

function HowItWorks() {
	return (
		<section
			aria-labelledby="mcp"
			className="grid grid-cols-1 items-start gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,30rem)] lg:gap-14"
		>
			<div className="flex flex-col gap-6">
				<SectionHeading id="mcp" title="How the MCP server works">
					MCP, the Model Context Protocol, is an open standard that lets AI apps
					use tools from other services.
				</SectionHeading>
				<ul className="flex flex-col gap-3 leading-relaxed">
					<Benefit>
						Your app connects to the GoodWatch MCP server at one address.
					</Benefit>
					<Benefit>
						You sign in on goodwatch.app and press <Ui>Allow</Ui>. Your app
						never sees your password.
					</Benefit>
					<Benefit>
						When you ask about movies or shows, your app calls GoodWatch and
						answers with your scores, matches, and where each title streams.
					</Benefit>
					<Benefit>
						In apps that support MCP Apps, answers can include poster cards.
					</Benefit>
				</ul>
				<div className="flex flex-col gap-2">
					<p className="text-sm font-semibold text-gray-400">
						The MCP server address
					</p>
					<CopyField
						text={CONNECTOR_URL}
						label="Copy the MCP server address"
						size="lg"
					/>
				</div>
			</div>
			<div className="flex flex-col divide-y divide-white/10 rounded-2xl bg-white/[0.04] ring-1 ring-white/10">
				<Access icon={EyeIcon} title="Your app can see" items={APP_CAN_SEE} />
				<Access
					icon={PencilSquareIcon}
					title="Your app can change"
					items={APP_CAN_CHANGE}
				/>
				<Access
					icon={LockClosedIcon}
					title="Your app can never"
					items={APP_CAN_NEVER}
					never
				/>
				<p className="px-5 py-4 text-sm leading-relaxed text-gray-400">
					Disconnect any time in{" "}
					<Link to={CONNECTED_APPS_PATH} className={linkClass}>
						Connected apps
					</Link>
					.
				</p>
			</div>
		</section>
	)
}

function Benefit({ children }: { children: ReactNode }) {
	return (
		<li className="flex items-start gap-3">
			<ArrowRightIcon
				className="mt-1 h-4 w-4 shrink-0 text-amber-400"
				aria-hidden="true"
			/>
			<span>{children}</span>
		</li>
	)
}

function Access({
	icon: Icon,
	title,
	items,
	never = false,
}: {
	icon: Icon
	title: string
	items: readonly string[]
	never?: boolean
}) {
	const ItemIcon = never ? NoSymbolIcon : CheckIcon
	return (
		<div className="flex flex-col gap-3 px-5 py-4">
			<h3 className="flex items-center gap-2 font-semibold text-white">
				<Icon className="h-5 w-5 shrink-0 text-amber-400" aria-hidden="true" />
				{title}
			</h3>
			<ul className="flex flex-col gap-2 text-sm leading-relaxed text-gray-300">
				{items.map((item) => (
					<li key={item} className="flex items-start gap-2">
						<ItemIcon
							className={`mt-0.5 h-4 w-4 shrink-0 ${never ? "text-gray-500" : "text-emerald-400"}`}
							aria-hidden="true"
						/>
						{item}
					</li>
				))}
			</ul>
		</div>
	)
}

function Faq() {
	return (
		<section aria-labelledby="faq" className="flex flex-col gap-8">
			<SectionHeading id="faq" title="Questions" />
			<div className="flex max-w-3xl flex-col divide-y divide-white/10 rounded-2xl bg-white/[0.04] ring-1 ring-white/10">
				<Question q="Is it free?">
					Yes. The GoodWatch MCP server is free, and so is a GoodWatch account.
					Your AI app's own plan decides whether it can add MCP servers.
				</Question>
				<Question q="Do I need a GoodWatch account?">
					Yes, a free one. GoodWatch uses it to fit answers to your taste and to
					save what you log and rate.{" "}
					<Link to="/sign-up" prefetch="intent" className={linkClass}>
						Create an account
					</Link>
				</Question>
				<Question q="Which AI apps work?">
					This page has steps for {APP_NAMES.join(", ")}. Any other app that
					adds a remote MCP server with sign-in works too. Pick{" "}
					<Ui>Other app</Ui> in step 1.
				</Question>
				<Question q="What is an MCP server?">
					MCP, the Model Context Protocol, is an open standard for connecting AI
					apps to other services. An MCP server offers tools that the app can
					call. Some apps call MCP servers connectors or extensions.
				</Question>
				<Question q="What can my AI app see and change?">
					Your ratings, Wishlist, watch history, taste profile, and settings. It
					can log, rate, and change your lists when you ask. It can never see
					your email address or password.{" "}
					<Link to={PRIVACY_CONNECTED_APPS_PATH} className={linkClass}>
						Read the privacy policy
					</Link>
				</Question>
				<Question q="Is there a limit?">
					Search by description, like “{DESCRIPTION_SEARCH_EXAMPLE}”, works{" "}
					{RANKED_SEARCHES_PER_DAY} times a day. Finding a title by its name has
					no daily limit.
				</Question>
				<Question q="How do I disconnect an app?">
					Open{" "}
					<Link to={CONNECTED_APPS_PATH} className={linkClass}>
						Connected apps
					</Link>{" "}
					in your settings and remove the app.
				</Question>
				<Question q="Something isn't working?">
					The{" "}
					<Link to="/support" prefetch="intent" className={linkClass}>
						Support
					</Link>{" "}
					page has fixes for the most common problems, and a way to write to us.
				</Question>
			</div>
			<div className="flex flex-col items-start gap-4 pt-4">
				<p className="text-lg text-gray-300">Ready to try it?</p>
				<SetupButton />
			</div>
		</section>
	)
}
