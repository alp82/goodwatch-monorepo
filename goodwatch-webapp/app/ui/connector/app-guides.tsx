// How to add GoodWatch to each app, for /use-with-ai. Every app gets one thing to press first (an install link, the
// app's own settings page, or terminal commands), the few steps only it has, and a way to set it up by hand. The
// sign-in to GoodWatch is the same for every app, so the page shows it once.
// Menu names, plans and links are the apps' own as their help pages had them on October 17, 2026
// (docs/implementation/mcp-distribution-research.md has the sources). The install links and commands come from
// install-links.ts.
import { Fragment, type ReactNode, useEffect, useState } from "react"
import type { AppKey } from "~/ui/connector/AppBadge"
import { CopyField } from "~/ui/connector/CopyField"
import { CONNECTOR_NAME, CONNECTOR_URL } from "~/ui/connector/connector"
import { Code, Ui } from "~/ui/connector/help-parts"
import {
	CHATGPT_PLUGINS_URL,
	CLAUDE_CONNECTORS_URL,
	GOODWATCH_SERVER,
	type TerminalSteps,
	claudeCodeCommands,
	codexCommands,
	cursorInstallLink,
	geminiCliCommands,
	gooseInstallLink,
	lmStudioInstallLink,
	vscodeInstallLink,
} from "~/ui/connector/install-links"

// "other" is any app that adds a remote MCP server with sign-in.
export type GuideKey = AppKey | "other"

export type AppGuide = {
	// Also the address bar hash that opens this guide (/use-with-ai#cursor).
	key: GuideKey
	name: string
	// The one thing to press first. Terminal apps have commands instead.
	action?: { href: string; label: string; external?: boolean }
	// A second, smaller link next to the action (VS Code Insiders).
	extraAction?: { href: string; label: string }
	// One short line under the action: where it works, who can use it.
	note?: string
	// Terminal apps: the commands to copy, in order.
	commands?: { label: string; text: string }[]
	// The steps only this app has, before the GoodWatch sign-in.
	steps: ReactNode[]
	// A step after the sign-in that only this app has.
	after?: ReactNode
	// For when the main way doesn't work, behind a disclosure.
	manual?: { title: string; body: ReactNode }
}

const ID = GOODWATCH_SERVER.id

export function AddressField() {
	return <CopyField text={CONNECTOR_URL} label="Copy the connector address" />
}

function SettingsField({ value }: { value: unknown }) {
	return <CopyField text={JSON.stringify(value)} label="Copy the settings" />
}

function oneClick({
	key,
	name,
	link,
	confirm,
	manual,
}: {
	key: AppKey
	name: string
	link: string
	confirm: ReactNode
	manual: ReactNode
}): AppGuide {
	return {
		key,
		name,
		action: { href: link, label: `Add to ${name}` },
		note: `Opens ${name} on this computer. Your browser may ask first: allow it.`,
		steps: [confirm],
		manual: { title: "Nothing happened? Add it by hand", body: manual },
	}
}

function terminal(
	key: AppKey,
	name: string,
	commands: TerminalSteps,
): AppGuide {
	return {
		key,
		name,
		commands: [
			{ label: "In a terminal, add GoodWatch:", text: commands.add },
			{
				label:
					commands.signInWhere === "app"
						? `Start ${name} and type:`
						: "Then sign in:",
				text: commands.signIn,
			},
		],
		steps: [],
	}
}

