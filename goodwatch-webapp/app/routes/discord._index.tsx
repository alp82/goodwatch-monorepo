// /discord: the GoodWatch Discord bot. What it does, how to add it in three steps (install link, My Apps or Server,
// type /), the commands, /together, linking an account, and a short FAQ. The pictures are Discord look-alikes drawn
// in markup (ui/discord-bot/DiscordMock). Every install button goes to /discord/add, which redirects to Discord.
// This is discord._index, not discord.tsx: a discord.tsx would become the layout of /discord/link.
import {
	ArrowRightIcon,
	ChevronDownIcon,
	LinkIcon,
	ServerStackIcon,
	SparklesIcon,
	UserIcon,
	UserGroupIcon,
} from "@heroicons/react/24/outline"
import type { MetaFunction } from "@remix-run/node"
import { Link } from "@remix-run/react"
import type { ComponentType, ReactNode, SVGProps } from "react"
import {
	BotMessage,
	DiscordWindow,
	InstallDialog,
	LinkCard,
	MemberBlock,
	type MockTitle,
	SERVICES,
	SlashMenu,
	TitleCard,
	TogetherMessage,
	VoteCard,
} from "~/ui/discord-bot/DiscordMock"
import {
	DISCORD_ADD_PATH,
	DISCORD_ADD_URL,
	DISCORD_BOT_PATH,
} from "~/ui/discord-bot/links"
import { DISCORD_URL, DiscordMark } from "~/ui/footer/links"
import { Kicker } from "~/ui/info-page"
import { type PageMeta, buildMeta } from "~/utils/meta"

export { pageHeaders as headers } from "~/utils/headers"

export const meta: MetaFunction = () => {
	const pageMeta: PageMeta = {
		title: "Discord bot for movies and shows | GoodWatch",
		description:
			"Add the GoodWatch bot to Discord. Search movies and shows, get a pick for tonight, and let your server choose what to watch together with private votes.",
		url: `https://goodwatch.app${DISCORD_BOT_PATH}`,
		image: "https://goodwatch.app/images/heroes/hero-movies.png",
		alt: "The GoodWatch Discord bot",
	}

	return buildMeta({ pageMeta, items: [] })
}

const PRIVACY_PATH = "/privacy#discord"
const linkClass = "font-semibold text-amber-500 hover:text-amber-400"

// Real titles and their GoodWatch data, with availability in Germany on October 23, 2026 (the card prototype's data).
const PROJECT_HAIL_MARY: MockTitle = {
	name: "Project Hail Mary",
	year: 2026,
	score: 85,
	runtime: 157,
	genres: ["Science Fiction", "Adventure"],
	service: SERVICES.prime,
	poster: "/iOb2fjXLbpJgyQXe46n1WtGCnaa.jpg",
	backdrop: "/8Tfys3mDZVp4tNoH2ktm06a0Tau.jpg",
	overview:
		"Science teacher Ryland Grace wakes up on a spaceship light years from home with no recollection of who he is or how he got there…",
}
const SPIRITED_AWAY: MockTitle = {
	name: "Spirited Away",
	year: 2001,
	score: 92,
	runtime: 125,
	genres: ["Animation", "Family", "Fantasy"],
	service: SERVICES.netflix,
	poster: "/jUo8cNmU400WtZiJss45HNXlQ2e.jpg",
}
const COCO: MockTitle = {
	name: "Coco",
	year: 2017,
	score: 87,
	runtime: 105,
	genres: ["Family", "Animation", "Music"],
	service: SERVICES.disney,
	poster: "/6Ryitt95xrO8KXuqRGm1fUuNwqF.jpg",
}
const HOWLS_MOVING_CASTLE: MockTitle = {
	name: "Howl's Moving Castle",
	year: 2004,
	score: 85,
	runtime: 119,
	genres: ["Fantasy", "Animation", "Adventure"],
	service: SERVICES.netflix,
	poster: "/13kOl2v0nD2OLbVSHnHk8GUFEhO.jpg",
}

// The slash menu: the descriptions the bot registers (app/server/discord/commands.ts), copied because code that runs
// in the browser can't import from app/server.
const MENU_COMMANDS = [
	{ name: "search", description: "Search movies and TV shows on GoodWatch" },
	{ name: "discover", description: "Discover movies and TV shows" },
	{ name: "watch", description: "Get a pick to watch" },
	{
		name: "together",
		description: "Choose what to watch together with private votes",
	},
	{
		name: "similar",
		description: "Find titles similar to a movie or TV show",
	},
	{ name: "hot", description: "Titles hot on socials right now" },
]

