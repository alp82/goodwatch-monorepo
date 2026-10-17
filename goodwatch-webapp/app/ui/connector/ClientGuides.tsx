// How to add GoodWatch to each app, one guide per app, in the owner's order (Q57): Claude members first, then the
// apps technical members use, then ChatGPT. Menu names, plans and install links are the apps' own, as their
// help pages had them on October 17, 2026 (docs/implementation/mcp-distribution-research.md has the sources). They
// move from time to time, so each guide also says what to look for and how to set the app up by hand.
//
// "Tested" means we connected GoodWatch with that app ourselves; "Should work" means we followed the app's own docs
// but haven't connected it yet. Change a status only after a real sign-in and a real answer.
import { ArrowTopRightOnSquareIcon } from "@heroicons/react/24/outline"
import type { ComponentType, ReactNode } from "react"
import type { AppKey } from "~/ui/connector/AppBadge"
import { CopyField } from "~/ui/connector/CopyField"
import { CONNECTOR_NAME, CONNECTOR_URL } from "~/ui/connector/connector"
import {
	Aside,
	Code,
	More,
	OpenButton,
	type Status,
	Step,
	Steps,
	Ui,
} from "~/ui/connector/help-parts"
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

// When the plan notes and menu names were last checked against the apps' help pages.
export const CHECKED_ON = "October 17, 2026"

export type Client = {
	key: AppKey
	name: string
	// How GoodWatch gets in, for the picker: "Custom connector", "One-click install", "Terminal".
	how: string
	status: Status
	// What "Tested" or "Should work" means for this app, in one line.
	statusNote: string
	// Who can use it, as the app's maker says.
	plans: string
	// The app maker's own setup help, for when the menus have moved.
	help: string
	Guide: ComponentType
}

const ID = GOODWATCH_SERVER.id

export const CLIENTS: Client[] = [
	{
		key: "claude",
		name: "Claude",
		how: "Web and apps",
		status: "tested",
		statusNote:
			"Tested on claude.ai in a browser, October 2026. The desktop and phone apps should work too: they use the same connectors.",
		plans:
			"Every plan. Free has room for one custom connector. On Team and Enterprise, an owner adds it first.",
		help: "https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp",
		Guide: ClaudeGuide,
	},
	{
		key: "cursor",
		name: "Cursor",
		how: "One-click install",
		status: "should-work",
		statusNote:
			"Uses Cursor's documented install link. We haven't tested it yet.",
		plans: "Depends on your Cursor plan; Cursor's pricing pages don't say.",
		help: "https://cursor.com/docs/mcp",
		Guide: CursorGuide,
	},
	{
		key: "vscode",
		name: "VS Code",
		how: "One-click install",
		status: "should-work",
		statusNote:
			"Uses VS Code's documented install link. We haven't tested it yet.",
		plans:
			"Needs GitHub Copilot, including Copilot Free. Business and Enterprise organizations must allow MCP servers.",
		help: "https://code.visualstudio.com/docs/agent-customization/mcp-servers",
		Guide: VsCodeGuide,
	},
	{
		key: "goose",
		name: "Goose",
		how: "One-click install",
		status: "should-work",
		statusNote:
			"Uses Goose's documented install link. We haven't tested it yet.",
		plans: "Free app. The AI model you pick in Goose may cost money.",
		help: "https://goose.vcorp.ai/docs/getting-started/using-extensions/",
		Guide: GooseGuide,
	},
	{
		key: "lm-studio",
		name: "LM Studio",
		how: "One-click install",
		status: "should-work",
		statusNote:
			"Uses LM Studio's documented install link. We haven't tested it yet.",
		plans: "Free for home and work.",
		help: "https://lmstudio.ai/docs/app/mcp",
		Guide: LmStudioGuide,
	},
	{
		key: "claude-code",
		name: "Claude Code",
		how: "Terminal",
		status: "should-work",
		statusNote:
			"Worked against a development server in October 2026. Not tested with goodwatch.app yet.",
		plans:
			"Every Claude plan that includes Claude Code, or a Claude Console account.",
		help: "https://code.claude.com/docs/en/mcp",
		Guide: ClaudeCodeGuide,
	},
	{
		key: "gemini-cli",
		name: "Gemini CLI",
		how: "Terminal",
		status: "should-work",
		statusNote: "Follows Gemini CLI's docs. We haven't tested it yet.",
		plans: "Works with a free Google account.",
		help: "https://geminicli.com/docs/tools/mcp-server/",
		Guide: GeminiCliGuide,
	},
	{
		key: "codex",
		name: "Codex",
		how: "Terminal",
		status: "should-work",
		statusNote: "Follows OpenAI's Codex docs. We haven't tested it yet.",
		plans: "OpenAI's Codex docs don't name a plan limit for connectors.",
		help: "https://learn.chatgpt.com/docs/extend/mcp?surface=cli",
		Guide: CodexGuide,
	},
	{
		key: "chatgpt",
		name: "ChatGPT",
		how: "chatgpt.com",
		status: "should-work",
		statusNote: "Follows OpenAI's setup guide. We haven't tested it yet.",
		plans:
			"Business, Enterprise and Edu: see and change, on chatgpt.com in a browser. Pro: see only. Plus and Free: OpenAI's help doesn't list them.",
		help: "https://help.openai.com/en/articles/12584461-connecting-custom-mcp-servers-in-chatgpt",
		Guide: ChatGptGuide,
	},
]

