// PROTOTYPE - throwaway (branch prototype/import-ai-hint), round 2. "Your AI app" is a source on the Imports page: it
// opens where a source opens and drives the real stepper (Bring → Choose → Import → Done). The AI app's writes are
// simulated with timers; a real build would watch the member's MCP batches arriving. Three variants:
//   E  Four steps   - each step is its own screen, like a file import
//   F  Hands-off    - one Bring screen; the page reacts on its own when the AI app starts writing
//   G  One stage    - the Notes → chat illustration stays put and each step lights up one part of it
import { ArrowRightIcon, CheckCircleIcon } from "@heroicons/react/24/solid"
import { Link } from "@remix-run/react"
import { type ReactNode, useEffect, useRef, useState } from "react"
import { AppBadge } from "~/ui/connector/AppBadge"
import { USE_WITH_AI_PATH } from "~/ui/connector/connector"
import { CopyField } from "~/ui/connector/CopyField"
import { MockWindow, ToolLine, UserBubble } from "~/ui/use-with-ai/ChatDemo"
import { CountTiles } from "../ImportDone"
import {
	Answer,
	type FlowPoster,
	PosterLights,
	StepHeading,
	useReportStep,
} from "../ImportFlowParts"
import { primaryButton, secondaryButton, textLink } from "../shared"

export const ROUND2_VARIANTS = {
	E: "Four steps",
	F: "Hands-off (page reacts)",
	G: "One stage",
} as const
export type Round2Variant = keyof typeof ROUND2_VARIANTS

/* ── Sample list ─────────────────────────────────────────────────────────────────────────────────────────────── */

type Line = {
	text: string
	title: string
	poster: string
	seen: boolean
	score?: number
}
const LIST: Line[] = [
	{ text: "arrival ✓ loved it", title: "Arrival", poster: "/pEzNVQfdzYDzVK0XqxERIw2x2se.jpg", seen: true },
	{ text: "dune 2 ✓ 9/10", title: "Dune: Part Two", poster: "/6izwz7rsy95ARzTR3poZ8H6c5pp.jpg", seen: true, score: 9 },
	{ text: "severance ✓", title: "Severance", poster: "/pPHpeI2X1qEd1CS1SeyrdhZ4qnT.jpg", seen: true },
	{ text: "prisoners (tom says!!)", title: "Prisoners", poster: "/uhviyknTT5cEQXbn6vWIqfM4vGm.jpg", seen: false },
	{ text: "sicario ✓ meh 6", title: "Sicario", poster: "/lz8vNyXeidqqOdJW9ZjnDAMb5Vr.jpg", seen: true, score: 6 },
	{ text: "incendies", title: "Incendies", poster: "/yH6DAQVgbyj72S66gN4WWVoTjuf.jpg", seen: false },
	{ text: "magnolia ✓", title: "Magnolia", poster: "/tpfC325Jk6S38VTe5dDWjWtoyxr.jpg", seen: true },
	{ text: "blade runner 2049", title: "Blade Runner 2049", poster: "/gajva2L0rPYkEWjzgFlBXCAVBE5.jpg", seen: false },
]
const POSTERS: FlowPoster[] = LIST.map((l) => ({ key: l.title, title: l.title, posterPath: l.poster }))
const SEEN = LIST.filter((l) => l.seen).length
const SCORED = LIST.filter((l) => l.score).length
const WANT = LIST.length - SEEN

const PLACES = [
	{ key: "notes", label: "Notes", how: "Copy the note and paste it into the chat." },
	{ key: "screenshot", label: "Screenshot", how: "Attach the screenshot. Your AI app reads the titles off it." },
	{ key: "sheet", label: "Spreadsheet", how: "Attach the file or paste the rows." },
	{ key: "chat", label: "Group chat", how: "Copy the messages and paste them." },
	{ key: "app", label: "Another app", how: "Attach that app's export. Any format works." },
] as const
type PlaceKey = (typeof PLACES)[number]["key"]

/* ── Rules → prompt ──────────────────────────────────────────────────────────────────────────────────────────── */

type Rules = { seen: boolean; scores: boolean; want: boolean }
const ALL_RULES: Rules = { seen: true, scores: true, want: true }
const promptFor = (r: Rules) => {
	const parts = [
		r.seen && "✓ means i've seen it",
		r.scores && "numbers are my scores",
		r.want && "the rest goes on my want to see",
	].filter(Boolean)
	return parts.length ? `add this list to goodwatch. ${parts.join(", ")}` : "add this list to goodwatch"
}
const ruleCount = (r: Rules) => Number(r.seen) + Number(r.scores) + Number(r.want)