export default function DiscordBot() {
	return (
		<div className="mx-auto flex w-full max-w-6xl flex-col gap-20 px-4 py-8 pb-24 text-gray-300 sm:px-8 md:gap-28 md:py-14">
			<Hero />
			<Setup />
			<Commands />
			<Together />
			<Linking />
			<Faq />
		</div>
	)
}

function AddButton({ className = "" }: { className?: string }) {
	// A document request: /discord/add redirects to discord.com.
	return (
		<a
			href={DISCORD_ADD_PATH}
			className={`inline-flex min-h-12 items-center justify-center gap-2.5 rounded-lg bg-amber-700 px-5 py-3 font-semibold text-white transition hover:bg-amber-600 focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900 focus-visible:outline-none ${className}`}
		>
			<DiscordMark className="h-5 w-5" />
			Add to Discord
		</a>
	)
}

function Hero() {
	return (
		<header className="grid grid-cols-1 items-center gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,32rem)] lg:gap-14">
			<div className="flex flex-col gap-5">
				<Kicker>Discord bot</Kicker>
				<h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl">
					GoodWatch in Discord
				</h1>
				<p className="max-w-xl text-lg leading-relaxed text-gray-300 sm:text-xl">
					Find something to watch, decide as a group, and keep your library up
					to date without leaving the chat.
				</p>
				<div className="flex flex-wrap items-center gap-3">
					<AddButton />
					<a
						href="#setup"
						className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-white/[0.06] px-5 py-3 font-semibold text-gray-100 ring-1 ring-white/10 transition hover:bg-white/10"
					>
						How to set it up
					</a>
				</div>
				<ul className="flex flex-col gap-2 text-sm text-gray-400 sm:flex-row sm:flex-wrap sm:gap-x-6">
					<HeroFact icon={SparklesIcon}>Free</HeroFact>
					<HeroFact icon={UserIcon}>No GoodWatch account needed</HeroFact>
					<HeroFact icon={ServerStackIcon}>
						Servers, DMs, and group DMs
					</HeroFact>
				</ul>
			</div>
			<DiscordWindow label="The GoodWatch bot answers /search with a title card for Project Hail Mary: backdrop, poster, score, where to watch, and buttons">
				<BotMessage command="/search" ephemeral>
					<TitleCard
						title={PROJECT_HAIL_MARY}
						country="Germany"
						flag="🇩🇪"
						priority
					/>
				</BotMessage>
			</DiscordWindow>
		</header>
	)
}

function HeroFact({
	icon: Icon,
	children,
}: {
	icon: ComponentType<SVGProps<SVGSVGElement>>
	children: ReactNode
}) {
	return (
		<li className="flex items-center gap-2">
			<Icon className="h-4 w-4 shrink-0 text-amber-400" aria-hidden="true" />
			{children}
		</li>
	)
}

function SectionHeading({
	id,
	title,
	children,
}: { id?: string; title: string; children?: ReactNode }) {
	return (
		<div className="flex max-w-2xl flex-col gap-3">
			<h2
				id={id}
				className="scroll-mt-24 text-3xl font-bold tracking-tight text-white sm:text-4xl"
			>
				{title}
			</h2>
			{children && (
				<p className="text-lg leading-relaxed text-gray-300">{children}</p>
			)}
		</div>
	)
}

