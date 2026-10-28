// PROTOTYPE - throwaway (branch prototype/import-ai-hint). Four ways to tell members on the Imports page's Bring step
// that their AI app, with GoodWatch connected, can import a list from anywhere: Apple Notes, a screenshot, a
// spreadsheet, a group chat, or an app GoodWatch has no import for. Switch with ?variant=A|B|C|D.
// Every promise here maps to a real MCP tool: log_watch, rate_title, set_want_to_see (up to 50 per call) and
// undo_watch with the batch id.
import { ArrowRightIcon, SparklesIcon } from "@heroicons/react/24/solid"
import { Link, useSearchParams } from "@remix-run/react"
import { useState } from "react"
import { AppBadge } from "~/ui/connector/AppBadge"
import { USE_WITH_AI_PATH } from "~/ui/connector/connector"
import { CopyField } from "~/ui/connector/CopyField"
import { MockWindow, ToolLine, UserBubble } from "~/ui/use-with-ai/ChatDemo"
import { Disclosure } from "../ImportFlowParts"
import { secondaryButton, textLink } from "../shared"

export const AI_HINT_VARIANTS = {
	A: "One more way (quiet row)",
	B: "AI app as a source",
	C: "Where's your list?",
	D: "Show the note becoming a library",
} as const
export type AiHintVariant = keyof typeof AI_HINT_VARIANTS

export function useAiHintVariant(): AiHintVariant {
	const [params] = useSearchParams()
	const v = params.get("variant")
	return v && v in AI_HINT_VARIANTS ? (v as AiHintVariant) : "A"
}

const DEFAULT_PROMPT =
	"add this list to goodwatch. ✓ means i've seen it, numbers are my scores, the rest goes on my want to see"

const PLACES = [
	{
		key: "notes",
		label: "Apple Notes",
		how: "Copy the note and paste it into the chat.",
		prompt: "add the movies in this note to my goodwatch want to see",
	},
	{
		key: "screenshot",
		label: "A screenshot",
		how: "Attach the screenshot. Your AI app reads the titles off the picture.",
		prompt: "these are shows i've watched, mark them as seen in goodwatch",
	},
	{
		key: "sheet",
		label: "A spreadsheet",
		how: "Attach the file or paste the rows.",
		prompt: "import this into goodwatch, column b is my score out of 10",
	},
	{
		key: "chat",
		label: "A group chat",
		how: "Copy the messages with the recommendations and paste them.",
		prompt: "add every movie my friends recommended here to my want to see",
	},
	{
		key: "paper",
		label: "A paper list",
		how: "Take a photo of the page and attach it.",
		prompt: "i've seen all of these, mark them as seen in goodwatch",
	},
	{
		key: "app",
		label: "Another app",
		how: "Export from that app, then attach the file. Any format works.",
		prompt: "here's my export from simkl, bring my scores into goodwatch",
	},
] as const

const APPS = ["claude", "chatgpt", "cursor"] as const

function AppRow() {
	return (
		<span className="flex -space-x-1.5" aria-hidden>
			{APPS.map((app) => (
				<AppBadge key={app} app={app} size="sm" />
			))}
		</span>
	)
}

function UndoLine() {
	return (
		<p className="text-sm text-gray-400">
			Changed your mind? Ask it to undo, and the whole batch goes back.
		</p>
	)
}

function SetupLink({ label = "Connect GoodWatch to your AI app" }) {
	return (
		<Link to={USE_WITH_AI_PATH} className={`${textLink} text-sm`}>
			{label}
		</Link>
	)
}

/** Shown in the red "GoodWatch doesn't know this file" card, in variant A. */
export function AiRescueLine() {
	return (
		<p className="text-sm">
			Any file or list works with your AI app.{" "}
			<Link to={USE_WITH_AI_PATH} className={textLink}>
				Import it with AI
			</Link>
		</p>
	)
}

// ── A: a quiet third row under "Or connect an account", opening in place ──────────────────────────────

