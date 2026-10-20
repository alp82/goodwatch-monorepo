// Support: how to reach us, how to disconnect an app, the fixes for AI apps (moved here from the old /connect page),
// help with signing in, and the privacy policy. Styled like the Settings tiles.
import {
	ArrowRightIcon,
	ChatBubbleLeftRightIcon,
	EnvelopeIcon,
	KeyIcon,
	LinkSlashIcon,
	ShieldCheckIcon,
} from "@heroicons/react/24/outline"
import type { MetaFunction } from "@remix-run/node"
import { Link } from "@remix-run/react"
import type { ComponentType, ReactNode, SVGProps } from "react"
import {
	CONNECTED_APPS_PATH,
	RANKED_SEARCHES_PER_DAY,
	USE_WITH_AI_PATH,
} from "~/ui/connector/connector"
import { DESCRIPTION_SEARCH_EXAMPLE } from "~/ui/connector/example-prompts"
import { Ui } from "~/ui/connector/help-parts"
import { ACCOUNT_PATH } from "~/ui/settings/paths"
import { type PageMeta, buildMeta } from "~/utils/meta"

export { pageHeaders as headers } from "~/utils/headers"

const SUPPORT_EMAIL = "hello@goodwatch.app"
// The MCP endpoint's limits per member (endpoint.server.ts).
const REQUESTS_PER_MINUTE = 60
const REQUESTS_PER_HOUR = "1,000"
const AI_FIXES_ID = "ai-app-fixes"

export const meta: MetaFunction = () => {
	const pageMeta: PageMeta = {
		title: "Support | GoodWatch",
		description:
			"Get help with GoodWatch: write to us, disconnect an AI app, fix a connection to Claude or ChatGPT, sign in or reset your password.",
		url: "https://goodwatch.app/support",
		image: "https://goodwatch.app/images/heroes/hero-movies.png",
		alt: "GoodWatch Support",
	}

	return buildMeta({ pageMeta, items: [] })
}

const linkClass = "font-semibold text-amber-500 hover:text-amber-400"