function Setup() {
	return (
		<section aria-labelledby="setup" className="flex flex-col gap-10">
			<SectionHeading id="setup" title="Set it up in three steps">
				It takes about a minute. You need a Discord account.
			</SectionHeading>
			<ol>
				<Step n={1} title="Open the install link">
					<p className="leading-relaxed">
						Press <strong className="text-white">Add to Discord</strong>.
						Discord opens and asks where to add GoodWatch. To share the link,
						copy this address:
					</p>
					<code className="w-fit max-w-full rounded-lg bg-gray-950 px-3 py-2 font-mono text-[0.95em] break-all text-gray-100 ring-1 ring-gray-700 select-all">
						{DISCORD_ADD_URL}
					</code>
					<AddButton className="w-fit" />
				</Step>

				<Step n={2} title="Choose My Apps or Server">
					<div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,26rem)]">
						<div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
							<Choice
								icon={UserIcon}
								title="Add to My Apps"
								hint="For you, everywhere"
							>
								Use the commands in any server, in DMs, and in group DMs, even
								where GoodWatch isn't added. The answers are private.
							</Choice>
							<Choice
								icon={UserGroupIcon}
								title="Add to Server"
								hint="For everyone in a server"
							>
								Everyone in the server can use the commands.{" "}
								<CommandName>/together</CommandName> needs this. Admins can run{" "}
								<CommandName>/setup</CommandName> to set the server's country
								and streaming services.
							</Choice>
						</div>
						<InstallDialog />
					</div>
					<p className="text-sm text-gray-400">
						You can do both. To add GoodWatch to a server, you need the Manage
						Server permission there.
					</p>
				</Step>

				<Step n={3} title="Type / in Discord" last>
					<div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,26rem)]">
						<div className="flex flex-col gap-3 leading-relaxed">
							<p>
								In any message box, type <CommandName>/</CommandName> and pick a
								GoodWatch command. Start with <CommandName>/search</CommandName>{" "}
								and a title you like, or <CommandName>/watch</CommandName> for a
								pick to watch.
							</p>
							<p>
								Only you see the answers. To show a title to everyone in the
								channel, press{" "}
								<strong className="text-white">Share to channel</strong>.
							</p>
						</div>
						<SlashMenu commands={MENU_COMMANDS} />
					</div>
				</Step>
			</ol>
		</section>
	)
}