// In the owner's order (Q57): Claude first, then the apps technical members use, then ChatGPT, then any other app.
export const APP_GUIDES: AppGuide[] = [
	{
		key: "claude",
		name: "Claude",
		action: {
			href: CLAUDE_CONNECTORS_URL,
			label: "Open Claude's connectors",
			external: true,
		},
		note: "Add it once on claude.ai or in the desktop app. The phone app picks it up. On Team and Enterprise, an owner adds it first.",
		steps: [
			<Fragment key="step-1">
				Press <Ui>+ Add</Ui>, then <Ui>Add custom connector</Ui>.
			</Fragment>,
			<Fragment key="step-2">
				Name it <Ui>{CONNECTOR_NAME}</Ui>, paste the address, press <Ui>Add</Ui>
				, then <Ui>Connect</Ui>.
				<div className="mt-2">
					<AddressField />
				</div>
			</Fragment>,
		],
		after: (
			<>
				In a chat, press <Ui>+</Ui>, then <Ui>Connectors</Ui>, and switch
				GoodWatch on.
			</>
		),
	},
	oneClick({
		key: "cursor",
		name: "Cursor",
		link: cursorInstallLink(),
		confirm: "Confirm the install in Cursor.",
		manual: (
			<>
				<p>
					Add this to <Code>~/.cursor/mcp.json</Code>:
				</p>
				<SettingsField
					value={{ mcpServers: { [ID]: { url: CONNECTOR_URL } } }}
				/>
			</>
		),
	}),
	{
		...oneClick({
			key: "vscode",
			name: "VS Code",
			link: vscodeInstallLink(),
			confirm: (
				<>
					Press <Ui>Install</Ui> and trust the server when VS Code asks.
				</>
			),
			manual: (
				<>
					<p>
						Run <Ui>MCP: Add Server</Ui> from the Command Palette, choose{" "}
						<Ui>HTTP</Ui> and paste the address. Or add this to{" "}
						<Code>.vscode/mcp.json</Code>:
					</p>
					<SettingsField
						value={{ servers: { [ID]: { type: "http", url: CONNECTOR_URL } } }}
					/>
				</>
			),
		}),
		note: "Needs GitHub Copilot, Copilot Free included. Your browser may ask to open VS Code: allow it.",
		extraAction: {
			href: vscodeInstallLink(undefined, { insiders: true }),
			label: "Add to VS Code Insiders",
		},
	},
	oneClick({
		key: "goose",
		name: "Goose",
		link: gooseInstallLink(),
		confirm: "Confirm the extension in Goose.",
		manual: (
			<>
				<p>
					In Goose Desktop, open <Ui>Extensions</Ui>, then{" "}
					<Ui>Add custom extension</Ui>, choose <Ui>Streamable HTTP</Ui> and
					paste the address:
				</p>
				<AddressField />
			</>
		),
	}),
	oneClick({
		key: "lm-studio",
		name: "LM Studio",
		link: lmStudioInstallLink(),
		confirm: "Confirm the install in LM Studio.",
		manual: (
			<>
				<p>
					Open <Ui>Program</Ui>, then <Ui>Install</Ui>, then{" "}
					<Ui>Edit mcp.json</Ui>, and add:
				</p>
				<SettingsField
					value={{ mcpServers: { [ID]: { url: CONNECTOR_URL } } }}
				/>
			</>
		),
	}),
	terminal("claude-code", "Claude Code", claudeCodeCommands()),
	terminal("gemini-cli", "Gemini CLI", geminiCliCommands()),
	terminal("codex", "Codex", codexCommands()),
	{
		key: "chatgpt",
		name: "ChatGPT",
		action: {
			href: CHATGPT_PLUGINS_URL,
			label: "Open ChatGPT's plugins",
			external: true,
		},
		note: "On chatgpt.com in a browser, with Business, Enterprise or Edu. On Pro it can only read.",
		steps: [
			<Fragment key="step-3">
				Press <Ui>+</Ui>, then <Ui>Add custom MCP server</Ui>.
			</Fragment>,
			<Fragment key="step-4">
				Name it <Ui>{CONNECTOR_NAME}</Ui>, paste the address and pick{" "}
				<Ui>OAuth</Ui>. Then create the plugin and install it.
				<div className="mt-2">
					<AddressField />
				</div>
			</Fragment>,
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
					Open <Ui>Apps</Ui>, press <Ui>Create</Ui> and fill in the same name,
					address and OAuth sign-in. No <Ui>Create</Ui>? Search ChatGPT's
					settings for "Developer mode" and turn it on first.
				</p>
			),
		},
	},
	{
		key: "other",
		name: "Other app",
		note: "Any app that adds a remote MCP server with sign-in.",
		steps: [
			<Fragment key="step-5">
				Find where the app adds a remote MCP server. It may call it a connector,
				an extension or a plugin.
			</Fragment>,
			<Fragment key="step-6">
				Paste the address.
				<div className="mt-2">
					<AddressField />
				</div>
			</Fragment>,
		],
	},
]

const isGuideKey = (key: string): key is GuideKey =>
	APP_GUIDES.some((guide) => guide.key === key)

// The selected app, kept in the address bar (#cursor) so a link opens one app's steps. The page puts an element with
// each app's id on its steps, so the browser scrolls there by itself.
export function useSelectedGuide() {
	const [selected, setSelected] = useState<GuideKey>(APP_GUIDES[0].key)
	useEffect(() => {
		const fromHash = () => {
			const key = window.location.hash.slice(1)
			if (!isGuideKey(key)) return
			setSelected(key)
		}
		fromHash()
		window.addEventListener("hashchange", fromHash)
		return () => window.removeEventListener("hashchange", fromHash)
	}, [])
	const select = (key: GuideKey) => {
		setSelected(key)
		// Replace, not push: the back button leaves the page instead of stepping through apps.
		window.history.replaceState(window.history.state, "", `#${key}`)
	}
	const guide = APP_GUIDES.find(({ key }) => key === selected) ?? APP_GUIDES[0]
	return { guide, select }
}
