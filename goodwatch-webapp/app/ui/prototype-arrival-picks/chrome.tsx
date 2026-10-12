// PROTOTYPE - throwaway (issue #489, part B: picks). Copies of the site header and the phone dock, laid over the real
// ones so that Tonight's pick can say why it was picked, and the prototype's own debug panel (white, fuchsia ring).
import {
	ChevronDownIcon,
	ChevronUpIcon,
	MagnifyingGlassIcon,
	Squares2X2Icon,
} from "@heroicons/react/24/solid"
import { Link, useSearchParams } from "@remix-run/react"
import type { SignalWords } from "~/domain/new-episodes-signal"
import { GoodWatchWordmark } from "~/ui/brand/GoodWatchWordmark"
import { GoodWatchMark, NewEpisodesMark, tmdbImage } from "~/ui/navigation/bits"
import {
	type Arrival,
	CASES,
	type CaseKey,
	type Decision,
	type Setup,
	VARIANTS,
	WATCHING,
	type WatchingKey,
	ago,
	reasonOf,
} from "./model"

const DOOR_NAME = {
	continue: "Continue",
	start: "Start a show",
	movie: "A movie",
}

/** What Tonight's pick says about itself: null when it was not picked for landing, or the variation says nothing. */
export function pickReason(decision: Decision): string | null {
	const { arrival } = decision.pick.lead
	if (!arrival || decision.variant === "D") return null
	const words = reasonOf(decision.variant, arrival)
	return decision.variant === "B" ? words.short : words.long
}

/** Tonight's pick in the header (ui/navigation/bits.tsx, copied), with the reason in place of "Tonight". */
function PickThumb({ decision }: { decision: Decision }) {
	const { lead } = decision.pick
	const reason = pickReason(decision)
	// B makes the landing the pick's whole identity: sky blue ring. The others keep the amber of Tonight's pick.
	const sky = reason && decision.variant === "B"
	return (
		<span
			data-pick
			className="flex min-w-0 items-center gap-2 rounded-xl p-[3px] text-left"
		>
			<img
				src={tmdbImage(lead.title.poster, "w92")}
				alt=""
				className={`h-11 w-[30px] shrink-0 rounded-md object-cover ${sky ? "ring-2 ring-sky-400 shadow-[0_0_18px_rgba(56,189,248,0.55)]" : "ring-[1.5px] ring-amber-400/85"}`}
			/>
			<span className="flex min-w-0 flex-col leading-[1.15]">
				<small
					className={`whitespace-nowrap text-[11px] font-bold ${reason ? "text-sky-300" : "text-amber-400"}`}
				>
					{reason ?? "Tonight"}
					{!reason && lead.episode && ` · ${lead.episode.code}`}
				</small>
				<b className="max-w-[150px] truncate text-[13.5px] text-gray-100">
					{lead.title.title}
					{reason && lead.episode && ` · ${lead.episode.code}`}
				</b>
			</span>
		</span>
	)
}

