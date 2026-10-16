// The help page for the GoodWatch connector (/connect, #571): how to add GoodWatch to Claude, Claude Code and
// ChatGPT, what a connected app can do, and how to disconnect it. The menu names are the apps' own, as their help
// pages had them on October 14, 2026 (support.claude.com, code.claude.com/docs, developers.openai.com and
// help.openai.com); they move from time to time, so each section also says what to look for.
import {
	CheckIcon,
	EyeIcon,
	NoSymbolIcon,
	PencilSquareIcon,
} from "@heroicons/react/24/outline"
import { Link } from "@remix-run/react"
import type { ReactNode } from "react"
import { AppBadge, type AppKey } from "~/ui/connector/AppBadge"
import {
	APP_CAN_CHANGE,
	APP_CAN_NEVER,
	APP_CAN_SEE,
	CLAUDE_CODE_NAME,
	CONNECTED_APPS_PATH,
	CONNECTOR_NAME,
	CONNECTOR_URL,
	PRIVACY_CONNECTED_APPS_PATH,
	RANKED_SEARCHES_PER_DAY,
} from "~/ui/connector/connector"
import { ConnectorAddressCard } from "~/ui/connector/ConnectorAddressCard"
import { CopyField } from "~/ui/connector/CopyField"

const ADD_COMMAND = `claude mcp add --transport http --scope user ${CLAUDE_CODE_NAME} ${CONNECTOR_URL}`
const REMOVE_COMMAND = `claude mcp remove ${CLAUDE_CODE_NAME}`

const APPS: {
	key: AppKey
	id: string
	name: string
	where: string
	plans: string
}[] = [
	{
		key: "claude",
		id: "claude",
		name: "Claude",
		where: "claude.ai and the Claude apps",
		plans: "Every plan. Free has room for one custom connector.",
	},
	{
		key: "claude-code",
		id: "claude-code",
		name: "Claude Code",
		where: "In your terminal",
		plans: "Every plan that includes Claude Code.",
	},
	{
		key: "chatgpt",
		id: "chatgpt",
		name: "ChatGPT",
		where: "chatgpt.com in a browser",
		plans: "Full access on Business, Enterprise and Edu.",
	},
]

const EXAMPLES = [
	"What should I watch tonight? Something funny, under two hours.",
	"I just watched episode 4 of Severance season 2.",
	"Where am I in The Bear?",
	"Rate Dune: Part Two 9 out of 10.",
	"Put Past Lives on my Wishlist.",
	"I moved to Germany and have Netflix and Disney+ now.",
]