export function VariantA() {
	const [open, setOpen] = useState(false)
	return (
		<div className="flex flex-col items-center gap-3">
			<p className="text-sm text-gray-400">Or ask your AI app</p>
			<button
				type="button"
				aria-expanded={open}
				onClick={() => setOpen(!open)}
				className={secondaryButton}
			>
				<span className="-my-1 scale-75">
					<AppRow />
				</span>
				Notes, screenshots, any list
			</button>
			{open && (
				<div className="mt-1 flex w-full flex-col gap-3 rounded-2xl bg-white/[0.03] p-4 text-left ring-1 ring-white/10">
					<p className="text-gray-200">
						With GoodWatch connected, Claude, ChatGPT, and other AI apps can
						add titles for you. Paste a note, attach a screenshot or a
						spreadsheet, and say what to do with it:
					</p>
					<CopyField text={DEFAULT_PROMPT} label="Copy the prompt" mono={false} />
					<UndoLine />
					<SetupLink />
				</div>
			)}
		</div>
	)
}

// ── B: the AI app listed as a source; picking it opens its steps where a source opens ────────────────

export function VariantBButton({ onOpen }: { onOpen: () => void }) {
	return (
		<button
			type="button"
			onClick={onOpen}
			className="flex min-h-11 w-full cursor-pointer items-center gap-3 rounded-lg bg-slate-900/60 p-3 text-left ring-1 ring-slate-800 hover:bg-slate-800"
		>
			<AppBadge app="claude" size="sm" />
			<span className="min-w-0 flex-1">
				<span className="block font-semibold text-white">
					Anything else, with your AI app
				</span>
				<span className="block text-xs text-gray-400">
					Notes, screenshots, spreadsheets, other apps · Right away
				</span>
			</span>
			<ArrowRightIcon className="size-4 text-gray-500" aria-hidden />
		</button>
	)
}

export function VariantBPanel({ onOther }: { onOther: () => void }) {
	const steps = [
		{
			title: "Connect GoodWatch to your AI app",
			body: (
				<div className="flex flex-wrap items-center gap-3">
					<AppRow />
					<SetupLink label="Set it up in Claude, ChatGPT, and more" />
				</div>
			),
		},
		{
			title: "Bring your list",
			body: (
				<p>
					Paste a note or chat, or attach a screenshot, a photo, a
					spreadsheet, or an export from any app.
				</p>
			),
		},
		{
			title: "Say what it is",
			body: (
				<div className="flex flex-col gap-2">
					<CopyField text={DEFAULT_PROMPT} label="Copy the prompt" mono={false} />
					<p className="text-sm text-gray-400">
						It marks what you've seen, saves your scores, and adds the rest to
						Want to See, up to 50 titles at a time.
					</p>
				</div>
			),
		},
	]
	return (
		<section className="w-full text-left">
			<div className="mb-4 flex flex-wrap items-center gap-3">
				<AppBadge app="claude" size="sm" />
				<span className="text-lg font-bold text-white">Your AI app</span>
				<span className="rounded-full bg-white/10 px-2 py-0.5 text-xs font-semibold text-gray-300">
					Right away
				</span>
				<button
					type="button"
					className="ml-auto cursor-pointer text-sm font-semibold text-indigo-300 underline underline-offset-4 hover:text-indigo-200"
					onClick={onOther}
				>
					Pick another source
				</button>
			</div>
			<ol className="flex flex-col gap-5 rounded-2xl bg-gray-900/90 p-5 text-gray-300 ring-1 ring-white/10 md:p-6">
				{steps.map((step, i) => (
					<li key={step.title} className="flex gap-4">
						<span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-indigo-700 font-bold text-white">
							{i + 1}
						</span>
						<div className="flex min-w-0 flex-1 flex-col gap-2">
							<p className="font-semibold text-white">{step.title}</p>
							{step.body}
						</div>
					</li>
				))}
			</ol>
			<div className="mt-3 px-1">
				<UndoLine />
			</div>
		</section>
	)
}

// ── C: "Where's your list?" picker; each place gets its own how-to and prompt ────────────────────────

