// Turning GoodWatch on, for /use-with-ai, step by step, as drawn screens: plain windows with each app's menu
// names (from ClientGuides.tsx, checked October 17, 2026), never the app's own look, and each one marked as an
// illustration. The GoodWatch sign-in screen is ours, so it is drawn like the real one.
import { CursorArrowRaysIcon, PlusIcon } from "@heroicons/react/24/solid"
import type { ReactNode } from "react"
import { AppBadge, type AppKey } from "~/ui/connector/AppBadge"
import { CONNECTOR_URL } from "~/ui/connector/connector"
import { CHAT_DEMO_QUESTIONS } from "~/ui/connector/example-prompts"
import { claudeCodeCommands } from "~/ui/connector/install-links"
import { MockWindow } from "./ChatDemo"

type Step = { title: string; text: ReactNode; screen: ReactNode }
export type SetupApp = {
	key: string
	name: string
	sub: string
	badges: AppKey[]
	steps: Step[]
	// The app's guide on /connect.
	guide: string
}

// Where the member clicks, drawn as a ring and a pointer.
function Hit({
	children,
	className = "",
}: { children: ReactNode; className?: string }) {
	return (
		<span
			className={`relative inline-flex rounded-lg ring-2 ring-amber-400 ring-offset-2 ring-offset-transparent ${className}`}
		>
			{children}
			<CursorArrowRaysIcon
				aria-hidden="true"
				className="absolute -right-3 -bottom-4 h-6 w-6 text-amber-300 drop-shadow"
			/>
		</span>
	)
}

function Field({ label, value }: { label: string; value: string }) {
	return (
		<div className="flex flex-col gap-1">
			<span className="text-[11px] font-semibold text-gray-400">{label}</span>
			<span className="truncate rounded-md border border-white/15 bg-black/30 px-2 py-1.5 font-mono text-xs text-gray-100">
				{value}
			</span>
		</div>
	)
}

function Btn({
	children,
	primary = false,
}: { children: ReactNode; primary?: boolean }) {
	return (
		<span
			className={`inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-semibold ${primary ? "bg-gray-100 text-gray-900" : "bg-white/10 text-gray-200"}`}
		>
			{children}
		</span>
	)
}

function Screen({
	title,
	app,
	children,
}: { title: string; app?: AppKey; children: ReactNode }) {
	return (
		<MockWindow
			title={title}
			badge={
				app ? (
					<span className="scale-[0.55] -my-3 -mx-2">
						<AppBadge app={app} size="sm" />
					</span>
				) : undefined
			}
		>
			<div className="flex min-h-44 flex-col gap-3 p-4 text-sm">{children}</div>
		</MockWindow>
	)
}

/** GoodWatch's own sign-in and allow screen, the same for every app. */
function ConsentScreen({ app }: { app: string }) {
	return (
		<MockWindow title="goodwatch.app" tone="dark">
			<div className="flex min-h-44 flex-col gap-2.5 bg-gray-950 p-4 text-sm">
				<p className="text-center font-black text-white">
					Good<span className="text-amber-400">Watch</span>
				</p>
				<p className="text-center font-bold text-white">
					{app} wants to access your GoodWatch
				</p>
				<div className="space-y-1.5 rounded-lg border border-gray-700 p-2.5 text-xs">
					<p className="flex items-center gap-2 text-gray-400">
						<span className="h-3 w-3 rounded-full border border-gray-500" />{" "}
						Read-only
					</p>
					<p className="flex items-center gap-2 text-gray-100">
						<span className="h-3 w-3 rounded-full border-4 border-amber-500" />{" "}
						Read and change my GoodWatch
					</p>
				</div>
				<div className="flex gap-2">
					<span className="flex-1 rounded-md border border-gray-600 bg-gray-800 py-1.5 text-center text-xs font-semibold">
						Deny
					</span>
					<Hit className="flex-1">
						<span className="w-full rounded-md bg-amber-700 py-1.5 text-center text-xs font-semibold text-white">
							Allow {app}
						</span>
					</Hit>
				</div>
			</div>
		</MockWindow>
	)
}

