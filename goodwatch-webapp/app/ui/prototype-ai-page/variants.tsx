// PROTOTYPE - throwaway. Four layouts for one page that replaces /connect and /use-with-ai. They all keep the
// same essentials (what it does in one line, pick your app, the install button or address, that app's few steps,
// things to ask) and disagree about structure:
// A Focused: one narrow column, app chips, one panel.
// B Show and set up: the chat demo beside an accordion of apps.
// C Everything visible: no picker. Apps grouped by kind, every button on the page.
// D Four steps: the page itself is the numbered steps. Shared steps appear once.
import {
	ArrowTopRightOnSquareIcon,
	BookmarkIcon,
	CheckBadgeIcon,
	ChevronDownIcon,
	LifebuoyIcon,
	LinkSlashIcon,
	SparklesIcon,
	StarIcon,
	TvIcon,
	UserGroupIcon,
	UserIcon,
} from "@heroicons/react/24/outline"
import { Link } from "@remix-run/react"
import {
	type ComponentType,
	type ReactNode,
	type SVGProps,
	useState,
} from "react"
import { CopyField } from "~/ui/connector/CopyField"
import { CONNECTED_APPS_PATH } from "~/ui/connector/connector"
import {
	CONNECT_EXAMPLES,
	USE_WITH_AI_ASKS,
} from "~/ui/connector/example-prompts"
import {
	More,
	OpenButton,
	Step,
	Steps,
	StatusTag,
	Ui,
} from "~/ui/connector/help-parts"
import { ChatDemo } from "~/ui/use-with-ai/ChatDemo"
import {
	APPS,
	Address,
	type AppGuide,
	Badge,
	GROUPS,
	OTHER_APP,
	PICKS,
	SIGN_IN_STEP,
	useSelectedApp,
} from "./apps"

const TITLE = "Use GoodWatch in your AI app"
const ONE_LINE =
	"Ask what to watch, log episodes and rate titles by chatting. Every answer fits your taste."
const linkClass = "font-semibold text-amber-500 hover:text-amber-400"

// ---- Shared pieces ---------------------------------------------------------------------------------------------

function ActionRow({ app }: { app: AppGuide }) {
	if (!app.action)
		return app.note ? <p className="text-sm text-gray-400">{app.note}</p> : null
	return (
		<div className="flex flex-col items-start gap-2">
			<div className="flex flex-wrap items-center gap-3">
				<OpenButton href={app.action.href} external={app.action.external}>
					{app.action.label}
					{app.action.external && (
						<>
							<ArrowTopRightOnSquareIcon className="h-5 w-5" aria-hidden="true" />
							<span className="sr-only">(opens in a new tab)</span>
						</>
					)}
				</OpenButton>
				{app.extraAction && (
					<a href={app.extraAction.href} className={`text-sm ${linkClass}`}>
						{app.extraAction.label}
					</a>
				)}
			</div>
			{app.note && <p className="text-sm text-gray-400">{app.note}</p>}
		</div>
	)
}

function stepItems(app: AppGuide, withShared: boolean): ReactNode[] {
	const commands = (app.commands ?? []).map((command) => (
		<>
			{command.label}
			<div className="mt-2">
				<CopyField
					text={command.text}
					label={`Copy: ${command.label} (${app.name})`}
				/>
			</div>
		</>
	))
	return [
		...commands,
		...app.steps,
		...(withShared ? [SIGN_IN_STEP] : []),
		...(withShared && app.after ? [app.after] : []),
	]
}