/* ── Simulated AI writes ─────────────────────────────────────────────────────────────────────────────────────── */

const TOOL_LINES = [
	{ at: 0.05, text: `Used GoodWatch: log watches (${SEEN})` },
	{ at: 0.45, text: `Used GoodWatch: rate titles (${SCORED})` },
	{ at: 0.7, text: `Used GoodWatch: Want to See (${WANT})` },
]

/** Progress 0..1 while the "AI app" writes; then `done`. Undo plays it back down. */
function useAiWrites(onDone: () => void) {
	const [progress, setProgress] = useState(0)
	const [running, setRunning] = useState(false)
	const done = useRef(onDone)
	done.current = onDone
	const start = () => setRunning(true)
	useEffect(() => {
		if (!running) return
		const t = setInterval(() => {
			setProgress((p) => {
				const next = Math.min(1, p + 1 / (LIST.length * 2))
				if (next >= 1) {
					clearInterval(t)
					setRunning(false)
					setTimeout(() => done.current(), 600)
				}
				return next
			})
		}, 220)
		return () => clearInterval(t)
	}, [running])
	return { progress, running, start, reset: () => setProgress(0) }
}

/* ── Shared pieces ───────────────────────────────────────────────────────────────────────────────────────────── */

function SimButton({ onClick, label = "Simulate: your AI app adds the list" }: { onClick: () => void; label?: string }) {
	return (
		<button
			type="button"
			onClick={onClick}
			className="min-h-11 cursor-pointer self-start rounded-full border-2 border-dashed border-fuchsia-500 px-4 text-sm font-semibold text-fuchsia-300 hover:bg-fuchsia-500/10"
		>
			Prototype · {label}
		</button>
	)
}

function ConnectedLine({ connected, onToggle }: { connected: boolean; onToggle: () => void }) {
	return (
		<div className="flex flex-wrap items-center gap-3 rounded-xl bg-white/[0.03] px-4 py-3 ring-1 ring-white/10">
			<AppBadge app="claude" size="sm" />
			{connected ? (
				<p className="flex-1 text-gray-200">
					<CheckCircleIcon className="mr-1 inline size-5 text-emerald-400" aria-hidden />
					GoodWatch is connected to Claude
				</p>
			) : (
				<p className="flex-1 text-gray-200">
					First, connect GoodWatch to your AI app.{" "}
					<Link to={USE_WITH_AI_PATH} target="_blank" className={textLink}>
						Set it up (opens in a new tab)
					</Link>
				</p>
			)}
			<button type="button" onClick={onToggle} className="text-xs font-semibold text-fuchsia-300 underline">
				Prototype · {connected ? "show not connected" : "show connected"}
			</button>
		</div>
	)
}

function NoteWindow({ lit = true, place = "notes" }: { lit?: boolean; place?: PlaceKey }) {
	const title = { notes: "Notes", screenshot: "Screenshot", sheet: "Spreadsheet", chat: "Group chat", app: "export.csv" }[place]
	return (
		<div className={`transition-opacity duration-500 ${lit ? "opacity-100" : "opacity-40"}`}>
			<MockWindow title={title} tone="light">
				<pre className="whitespace-pre-wrap px-4 py-3 font-sans text-sm leading-relaxed">
					{["movies 🍿", ...LIST.map((l) => `- ${l.text}`)].join("\n")}
				</pre>
			</MockWindow>
		</div>
	)
}

function ChatWindow({
	prompt,
	progress,
	lit = true,
	promptLit = true,
}: { prompt: string; progress: number; lit?: boolean; promptLit?: boolean }) {
	return (
		<div className={`transition-opacity duration-500 ${lit ? "opacity-100" : "opacity-40"}`}>
			<MockWindow title="Your AI app">
				<div className="flex min-h-56 flex-col gap-3 p-4 text-sm">
					<div className={`transition-opacity duration-500 ${promptLit ? "opacity-100" : "opacity-30"}`}>
						<UserBubble>
							<span className="block text-xs text-gray-300">📎 movies 🍿 ({LIST.length} lines)</span>
							{prompt}
						</UserBubble>
					</div>
					{TOOL_LINES.filter((l) => progress >= l.at).map((l) => (
						<ToolLine key={l.text}>{l.text}</ToolLine>
					))}
					{progress >= 1 && (
						<p className="text-gray-200">
							Done. {SEEN} marked as seen, Dune: Part Two scored 9 and Sicario 6, and {WANT} on your Want to
							See. You said you loved Arrival. Want to give it a score?
						</p>
					)}
				</div>
			</MockWindow>
		</div>
	)
}

