// PROTOTYPE - throwaway. One consolidated page for /connect and /use-with-ai: the per-app setup cut down to what a
// member needs. Every app gets one action (an install link, the app's settings page, or a command), the few steps
// that are only its own, and a "by hand" fallback. The steps every app shares (sign in to GoodWatch, press Allow,
// ask) live in SHARED_STEPS, so a variant can show them once instead of in every guide.
// Menu names, links and commands come from ClientGuides.tsx and install-links.ts (checked October 17, 2026).
import { ArrowTopRightOnSquareIcon } from "@heroicons/react/24/outline"
import { type ReactNode, useEffect, useState } from "react"
import { AppBadge, type AppKey } from "~/ui/connector/AppBadge"
import { CLIENTS } from "~/ui/connector/ClientGuides"
import { CopyField } from "~/ui/connector/CopyField"
import { CONNECTOR_URL } from "~/ui/connector/connector"
import { Code, type Status, Ui } from "~/ui/connector/help-parts"
import {
	CHATGPT_PLUGINS_URL,
	CLAUDE_CONNECTORS_URL,
	GOODWATCH_SERVER,
	claudeCodeCommands,
	codexCommands,
	cursorInstallLink,
	geminiCliCommands,
	gooseInstallLink,
	lmStudioInstallLink,
	vscodeInstallLink,
} from "~/ui/connector/install-links"

export type Group = "chat" | "desktop" | "terminal"

export type PickKey = AppKey | "other"

export type AppGuide = {
	key: PickKey
	name: string
	group: Group
	// Short line for a picker tile.
	how: string
	status: Status
	help: string
	// The one thing to press first. Terminal apps have commands instead.
	action?: { href: string; label: string; external?: boolean }
	extraAction?: { href: string; label: string }
	// One short line under the action: where it works, who can use it.
	note?: ReactNode
	// The steps only this app has, before the shared sign-in.
	steps: ReactNode[]
	// Terminal apps: the commands to copy, in order.
	commands?: { label: string; text: string }[]
	// A step after signing in that only this app has.
	after?: ReactNode
	// The fallback, behind a disclosure.
	manual?: { title: string; body: ReactNode }
}

const ID = GOODWATCH_SERVER.id
const clientOf = (key: AppKey) => {
	const found = CLIENTS.find((client) => client.key === key)
	if (!found) throw new Error(`No client ${key}`)
	return found
}

export function Address({ size = "md" }: { size?: "md" | "lg" }) {
	return (
		<CopyField
			text={CONNECTOR_URL}
			label="Copy the connector address"
			size={size}
		/>
	)
}

const json = (value: unknown) => (
	<CopyField text={JSON.stringify(value)} label="Copy the settings" />
)

const oneClick = (
	key: AppKey,
	name: string,
	href: string,
	confirm: ReactNode,
	manual: ReactNode,
): AppGuide => ({
	key,
	name,
	group: "desktop",
	how: "One click",
	status: clientOf(key).status,
	help: clientOf(key).help,
	action: { href, label: `Add to ${name}` },
	note: `Opens ${name} on this computer.`,
	steps: [confirm],
	manual: { title: "Nothing happened? Add it by hand", body: manual },
})

const terminal = (
	key: AppKey,
	name: string,
	commands: { add: string; signIn: string; signInWhere: "terminal" | "app" },
	note?: string,
): AppGuide => ({
	key,
	name,
	group: "terminal",
	how: "Terminal",
	status: clientOf(key).status,
	help: clientOf(key).help,
	note,
	steps: [],
	commands: [
		{ label: "Add GoodWatch", text: commands.add },
		{
			label:
				commands.signInWhere === "app" ? `Then, inside ${name}` : "Sign in",
			text: commands.signIn,
		},
	],
})