export function SiteChrome({
	decision,
	opener,
}: {
	decision: Decision
	/** The count on what opens the hub: today's, unchanged in every variation. */
	opener: SignalWords | null
}) {
	const avatar = (
		<span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-linear-135 from-amber-400 to-amber-700 text-[15px] font-extrabold text-amber-950">
			M
		</span>
	)
	return (
		<>
			<div className="fixed top-0 z-[1001] w-full text-gray-100">
				<div className="flex h-16 items-center gap-2.5 border-b border-white/[0.09] bg-gray-950 px-3.5 lg:hidden">
					<GoodWatchWordmark fontSize={20} />
					<span className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-full bg-white/[0.06] px-3.5 text-[14.5px] text-gray-400 ring-1 ring-white/10">
						<MagnifyingGlassIcon className="h-4 w-4 text-amber-400" />
						Search
					</span>
					{avatar}
				</div>
				<header className="hidden border-b border-white/[0.09] bg-gray-950 lg:block">
					<div className="mx-auto grid h-16 max-w-7xl grid-cols-[1fr_auto_1fr] items-center gap-[18px] px-8">
						<div className="flex items-center gap-[18px]">
							<GoodWatchWordmark fontSize={30} />
							<span className="relative flex h-10 items-center gap-2 rounded-xl bg-white/[0.07] px-3.5 font-bold text-gray-100 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.1)]">
								<Squares2X2Icon className="h-[18px] w-[18px]" aria-hidden />
								Browse
								<ChevronDownIcon className="h-4 w-4" aria-hidden />
								<NewEpisodesMark
									words={opener}
									className="absolute -top-1.5 -right-1.5"
								/>
							</span>
						</div>
						<span className="flex h-10 w-[400px] items-center gap-2.5 rounded-full bg-white/[0.06] px-4 text-[14.5px] text-gray-400 ring-1 ring-white/10">
							<MagnifyingGlassIcon className="h-4 w-4 text-amber-400" />
							Search titles, people, moods
						</span>
						<div className="flex items-center justify-end gap-[18px]">
							<PickThumb decision={decision} />
							{avatar}
						</div>
					</div>
				</header>
			</div>
			<div className="fixed inset-x-0 bottom-0 z-[1001] rounded-t-3xl bg-gray-950 text-gray-100 shadow-[0_-20px_50px_-20px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.08)] lg:hidden">
				<div className="grid h-[72px] w-full grid-cols-[1fr_auto_1fr] items-center gap-2 px-3">
					<span className="flex min-w-0 items-center gap-2 justify-self-start">
						<span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/[0.08] text-amber-400">
							<Squares2X2Icon className="h-5 w-5" />
						</span>
						<b className="truncate text-[14px] text-gray-100">Browse</b>
					</span>
					<span className="relative -mt-[26px] flex h-16 w-16 items-center justify-center rounded-full bg-[radial-gradient(circle_at_35%_30%,#4b5563,#111827_70%)] shadow-[0_0_0_1px_rgba(255,255,255,0.16),0_0_0_6px_rgba(3,7,18,0.94),0_12px_30px_-6px_rgba(0,0,0,0.9)]">
						<GoodWatchMark size={30} />
						<NewEpisodesMark
							words={opener}
							className="absolute top-0 right-0"
						/>
					</span>
					<span className="flex h-11 items-center gap-1.5 justify-self-end rounded-full bg-white/[0.08] pr-3 pl-4 text-[13.5px] font-bold text-gray-100">
						Go to…
						<ChevronUpIcon className="h-4 w-4" />
					</span>
				</div>
			</div>
		</>
	)
}

// ---------------------------------------------------------------------------------------------------------
// The debug panel

const CHIP = "rounded-full px-2 py-0.5 font-bold ring-1 ring-fuchsia-400/60"

function Chips<K extends string>({
	name,
	choices,
	current,
}: {
	name: string
	choices: Record<K, string>
	current: K
}) {
	const [params] = useSearchParams()
	return (
		<span className="flex flex-wrap gap-1">
			{(Object.keys(choices) as K[]).map((key) => {
				const next = new URLSearchParams(params)
				next.set(name, key)
				return (
					<Link
						key={key}
						to={`?${next}`}
						replace
						preventScrollReset
						data-chip={`${name}:${key}`}
						className={`${CHIP} ${key === current ? "bg-fuchsia-600 text-white" : "bg-white text-black"}`}
					>
						{choices[key]}
					</Link>
				)
			})}
		</span>
	)
}

const labels = <K extends string>(of: Record<K, { label: string }>) =>
	Object.fromEntries(
		Object.entries<{ label: string }>(of).map(([key, value]) => [
			key,
			value.label,
		]),
	) as Record<K, string>