function ChatWithTool({
	app,
	toolLabel,
	children,
}: { app: AppKey; toolLabel: string; children: ReactNode }) {
	return (
		<Screen title={toolLabel} app={app}>
			<div className="mt-auto flex flex-col gap-2">
				{children}
				<div className="flex items-center gap-2 rounded-xl border border-white/15 bg-black/20 px-3 py-2 text-xs text-gray-500">
					{CHAT_DEMO_QUESTIONS.tonight}
				</div>
			</div>
		</Screen>
	)
}

const CLAUDE: SetupApp = {
	key: "claude",
	name: "Claude",
	sub: "Web, desktop and phone",
	badges: ["claude"],
	guide: "/connect#claude",
	steps: [
		{
			title: "Open Connectors",
			text: (
				<>
					On claude.ai, open <b>Customize</b>, then <b>Connectors</b>. Press{" "}
					<b>+ Add</b> and pick <b>Add custom connector</b>.
				</>
			),
			screen: (
				<Screen title="Claude · Customize" app="claude">
					<div className="flex gap-3">
						<div className="flex w-24 shrink-0 flex-col gap-1 text-xs text-gray-400">
							<span
								aria-hidden="true"
								className="my-1 h-2 w-14 rounded bg-white/10"
							/>
							<span className="rounded bg-white/10 px-1.5 py-0.5 font-semibold text-white">
								Connectors
							</span>
							<span
								aria-hidden="true"
								className="my-1 h-2 w-12 rounded bg-white/10"
							/>
						</div>
						<div className="flex flex-1 flex-col items-end gap-2">
							<Btn>
								<PlusIcon className="h-3 w-3" /> Add
							</Btn>
							<div className="w-full max-w-48 rounded-md border border-white/15 bg-[#232327] p-1 text-xs">
								<Hit className="w-full">
									<p className="w-full rounded bg-white/10 px-2 py-1 font-semibold text-white">
										Add custom connector
									</p>
								</Hit>
							</div>
						</div>
					</div>
				</Screen>
			),
		},
		{
			title: "Paste the address",
			text: (
				<>
					Name it <b>GoodWatch</b>, paste <b>{CONNECTOR_URL}</b> and press{" "}
					<b>Continue</b>. Keep the suggested sign-in settings and press{" "}
					<b>Add</b>.
				</>
			),
			screen: (
				<Screen title="Add custom connector" app="claude">
					<Field label="Name" value="GoodWatch" />
					<Field label="Remote MCP server URL" value={CONNECTOR_URL} />
					<div className="mt-auto flex justify-end gap-2">
						<Btn>Cancel</Btn>
						<Hit>
							<Btn primary>Continue</Btn>
						</Hit>
					</div>
				</Screen>
			),
		},
		{
			title: "Connect and allow",
			text: (
				<>
					Press <b>Connect</b> next to GoodWatch. GoodWatch opens: sign in and
					press <b>Allow</b>.
				</>
			),
			screen: <ConsentScreen app="Claude" />,
		},
		{
			title: "Ask away",
			text: (
				<>
					In a chat, press <b>+</b>, then <b>Connectors</b>, and switch
					GoodWatch on. It stays on for your phone too.
				</>
			),
			screen: (
				<ChatWithTool app="claude" toolLabel="Claude · New chat">
					<div className="w-52 rounded-md border border-white/15 bg-[#232327] p-2 text-xs">
						<p className="mb-1 text-gray-400">Connectors</p>
						<p className="flex items-center justify-between font-semibold text-white">
							GoodWatch
							<Hit>
								<span className="flex h-4 w-7 items-center justify-end rounded-full bg-amber-600 px-0.5">
									<span className="h-3 w-3 rounded-full bg-white" />
								</span>
							</Hit>
						</p>
					</div>
				</ChatWithTool>
			),
		},
	],
}