export const APPS: AppGuide[] = [
	{
		key: "claude",
		name: "Claude",
		group: "chat",
		how: "Web and apps",
		status: clientOf("claude").status,
		help: clientOf("claude").help,
		action: {
			href: CLAUDE_CONNECTORS_URL,
			label: "Open Claude's connectors",
			external: true,
		},
		note: "Add it once on the web. The phone app picks it up.",
		steps: [
			<>
				Press <Ui>+ Add</Ui> → <Ui>Add custom connector</Ui>.
			</>,
			<>
				Name it <Ui>GoodWatch</Ui>, paste the address, press <Ui>Add</Ui>, then{" "}
				<Ui>Connect</Ui>.
				<div className="mt-2">
					<Address />
				</div>
			</>,
		],
		after: (
			<>
				In a chat, press <Ui>+</Ui> → <Ui>Connectors</Ui> and switch GoodWatch
				on.
			</>
		),
	},
	oneClick(
		"cursor",
		"Cursor",
		cursorInstallLink(),
		"Confirm the install in Cursor.",
		<>
			<p>
				Add this to <Code>~/.cursor/mcp.json</Code>:
			</p>
			{json({ mcpServers: { [ID]: { url: CONNECTOR_URL } } })}
		</>,
	),
	{
		...oneClick(
			"vscode",
			"VS Code",
			vscodeInstallLink(),
			<>
				Press <Ui>Install</Ui> and trust the server.
			</>,
			<>
				<p>
					Run <Ui>MCP: Add Server</Ui>, choose <Ui>HTTP</Ui> and paste the
					address. Or add this to <Code>.vscode/mcp.json</Code>:
				</p>
				{json({ servers: { [ID]: { type: "http", url: CONNECTOR_URL } } })}
			</>,
		),
		note: "Needs GitHub Copilot (Free works).",
		extraAction: {
			href: vscodeInstallLink(undefined, { insiders: true }),
			label: "Insiders",
		},
	},
	oneClick(
		"goose",
		"Goose",
		gooseInstallLink(),
		"Confirm the extension in Goose.",
		<>
			<p>
				<Ui>Extensions</Ui> → <Ui>Add custom extension</Ui> →{" "}
				<Ui>Streamable HTTP</Ui>, then paste the address.
			</p>
			<Address />
		</>,
	),
	oneClick(
		"lm-studio",
		"LM Studio",
		lmStudioInstallLink(),
		"Confirm the install in LM Studio.",
		<>
			<p>
				<Ui>Program</Ui> → <Ui>Install</Ui> → <Ui>Edit mcp.json</Ui>, then add:
			</p>
			{json({ mcpServers: { [ID]: { url: CONNECTOR_URL } } })}
		</>,
	),
	terminal("claude-code", "Claude Code", claudeCodeCommands()),
	terminal("gemini-cli", "Gemini CLI", geminiCliCommands()),
	terminal("codex", "Codex", codexCommands()),
	{
		key: "chatgpt",
		name: "ChatGPT",
		group: "chat",
		how: "chatgpt.com",
		status: clientOf("chatgpt").status,
		help: clientOf("chatgpt").help,
		action: {
			href: CHATGPT_PLUGINS_URL,
			label: "Open ChatGPT's plugins",
			external: true,
		},
		note: "In a browser, on Business, Enterprise or Edu. Pro can only read.",
		steps: [
			<>
				Press <Ui>+</Ui> → <Ui>Add custom MCP server</Ui>.
			</>,
			<>
				Name it <Ui>GoodWatch</Ui>, paste the address, pick <Ui>OAuth</Ui>,
				then create and install the plugin.
				<div className="mt-2">
					<Address />
				</div>
			</>,
		],
		after: (
			<>
				In a chat, type <Code>@</Code> and pick GoodWatch.
			</>
		),
		manual: {
			title: "I see Apps, not Plugins",
			body: (
				<p>
					Open <Ui>Apps</Ui> → <Ui>Create</Ui> and fill in the same name,
					address and OAuth. No <Ui>Create</Ui>? Turn on "Developer mode" in
					settings first.
				</p>
			),
		},
	},
]

// Any other app that takes a remote MCP server with sign-in.
export const OTHER_APP: AppGuide = {
	key: "other",
	name: "Other app",
	group: "chat",
	how: "Paste the address",
	status: "should-work",
	help: "https://modelcontextprotocol.io/clients",
	note: "Any app that adds remote MCP servers with sign-in.",
	steps: [
		<>
			Find where the app adds a remote MCP server. It may say connector,
			extension or plugin.
		</>,
		<>
			Paste the address.
			<div className="mt-2">
				<Address />
			</div>
		</>,
	],
}

export const PICKS: AppGuide[] = [...APPS, OTHER_APP]

export function Badge({
	app,
	size = "md",
}: { app: PickKey; size?: "sm" | "md" }) {
	if (app !== "other") return <AppBadge app={app} size={size} />
	const dims =
		size === "sm"
			? "h-9 w-9 text-lg rounded-xl"
			: "h-12 w-12 text-2xl rounded-2xl"
	return (
		<span
			aria-hidden="true"
			className={`inline-flex shrink-0 items-center justify-center bg-white/[0.06] font-bold text-gray-300 ring-1 ring-white/15 ${dims}`}
		>
			+
		</span>
	)
}

export const GROUPS: { key: Group; title: string; sub: string }[] = [
	{ key: "chat", title: "Chat apps", sub: "Claude, ChatGPT" },
	{ key: "desktop", title: "Desktop apps", sub: "One click to add" },
	{ key: "terminal", title: "Terminal", sub: "Two commands" },
]

// The same for every app.
export const SIGN_IN_STEP = (
	<>
		GoodWatch opens. Sign in and press <Ui>Allow</Ui>.
	</>
)

// The selected app, kept in the address bar (#cursor) so a link opens one app's steps. Old /connect links
// (#claude, #claude-code, #chatgpt) still match.
export function useSelectedApp(initial: PickKey | null = "claude") {
	const [selected, setSelected] = useState<PickKey | null>(initial)
	useEffect(() => {
		const fromHash = () => {
			const key = window.location.hash.slice(1)
			if (PICKS.some((app) => app.key === key)) setSelected(key as PickKey)
		}
		fromHash()
		window.addEventListener("hashchange", fromHash)
		return () => window.removeEventListener("hashchange", fromHash)
	}, [])
	const select = (key: PickKey | null) => {
		setSelected(key)
		const url = `${window.location.pathname}${window.location.search}${key ? `#${key}` : ""}`
		window.history.replaceState(window.history.state, "", url)
	}
	const app = PICKS.find(({ key }) => key === selected) ?? null
	return { selected, select, app }
}

export function HelpLink({ app }: { app: AppGuide }) {
	return (
		<a
			href={app.help}
			target="_blank"
			rel="noreferrer"
			className="inline-flex items-center gap-1 font-semibold text-amber-500 hover:text-amber-400"
		>
			{app.name}'s help
			<ArrowTopRightOnSquareIcon className="h-4 w-4" aria-hidden="true" />
			<span className="sr-only">(opens in a new tab)</span>
		</a>
	)
}
