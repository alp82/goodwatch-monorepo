// The help page for the GoodWatch connector (/connect): the address to copy, a guide per app (one-click install links
// where the app has them, terminal commands, step-by-step menus), what the member sees while connecting, things to
// ask, what a connected app can do, how to disconnect, and what to do when something doesn't work.
// The app guides live in ClientGuides.tsx; the sources behind them are in
// docs/implementation/mcp-distribution-research.md.
import {
	CheckIcon,
	Cog6ToothIcon,
	EyeIcon,
	KeyIcon,
	NoSymbolIcon,
	PencilSquareIcon,
	ShieldCheckIcon,
} from "@heroicons/react/24/outline"
import { Link } from "@remix-run/react"
import type { ComponentType, ReactNode, SVGProps } from "react"
import { CHECKED_ON } from "~/ui/connector/ClientGuides"
import { ClientPicker } from "~/ui/connector/ClientPicker"
import { CopyField } from "~/ui/connector/CopyField"
import {
	APP_CAN_CHANGE,
	APP_CAN_NEVER,
	APP_CAN_SEE,
	CONNECTED_APPS_PATH,
	CONNECTOR_URL,
	PRIVACY_CONNECTED_APPS_PATH,
	RANKED_SEARCHES_PER_DAY,
} from "~/ui/connector/connector"
import { Code, Question, SectionHeading, Ui } from "~/ui/connector/help-parts"

// The MCP endpoint's limits per member (endpoint.server.ts).
const REQUESTS_PER_MINUTE = 60
const REQUESTS_PER_HOUR = "1,000"

const EXAMPLES = [
	"What should I watch next?",
	"Sort my Wishlist by best match for me.",
	"Movies like Arrival, but a bit lighter.",
	"What's good on Netflix for me tonight?",
	"I just watched episode 4 of Severance season 2.",
	"Rate Dune: Part Two 9 out of 10.",
]

const linkClass = "font-semibold text-amber-500 hover:text-amber-400"