export function ExternalLink({
	href,
	children,
}: { href: string; children: string }) {
	return (
		<a
			href={href}
			target="_blank"
			rel="noreferrer"
			className="inline-flex items-center gap-1 font-semibold text-amber-500 hover:text-amber-400"
		>
			{children}
			<ArrowTopRightOnSquareIcon className="h-4 w-4" aria-hidden="true" />
			<span className="sr-only">(opens in a new tab)</span>
		</a>
	)
}

function AddressField() {
	return <CopyField text={CONNECTOR_URL} label="Copy the connector address" />
}

function ClaudeGuide() {
	return (
		<>
			<div className="flex flex-col items-start gap-2">
				<OpenButton href={CLAUDE_CONNECTORS_URL} external>
					Open Claude's connector settings
					<ArrowTopRightOnSquareIcon className="h-5 w-5" aria-hidden="true" />
					<span className="sr-only">(opens in a new tab)</span>
				</OpenButton>
				<p className="text-sm text-gray-400">
					Or on claude.ai, open <Ui>Customize</Ui>, then <Ui>Connectors</Ui>.
				</p>
			</div>
			<Steps>
				<Step>
					Press <Ui>+ Add</Ui>, then <Ui>Add custom connector</Ui>.
				</Step>
				<Step>
					Name it <Ui>{CONNECTOR_NAME}</Ui>, paste the address and press{" "}
					<Ui>Continue</Ui>.
					<div className="mt-2">
						<AddressField />
					</div>
				</Step>
				<Step>
					Keep the sign-in settings Claude suggests and press <Ui>Add</Ui>.
				</Step>
				<Step>
					Press <Ui>Connect</Ui> next to GoodWatch. GoodWatch opens: sign in and
					press <Ui>Allow</Ui>.
				</Step>
				<Step>
					In a chat, press <Ui>+</Ui>, then <Ui>Connectors</Ui>, and switch
					GoodWatch on.
				</Step>
			</Steps>
			<Aside title="On your phone">
				Add GoodWatch on claude.ai or in the desktop app first. It then shows up
				in the Claude app on your phone, on the same account, with nothing more
				to set up.
			</Aside>
			<Aside title="On a Team or Enterprise plan">
				An owner of your organization adds GoodWatch once, under{" "}
				<Ui>Organization settings</Ui> → <Ui>Connectors</Ui>. Then everyone
				presses <Ui>Connect</Ui> under <Ui>Customize</Ui> → <Ui>Connectors</Ui>{" "}
				and signs in with their own GoodWatch account.
			</Aside>
		</>
	)
}