function Illustration({ prompt, progress, place }: { prompt: string; progress: number; place?: PlaceKey }) {
	return (
		<div className="grid items-center gap-3 md:grid-cols-[minmax(0,0.8fr)_auto_minmax(0,1.2fr)]">
			<NoteWindow place={place} />
			<ArrowRightIcon className="mx-auto size-6 rotate-90 text-gray-500 md:rotate-0" aria-hidden />
			<ChatWindow prompt={prompt} progress={progress} />
		</div>
	)
}

function PlaceChips({ place, onPick }: { place: PlaceKey; onPick: (p: PlaceKey) => void }) {
	return (
		<div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Where is your list?">
			{PLACES.map((p) => (
				<button
					key={p.key}
					type="button"
					role="radio"
					aria-checked={p.key === place}
					onClick={() => onPick(p.key)}
					className={`min-h-11 cursor-pointer rounded-full px-4 text-sm font-semibold ring-1 ${p.key === place ? "bg-amber-400/15 text-amber-200 ring-amber-400/60" : "bg-slate-900/60 text-gray-300 ring-slate-700 hover:bg-slate-800"}`}
				>
					{p.label}
				</button>
			))}
		</div>
	)
}

function RuleAnswers({ rules, setRules }: { rules: Rules; setRules: (r: Rules) => void }) {
	return (
		<div className="flex flex-col gap-2">
			<Answer selected={rules.seen} onClick={() => setRules({ ...rules, seen: !rules.seen })} title="Ticked titles are Seen" note="✓, x, done, watched" />
			<Answer selected={rules.scores} onClick={() => setRules({ ...rules, scores: !rules.scores })} title="Numbers are scores" note="9/10, 4 stars, meh 6" />
			<Answer selected={rules.want} onClick={() => setRules({ ...rules, want: !rules.want })} title="Everything else goes on Want to See" />
		</div>
	)
}

const TILES = (undone: boolean) => [
	{ key: "seen", name: "Seen", total: undone ? 412 : 417, added: undone ? 0 : SEEN, removed: undone ? SEEN : 0 },
	{ key: "scores", name: "Scores", total: undone ? 268 : 270, added: undone ? 0 : SCORED, removed: undone ? SCORED : 0 },
	{ key: "want", name: "Want to See", total: undone ? 57 : 60, added: undone ? 0 : WANT, removed: undone ? WANT : 0 },
]

function DoneBlock({ onAnother, focus }: { onAnother: () => void; focus: boolean }) {
	const [undone, setUndone] = useState(false)
	return (
		<div className="flex flex-col gap-5">
			<StepHeading focus={focus}>{undone ? "Taken back" : "Your list is in"}</StepHeading>
			<PosterLights posters={POSTERS} progress={undone ? 0 : 1} tone={undone ? "red" : "amber"} />
			<CountTiles tiles={TILES(undone)} />
			{!undone && (
				<p className="text-gray-300">
					Your AI app asked about Arrival, which has no score yet. You can answer there, or score it here.
				</p>
			)}
			<div className="flex flex-wrap gap-3">
				<button type="button" className={primaryButton} onClick={onAnother}>
					Bring another list
				</button>
				{!undone && (
					<button type="button" className={secondaryButton} onClick={() => setUndone(true)}>
						Undo all {LIST.length}
					</button>
				)}
			</div>
		</div>
	)
}

/** The header every source shows at Bring. */
export function AiSourceHeader({ onOther }: { onOther: () => void }) {
	return (
		<div className="mb-4 flex flex-wrap items-center gap-3">
			<AppBadge app="claude" size="sm" />
			<span className="text-lg font-bold text-white">Your AI app</span>
			<span className="rounded-full bg-white/10 px-2 py-0.5 text-xs font-semibold text-gray-300">Right away</span>
			<button
				type="button"
				className="ml-auto cursor-pointer text-sm font-semibold text-indigo-300 underline underline-offset-4 hover:text-indigo-200"
				onClick={onOther}
			>
				Pick another source
			</button>
		</div>
	)
}

const box = "flex w-full flex-col gap-5 rounded-2xl bg-gray-900/90 p-5 text-left text-base text-gray-300 ring-1 ring-white/10 md:p-6"
type Step = 1 | 2 | 3 | 4