export function ConnectorHelp() {
	return (
		<div className="mx-auto flex w-full max-w-3xl flex-col gap-14 px-4 py-8 text-gray-300 sm:px-8 md:py-12">
			<header className="flex flex-col gap-4">
				<p className="text-sm font-semibold uppercase tracking-wider text-amber-500">
					Connected apps
				</p>
				<h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
					Use GoodWatch in Claude and ChatGPT
				</h1>
				<p className="text-lg leading-relaxed text-gray-300">
					Add GoodWatch to your AI assistant. Then ask it what to watch tonight,
					tell it what you just watched, or rate a title, in your own words. It
					works with your GoodWatch account: your ratings, your shows, your
					streaming services.
				</p>
				<p className="text-gray-400">
					You need a free GoodWatch account.{" "}
					<Link
						to="/sign-up"
						className="font-semibold text-amber-500 hover:text-amber-400"
					>
						Sign up
					</Link>{" "}
					if you don't have one yet.
				</p>
				<ConnectorAddressCard title="The connector address" helpLink={false} />
			</header>

			<nav aria-label="Pick your app" className="grid gap-3 sm:grid-cols-3">
				{APPS.map((app) => (
					<a
						key={app.id}
						href={`#${app.id}`}
						className="group flex items-start gap-3 rounded-xl border border-gray-700 bg-gray-800/40 p-4 transition hover:border-amber-600 hover:bg-gray-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
					>
						<AppBadge app={app.key} size="sm" />
						<span className="min-w-0">
							<span className="block font-semibold text-gray-100 group-hover:text-white">
								{app.name}
							</span>
							<span className="block text-sm text-gray-400">{app.where}</span>
						</span>
					</a>
				))}
			</nav>

			<AppSection app={APPS[0]}>
				<Steps>
					<Step>
						On claude.ai, open <Ui>Customize</Ui>, then <Ui>Connectors</Ui>.
					</Step>
					<Step>
						Press <Ui>+ Add</Ui>, then <Ui>Add custom connector</Ui>.
					</Step>
					<Step>
						Name it <Ui>{CONNECTOR_NAME}</Ui>, paste the address and press{" "}
						<Ui>Continue</Ui>.
						<div className="mt-2">
							<CopyField
								text={CONNECTOR_URL}
								label="Copy the connector address"
							/>
						</div>
					</Step>
					<Step>
						Keep the sign-in settings Claude suggests and press <Ui>Add</Ui>.
					</Step>
					<Step>
						Press <Ui>Connect</Ui> next to GoodWatch. GoodWatch opens: sign in
						and press <Ui>Allow</Ui>.
					</Step>
					<Step>
						In a chat, press <Ui>+</Ui>, then <Ui>Connectors</Ui>, and switch
						GoodWatch on.
					</Step>
				</Steps>
				<Aside title="On a Team or Enterprise plan">
					An owner of your organization adds GoodWatch once, under{" "}
					<Ui>Organization settings</Ui> → <Ui>Connectors</Ui> → <Ui>Add</Ui> →{" "}
					<Ui>Custom</Ui> → <Ui>Web</Ui>. Then everyone presses <Ui>Connect</Ui>{" "}
					under <Ui>Customize</Ui> → <Ui>Connectors</Ui> and signs in with their
					own GoodWatch account.
				</Aside>
			</AppSection>

			<AppSection app={APPS[1]}>
				<Steps>
					<Step>
						In a terminal, add GoodWatch for all your projects:
						<div className="mt-2">
							<CopyField
								text={ADD_COMMAND}
								label="Copy the command that adds GoodWatch"
							/>
						</div>
					</Step>
					<Step>
						Start Claude Code and type <Code>/mcp</Code>. Pick{" "}
						<Code>{CLAUDE_CODE_NAME}</Code> and sign in to GoodWatch in the
						browser window that opens. Press <Ui>Allow</Ui>.
					</Step>
					<Step>
						Ask away. Claude Code keeps you signed in and renews the access by
						itself.
					</Step>
				</Steps>
				<p className="text-sm text-gray-400">
					Each computer you connect gets its own line in Connected apps, so you
					can disconnect one without the others.
				</p>
			</AppSection>

			<AppSection app={APPS[2]}>
				<div className="overflow-hidden rounded-xl border border-gray-700">
					<table className="w-full text-left text-sm">
						<caption className="sr-only">
							What GoodWatch can do in ChatGPT, by plan
						</caption>
						<thead className="bg-gray-800/70 text-gray-300">
							<tr>
								<th scope="col" className="px-4 py-2.5 font-semibold">
									ChatGPT plan
								</th>
								<th scope="col" className="px-4 py-2.5 font-semibold">
									What GoodWatch can do
								</th>
							</tr>
						</thead>
						<tbody className="divide-y divide-gray-800 bg-gray-900/40">
							<tr>
								<td className="px-4 py-3 text-gray-100">
									Business, Enterprise, Edu
								</td>
								<td className="px-4 py-3 text-amber-300">See and change</td>
							</tr>
							<tr>
								<td className="px-4 py-3 text-gray-100">Pro</td>
								<td className="px-4 py-3 text-sky-300">
									See only: ChatGPT can read your GoodWatch but can't log, rate
									or change anything
								</td>
							</tr>
						</tbody>
					</table>
				</div>
				<p className="text-sm text-gray-400">
					OpenAI decides which plans get custom connectors, and it changes.
					Custom connectors work on chatgpt.com in a browser, not in the ChatGPT
					phone app.
				</p>
				<Steps>
					<Step>
						On Business, Enterprise and Edu, a workspace admin first allows
						custom connectors: <Ui>Workspace settings</Ui> →{" "}
						<Ui>Permissions & roles</Ui> → <Ui>Developer mode</Ui>.
					</Step>
					<Step>
						Turn on <Ui>Developer mode</Ui> in ChatGPT's settings. If you don't
						find it, search the settings for "Developer mode".
					</Step>
					<Step>
						Open <Ui>Plugins</Ui>, press <Ui>+</Ui> and choose{" "}
						<Ui>Add custom MCP server</Ui>.
					</Step>
					<Step>
						Name it <Ui>{CONNECTOR_NAME}</Ui>, paste the address and choose{" "}
						<Ui>OAuth</Ui> as the sign-in. Confirm ChatGPT's warning and create
						it.
						<div className="mt-2">
							<CopyField
								text={CONNECTOR_URL}
								label="Copy the connector address"
							/>
						</div>
					</Step>
					<Step>
						GoodWatch opens: sign in and press <Ui>Allow</Ui>.
					</Step>
					<Step>
						In a chat, type <Code>@</Code> and pick GoodWatch.
					</Step>
				</Steps>
			</AppSection>

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
					If you don't say when you watched something, GoodWatch saves the watch
					without a date. Your assistant finds titles by name as often as you
					like; searching by description ("a slow sci-fi like Arrival") is
					limited to {RANKED_SEARCHES_PER_DAY} searches a day.
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
					<Link
						to={PRIVACY_CONNECTED_APPS_PATH}
						className="font-semibold text-amber-500 hover:text-amber-400"
					>
						ours explains what GoodWatch keeps
					</Link>
					.
				</p>
			</section>

			<section aria-labelledby="disconnect" className="flex flex-col gap-4">
				<SectionHeading id="disconnect">Disconnect an app</SectionHeading>
				<p className="leading-relaxed">
					On GoodWatch, open{" "}
					<Link
						to={CONNECTED_APPS_PATH}
						className="font-semibold text-amber-500 hover:text-amber-400"
					>
						Settings → Connected apps
					</Link>{" "}
					and press <Ui>Disconnect</Ui>. The app loses access right away.
					Nothing you saved on GoodWatch is lost.
				</p>
				<ul className="flex flex-col gap-3 text-sm leading-relaxed">
					<li className="flex gap-3">
						<AppBadge app="claude" size="sm" />
						<span className="min-w-0 self-center">
							In Claude: <Ui>Customize</Ui> → <Ui>Connectors</Ui>, then{" "}
							<Ui>Remove</Ui> next to GoodWatch.
						</span>
					</li>
					<li className="flex gap-3">
						<AppBadge app="claude-code" size="sm" />
						<span className="flex min-w-0 flex-1 flex-col gap-2 self-center">
							In Claude Code:
							<CopyField
								text={REMOVE_COMMAND}
								label="Copy the command that removes GoodWatch"
							/>
						</span>
					</li>
					<li className="flex gap-3">
						<AppBadge app="chatgpt" size="sm" />
						<span className="min-w-0 self-center">
							In ChatGPT: remove GoodWatch from your plugins.
						</span>
					</li>
				</ul>
				<p className="text-sm text-gray-400">
					Removing GoodWatch in the app deletes the app's key. Disconnecting on
					GoodWatch cancels it on our side too, so do both to be sure.
				</p>
			</section>

			<section aria-labelledby="problems" className="flex flex-col gap-5">
				<SectionHeading id="problems">If something doesn't work</SectionHeading>
				<Question q="My assistant says GoodWatch isn't connected.">
					Connect it again from the app (in Claude, <Ui>Connect</Ui> under{" "}
					<Ui>Customize</Ui> → <Ui>Connectors</Ui>; in Claude Code,{" "}
					<Code>/mcp</Code>). Your GoodWatch data stays as it was.
				</Question>
				<Question q="I sign in to GoodWatch with Google.">
					On the GoodWatch page that opens, choose <Ui>Continue with Google</Ui>
					.
				</Question>
				<Question q="ChatGPT reads my GoodWatch but can't change anything.">
					Your ChatGPT plan allows reading only. See the plans above.
				</Question>
				<Question q="Can I use another app?">
					Any app that supports remote MCP connectors with sign-in can connect,
					for example VS Code or Cursor. If an app doesn't publish who made it,
					GoodWatch marks it as unverified before you allow it. Only allow apps
					you trust.
				</Question>
				<p className="text-sm text-gray-400">
					Still stuck? Write to{" "}
					<a
						href="mailto:hello@goodwatch.app"
						className="font-semibold text-amber-500 hover:text-amber-400"
					>
						hello@goodwatch.app
					</a>
					.
				</p>
			</section>
		</div>
	)
}