function AppSteps({
	app,
	withShared = true,
	plain = false,
}: { app: AppGuide; withShared?: boolean; plain?: boolean }) {
	const items = stepItems(app, withShared)
	if (items.length === 0) return null
	// Inside a numbered page step, a second set of numbers reads as noise: plain bullets instead.
	if (plain)
		return (
			<ul className="flex flex-col gap-4">
				{items.map((item, index) => (
					<li
						// biome-ignore lint/suspicious/noArrayIndexKey: fixed list per app
						key={index}
						className="flex gap-3 leading-relaxed before:mt-2.5 before:h-1.5 before:w-1.5 before:shrink-0 before:rounded-full before:bg-amber-500"
					>
						<div className="min-w-0 flex-1">{item}</div>
					</li>
				))}
			</ul>
		)
	return (
		<Steps>
			{items.map((item, index) => (
				// biome-ignore lint/suspicious/noArrayIndexKey: fixed list per app
				<Step key={index}>{item}</Step>
			))}
		</Steps>
	)
}

function Manual({ app }: { app: AppGuide }) {
	if (!app.manual) return null
	return <More title={app.manual.title}>{app.manual.body}</More>
}

function Guide({
	app,
	withShared = true,
	plain = false,
}: { app: AppGuide; withShared?: boolean; plain?: boolean }) {
	return (
		<div className="flex flex-col gap-5">
			<ActionRow app={app} />
			<AppSteps app={app} withShared={withShared} plain={plain} />
			<Manual app={app} />
		</div>
	)
}