function Step({
	n,
	title,
	last = false,
	children,
}: { n: number; title: string; last?: boolean; children: ReactNode }) {
	return (
		<li className="grid grid-cols-[2.5rem_minmax(0,1fr)] gap-x-4 sm:grid-cols-[3rem_minmax(0,1fr)] sm:gap-x-6">
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

function Choice({
	icon: Icon,
	title,
	hint,
	children,
}: {
	icon: ComponentType<SVGProps<SVGSVGElement>>
	title: string
	hint: string
	children: ReactNode
}) {
	return (
		<div className="flex flex-col gap-2 rounded-2xl bg-white/[0.04] p-4 ring-1 ring-white/10">
			<div className="flex items-center gap-3">
				<span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 ring-1 ring-amber-500/30">
					<Icon className="h-5 w-5 text-amber-400" aria-hidden="true" />
				</span>
				<div className="flex flex-col">
					<span className="font-semibold text-white">{title}</span>
					<span className="text-sm text-gray-400">{hint}</span>
				</div>
			</div>
			<p className="leading-relaxed">{children}</p>
		</div>
	)
}

function CommandName({ children }: { children: ReactNode }) {
	return (
		<code className="rounded bg-[#5865f2]/20 px-1.5 py-0.5 font-mono text-[0.9em] font-semibold whitespace-nowrap text-[#c9cdfb]">
			{children}
		</code>
	)
}

interface CommandInfo {
	name: string
	does: ReactNode
}

const EVERYONE: CommandInfo[] = [
	{
		name: "/search",
		does: "Find a title, a person, or a mood like “dark vibes”. For a mood, the answer shows what your search reads as.",
	},
	{
		name: "/discover",
		does: "Browse by type, mood, theme, style, release period, score, anime, length, genre, and service, in the order you choose.",
	},
	{
		name: "/watch",
		does: "Get one pick to watch. Press Another for the next one.",
	},
	{ name: "/similar", does: "Find titles similar to a movie or show." },
	{ name: "/person", does: "Find a person and the titles they're known for." },
	{
		name: "/hot",
		does: "See the titles hot on socials right now and what people say about them.",
	},
]

const SERVER: CommandInfo[] = [
	{
		name: "/together",
		does: "Choose what to watch as a group, with private votes.",
	},
	{
		name: "/setup",
		does: "Set the server's country and streaming services. For admins with the Manage Server permission.",
	},
]

const MEMBER: CommandInfo[] = [
	{ name: "/link", does: "Link your GoodWatch account." },
	{
		name: "/next",
		does: "See the next episodes of the shows you're watching.",
	},
	{ name: "/rate", does: "Rate a title from 1 to 10." },
	{ name: "/seen", does: "Log that you watched a title today." },
	{ name: "/unlink", does: "Unlink your GoodWatch account." },
]

function Commands() {
	return (
		<section aria-labelledby="commands" className="flex flex-col gap-10">
			<SectionHeading id="commands" title="Commands">
				Title cards show the GoodWatch score, where to stream on subscription
				services, and a menu to switch the country.
			</SectionHeading>
			<div className="grid grid-cols-1 gap-4 md:grid-cols-3">
				<CommandGroup
					icon={UserIcon}
					title="For everyone"
					hint="No GoodWatch account needed"
					items={EVERYONE}
				/>
				<CommandGroup
					icon={UserGroupIcon}
					title="In a server"
					hint="Needs Add to Server"
					items={SERVER}
				/>
				<CommandGroup
					icon={LinkIcon}
					title="With a linked account"
					hint="Free GoodWatch account"
					items={MEMBER}
				/>
			</div>
		</section>
	)
}

function CommandGroup({
	icon: Icon,
	title,
	hint,
	items,
}: {
	icon: ComponentType<SVGProps<SVGSVGElement>>
	title: string
	hint: string
	items: CommandInfo[]
}) {
	return (
		<div className="flex flex-col gap-4 rounded-2xl bg-white/[0.04] p-5 ring-1 ring-white/10">
			<div className="flex items-center gap-3">
				<span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 ring-1 ring-amber-500/30">
					<Icon className="h-5 w-5 text-amber-400" aria-hidden="true" />
				</span>
				<div className="flex flex-col">
					<h3 className="font-semibold text-white">{title}</h3>
					<p className="text-sm text-gray-400">{hint}</p>
				</div>
			</div>
			<dl className="flex flex-col gap-3">
				{items.map(({ name, does }) => (
					<div key={name} className="flex flex-col gap-1">
						<dt>
							<CommandName>{name}</CommandName>
						</dt>
						<dd className="text-sm leading-relaxed text-gray-300">{does}</dd>
					</div>
				))}
			</dl>
		</div>
	)
}

function Together() {
	return (
		<section aria-labelledby="together" className="flex flex-col gap-10">
			<SectionHeading id="together" title="Decide what to watch together">
				Run <CommandName>/together</CommandName> in a channel. Everyone who
				joins votes Yep or Nope on the same titles in private. A title that
				everyone likes becomes a match, and when everyone picks the same match,
				the bot announces it.
			</SectionHeading>
			<div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
				<div className="flex min-w-0 flex-col gap-3">
					<p className="text-sm font-semibold text-gray-400">
						In the channel, for everyone
					</p>
					<DiscordWindow label="The public /together message: 4 participants, Spirited Away is a match and Coco is a possible match">
						<BotMessage command="/together">
							<TogetherMessage
								starter="alp"
								choice="Movies · Feel-good"
								participants={4}
								stillVoting={2}
								country="Germany"
								rows={[
									{ title: SPIRITED_AWAY, label: "Match · picked by 2 of 4" },
									{
										title: COCO,
										label: "Possible match · waiting for 2 people",
									},
								]}
							/>
						</BotMessage>
					</DiscordWindow>
				</div>
				<div className="flex min-w-0 flex-col gap-3">
					<p className="text-sm font-semibold text-gray-400">
						After Join, only for you
					</p>
					<DiscordWindow label="A private voting card for Howl's Moving Castle with Yep, Nope, Undo, and Leave">
						<BotMessage ephemeral>
							<VoteCard
								title={HOWLS_MOVING_CASTLE}
								position={7}
								deck={30}
								country="Germany"
								trailer
							/>
						</BotMessage>
					</DiscordWindow>
					<ul className="flex flex-col gap-2 pt-2 text-sm leading-relaxed text-gray-400">
						<li>Nobody sees anyone else's votes.</li>
						<li>The starter can end the session. It closes after 24 hours.</li>
						<li>
							<CommandName>/together</CommandName> needs GoodWatch added to the
							server.
						</li>
					</ul>
				</div>
			</div>
		</section>
	)
}

function Linking() {
	return (
		<section
			aria-labelledby="link"
			className="grid grid-cols-1 items-start gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,30rem)] lg:gap-14"
		>
			<div className="flex flex-col gap-6">
				<SectionHeading id="link" title="Link your GoodWatch account">
					The bot works without an account. Link one to make every answer fit
					your taste.
				</SectionHeading>
				<ul className="flex flex-col gap-3 leading-relaxed">
					<Benefit>Your taste match on every title.</Benefit>
					<Benefit>
						Picks from your own streaming services with{" "}
						<CommandName>/watch</CommandName>.
					</Benefit>
					<Benefit>
						Want to See, Seen, and Rate buttons on every title card, each with
						Undo.
					</Benefit>
					<Benefit>
						Your next episodes with <CommandName>/next</CommandName>, and{" "}
						<CommandName>/rate</CommandName> and{" "}
						<CommandName>/seen</CommandName> from any chat.
					</Benefit>
				</ul>
				<div className="flex flex-col gap-3 leading-relaxed">
					<p>
						Run <CommandName>/link</CommandName>. It opens goodwatch.app, where
						you sign in and continue with Discord. Discord shares only your user
						ID and username.
					</p>
					<p>
						Only you see your personal answers. When you press Share to channel,
						the bot posts the card without your personal part. Run{" "}
						<CommandName>/unlink</CommandName> any time.
					</p>
				</div>
			</div>
			<DiscordWindow label="The answer to /link, and the personal part of a title card: taste match and the Want to see, Seen, and Rate buttons">
				<BotMessage command="/link" ephemeral>
					<LinkCard />
				</BotMessage>
				<BotMessage command="/search" ephemeral>
					<MemberBlock
						match={88}
						state="Seen  ·  You rated it 7 · Great"
						seen
						rated
					/>
				</BotMessage>
			</DiscordWindow>
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

function Faq() {
	return (
		<section aria-labelledby="faq" className="flex flex-col gap-8">
			<SectionHeading id="faq" title="Questions" />
			<div className="flex max-w-3xl flex-col divide-y divide-white/10 rounded-2xl bg-white/[0.04] ring-1 ring-white/10">
				<Question q="Is it free?">
					Yes. The bot is free, and so is a GoodWatch account.
				</Question>
				<Question q="Do I need a GoodWatch account?">
					No. Search, Discover, picks, and <CommandName>/together</CommandName>{" "}
					work without one. Link an account when you want matches, your own
					services, and your library.{" "}
					<Link to="/sign-up" prefetch="intent" className={linkClass}>
						Create an account
					</Link>
				</Question>
				<Question q="Should I add it to My Apps or to a server?">
					Add it to My Apps to use it yourself anywhere, including DMs. Add it
					to a server so everyone there can use it and run{" "}
					<CommandName>/together</CommandName>. You can do both.
				</Question>
				<Question q="Who sees the bot's answers?">
					Only you, unless you press Share to channel. The{" "}
					<CommandName>/together</CommandName> message is public in the channel,
					and the votes stay private.
				</Question>
				<Question q="What data does it keep?">
					For a linked account, your Discord user ID and username and when you
					linked them. For a server, the country and services set with{" "}
					<CommandName>/setup</CommandName>. Votes from{" "}
					<CommandName>/together</CommandName> expire within 48 hours after the
					session closes. The bot doesn't log message content or what you search
					for.{" "}
					<Link to={PRIVACY_PATH} className={linkClass}>
						Read the privacy policy
					</Link>
				</Question>
				<Question q="Something isn't working?">
					Write to us on the{" "}
					<Link to="/support" prefetch="intent" className={linkClass}>
						Support
					</Link>{" "}
					page, or ask in the{" "}
					<a
						href={DISCORD_URL}
						target="_blank"
						rel="noreferrer"
						className={linkClass}
					>
						GoodWatch Discord server
					</a>
					.
				</Question>
			</div>
			<div className="flex flex-col items-start gap-4 pt-4">
				<p className="text-lg text-gray-300">Ready to try it?</p>
				<AddButton />
			</div>
		</section>
	)
}

function Question({ q, children }: { q: string; children: ReactNode }) {
	return (
		<details className="group px-5 py-4">
			<summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold text-white [&::-webkit-details-marker]:hidden">
				{q}
				<ChevronDownIcon
					className="h-5 w-5 shrink-0 text-gray-400 transition-transform group-open:rotate-180"
					aria-hidden="true"
				/>
			</summary>
			<p className="pt-3 leading-relaxed text-gray-300">{children}</p>
		</details>
	)
}