const CHATGPT: SetupApp = {
	key: "chatgpt",
	name: "ChatGPT",
	sub: "On chatgpt.com in a browser",
	badges: ["chatgpt"],
	guide: "/connect#chatgpt",
	steps: [
		{
			title: "Open Plugins",
			text: (
				<>
					On chatgpt.com, open <b>Plugins</b>, press <b>+</b> and choose{" "}
					<b>Add custom MCP server</b>.
				</>
			),
			screen: (
				<Screen title="ChatGPT · Plugins" app="chatgpt">
					<div className="flex items-center justify-between">
						<span className="font-semibold text-white">Plugins</span>
						<Btn>
							<PlusIcon className="h-3 w-3" />
						</Btn>
					</div>
					<div className="self-end rounded-md border border-white/15 bg-[#232327] p-1 text-xs">
						<Hit>
							<p className="rounded bg-white/10 px-2 py-1 font-semibold text-white">
								Add custom MCP server
							</p>
						</Hit>
					</div>
				</Screen>
			),
		},
		{
			title: "Paste the address",
			text: (
				<>
					Name it <b>GoodWatch</b>, paste the address, pick <b>OAuth</b> and
					create it as a plugin.
				</>
			),
			screen: (
				<Screen title="Add custom MCP server" app="chatgpt">
					<Field label="Name" value="GoodWatch" />
					<Field label="MCP server URL" value={CONNECTOR_URL} />
					<Field label="Authentication" value="OAuth" />
					<div className="mt-auto flex justify-end">
						<Hit>
							<Btn primary>Create</Btn>
						</Hit>
					</div>
				</Screen>
			),
		},
		{
			title: "Install and allow",
			text: (
				<>
					Install the plugin. GoodWatch opens: sign in and press <b>Allow</b>.
				</>
			),
			screen: <ConsentScreen app="ChatGPT" />,
		},
		{
			title: "Ask away",
			text: (
				<>
					In a new chat, type <b>@</b> and pick GoodWatch.
				</>
			),
			screen: (
				<ChatWithTool app="chatgpt" toolLabel="ChatGPT · New chat">
					<div className="w-44 rounded-md border border-white/15 bg-[#232327] p-1 text-xs">
						<Hit className="w-full">
							<p className="w-full rounded bg-white/10 px-2 py-1 font-semibold text-white">
								@ GoodWatch
							</p>
						</Hit>
					</div>
				</ChatWithTool>
			),
		},
	],
}

const ONE_CLICK: SetupApp = {
	key: "one-click",
	name: "Cursor, VS Code and more",
	sub: "One-click install",
	badges: ["cursor", "vscode", "goose", "lm-studio"],
	guide: "/connect#cursor",
	steps: [
		{
			title: "Press Add",
			text: (
				<>
					On GoodWatch's <b>Connect</b> page, pick your app and press its{" "}
					<b>Add</b> button.
				</>
			),
			screen: (
				<MockWindow title="goodwatch.app/connect">
					<div className="flex min-h-44 flex-col items-start justify-center gap-3 bg-gray-900 p-4 text-sm">
						<div className="flex items-center gap-2">
							<AppBadge app="cursor" size="sm" />
							<span className="font-bold text-white">Cursor</span>
						</div>
						<Hit>
							<span className="rounded-lg bg-amber-700 px-4 py-2 text-xs font-semibold text-white">
								Add to Cursor
							</span>
						</Hit>
					</div>
				</MockWindow>
			),
		},
		{
			title: "Let the browser open the app",
			text: <>Your browser asks whether to open the app. Allow it.</>,
			screen: (
				<MockWindow title="Your browser" tone="light">
					<div className="flex min-h-44 items-center justify-center p-4 text-sm">
						<div className="w-full max-w-56 rounded-lg bg-white p-3 shadow ring-1 ring-black/10">
							<p className="font-semibold">Open Cursor?</p>
							<p className="mt-1 text-xs text-gray-500">
								goodwatch.app wants to open this app.
							</p>
							<div className="mt-3 flex justify-end gap-2 text-xs">
								<span className="rounded px-2 py-1">Cancel</span>
								<Hit>
									<span className="rounded bg-gray-800 px-2 py-1 font-semibold text-white">
										Open
									</span>
								</Hit>
							</div>
						</div>
					</div>
				</MockWindow>
			),
		},
		{
			title: "Confirm the install",
			text: <>The app shows GoodWatch and asks you to confirm.</>,
			screen: (
				<Screen title="Cursor · Install MCP server" app="cursor">
					<Field label="Name" value="goodwatch" />
					<Field label="URL" value={CONNECTOR_URL} />
					<div className="mt-auto flex justify-end">
						<Hit>
							<Btn primary>Install</Btn>
						</Hit>
					</div>
				</Screen>
			),
		},
		{
			title: "Sign in and allow",
			text: (
				<>
					GoodWatch opens in your browser: sign in and press <b>Allow</b>. Then
					ask in the app's chat.
				</>
			),
			screen: <ConsentScreen app="Cursor" />,
		},
	],
}