function PromptChips({ prompts }: { prompts: readonly string[] }) {
	return (
		<ul className="flex flex-wrap gap-2">
			{prompts.map((prompt) => (
				<li
					key={prompt}
					className="rounded-2xl rounded-br-md bg-gray-700/70 px-3.5 py-2 text-gray-100"
				>
					{prompt}
				</li>
			))}
		</ul>
	)
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

function PromptCards() {
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

// Account, disconnect and help, in one quiet row instead of three sections.
function FinePrint({ className = "" }: { className?: string }) {
	const item = "flex items-center gap-2"
	const icon = "h-4 w-4 shrink-0 text-gray-500"
	return (
		<ul
			className={`flex flex-col gap-2 border-t border-white/10 pt-6 text-sm text-gray-400 sm:flex-row sm:flex-wrap sm:gap-x-6 ${className}`}
		>
			<li className={item}>
				<UserIcon className={icon} aria-hidden="true" />
				Needs a free{" "}
				<Link to="/sign-up" className={linkClass}>
					GoodWatch account
				</Link>
			</li>
			<li className={item}>
				<LinkSlashIcon className={icon} aria-hidden="true" />
				Disconnect in{" "}
				<Link to={CONNECTED_APPS_PATH} className={linkClass}>
					Connected apps
				</Link>
			</li>
			<li className={item}>
				<LifebuoyIcon className={icon} aria-hidden="true" />
				Stuck?{" "}
				<Link to="/support" className={linkClass}>
					Support
				</Link>
			</li>
		</ul>
	)
}

const h2 = "text-xl font-bold tracking-tight text-white sm:text-2xl"
const tileOn = "bg-amber-950/40 ring-2 ring-amber-500"
const tileOff = "bg-white/[0.04] ring-1 ring-white/10 hover:bg-white/[0.07]"

// ---- A: Focused ------------------------------------------------------------------------------------------------

export function VariantA() {
	const { selected, select, app } = useSelectedApp("claude")
	const current = app ?? APPS[0]
	return (
		<div className="mx-auto flex w-full max-w-2xl flex-col gap-10 px-4 py-8 text-gray-300 sm:px-8 md:py-14">
			<header className="flex flex-col gap-3">
				<h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
					{TITLE}
				</h1>
				<p className="text-lg leading-relaxed text-gray-300">{ONE_LINE}</p>
			</header>

			<section aria-label="Set it up" className="flex flex-col gap-4">
				<div
					role="tablist"
					aria-label="Pick your app"
					className="flex flex-wrap gap-2"
				>
					{PICKS.map((item) => {
						const on = item.key === selected
						return (
							<button
								key={item.key}
								type="button"
								role="tab"
								aria-selected={on}
								onClick={() => select(item.key)}
								className={`flex cursor-pointer items-center gap-2 rounded-xl py-1.5 pr-3.5 pl-1.5 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${on ? `${tileOn} text-white` : `${tileOff} text-gray-200`}`}
							>
								<span className="-m-0.5 scale-[0.8]">
									<Badge app={item.key} size="sm" />
								</span>
								{item.name}
							</button>
						)
					})}
				</div>
				<div
					role="tabpanel"
					className="flex flex-col gap-5 rounded-2xl bg-white/[0.03] p-5 ring-1 ring-white/10 sm:p-6"
				>
					<div className="flex flex-wrap items-center gap-x-3 gap-y-1">
						<h2 className="text-2xl font-bold tracking-tight text-white">
							{current.name}
						</h2>
						{current.key !== "other" && <StatusTag status={current.status} />}
					</div>
					<Guide app={current} />
				</div>
			</section>

			<section aria-labelledby="a-ask" className="flex flex-col gap-4">
				<h2 id="a-ask" className={h2}>
					Then ask
				</h2>
				<PromptChips prompts={CONNECT_EXAMPLES} />
			</section>

			<FinePrint />
		</div>
	)
}

// ---- B: Show and set up ----------------------------------------------------------------------------------------

export function VariantB() {
	const { selected, select } = useSelectedApp("claude")
	const groups = [
		...GROUPS.map((group) => ({
			...group,
			apps: APPS.filter((app) => app.group === group.key),
		})),
		{ key: "other", title: "Something else", sub: "", apps: [OTHER_APP] },
	]
	return (
		<div className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-10 px-4 py-8 text-gray-300 sm:px-8 md:py-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:gap-14">
			<div className="flex flex-col gap-8">
				<header className="flex flex-col gap-3">
					<h1 className="text-4xl font-black tracking-tight text-white sm:text-5xl">
						Ask your AI what to watch.
					</h1>
					<p className="text-lg leading-relaxed text-gray-300">{ONE_LINE}</p>
				</header>

				<section aria-label="Pick your app" className="flex flex-col gap-5">
					{groups.map((group) => (
						<div key={group.key} className="flex flex-col gap-2">
							<p className="text-xs font-semibold tracking-wider text-gray-500 uppercase">
								{group.title}
							</p>
							<ul className="divide-y divide-white/10 overflow-hidden rounded-2xl bg-white/[0.03] ring-1 ring-white/10">
								{group.apps.map((app) => {
									const open = app.key === selected
									return (
										<li key={app.key}>
											<button
												type="button"
												aria-expanded={open}
												onClick={() => select(open ? null : app.key)}
												className={`flex w-full cursor-pointer items-center gap-3 px-3 py-2.5 text-left transition hover:bg-white/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-inset ${open ? "bg-white/[0.04]" : ""}`}
											>
												<Badge app={app.key} size="sm" />
												<span className="min-w-0 flex-1">
													<span className="block font-semibold text-white">
														{app.name}
													</span>
													<span className="block text-xs text-gray-400">
														{app.how}
													</span>
												</span>
												{app.key !== "other" && app.status === "tested" && (
													<StatusTag status="tested" />
												)}
												<ChevronDownIcon
													className={`h-5 w-5 shrink-0 text-gray-500 transition ${open ? "rotate-180" : ""}`}
													aria-hidden="true"
												/>
											</button>
											{open && (
												<div className="px-4 pt-2 pb-5 sm:px-5">
													<Guide app={app} />
												</div>
											)}
										</li>
									)
								})}
							</ul>
						</div>
					))}
				</section>
				<FinePrint className="hidden lg:flex" />
			</div>

			<aside
				aria-label="What it looks like"
				className="flex flex-col gap-6 lg:sticky lg:top-24 lg:self-start"
			>
				<ChatDemo />
				<div className="flex flex-col gap-3">
					<p className="text-sm font-semibold text-gray-400">More to try</p>
					<PromptChips
						prompts={USE_WITH_AI_ASKS.map(({ ask }) => ask).slice(0, 5)}
					/>
				</div>
			</aside>
			<FinePrint className="lg:hidden" />
		</div>
	)
}

// ---- C: Everything visible -------------------------------------------------------------------------------------

function Card({
	title,
	sub,
	children,
}: { title: ReactNode; sub?: ReactNode; children: ReactNode }) {
	return (
		<div className="flex flex-col gap-5 rounded-2xl bg-white/[0.03] p-5 ring-1 ring-white/10 sm:p-6">
			<div>
				<div className="flex flex-wrap items-center gap-x-3 gap-y-1">{title}</div>
				{sub && <p className="mt-1 text-sm text-gray-400">{sub}</p>}
			</div>
			{children}
		</div>
	)
}

export function VariantC() {
	const chat = APPS.filter((app) => app.group === "chat")
	const desktop = APPS.filter((app) => app.group === "desktop")
	const terminals = APPS.filter((app) => app.group === "terminal")
	const [term, setTerm] = useState(terminals[0].key)
	const terminal = terminals.find(({ key }) => key === term) ?? terminals[0]
	return (
		<div className="mx-auto flex w-full max-w-5xl flex-col gap-12 px-4 py-8 text-gray-300 sm:px-8 md:py-14">
			<header className="grid grid-cols-1 items-end gap-6 md:grid-cols-[1fr_minmax(0,24rem)]">
				<div className="flex flex-col gap-3">
					<h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
						{TITLE}
					</h1>
					<p className="text-lg leading-relaxed text-gray-300">{ONE_LINE}</p>
				</div>
				<div className="flex flex-col gap-2">
					<p className="text-sm font-semibold text-gray-300">
						Your GoodWatch address, for any app
					</p>
					<Address />
				</div>
			</header>

			<section aria-labelledby="c-chat" className="flex flex-col gap-4">
				<h2 id="c-chat" className={h2}>
					Chat apps
				</h2>
				<div className="grid grid-cols-1 gap-4 md:grid-cols-2">
					{chat.map((app) => (
						<Card
							key={app.key}
							title={
								<>
									<Badge app={app.key} size="sm" />
									<h3 className="text-xl font-bold text-white">{app.name}</h3>
									<StatusTag status={app.status} />
								</>
							}
						>
							<Guide app={app} />
						</Card>
					))}
				</div>
			</section>

			<section aria-labelledby="c-desktop" className="flex flex-col gap-4">
				<h2 id="c-desktop" className={h2}>
					Code editors and desktop apps
				</h2>
				<Card
					title={<p className="font-semibold text-white">One click to add</p>}
					sub="Opens the app on this computer. Confirm, then sign in to GoodWatch and press Allow."
				>
					<ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
						{desktop.map((app) => (
							<li key={app.key}>
								<a
									href={app.action?.href}
									className="flex items-center gap-3 rounded-xl bg-amber-700 p-2 pr-4 font-semibold text-white transition hover:bg-amber-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
								>
									<Badge app={app.key} size="sm" />
									<span className="min-w-0 leading-tight">
										<span className="block text-xs font-normal text-amber-100/80">
											Add to
										</span>
										{app.name}
									</span>
								</a>
							</li>
						))}
					</ul>
					<More title="Nothing happened? Add it by hand">
						{desktop.map((app) => (
							<div key={app.key} className="flex flex-col gap-2">
								<p className="font-semibold text-gray-100">{app.name}</p>
								{app.manual?.body}
							</div>
						))}
					</More>
				</Card>
			</section>

			<section aria-labelledby="c-terminal" className="flex flex-col gap-4">
				<h2 id="c-terminal" className={h2}>
					Terminal
				</h2>
				<Card
					title={
						<div
							role="tablist"
							aria-label="Pick your terminal app"
							className="flex flex-wrap gap-2"
						>
							{terminals.map((app) => (
								<button
									key={app.key}
									type="button"
									role="tab"
									aria-selected={app.key === term}
									onClick={() => setTerm(app.key)}
									className={`cursor-pointer rounded-full px-3.5 py-1.5 text-sm font-semibold transition ${app.key === term ? "bg-amber-600 text-white" : "bg-white/[0.06] text-gray-300 ring-1 ring-white/10 hover:bg-white/10"}`}
								>
									{app.name}
								</button>
							))}
						</div>
					}
				>
					<AppSteps app={terminal} />
				</Card>
			</section>

			<section aria-labelledby="c-ask" className="flex flex-col gap-4">
				<h2 id="c-ask" className={h2}>
					Then ask
				</h2>
				<PromptChips prompts={CONNECT_EXAMPLES} />
			</section>

			<FinePrint />
		</div>
	)
}

// ---- D: Four steps ---------------------------------------------------------------------------------------------

function PageStep({
	n,
	title,
	last = false,
	children,
}: { n: number; title: ReactNode; last?: boolean; children: ReactNode }) {
	return (
		<li className="relative grid grid-cols-[2.5rem_minmax(0,1fr)] gap-x-4 sm:grid-cols-[3rem_minmax(0,1fr)] sm:gap-x-6">
			<div className="flex flex-col items-center">
				<span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-700 text-lg font-black text-white sm:h-12 sm:w-12 sm:text-xl">
					<span className="sr-only">Step </span>
					{n}
				</span>
				{!last && <span aria-hidden="true" className="mt-2 w-px flex-1 bg-white/15" />}
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

export function VariantD() {
	const { selected, select, app } = useSelectedApp("claude")
	const current = app ?? APPS[0]
	return (
		<div className="mx-auto flex w-full max-w-3xl flex-col gap-10 px-4 py-8 text-gray-300 sm:px-8 md:py-14">
			<header className="flex flex-col gap-3">
				<h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
					{TITLE}
				</h1>
				<p className="text-lg leading-relaxed text-gray-300">{ONE_LINE}</p>
			</header>

			<ol>
				<PageStep n={1} title="Pick your app">
					<div
						role="tablist"
						aria-label="Pick your app"
						className="grid grid-cols-3 gap-2 sm:grid-cols-5"
					>
						{PICKS.map((item) => {
							const on = item.key === selected
							return (
								<button
									key={item.key}
									type="button"
									role="tab"
									aria-selected={on}
									onClick={() => select(item.key)}
									className={`flex cursor-pointer flex-col items-center gap-2 rounded-2xl px-1 py-3 text-center transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${on ? tileOn : tileOff}`}
								>
									<Badge app={item.key} size="sm" />
									<span
										className={`text-xs font-semibold leading-tight sm:text-sm ${on ? "text-white" : "text-gray-300"}`}
									>
										{item.name}
									</span>
								</button>
							)
						})}
					</div>
				</PageStep>

				<PageStep
					n={2}
					title={
						current.key === "other"
							? "Add GoodWatch"
							: `Add GoodWatch to ${current.name}`
					}
				>
					<Guide app={current} withShared={false} plain />
				</PageStep>

				<PageStep n={3} title="Sign in and allow">
					<p className="leading-relaxed">
						GoodWatch opens in your browser. Sign in and press <Ui>Allow</Ui>.
					</p>
					{current.after && (
						<p className="leading-relaxed">{current.after}</p>
					)}
				</PageStep>

				<PageStep n={4} title="Ask" last>
					<PromptCards />
				</PageStep>
			</ol>

			<FinePrint />
		</div>
	)
}

export const VARIANTS: Record<string, { name: string; View: () => ReactNode }> =
	{
		A: { name: "Focused", View: VariantA },
		B: { name: "Show and set up", View: VariantB },
		C: { name: "Everything visible", View: VariantC },
		D: { name: "Four steps", View: VariantD },
	}