const notesFor = (step: Step, rules: Rules, progress: number): [string, string, string, string] => [
	"Your AI app",
	step >= 2 ? `${ruleCount(rules)} rules` : "",
	step >= 3 ? (progress >= 1 ? `${LIST.length} titles` : `${Math.round(progress * LIST.length)} of ${LIST.length}`) : "",
	step === 4 ? `${LIST.length} added` : "",
]

/* ── E: four steps, each its own screen ──────────────────────────────────────────────────────────────────────── */

export function FlowE({ onOther }: { onOther: () => void }) {
	const [step, setStep] = useState<Step>(1)
	const [rules, setRules] = useState<Rules>(ALL_RULES)
	const [place, setPlace] = useState<PlaceKey>("notes")
	const [connected, setConnected] = useState(true)
	const writes = useAiWrites(() => setStep(4))
	useReportStep({ step, notes: notesFor(step, rules, writes.progress), allDone: step === 4, back: step === 2 ? () => setStep(1) : undefined })
	const prompt = promptFor(rules)
	return (
		<>
			{step === 1 && <AiSourceHeader onOther={onOther} />}
			<div className={box}>
				{step === 1 && (
					<>
						<StepHeading focus={false}>Bring a list from anywhere</StepHeading>
						<p>Your AI app reads it and adds the titles to GoodWatch. Where is your list?</p>
						<PlaceChips place={place} onPick={setPlace} />
						<Illustration prompt={prompt} progress={1} place={place} />
						<ConnectedLine connected={connected} onToggle={() => setConnected(!connected)} />
						<button type="button" className={`${primaryButton} self-start`} disabled={!connected} onClick={() => setStep(2)}>
							Next
						</button>
					</>
				)}
				{step === 2 && (
					<>
						<StepHeading focus>What's in your list?</StepHeading>
						<RuleAnswers rules={rules} setRules={setRules} />
						<p className="text-gray-200">{PLACES.find((p) => p.key === place)?.how} Then send this with it:</p>
						<CopyField text={prompt} label="Copy the prompt" mono={false} size="lg" />
						<button type="button" className={`${primaryButton} self-start`} onClick={() => setStep(3)}>
							I sent it
						</button>
					</>
				)}
				{step === 3 && (
					<>
						<StepHeading focus>{writes.progress > 0 ? "Your AI app is adding titles" : "Waiting for your AI app"}</StepHeading>
						<PosterLights posters={POSTERS} progress={writes.progress} />
						<p className="text-gray-400">
							{writes.progress > 0
								? "Titles show up here as it adds them."
								: "Keep this page open. Titles show up here as soon as it starts."}
						</p>
						{!writes.running && writes.progress === 0 && <SimButton onClick={writes.start} />}
					</>
				)}
				{step === 4 && (
					<DoneBlock
						focus
						onAnother={() => {
							writes.reset()
							setStep(1)
						}}
					/>
				)}
			</div>
		</>
	)
}

/* ── F: hands-off; one Bring screen, the page moves on by itself ─────────────────────────────────────────────── */

export function FlowF({ onOther }: { onOther: () => void }) {
	const [step, setStep] = useState<Step>(1)
	const [connected, setConnected] = useState(true)
	const writes = useAiWrites(() => setStep(4))
	useEffect(() => {
		if (writes.progress > 0 && step === 1) setStep(3)
	}, [writes.progress, step])
	const notes: [string, string, string, string] =
		step === 1
			? ["Your AI app", "In your AI app", "Listening", ""]
			: notesFor(step, ALL_RULES, writes.progress)
	useReportStep({ step, notes, allDone: step === 4 })
	const prompt = promptFor(ALL_RULES)
	return (
		<>
			{step === 1 && <AiSourceHeader onOther={onOther} />}
			<div className={box}>
				{step === 1 && (
					<>
						<StepHeading focus={false}>Bring a list from anywhere</StepHeading>
						<Illustration prompt={prompt} progress={1} />
						<ol className="flex flex-col gap-4">
							<NumberedStep n={1} title="Connect GoodWatch to your AI app">
								<ConnectedLine connected={connected} onToggle={() => setConnected(!connected)} />
							</NumberedStep>
							<NumberedStep n={2} title="Paste your list or attach it">
								<p>A note, a screenshot, a spreadsheet, a group chat, another app's export.</p>
							</NumberedStep>
							<NumberedStep n={3} title="Say what it is, the way you'd tell a friend">
								<CopyField text={prompt} label="Copy the prompt" mono={false} />
							</NumberedStep>
						</ol>
						<div className="flex items-center gap-3 rounded-xl bg-amber-400/10 px-4 py-3 ring-1 ring-amber-400/30">
							<span className="relative flex size-3">
								<span className="absolute inline-flex size-full animate-ping rounded-full bg-amber-400 opacity-60" />
								<span className="relative inline-flex size-3 rounded-full bg-amber-400" />
							</span>
							<p className="text-amber-100">This page follows along as soon as your AI app starts adding titles.</p>
						</div>
						<SimButton onClick={writes.start} />
					</>
				)}
				{step === 3 && (
					<>
						<StepHeading focus>Your AI app is adding titles</StepHeading>
						<PosterLights posters={POSTERS} progress={writes.progress} />
						<div className="flex flex-col gap-1">
							{TOOL_LINES.filter((l) => writes.progress >= l.at).map((l) => (
								<ToolLine key={l.text}>{l.text.replace("Used GoodWatch: ", "")}</ToolLine>
							))}
						</div>
					</>
				)}
				{step === 4 && (
					<DoneBlock
						focus
						onAnother={() => {
							writes.reset()
							setStep(1)
						}}
					/>
				)}
			</div>
		</>
	)
}