function AppSection({
	app,
	children,
}: { app: (typeof APPS)[number]; children: ReactNode }) {
	return (
		<section
			id={app.id}
			aria-labelledby={`${app.id}-title`}
			className="flex scroll-mt-24 flex-col gap-5"
		>
			<div className="flex items-center gap-4">
				<AppBadge app={app.key} />
				<div className="min-w-0">
					<h2
						id={`${app.id}-title`}
						className="text-2xl font-bold tracking-tight text-white"
					>
						{app.name}
					</h2>
					<p className="text-sm text-gray-400">{app.plans}</p>
				</div>
			</div>
			{children}
		</section>
	)
}

function SectionHeading({ id, children }: { id: string; children: ReactNode }) {
	return (
		<h2
			id={id}
			className="scroll-mt-24 text-2xl font-bold tracking-tight text-white"
		>
			{children}
		</h2>
	)
}

function Steps({ children }: { children: ReactNode }) {
	return (
		<ol className="flex flex-col gap-4 [counter-reset:step]">{children}</ol>
	)
}

function Step({ children }: { children: ReactNode }) {
	return (
		<li className="flex gap-3 leading-relaxed [counter-increment:step] before:flex before:h-7 before:w-7 before:shrink-0 before:items-center before:justify-center before:rounded-full before:bg-gray-800 before:text-sm before:font-bold before:text-amber-400 before:ring-1 before:ring-gray-700 before:content-[counter(step)]">
			<div className="min-w-0 flex-1 pt-0.5">{children}</div>
		</li>
	)
}

// A button or menu name in the other app, as it is labelled there.
function Ui({ children }: { children: ReactNode }) {
	return (
		<span className="whitespace-nowrap rounded bg-gray-800 px-1.5 py-0.5 text-[0.92em] font-semibold text-gray-100 ring-1 ring-gray-700">
			{children}
		</span>
	)
}

function Code({ children }: { children: ReactNode }) {
	return (
		<code className="rounded bg-gray-950 px-1.5 py-0.5 font-mono text-[0.9em] text-gray-100 ring-1 ring-gray-700">
			{children}
		</code>
	)
}

function Aside({ title, children }: { title: string; children: ReactNode }) {
	return (
		<div className="rounded-xl border border-gray-700 bg-gray-800/30 p-4 text-sm leading-relaxed text-gray-300">
			<p className="mb-1 font-semibold text-gray-100">{title}</p>
			{children}
		</div>
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

function Question({ q, children }: { q: string; children: ReactNode }) {
	return (
		<div>
			<h3 className="font-semibold text-gray-100">{q}</h3>
			<p className="mt-1 leading-relaxed text-gray-300">{children}</p>
		</div>
	)
}