export function VariantC() {
	const [pick, setPick] = useState<(typeof PLACES)[number]["key"]>("notes")
	const place = PLACES.find((p) => p.key === pick) ?? PLACES[0]
	return (
		<section className="flex flex-col gap-4 rounded-2xl bg-white/[0.03] p-5 text-left ring-1 ring-white/10">
			<div className="flex items-start gap-3">
				<SparklesIcon className="mt-0.5 size-6 shrink-0 text-amber-300" aria-hidden />
				<div>
					<h3 className="text-lg font-bold text-white">
						No export? Your AI app can import it
					</h3>
					<p className="text-sm text-gray-400">
						Where is your list?
					</p>
				</div>
			</div>
			<div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Where is your list?">
				{PLACES.map((p) => (
					<button
						key={p.key}
						type="button"
						role="radio"
						aria-checked={p.key === pick}
						onClick={() => setPick(p.key)}
						className={`min-h-11 cursor-pointer rounded-full px-4 text-sm font-semibold ring-1 ${p.key === pick ? "bg-amber-400/15 text-amber-200 ring-amber-400/60" : "bg-slate-900/60 text-gray-300 ring-slate-700 hover:bg-slate-800"}`}
					>
						{p.label}
					</button>
				))}
			</div>
			<div className="flex flex-col gap-2">
				<p className="text-gray-200">{place.how} Then send:</p>
				<CopyField text={place.prompt} label="Copy the prompt" mono={false} />
			</div>
			<div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-3">
				<UndoLine />
				<div className="flex items-center gap-2">
					<AppRow />
					<SetupLink label="Connect your AI app" />
				</div>
			</div>
		</section>
	)
}

// ── D: show it; a messy note on the left turns into a chat that fills the library ───────────────────

const NOTE = [
	"movies 🍿",
	"- past lives ✓ loved it",
	"- dune 2 ✓ 9/10",
	"- the zone of interest",
	"- perfect days (anna says!!)",
	"- aftersun ✓",
	"- oppenheimer ✓ meh 6",
	"- anatomy of a fall",
]

export function VariantD() {
	const [more, setMore] = useState(false)
	return (
		<section className="flex flex-col gap-4 text-left">
			<div>
				<h3 className="text-lg font-bold text-white">
					Your list lives somewhere else?
				</h3>
				<p className="text-sm text-gray-400">
					Paste it into your AI app with GoodWatch connected. A note, a
					screenshot, a spreadsheet, anything.
				</p>
			</div>
			<div className="grid items-center gap-3 md:grid-cols-[minmax(0,0.8fr)_auto_minmax(0,1.2fr)]">
				<MockWindow title="Notes" tone="light">
					<pre className="whitespace-pre-wrap px-4 py-3 font-sans text-sm leading-relaxed">
						{NOTE.join("\n")}
					</pre>
				</MockWindow>
				<ArrowRightIcon
					className="mx-auto size-6 rotate-90 text-gray-500 md:rotate-0"
					aria-hidden
				/>
				<MockWindow title="Your AI app">
					<div className="flex flex-col gap-3 p-4 text-sm">
						<UserBubble>
							add this to goodwatch. ✓ means seen, numbers are my scores
						</UserBubble>
						<ToolLine>Used GoodWatch: log watches (4)</ToolLine>
						<ToolLine>Used GoodWatch: rate titles (2)</ToolLine>
						<ToolLine>Used GoodWatch: Want to See (3)</ToolLine>
						<p className="text-gray-200">
							Done. 4 marked as seen, Dune: Part Two scored 9 and Oppenheimer
							6, and 3 more on your Want to See. You said you loved Past
							Lives. Want to give it a score?
						</p>
					</div>
				</MockWindow>
			</div>
			<Disclosure label="How do I do this?" open={more} onToggle={setMore} bordered={false}>
				<ol className="flex list-decimal flex-col gap-2 pl-5 text-gray-300">
					<li>
						<SetupLink /> (once).
					</li>
					<li>Paste your list or attach a screenshot or file.</li>
					<li>
						Say what it is, the way you'd tell a friend:
						<div className="mt-2">
							<CopyField text={DEFAULT_PROMPT} label="Copy the prompt" mono={false} />
						</div>
					</li>
				</ol>
				<div className="mt-3">
					<UndoLine />
				</div>
			</Disclosure>
		</section>
	)
}