function NumberedStep({ n, title, children }: { n: number; title: string; children: ReactNode }) {
	return (
		<li className="flex gap-4">
			<span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-indigo-700 font-bold text-white">{n}</span>
			<div className="flex min-w-0 flex-1 flex-col gap-2">
				<p className="font-semibold text-white">{title}</p>
				{children}
			</div>
		</li>
	)
}

/* ── G: one stage; the illustration stays, each step lights one part ─────────────────────────────────────────── */

export function FlowG({ onOther }: { onOther: () => void }) {
	const [step, setStep] = useState<Step>(1)
	const [rules, setRules] = useState<Rules>(ALL_RULES)
	const [place, setPlace] = useState<PlaceKey>("notes")
	const [connected, setConnected] = useState(true)
	const writes = useAiWrites(() => setStep(4))
	useReportStep({ step, notes: notesFor(step, rules, writes.progress), allDone: step === 4, back: step === 2 ? () => setStep(1) : undefined })
	const prompt = promptFor(rules)
	const caption: Record<Step, ReactNode> = {
		1: (
			<>
				<p className="text-lg font-bold text-white">Where is your list?</p>
				<PlaceChips place={place} onPick={setPlace} />
				<p>{PLACES.find((p) => p.key === place)?.how}</p>
				<ConnectedLine connected={connected} onToggle={() => setConnected(!connected)} />
				<button type="button" className={`${primaryButton} self-start`} disabled={!connected} onClick={() => setStep(2)}>
					Next
				</button>
			</>
		),
		2: (
			<>
				<p className="text-lg font-bold text-white">What's in your list?</p>
				<RuleAnswers rules={rules} setRules={setRules} />
				<CopyField text={prompt} label="Copy the prompt" mono={false} />
				<button type="button" className={`${primaryButton} self-start`} onClick={() => setStep(3)}>
					I sent it
				</button>
			</>
		),
		3: (
			<>
				<p className="text-lg font-bold text-white">
					{writes.progress > 0 ? "Adding titles" : "Waiting for your AI app"}
				</p>
				<PosterLights posters={POSTERS} progress={writes.progress} />
				{!writes.running && writes.progress === 0 && <SimButton onClick={writes.start} />}
			</>
		),
		4: (
			<DoneBlock
				focus={false}
				onAnother={() => {
					writes.reset()
					setStep(1)
				}}
			/>
		),
	}
	return (
		<>
			{step === 1 && <AiSourceHeader onOther={onOther} />}
			<div className={box}>
				<div className="grid items-start gap-3 md:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
					<div className={`rounded-2xl p-1 transition-shadow ${step === 1 ? "ring-2 ring-amber-400" : ""}`}>
						<NoteWindow lit={step === 1} place={place} />
					</div>
					<div className={`rounded-2xl p-1 transition-shadow ${step === 2 || step === 3 ? "ring-2 ring-amber-400" : ""}`}>
						<ChatWindow
							prompt={prompt}
							progress={step === 4 ? 1 : step === 3 ? writes.progress : 0}
							lit={step >= 2}
							promptLit={step >= 2}
						/>
					</div>
				</div>
				<div className="flex flex-col gap-4 border-t border-white/10 pt-5">{caption[step]}</div>
			</div>
		</>
	)
}