function ChatGptGuide() {
	return (
		<>
			<div className="flex flex-col items-start gap-2">
				<OpenButton href={CHATGPT_PLUGINS_URL} external>
					Open ChatGPT's plugins
					<ArrowTopRightOnSquareIcon className="h-5 w-5" aria-hidden="true" />
					<span className="sr-only">(opens in a new tab)</span>
				</OpenButton>
				<p className="text-sm text-gray-400">
					Use chatgpt.com in a browser. Custom connectors aren't in the ChatGPT
					phone app.
				</p>
			</div>
			<Steps>
				<Step>
					In <Ui>Plugins</Ui>, press <Ui>+</Ui> and choose{" "}
					<Ui>Add custom MCP server</Ui>.
				</Step>
				<Step>
					Name it <Ui>{CONNECTOR_NAME}</Ui>, paste the address and choose{" "}
					<Ui>OAuth</Ui> as the sign-in.
					<div className="mt-2">
						<AddressField />
					</div>
				</Step>
				<Step>
					Create it as a plugin, then install the plugin. GoodWatch opens: sign
					in and press <Ui>Allow</Ui>.
				</Step>
				<Step>
					In a new chat, type <Code>@</Code> and pick GoodWatch.
				</Step>
			</Steps>
			<More title="I see Apps instead of Plugins">
				<p>
					Some accounts still have the older menu. Open <Ui>Apps</Ui> and press{" "}
					<Ui>Create</Ui>, then fill in the same name, address and OAuth
					sign-in. If there's no <Ui>Create</Ui>, search ChatGPT's settings for
					"Developer mode" and turn it on first.
				</p>
			</More>
			<Aside title="On Business, Enterprise or Edu">
				On Business, a workspace owner or admin adds GoodWatch. Enterprise and
				Edu workspaces can let other roles add it too.
			</Aside>
		</>
	)
}

// The install button, what happens after it, and the way to add GoodWatch by hand.
function OneClick({
	app,
	link,
	afterwards,
	manual,
	extra,
}: {
	app: string
	link: string
	afterwards: string
	manual: ReactNode
	extra?: ReactNode
}) {
	return (
		<>
			<div className="flex flex-col items-start gap-2">
				<div className="flex flex-wrap items-center gap-3">
					<OpenButton href={link}>Add to {app}</OpenButton>
					{extra}
				</div>
				<p className="text-sm text-gray-400">
					Needs {app} on this computer. Your browser asks whether to open it:
					allow it.
				</p>
			</div>
			<Steps>
				<Step>{afterwards}</Step>
				<Step>
					GoodWatch opens in your browser: sign in and press <Ui>Allow</Ui>.
				</Step>
				<Step>Ask away in {app}'s chat.</Step>
			</Steps>
			<More title="Nothing happened? Add it by hand">{manual}</More>
		</>
	)
}

function CursorGuide() {
	return (
		<OneClick
			app="Cursor"
			link={cursorInstallLink()}
			afterwards="Cursor shows GoodWatch and asks you to confirm the install. If no sign-in starts, look for GoodWatch in Cursor's MCP settings and sign in from there."
			manual={
				<>
					<p>
						Add this to <Code>~/.cursor/mcp.json</Code> for all your projects,
						or to <Code>.cursor/mcp.json</Code> in one project:
					</p>
					<CopyField
						text={JSON.stringify({
							mcpServers: { [ID]: { url: CONNECTOR_URL } },
						})}
						label="Copy the Cursor settings"
					/>
				</>
			}
		/>
	)
}