export default function Support() {
	return (
		<div className="mx-auto max-w-5xl px-4 py-6 pb-24 text-gray-300 md:px-8 md:py-10">
			<header className="flex flex-col gap-5 rounded-2xl bg-gradient-to-br from-amber-950/70 via-gray-900 to-gray-900 p-5 ring-1 ring-amber-500/20 md:flex-row md:items-center md:justify-between md:p-8">
				<div className="flex flex-col gap-2">
					<h1 className="text-3xl font-bold tracking-tight text-white md:text-4xl">
						Support
					</h1>
					<p className="max-w-xl text-lg leading-relaxed text-gray-300">
						Something not working, or a question about your account? Write to
						us. We read every email.
					</p>
				</div>
				<div className="flex shrink-0 flex-col gap-2">
					<a
						href={`mailto:${SUPPORT_EMAIL}`}
						className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-amber-700 px-5 py-3 font-semibold text-white transition hover:bg-amber-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900"
					>
						<EnvelopeIcon className="h-5 w-5" aria-hidden="true" />
						{SUPPORT_EMAIL}
					</a>
					<p className="text-center text-sm text-gray-400">
						Write from your account's email address.
					</p>
				</div>
			</header>

			<div className="mt-4 grid gap-4 md:mt-6 md:grid-cols-2">
				<Tile
					icon={ChatBubbleLeftRightIcon}
					label="AI apps"
					hint="GoodWatch in Claude, ChatGPT and other assistants"
					more={{ to: `#${AI_FIXES_ID}`, text: "More fixes" }}
				>
					<Fix q="It says GoodWatch isn't connected.">
						Connect again from the app, for example in Claude under{" "}
						<Ui>Customize</Ui> → <Ui>Connectors</Ui>. Your GoodWatch data stays
						as it was.
					</Fix>
					<Fix q="New features don't show up.">
						Start a new chat. If that doesn't help, disconnect GoodWatch in the
						app and connect it again.
					</Fix>
					<Fix q="It reads my GoodWatch but can't change anything.">
						You may have picked <Ui>Read-only</Ui> when you connected. Connect
						again and pick <Ui>Read and change my GoodWatch</Ui>.
					</Fix>
					<p className="text-sm text-gray-400">
						Not connected yet?{" "}
						<Link to={USE_WITH_AI_PATH} prefetch="intent" className={linkClass}>
							Set it up in a few steps
						</Link>
						.
					</p>
				</Tile>

				<Tile
					icon={LinkSlashIcon}
					label="Disconnect an app"
					hint="Stop an assistant from reaching your GoodWatch"
					more={{ to: CONNECTED_APPS_PATH, text: "Open Connected apps" }}
				>
					<ol className="flex list-decimal flex-col gap-2 pl-5 leading-relaxed marker:font-semibold marker:text-amber-400">
						<li>
							Open{" "}
							<Link
								to={CONNECTED_APPS_PATH}
								prefetch="intent"
								className={linkClass}
							>
								Settings → Connected apps
							</Link>
							.
						</li>
						<li>
							Next to the app, press <Ui>Disconnect</Ui>. The app loses access
							right away, and nothing you saved on GoodWatch is lost.
						</li>
						<li>
							Remove GoodWatch in the app too, so it stops offering it. In a
							terminal app, for example, run{" "}
							<code className="rounded bg-gray-950 px-1.5 py-0.5 font-mono text-[0.9em] text-gray-100 ring-1 ring-gray-700">
								claude mcp remove goodwatch
							</code>
							.
						</li>
					</ol>
				</Tile>

				<AiAppFixes />

				<Tile
					icon={KeyIcon}
					label="Your account"
					hint="Signing in, passwords and your email address"
					more={{ to: ACCOUNT_PATH, text: "Account and sign-in" }}
				>
					<Fix q="I can't sign in.">
						On{" "}
						<Link to="/sign-in" prefetch="intent" className={linkClass}>
							Sign in
						</Link>
						, use the way you signed up: your email and password, or{" "}
						<Ui>Continue with Google</Ui>. An account made with Google has no
						password.
					</Fix>
					<Fix q="I forgot my password.">
						<Link to="/forgot-password" prefetch="intent" className={linkClass}>
							Reset your password
						</Link>
						. We email you a link. If it doesn't arrive in a few minutes, look
						in your spam folder.
					</Fix>
					<Fix q="I want to change my password or delete my account.">
						Change your password in{" "}
						<Link to={ACCOUNT_PATH} prefetch="intent" className={linkClass}>
							Settings → Account and sign-in
						</Link>
						. To delete your account, write to{" "}
						<a href={`mailto:${SUPPORT_EMAIL}`} className={linkClass}>
							{SUPPORT_EMAIL}
						</a>{" "}
						from your account's email address.
					</Fix>
				</Tile>

				<Tile
					icon={ShieldCheckIcon}
					label="Privacy"
					hint="What GoodWatch keeps, and what connected apps can see"
					more={{ to: "/privacy", text: "Read the privacy policy" }}
				>
					<p className="leading-relaxed">
						We only email you about your account: no newsletters, no ads. A
						connected app sees your ratings, lists, shows and streaming
						services, never your email address or password.
					</p>
					<p className="leading-relaxed">
						The{" "}
						<Link to="/privacy" prefetch="intent" className={linkClass}>
							privacy policy
						</Link>{" "}
						explains what we store, how long we keep it, and how to have it
						deleted.
					</p>
					<p className="leading-relaxed">
						Our{" "}
						<Link to="/terms" className={linkClass}>
							terms of service
						</Link>{" "}
						cover accounts, share lists and connected apps.
					</p>
				</Tile>
			</div>
		</div>
	)
}