export function ConnectorHelp() {
	return (
		<div className="mx-auto flex w-full max-w-3xl flex-col gap-14 px-4 py-8 text-gray-300 sm:px-8 md:py-12">
			<header className="flex flex-col gap-4">
				<p className="text-sm font-semibold uppercase tracking-wider text-amber-500">
					Connected apps
				</p>
				<h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
					Use GoodWatch in your AI assistant
				</h1>
				<p className="text-lg leading-relaxed text-gray-300">
					Add GoodWatch to Claude, ChatGPT, Cursor, VS Code and other AI apps.
					Then ask what to watch next, sort your Wishlist by how well it fits
					you, or log what you just watched, in your own words. It works with
					your GoodWatch account: your ratings, your shows, your streaming
					services.
				</p>
				<div className="rounded-2xl bg-gradient-to-br from-amber-950/60 via-gray-900 to-gray-900 p-4 ring-1 ring-amber-500/30 sm:p-6">
					<p className="font-semibold text-white">Your GoodWatch address</p>
					<p className="mt-1 text-sm text-gray-400">
						Every app asks for this. You then sign in with your GoodWatch
						account and allow the app once.
					</p>
					<div className="mt-4">
						<CopyField
							text={CONNECTOR_URL}
							label="Copy the connector address"
							size="lg"
						/>
					</div>
				</div>
				<p className="text-sm text-gray-400">
					You need a free GoodWatch account.{" "}
					<Link to="/sign-up" className={linkClass}>
						Sign up
					</Link>{" "}
					if you don't have one yet.
				</p>
			</header>

			<section aria-labelledby="pick" className="flex flex-col gap-4">
				<div>
					<SectionHeading id="pick">Pick your app</SectionHeading>
					<p className="mt-1 text-sm text-gray-400">
						<span className="font-semibold text-emerald-300">Tested</span> means
						we connected GoodWatch with that app ourselves.{" "}
						<span className="font-semibold text-gray-200">Should work</span>{" "}
						means we followed the app's own setup guide but haven't tried it
						yet. Any other app that supports remote MCP connectors with sign-in
						can use the same address.
					</p>
				</div>
				<ClientPicker />
			</section>

			<section aria-labelledby="see" className="flex flex-col gap-4">
				<SectionHeading id="see">What you'll see</SectionHeading>
				<ol className="grid gap-3 md:grid-cols-3">
					<SeeStep n={1} icon={KeyIcon} title="Sign in to GoodWatch">
						A GoodWatch page opens in your browser. Sign in the way you always
						do, with your email or with Google.
					</SeeStep>
					<SeeStep n={2} icon={ShieldCheckIcon} title="Choose what it may do">
						Pick <Ui>Read and change my GoodWatch</Ui> so the app can log
						watches and rate titles, or <Ui>Read-only</Ui>. Then press{" "}
						<Ui>Allow</Ui>.
					</SeeStep>
					<SeeStep n={3} icon={Cog6ToothIcon} title="Find it in Settings">
						The app shows up in{" "}
						<Link to={CONNECTED_APPS_PATH} className={linkClass}>
							Settings → Connected apps
						</Link>
						, where you can disconnect it any time.
					</SeeStep>
				</ol>
			</section>

			<section aria-labelledby="try" className="flex flex-col gap-4">
				<SectionHeading id="try">Things to ask</SectionHeading>
				<ul className="grid gap-2 sm:grid-cols-2">
					{EXAMPLES.map((example) => (
						<li
							key={example}
							className="rounded-xl bg-gray-800/50 px-4 py-3 text-gray-200 ring-1 ring-gray-700/70"
						>
							“{example}”
						</li>
					))}
				</ul>
				<p className="text-sm leading-relaxed text-gray-400">
					In Claude and some other apps, answers come with poster cards; others
					show text only. If you don't say when you watched something, GoodWatch
					saves the watch without a date. Your assistant finds titles by name as
					often as you like; searching by description ("a slow sci-fi like
					Arrival") is limited to {RANKED_SEARCHES_PER_DAY} searches a day.
				</p>
			</section>

			<section aria-labelledby="access" className="flex flex-col gap-4">
				<SectionHeading id="access">What a connected app can do</SectionHeading>
				<div className="grid gap-3 md:grid-cols-3">
					<AccessList title="It can see" tone="see" items={APP_CAN_SEE} />
					<AccessList
						title="It can change"
						tone="change"
						items={APP_CAN_CHANGE}
					/>
					<AccessList title="It can never" tone="never" items={APP_CAN_NEVER} />
				</div>
				<p className="text-sm leading-relaxed text-gray-400">
					The assistant decides when to use GoodWatch, based on what you ask.
					Removing a watch, clearing a rating or changing your services is
					something your app may ask you to confirm first. How the app's maker
					treats what it reads is up to their privacy policy;{" "}
					<Link to={PRIVACY_CONNECTED_APPS_PATH} className={linkClass}>
						ours explains what GoodWatch keeps
					</Link>
					.
				</p>
			</section>

			<section aria-labelledby="disconnect" className="flex flex-col gap-4">
				<SectionHeading id="disconnect">Disconnect an app</SectionHeading>
				<p className="leading-relaxed">
					On GoodWatch, open{" "}
					<Link to={CONNECTED_APPS_PATH} className={linkClass}>
						Settings → Connected apps
					</Link>{" "}
					and press <Ui>Disconnect</Ui>. The app loses access right away.
					Nothing you saved on GoodWatch is lost. Claude Code gets one line per
					computer, so you can disconnect one without the others.
				</p>
				<p className="leading-relaxed">
					Then remove GoodWatch in the app too: in Claude, <Ui>Customize</Ui> →{" "}
					<Ui>Connectors</Ui> → <Ui>Remove</Ui>; in ChatGPT, remove the plugin;
					in a terminal app, for example{" "}
					<Code>claude mcp remove goodwatch</Code>.
				</p>
			</section>

			<section aria-labelledby="problems" className="flex flex-col gap-5">
				<SectionHeading id="problems">If something doesn't work</SectionHeading>
				<Question q="My assistant says GoodWatch isn't connected, or stopped working after an update.">
					Connect again from the app: in Claude, <Ui>Connect</Ui> under{" "}
					<Ui>Customize</Ui> → <Ui>Connectors</Ui>; in a terminal app, run its
					sign-in command again. Your GoodWatch data stays as it was.
				</Question>
				<Question q="New GoodWatch features don't show up.">
					Apps remember GoodWatch's list of tools from when you connected. Start
					a new chat first. If that doesn't help, refresh the tool list: in
					ChatGPT, open the GoodWatch plugin and press <Ui>Refresh</Ui>; in
					Claude, disconnect and connect GoodWatch again; in Cursor or VS Code,
					turn GoodWatch off and on in the MCP settings.
				</Question>
				<Question q="I can't find a place to add a custom connector.">
					Your plan or workspace may not allow it. As of {CHECKED_ON}: Claude
					Free has room for one custom connector, and on Team or Enterprise an
					owner adds it. ChatGPT allows full access on Business, Enterprise and
					Edu, read-only on Pro, and only on chatgpt.com in a browser. Plans
					change, so check the app's own help, linked under each guide.
				</Question>
				<Question q="It reads my GoodWatch but can't change anything.">
					When you connected, you may have picked <Ui>Read-only</Ui>. Disconnect
					the app in Settings → Connected apps, connect it again and pick{" "}
					<Ui>Read and change my GoodWatch</Ui>. On ChatGPT Pro, connectors can
					only read (as of {CHECKED_ON}).
				</Question>
				<Question q="The sign-in page opens, but the app never finishes connecting.">
					Update the app and try again. For desktop and terminal apps, the
					browser has to run on the same computer, and the browser may ask
					whether to open the app: allow it. Never paste a code or key from the
					sign-in into an email to anyone.
				</Question>
				<Question q="It says “too many requests”.">
					A connected app can ask GoodWatch {REQUESTS_PER_MINUTE} times a minute
					and {REQUESTS_PER_HOUR} times an hour. Wait a minute and ask again.
				</Question>
				<Question q="GoodWatch calls the app unverified.">
					Some apps don't publish who made them, so GoodWatch can't check. Only
					allow the app if you started the connection yourself, in an app you
					trust.
				</Question>
				<p className="text-sm text-gray-400">
					Still stuck? Write to{" "}
					<a href="mailto:hello@goodwatch.app" className={linkClass}>
						hello@goodwatch.app
					</a>{" "}
					and tell us which app you use.
				</p>
			</section>
		</div>
	)
}

function SeeStep({
	n,
	icon: Icon,
	title,
	children,
}: {
	n: number
	icon: ComponentType<SVGProps<SVGSVGElement>>
	title: string
	children: ReactNode
}) {
	return (
		<li className="flex flex-col gap-2 rounded-2xl bg-white/[0.04] p-4 ring-1 ring-white/10">
			<span className="flex items-center gap-2 font-semibold text-white">
				<span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-900/60 text-amber-300 ring-1 ring-amber-700/60">
					<Icon className="h-4 w-4" aria-hidden="true" />
				</span>
				<span>
					<span className="sr-only">Step {n}: </span>
					{title}
				</span>
			</span>
			<p className="text-sm leading-relaxed text-gray-300">{children}</p>
		</li>
	)
}

const TONES = {
	see: {
		icon: EyeIcon,
		box: "border-sky-900/80",
		head: "text-sky-300",
		mark: CheckIcon,
		markClass: "text-sky-400",
	},
	change: {
		icon: PencilSquareIcon,
		box: "border-amber-900/80",
		head: "text-amber-300",
		mark: CheckIcon,
		markClass: "text-amber-400",
	},
	never: {
		icon: NoSymbolIcon,
		box: "border-gray-700",
		head: "text-gray-200",
		mark: NoSymbolIcon,
		markClass: "text-gray-500",
	},
}

function AccessList({
	title,
	tone,
	items,
}: { title: string; tone: keyof typeof TONES; items: readonly string[] }) {
	const { icon: Icon, box, head, mark: Mark, markClass } = TONES[tone]
	return (
		<div className={`rounded-xl border bg-gray-800/30 p-4 ${box}`}>
			<p className={`mb-3 flex items-center gap-2 font-semibold ${head}`}>
				<Icon className="h-5 w-5" aria-hidden="true" />
				{title}
			</p>
			<ul className="flex flex-col gap-2 text-sm leading-snug">
				{items.map((item) => (
					<li key={item} className="flex gap-2">
						<Mark
							className={`mt-0.5 h-4 w-4 shrink-0 ${markClass}`}
							aria-hidden="true"
						/>
						<span>{item}</span>
					</li>
				))}
			</ul>
		</div>
	)
}