function VsCodeGuide() {
	return (
		<OneClick
			app="VS Code"
			link={vscodeInstallLink()}
			afterwards="VS Code shows GoodWatch. Press Install, trust the server when asked, and press Allow when VS Code asks to sign in to GoodWatch."
			extra={
				<a
					href={vscodeInstallLink(undefined, { insiders: true })}
					className="text-sm font-semibold text-amber-500 hover:text-amber-400"
				>
					Add to VS Code Insiders
				</a>
			}
			manual={
				<>
					<p>
						Open the Command Palette, run <Ui>MCP: Add Server</Ui>, choose{" "}
						<Ui>HTTP</Ui> and paste the address. Or add this to{" "}
						<Code>.vscode/mcp.json</Code>:
					</p>
					<CopyField
						text={JSON.stringify({
							servers: { [ID]: { type: "http", url: CONNECTOR_URL } },
						})}
						label="Copy the VS Code settings"
					/>
					<p>Then select GoodWatch's tools in Copilot Chat's agent mode.</p>
				</>
			}
		/>
	)
}

function GooseGuide() {
	return (
		<OneClick
			app="Goose"
			link={gooseInstallLink()}
			afterwards="Goose Desktop asks whether to add the GoodWatch extension. Confirm."
			manual={
				<>
					<p>
						In Goose Desktop, open <Ui>Extensions</Ui> →{" "}
						<Ui>Add custom extension</Ui>, choose <Ui>Streamable HTTP</Ui> and
						paste the address:
					</p>
					<AddressField />
					<p>
						In the Goose command line, run <Code>goose configure</Code>, then{" "}
						<Ui>Add Extension</Ui> → <Ui>Remote Extension (Streamable HTTP)</Ui>
						.
					</p>
				</>
			}
		/>
	)
}

function LmStudioGuide() {
	return (
		<OneClick
			app="LM Studio"
			link={lmStudioInstallLink()}
			afterwards="LM Studio shows GoodWatch and asks you to install it. Confirm."
			manual={
				<>
					<p>
						In LM Studio's side bar, open <Ui>Program</Ui> → <Ui>Install</Ui> →{" "}
						<Ui>Edit mcp.json</Ui> and add:
					</p>
					<CopyField
						text={JSON.stringify({
							mcpServers: { [ID]: { url: CONNECTOR_URL } },
						})}
						label="Copy the LM Studio settings"
					/>
				</>
			}
		/>
	)
}

function Terminal({
	commands,
	app,
	signInNote,
}: { commands: TerminalSteps; app: string; signInNote: string }) {
	return (
		<Steps>
			<Step>
				In a terminal, add GoodWatch for all your projects:
				<div className="mt-2">
					<CopyField
						text={commands.add}
						label={`Copy the command that adds GoodWatch to ${app}`}
					/>
				</div>
			</Step>
			<Step>
				{commands.signInWhere === "app" ? `Start ${app} and type:` : "Sign in:"}
				<div className="mt-2">
					<CopyField
						text={commands.signIn}
						label={`Copy the command that signs ${app} in to GoodWatch`}
					/>
				</div>
				<p className="mt-2">
					GoodWatch opens in your browser: sign in and press <Ui>Allow</Ui>.{" "}
					{signInNote}
				</p>
			</Step>
		</Steps>
	)
}

function ClaudeCodeGuide() {
	return (
		<>
			<Terminal
				app="Claude Code"
				commands={claudeCodeCommands()}
				signInNote="Claude Code keeps you signed in. Inside Claude Code, /mcp does the same."
			/>
			<p className="text-sm text-gray-400">
				Already added GoodWatch on claude.ai? Claude Code can use that connector
				too when you sign in with the same Claude account.
			</p>
		</>
	)
}

function GeminiCliGuide() {
	return (
		<Terminal
			app="Gemini CLI"
			commands={geminiCliCommands()}
			signInNote="The browser has to run on the same computer as Gemini CLI."
		/>
	)
}

function CodexGuide() {
	return (
		<Terminal
			app="Codex"
			commands={codexCommands()}
			signInNote="The Codex app and IDE extension pick it up too."
		/>
	)
}