// The rest of the fixes for AI apps, under the first row of tiles.
function AiAppFixes() {
	return (
		<section
			id={AI_FIXES_ID}
			aria-labelledby={`${AI_FIXES_ID}-heading`}
			className="scroll-mt-24 rounded-2xl bg-white/[0.04] p-5 ring-1 ring-white/10 md:col-span-2 md:p-6"
		>
			<h2
				id={`${AI_FIXES_ID}-heading`}
				className="mb-4 flex items-center gap-2 text-lg font-semibold text-white"
			>
				<ChatBubbleLeftRightIcon
					className="h-5 w-5 text-amber-400"
					aria-hidden="true"
				/>
				More fixes for AI apps
			</h2>
			<div className="grid gap-x-8 gap-y-5 md:grid-cols-2">
				<Fix q="I can't find where to add a custom connector.">
					Your plan or workspace may not allow it. As of October 2026, Claude
					Free has room for one custom connector, and on Team or Enterprise an
					owner adds it. ChatGPT allows it on Business, Enterprise and Edu
					(read-only on Pro), and only on chatgpt.com in a browser. Plans
					change, so check the app's own help too.
				</Fix>
				<Fix q="The sign-in page opens, but the app never finishes connecting.">
					Update the app and try again. For desktop and terminal apps, the
					browser has to run on the same computer, and it may ask whether to
					open the app: allow it. Never send a code or key from the sign-in to
					anyone.
				</Fix>
				<Fix q="New features still don't show up after a new chat.">
					Refresh the app's list of GoodWatch tools. In ChatGPT, open the
					GoodWatch plugin and press <Ui>Refresh</Ui>. In Claude, disconnect
					GoodWatch and connect it again. In Cursor or VS Code, turn GoodWatch
					off and on in the MCP settings.
				</Fix>
				<Fix q="Searching by description stopped working.">
					Your assistant can search by description (“
					{DESCRIPTION_SEARCH_EXAMPLE}”) {RANKED_SEARCHES_PER_DAY} times a day.
					Finding a title by its name has no daily limit.
				</Fix>
				<Fix q="It says “too many requests”.">
					A connected app can ask GoodWatch {REQUESTS_PER_MINUTE} times a minute
					and {REQUESTS_PER_HOUR} times an hour. Wait a minute and ask again.
				</Fix>
				<Fix q="GoodWatch calls the app unverified.">
					Some apps don't say who made them, so GoodWatch can't check. Allow the
					app only if you started the connection yourself, in an app you trust.
				</Fix>
			</div>
		</section>
	)
}

function Tile({
	icon: Icon,
	label,
	hint,
	more,
	children,
}: {
	icon: ComponentType<SVGProps<SVGSVGElement>>
	label: string
	hint: string
	more: { to: string; text: string }
	children: ReactNode
}) {
	return (
		<section
			aria-label={label}
			className="flex flex-col rounded-2xl bg-white/[0.04] p-5 ring-1 ring-white/10 md:p-6"
		>
			<h2 className="flex items-center gap-2 text-lg font-semibold text-white">
				<Icon className="h-5 w-5 text-amber-400" aria-hidden="true" />
				{label}
			</h2>
			<p className="mb-4 text-sm text-gray-400">{hint}</p>
			<div className="flex flex-col gap-4">{children}</div>
			<Link
				to={more.to}
				prefetch="intent"
				className="mt-auto inline-flex items-center gap-1.5 self-start pt-5 text-sm font-semibold text-gray-200 hover:text-white"
			>
				{more.text}
				<ArrowRightIcon className="h-4 w-4" aria-hidden="true" />
			</Link>
		</section>
	)
}

function Fix({ q, children }: { q: string; children: ReactNode }) {
	return (
		<div>
			<h3 className="font-semibold text-gray-100">{q}</h3>
			<p className="mt-1 leading-relaxed text-gray-300">{children}</p>
		</div>
	)
}