const commands = claudeCodeCommands()

function Terminal({
	lines,
}: { lines: { text: string; dim?: boolean; hit?: boolean }[] }) {
	return (
		<MockWindow title="Terminal">
			<div className="flex min-h-44 flex-col gap-1.5 bg-black p-4 font-mono text-xs leading-relaxed text-gray-200 [overflow-wrap:anywhere]">
				{lines.map((line) =>
					line.hit ? (
						<Hit key={line.text} className="self-start">
							<span className="px-1">
								<span className="text-emerald-400">$ </span>
								{line.text}
							</span>
						</Hit>
					) : (
						<p key={line.text} className={line.dim ? "text-gray-500" : ""}>
							{!line.dim && <span className="text-emerald-400">$ </span>}
							{line.text}
						</p>
					),
				)}
			</div>
		</MockWindow>
	)
}

const TERMINAL: SetupApp = {
	key: "terminal",
	name: "Terminal apps",
	sub: "Claude Code, Codex, Gemini CLI",
	badges: ["claude-code", "codex", "gemini-cli"],
	guide: "/connect#claude-code",
	steps: [
		{
			title: "Add GoodWatch",
			text: (
				<>
					Run the add command. Each app has its own; the Connect page lists
					them.
				</>
			),
			screen: <Terminal lines={[{ text: commands.add, hit: true }]} />,
		},
		{
			title: "Sign in",
			text: <>Run the sign-in command. Your browser opens GoodWatch.</>,
			screen: <Terminal lines={[{ text: commands.signIn, hit: true }]} />,
		},
		{
			title: "Allow",
			text: (
				<>
					Sign in and press <b>Allow</b>. Your browser has to run on the same
					computer.
				</>
			),
			screen: <ConsentScreen app="Claude Code" />,
		},
		{
			title: "Ask away",
			text: <>Ask in the terminal app. Answers come as text with links.</>,
			screen: (
				<Terminal
					lines={[
						{ text: `> ${CHAT_DEMO_QUESTIONS.tonight}`, dim: true },
						{
							text: "Dark (2017): episode 7 of season 3 is next, on Netflix. 74% taste match.",
							dim: true,
						},
					]}
				/>
			),
		},
	],
}

export const SETUP_APPS: SetupApp[] = [CLAUDE, CHATGPT, ONE_CLICK, TERMINAL]

export function AppBadges({ app }: { app: SetupApp }) {
	return (
		<span className="flex -space-x-2">
			{app.badges.slice(0, 3).map((badge, index) => (
				<span
					key={badge}
					className={`rounded-xl ring-2 ring-gray-900 ${index > 0 ? "hidden sm:inline-flex" : ""}`}
				>
					<AppBadge app={badge} size="sm" />
				</span>
			))}
		</span>
	)
}
