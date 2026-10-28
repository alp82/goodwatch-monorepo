// The Imports page's "Your AI app" source: a list from anywhere (a spreadsheet, a note, a screenshot of a chat, any
// other app's export) comes in through the member's AI app and GoodWatch's MCP server, and this flow follows it on
// the page's own stepper. Bring shows where the list can come from and whether an AI app is connected; Choose builds
// the prompt to send; Import waits for the AI app and lights up each title as it lands; Done counts what came in and
// can take it all back.
import { CheckCircleIcon, SparklesIcon } from "@heroicons/react/24/solid"
import { Link } from "@remix-run/react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { type ReactNode, useEffect, useState } from "react"
import type { AiActivityResponse } from "~/server/imports/ai-activity.server"
import { CopyField } from "~/ui/connector/CopyField"
import { USE_WITH_AI_PATH } from "~/ui/connector/connector"
import { MockWindow, ToolLine, UserBubble } from "~/ui/use-with-ai/ChatDemo"
import { CountTiles } from "../ImportDone"
import {
	Answer,
	BackArrow,
	type FlowPoster,
	PosterLights,
	StepHeading,
	backClass,
	useReportStep,
} from "../ImportFlowParts"
import { invalidateMemberData } from "../SourceImportHooks"
import { formatCount } from "../import-flow-model"
import { primaryButton, secondaryButton, textLink } from "../shared"
import {
	LIST_SOURCES,
	type ListSourceKey,
	type Rules,
	listSource,
	promptFor,
} from "./list-sources"

type Activity = AiActivityResponse & { since: number; now: number }
type Step = 1 | 2 | 3 | 4