export function DebugPanel({
	setup,
	decision,
	arrivals,
}: { setup: Setup; decision: Decision; arrivals: Arrival[] }) {
	const { pick, rows, variant } = decision
	const reason = pick.lead.arrival
		? reasonOf(variant, pick.lead.arrival).long
		: null
	const pills = (["continue", "start", "movie"] as const).flatMap((door) => {
		const pill = decision.pills[door]
		return pill
			? `${DOOR_NAME[door]}: “${pill.long}”${pill.quiet ? " (outlined)" : ""}`
			: []
	})
	return (
		<aside
			data-debug-panel
			className="fixed inset-x-2 bottom-[152px] z-[1002] max-h-[43vh] overflow-auto rounded-2xl bg-white/95 p-3 text-[11.5px] leading-snug text-black shadow-2xl ring-2 ring-fuchsia-500 lg:inset-x-auto lg:bottom-4 lg:left-4 lg:max-h-[calc(100vh-96px)] lg:w-[400px]"
		>
			<div className="flex items-baseline justify-between gap-2">
				<b className="text-fuchsia-700">
					#489 B · {variant}: {VARIANTS[variant]}
				</b>
				<span className="text-neutral-500">pick logic</span>
			</div>
			<p className="mt-1 text-neutral-600">{CASES[setup.case].about}</p>

			<p className="mt-2 text-[13px]" data-debug-pick>
				Tonight's pick: <b>{pick.lead.title.title}</b>
				{pick.lead.episode && ` ${pick.lead.episode.code}`}{" "}
				<span className="text-neutral-600">({DOOR_NAME[pick.door]})</span>
				<br />
				{decision.changed ? (
					<b className="text-sky-700">
						Won because it landed{reason ? `: “${reason}”` : ""}
					</b>
				) : (
					<span className="text-neutral-600">
						{arrivals.length
							? "The same pick as without a landing"
							: "The normal pick"}
					</span>
				)}
			</p>

			<table className="mt-2 w-full border-collapse">
				<tbody>
					{rows.map((row) => (
						<tr
							key={`${row.title}:${row.what}`}
							className={`border-t border-neutral-200 align-top ${row.won ? "bg-amber-100" : ""}`}
						>
							<td className="w-9 py-1 pr-1 text-right font-bold tabular-nums">
								{row.value}
							</td>
							<td className="py-1 pr-1">
								<b>{row.title}</b> {row.won && "← wins"}
								<br />
								<span className="text-neutral-600">{row.what}</span>
							</td>
							<td className="w-[42%] py-1 text-neutral-700">{row.note}</td>
						</tr>
					))}
				</tbody>
			</table>

			<dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5 border-t border-neutral-300 pt-2">
				<dt className="font-bold">Rule</dt>
				<dd>{decision.rule}</dd>
				<dt className="font-bold">Lasts</dt>
				<dd>{decision.lasts}</dd>
				<dt className="font-bold">Pill</dt>
				<dd>
					{decision.pill}{" "}
					<span className="text-sky-700">
						Now: {pills.length ? pills.join("; ") : "no pill"}.
					</span>
				</dd>
				<dt className="font-bold">Landed</dt>
				<dd>
					{arrivals.length
						? arrivals
								.map(
									(a) =>
										`${a.title.title}, ${a.service}, ${ago(a.days)}${a.unseen ? "" : " (seen)"}`,
								)
								.join("; ")
						: "nothing"}
				</dd>
			</dl>

			<div className="mt-2 grid grid-cols-[auto_1fr] items-center gap-x-2 gap-y-1.5 border-t border-neutral-300 pt-2">
				<span>Case</span>
				<Chips<CaseKey>
					name="case"
					choices={labels(CASES)}
					current={setup.case}
				/>
				<span>Last watched The Bear</span>
				<Chips<WatchingKey>
					name="watching"
					choices={labels(WATCHING)}
					current={setup.watching}
				/>
				<span>Opened My movies and My shows since</span>
				<Chips
					name="visited"
					choices={{ no: "no", yes: "yes" }}
					current={setup.visited ? "yes" : "no"}
				/>
			</div>
		</aside>
	)
}