const API = "/api/imports/ai-activity"
/** How often the page asks what the AI app has changed. */
const POLL_MS = 2500
/** After this long without a new change, the import counts as finished and Done shows. Done keeps listening. */
const QUIET_MS = 20_000
const ALL_RULES: Rules = { seen: true, scores: true, want: true }
const newReading = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`

async function call(init?: RequestInit, since?: number): Promise<Activity> {
	const url = since ? `${API}?since=${since}` : API
	const response = await fetch(url, init)
	const body = await response.json().catch(() => null)
	if (!response.ok || !body)
		throw new Error(
			body?.error ?? "We couldn't reach GoodWatch. Check your connection.",
		)
	return body as Activity
}

/** What the AI app changed since the source opened. The first read fixes `since` on the server's clock. */
function useAiActivity(reading: string, since: number | null, fast: boolean) {
	return useQuery({
		queryKey: ["imports", "ai-activity", reading, since],
		gcTime: 0,
		queryFn: () => call(undefined, since ?? undefined),
		refetchInterval: fast ? POLL_MS : POLL_MS * 2,
		refetchOnWindowFocus: true,
		staleTime: 0,
	})
}

/** The neutral mark for "Your AI app": any assistant, so no maker's colors. */
export function AiMark() {
	return (
		<span
			aria-hidden
			className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-linear-to-br from-amber-300 to-amber-500 text-gray-950"
		>
			<SparklesIcon className="size-6" />
		</span>
	)
}

function SourceHeader({ onOther }: { onOther: () => void }) {
	return (
		<div className="mb-4 flex flex-wrap items-center gap-3">
			<AiMark />
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
	)
}

/** Back on the left, the step's actions on the right, in one row. */
function Actions({
	back,
	children,
}: { back?: () => void; children?: ReactNode }) {
	return (
		<div className="flex flex-wrap items-center justify-between gap-3">
			{back ? (
				<button type="button" onClick={back} className={backClass}>
					<BackArrow />
					Back
				</button>
			) : (
				<span />
			)}
			<div className="ml-auto flex flex-wrap justify-end gap-3">{children}</div>
		</div>
	)
}

function SourceChips({
	value,
	onPick,
}: { value: ListSourceKey; onPick: (key: ListSourceKey) => void }) {
	return (
		<fieldset className="flex flex-wrap gap-2">
			<legend className="sr-only">Where is your list?</legend>
			{LIST_SOURCES.map((source) => (
				<button
					key={source.key}
					type="button"
					aria-pressed={source.key === value}
					onClick={() => onPick(source.key)}
					className={`min-h-11 cursor-pointer rounded-full px-4 text-sm font-semibold ring-1 ${source.key === value ? "bg-amber-400/15 text-amber-200 ring-amber-400/60" : "bg-slate-900/60 text-gray-300 ring-slate-700 hover:bg-slate-800"}`}
				>
					{source.label}
				</button>
			))}
		</fieldset>
	)
}

/** The list on the left and the chat on the right, at a fixed height, so switching sources moves nothing. */
function Illustration({
	source,
	prompt,
}: { source: ListSourceKey; prompt: string }) {
	const list = listSource(source)
	return (
		<div className="grid items-center gap-3 md:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
			<MockWindow title={list.window} tone="light">
				<div className="h-80 overflow-hidden">{list.preview}</div>
			</MockWindow>
			<MockWindow title="Your AI app">
				<div className="flex h-80 flex-col gap-3 overflow-hidden p-4 text-sm">
					<UserBubble>
						<span className="block text-xs text-gray-300">
							{list.attachment}
						</span>
						{prompt}
					</UserBubble>
					<ToolLine>Used GoodWatch: log watches (5)</ToolLine>
					<ToolLine>Used GoodWatch: rate titles (2)</ToolLine>
					<ToolLine>Used GoodWatch: Want to See (3)</ToolLine>
					<p className="text-gray-200">
						Done. 5 marked as seen, Dune: Part Two scored 9 and Sicario 6, and 3
						on your Want to See. You said you loved Arrival. Want to give it a
						score?
					</p>
				</div>
			</MockWindow>
		</div>
	)
}

function Connection({ activity }: { activity: Activity | undefined }) {
	if (!activity) return <div className="min-h-[66px]" />
	return (
		<div className="flex min-h-[66px] flex-wrap items-center gap-3 rounded-xl bg-white/[0.03] px-4 py-3 ring-1 ring-white/10">
			{activity.connected ? (
				<p className="flex items-center gap-2 text-gray-200">
					<CheckCircleIcon
						className="size-5 shrink-0 text-emerald-400"
						aria-hidden
					/>
					{activity.app
						? `GoodWatch is connected to ${activity.app.name}`
						: "Your AI app can reach GoodWatch"}
				</p>
			) : (
				<p className="text-gray-200">
					First, connect GoodWatch to your AI app.{" "}
					<Link to={USE_WITH_AI_PATH} target="_blank" className={textLink}>
						Set it up (opens in a new tab)
					</Link>
				</p>
			)}
		</div>
	)
}

const posters = (activity: Activity | undefined): FlowPoster[] =>
	(activity?.titles ?? []).map((title) => ({
		key: title.key,
		title: title.name,
		posterPath: title.posterPath,
	}))

function Done({
	activity,
	onUndo,
	undoing,
	undoFailed,
	onAnother,
}: {
	activity: Activity
	onUndo: () => void
	undoing: boolean
	undoFailed: boolean
	onAnother: () => void
}) {
	const open = activity.batches.filter(
		(id) =>
			!activity.undone.includes(id) && !activity.undoIncomplete.includes(id),
	)
	// Taken back only when every batch's undo finished completely; an undo that left titles behind says so instead.
	const incomplete = activity.undoIncomplete.length > 0
	const takenBack =
		activity.batches.length > 0 && open.length === 0 && !incomplete
	const { seen, scored, wanted } = activity.counts
	const tiles = [
		{ key: "seen", name: "Seen", total: null, added: seen, removed: 0 },
		{ key: "scores", name: "Scores", total: null, added: scored, removed: 0 },
		{
			key: "want",
			name: "Want to See",
			total: null,
			added: wanted,
			removed: 0,
		},
	]
	return (
		<div className="flex flex-col gap-5">
			<StepHeading focus>
				{takenBack
					? "Taken back"
					: incomplete
						? "Undo didn't finish"
						: "Your list is in"}
			</StepHeading>
			<PosterLights
				posters={posters(activity)}
				progress={takenBack ? 0 : 1}
				tone={takenBack ? "red" : "amber"}
			/>
			<CountTiles tiles={tiles} />
			<p className="text-gray-300">
				{takenBack
					? "Everything your AI app added in batches is back the way it was. A title you changed again since keeps your newer change."
					: incomplete
						? "Some titles couldn't be taken back. To check them, ask your AI app what it changed."
						: "New titles your AI app adds still show up here."}
				{activity.singles > 0 &&
					` ${formatCount(activity.singles)} ${activity.singles === 1 ? "change was" : "changes were"} made one title at a time. To take ${activity.singles === 1 ? "it" : "those"} back, ask your AI app.`}
			</p>
			{undoFailed && (
				<p className="text-red-300">
					Undo didn't finish. Try again in a moment.
				</p>
			)}
			<Actions>
				{open.length > 0 && (
					<button
						type="button"
						className={secondaryButton}
						onClick={onUndo}
						disabled={undoing}
					>
						{undoing ? "Taking back…" : "Undo all"}
					</button>
				)}
				<button type="button" className={primaryButton} onClick={onAnother}>
					Bring another list
				</button>
			</Actions>
		</div>
	)
}

const box =
	"flex w-full flex-col gap-5 rounded-2xl bg-gray-900/90 p-5 text-left text-base text-gray-300 ring-1 ring-white/10 md:p-6"

export function AiImportFlow({ onOther }: { onOther: () => void }) {
	const client = useQueryClient()
	const [step, setStep] = useState<Step>(1)
	// Set when the member goes back to Bring, so its heading takes focus then (never on arrival).
	const [cameBack, setCameBack] = useState(false)
	const goTo = (next: Step) => {
		if (next === 1) setCameBack(true)
		setStep(next)
	}
	const [source, setSource] = useState<ListSourceKey>(LIST_SOURCES[0].key)
	const [rules, setRules] = useState<Rules>(ALL_RULES)
	const [since, setSince] = useState<number | null>(null)
	// Each opening of the source and each list brought starts a reading of its own, never a cached earlier one.
	const [reading, setReading] = useState(newReading)
	const query = useAiActivity(reading, since, step >= 3)
	const activity = query.data
	// The first answer fixes the starting moment on the server's clock.
	useEffect(() => {
		if (since === null && activity) setSince(activity.since)
	}, [since, activity])

	const arrived = activity?.titles.length ?? 0
	// Titles that arrive before the member says they sent the list still move the flow on.
	useEffect(() => {
		if (arrived > 0 && step < 3) setStep(3)
	}, [arrived, step])
	useEffect(() => {
		if (
			step === 3 &&
			activity?.lastChangeAt &&
			activity.now - activity.lastChangeAt > QUIET_MS
		)
			setStep(4)
	}, [step, activity])
	// Done refreshes the member's library everywhere on the site.
	useEffect(() => {
		if (step === 4) void invalidateMemberData(client)
	}, [step, client, arrived])

	const undo = useMutation({
		mutationFn: () =>
			call({
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ intent: "undo", since }),
			}),
		onSuccess: (data) => {
			client.setQueryData(["imports", "ai-activity", reading, since], data)
			void invalidateMemberData(client)
		},
	})

	const waiting = step === 3 && arrived === 0
	const list = listSource(source)
	useReportStep({
		step,
		notes: [
			"Your AI app",
			step >= 2 ? list.label : "",
			step >= 3 ? (arrived ? `${formatCount(arrived)} titles` : "Waiting") : "",
			step === 4 ? `${formatCount(arrived)} added` : "",
		],
		allDone: step === 4,
		openStep: step === 2 || waiting ? (n) => goTo(n as Step) : undefined,
	})
	const prompt = promptFor(rules, source)
	const connected = activity?.connected !== false

	return (
		<>
			{step === 1 && <SourceHeader onOther={onOther} />}
			<div className={box}>
				{step === 1 && (
					<>
						<StepHeading focus={cameBack}>
							Bring a list from anywhere
						</StepHeading>
						<p>
							Your AI app reads it and adds the titles to GoodWatch. Where is
							your list?
						</p>
						<SourceChips value={source} onPick={setSource} />
						<p className="min-h-[6.25rem] text-sm text-gray-400 sm:min-h-10">
							{list.how}
						</p>
						<Illustration source={source} prompt={prompt} />
						<Connection activity={activity} />
						<Actions>
							<button
								type="button"
								className={primaryButton}
								disabled={!connected}
								onClick={() => setStep(2)}
							>
								Next
							</button>
						</Actions>
					</>
				)}
				{step === 2 && (
					<>
						<StepHeading focus>What's in your list?</StepHeading>
						<div className="flex flex-col gap-2">
							{(["seen", "scores", "want"] as const).map((key) => (
								<Answer
									key={key}
									selected={rules[key]}
									onClick={() => setRules({ ...rules, [key]: !rules[key] })}
									title={list.rules[key].title}
									note={list.rules[key].note}
								/>
							))}
						</div>
						<p className="text-gray-200">
							Send this to your AI app with your {list.noun}:
						</p>
						<CopyField
							text={prompt}
							label="Copy the prompt"
							mono={false}
							size="lg"
						/>
						<Actions back={() => goTo(1)}>
							<button
								type="button"
								className={primaryButton}
								onClick={() => setStep(3)}
							>
								I sent it
							</button>
						</Actions>
					</>
				)}
				{step === 3 && (
					<>
						<StepHeading focus>
							{waiting
								? "Waiting for your AI app"
								: "Your AI app is adding titles"}
						</StepHeading>
						<PosterLights posters={posters(activity)} progress={1} />
						<p className="text-gray-400" aria-live="polite">
							{waiting
								? "Keep this page open. Titles show up here as soon as your AI app starts adding them."
								: `${formatCount(arrived)} ${arrived === 1 ? "title" : "titles"} so far. More show up here as they come in.`}
						</p>
						<Actions back={waiting ? () => setStep(2) : undefined}>
							{!waiting && (
								<button
									type="button"
									className={primaryButton}
									onClick={() => setStep(4)}
								>
									That's everything
								</button>
							)}
						</Actions>
					</>
				)}
				{step === 4 && activity && (
					<Done
						activity={activity}
						onUndo={() => undo.mutate()}
						undoing={undo.isPending}
						undoFailed={undo.isError}
						onAnother={() => {
							undo.reset()
							setSince(null)
							setReading(newReading())
							goTo(1)
						}}
					/>
				)}
			</div>
		</>
	)
}
