// PROTOTYPE - throwaway. The Report a problem flow: what's wrong, then the questions for that field, then the current
// value (filled in) with an optional suggestion and source link. Three layouts of the same questions:
// - steps (A): one question per screen, Back and Next.
// - form (B): a section picker first, then every question on one scrolling form that opens as you answer.
// - chips (C): one compact screen of chips with the before/after side by side.
import { ArrowUturnLeftIcon, CheckCircleIcon, ClockIcon, FlagIcon } from "@heroicons/react/20/solid"
import { useState } from "react"
import { PrimaryButton } from "~/ui/auth/kit"
import { TmdbImage } from "~/ui/TmdbImage"
import {
	AREAS,
	type Area,
	CAST,
	COUNTRIES,
	type Correction,
	type Draft,
	OTHER_SERVICES,
	OUTCOME_COPY,
	type Outcome,
	type Problem,
	SCORE_SOURCES,
	SEASONS,
	type Viewer,
	newDraft,
	outcomeOf,
} from "~/ui/prototype-feedback/model"
import { currentValue, useFeedback } from "~/ui/prototype-feedback/store"
import person from "~/ui/prototype-feedback/fixture-person.json"

export type Layout = "steps" | "form" | "chips"

export const INPUT =
	"min-h-11 w-full rounded-lg bg-gray-900 px-3 text-gray-100 ring-1 ring-white/15 placeholder:text-gray-600 focus:ring-2 focus:ring-amber-400 focus:outline-none"
const LABEL = "mb-2 block text-[11px] font-semibold uppercase tracking-[.12em] text-gray-500"

export function Chip({ on, onClick, children, className = "" }: { on: boolean; onClick: () => void; children: React.ReactNode; className?: string }) {
	return (
		<button
			type="button"
			aria-pressed={on}
			onClick={onClick}
			className={`inline-flex min-h-9 cursor-pointer items-center gap-2 rounded-full px-3 py-1.5 text-sm transition-colors ${on ? "bg-white font-semibold text-black" : "bg-white/8 text-gray-200 hover:bg-white/15"} ${className}`}
		>
			{children}
		</button>
	)
}

function Row({ on, onClick, children, hint }: { on: boolean; onClick: () => void; children: React.ReactNode; hint?: React.ReactNode }) {
	return (
		<button
			type="button"
			aria-pressed={on}
			onClick={onClick}
			className={`flex w-full cursor-pointer items-center gap-3 rounded-xl p-3 text-left ring-1 transition-colors ${on ? "bg-amber-500/10 ring-amber-500/60" : "bg-white/[0.04] ring-white/10 hover:ring-white/25"}`}
		>
			<span className={`size-4 shrink-0 rounded-full ring-2 ${on ? "bg-amber-400 ring-amber-400" : "ring-white/30"}`} aria-hidden />
			<span className="min-w-0 flex-1 text-sm font-medium text-gray-100">{children}</span>
			{hint}
		</button>
	)
}

const FlagHint = () => (
	<span className="inline-flex items-center gap-1 text-xs text-gray-500">
		<FlagIcon className="size-3.5" aria-hidden />
		flag
	</span>
)

export function OutcomeLine({ outcome, viewer }: { outcome: Outcome; viewer: Viewer }) {
	if (outcome === "live")
		return (
			<p className="flex items-center gap-1.5 text-xs text-emerald-300">
				<CheckCircleIcon className="size-4" aria-hidden /> Goes live as soon as you send it
			</p>
		)
	if (outcome === "pending")
		return (
			<p className="flex items-center gap-1.5 text-xs text-gray-400">
				<ClockIcon className="size-4" aria-hidden /> {viewer === "guest" ? "We check it before it shows" : "Staff check it before it shows"}
			</p>
		)
	return (
		<p className="flex items-center gap-1.5 text-xs text-gray-400">
			<FlagIcon className="size-4" aria-hidden /> We look into it. This part isn't edited by hand.
		</p>
	)
}

// --- The questions after "what's wrong" ---

function Questions({ d, set, compact }: { d: Draft; set: (p: Partial<Draft>) => void; compact?: boolean }) {
	const { media } = useFeedback()
	const ask = d.problem?.ask ?? []
	const offered = media.streaming_availabilities
		.map((a) => media.streaming_services.find((s) => s.tmdb_id === a.streaming_service_id))
		.filter((s): s is NonNullable<typeof s> => Boolean(s))
	const missing = OTHER_SERVICES.filter((s) => !offered.some((o) => o.tmdb_id === s.tmdb_id))
	const block = compact ? "flex flex-col gap-4" : "flex flex-col gap-5"
	return (
		<div className={block}>
			{(ask.includes("provider") || ask.includes("missingProvider")) && (
				<div>
					<span className={LABEL}>{ask.includes("provider") ? "Which service?" : "Where is it?"}</span>
					<div className="flex flex-wrap gap-2">
						{(ask.includes("provider") ? offered : missing).map((s) => (
							<Chip key={s.tmdb_id} on={d.provider === s.tmdb_id} onClick={() => set({ provider: s.tmdb_id })} className="pl-1.5">
								<TmdbImage kind="logo" path={s.logo} width={24} ratio={1} alt="" className="size-6 rounded-md" />
								{s.name}
							</Chip>
						))}
					</div>
				</div>
			)}
			{ask.includes("offer") && (
				<div>
					<span className={LABEL}>How?</span>
					<div className="flex flex-wrap gap-2">
						{(["flatrate", "rent", "buy"] as const).map((o) => (
							<Chip key={o} on={d.offer === o} onClick={() => set({ offer: o })}>
								{{ flatrate: "Stream", rent: "Rent", buy: "Buy" }[o]}
							</Chip>
						))}
					</div>
				</div>
			)}
			{ask.includes("country") && (
				<div>
					<span className={LABEL}>In which country?</span>
					<div className="flex flex-wrap gap-2">
						{COUNTRIES.map(([code, name]) => (
							<Chip key={code} on={d.country === code} onClick={() => set({ country: code })}>
								{name}
							</Chip>
						))}
					</div>
				</div>
			)}
			{ask.includes("episode") && (
				<div>
					<span className={LABEL}>Which episode?</span>
					<div className="flex flex-wrap gap-2">
						{SEASONS.map((s) => (
							<Chip key={s.number} on={d.season === s.number} onClick={() => set({ season: s.number, episode: 1 })}>
								Season {s.number}
							</Chip>
						))}
					</div>
					<select
						aria-label="Episode"
						value={d.episode}
						onChange={(e) => set({ episode: Number(e.target.value) })}
						className={`${INPUT} mt-2`}
					>
						{SEASONS.find((s) => s.number === d.season)?.episodes.map((e) => (
							<option key={e.number} value={e.number}>
								Episode {e.number} · {e.title}
							</option>
						))}
						{d.problem?.id === "ep-missing" && <option value={99}>Not in this list</option>}
					</select>
				</div>
			)}
			{ask.includes("person") && (
				<div>
					<span className={LABEL}>Who?</span>
					<div className="flex flex-wrap gap-2">
						{CAST.map((c) => (
							<Chip key={c.id} on={d.person === c.id} onClick={() => set({ person: c.id })} className="pl-1">
								<TmdbImage kind="profile" path={c.profile_path} width={28} ratio={1} alt="" className="size-7 rounded-full object-cover" />
								{c.name}
							</Chip>
						))}
					</div>
				</div>
			)}
			{ask.includes("credit") && (
				<div>
					<span className={LABEL}>Which title?</span>
					<div className="flex flex-wrap gap-2">
						{person.knownFor.map((c) => (
							<Chip key={c.key} on={d.credit === c.key} onClick={() => set({ credit: c.key })}>
								{c.title} <span className="text-xs opacity-60">{c.release_year}</span>
							</Chip>
						))}
					</div>
				</div>
			)}
			{ask.includes("source") && (
				<div>
					<span className={LABEL}>Which score?</span>
					<div className="flex flex-wrap gap-2">
						{SCORE_SOURCES.map((s) => (
							<Chip key={s.id} on={d.source === s.id} onClick={() => set({ source: s.id })}>
								{s.label} <span className="tabular-nums opacity-60">{s.value}</span>
							</Chip>
						))}
					</div>
				</div>
			)}
		</div>
	)
}

/** The current value, filled in, and what it should be. */
function Values({ d, set, sideBySide }: { d: Draft; set: (p: Partial<Draft>) => void; sideBySide?: boolean }) {
	const p = d.problem
	if (!p) return null
	const removing = ["not-there", "not-in-it", "not-theirs"].includes(p.id)
	return (
		<div className="flex flex-col gap-4">
			<div className={sideBySide && p.suggest ? "grid grid-cols-2 gap-2" : "flex flex-col gap-4"}>
				<div>
					<span className={LABEL}>On GoodWatch now</span>
					<p className="rounded-lg bg-white/[0.04] px-3 py-2.5 text-sm text-gray-300 ring-1 ring-white/10">{currentValue(d)}</p>
				</div>
				{p.suggest && (
					<label>
						<span className={LABEL}>
							{p.suggest} <span className="normal-case tracking-normal text-gray-600">· optional</span>
						</span>
						<input
							value={d.suggested}
							onChange={(e) => set({ suggested: e.target.value })}
							placeholder={p.id === "date" ? "e.g. June 22, 2022" : p.id === "character" ? "e.g. Carmen Berzatto" : "Type it here"}
							className={INPUT}
						/>
					</label>
				)}
			</div>
			{removing && <p className="text-sm text-gray-400">We'll take it off.</p>}
			{p.flag ? (
				<label>
					<span className={LABEL}>
						What looks off? <span className="normal-case tracking-normal text-gray-600">· optional</span>
					</span>
					<textarea
						value={d.note}
						onChange={(e) => set({ note: e.target.value })}
						rows={3}
						placeholder="A few words help us find it"
						className={`${INPUT} py-2.5`}
					/>
				</label>
			) : null}
			<label>
				<span className={LABEL}>
					Source link <span className="normal-case tracking-normal text-gray-600">· optional</span>
				</span>
				<input
					value={d.link}
					onChange={(e) => set({ link: e.target.value })}
					inputMode="url"
					placeholder="https://…"
					className={INPUT}
				/>
			</label>
		</div>
	)
}

function ready(d: Draft, stage: "problem" | "questions") {
	if (!d.problem) return false
	if (stage === "problem") return true
	const a = d.problem.ask
	if ((a.includes("provider") || a.includes("missingProvider")) && !d.provider) return false
	if (a.includes("person") && !d.person) return false
	if (a.includes("credit") && !d.credit) return false
	if (a.includes("source") && !d.source) return false
	return true
}

// --- After sending ---

export function Result({ c, onClose, onAnother }: { c: Correction; onClose: () => void; onAnother?: () => void }) {
	const { undo, corrections, viewer } = useFeedback()
	const undone = corrections.find((x) => x.id === c.id)?.undone
	const copy = OUTCOME_COPY[c.outcome]
	return (
		<div className="flex flex-col gap-4 py-2" aria-live="polite">
			<div className="flex items-start gap-3">
				<span
					className={`grid size-10 shrink-0 place-items-center rounded-full ${c.outcome === "live" ? "bg-emerald-500/15 text-emerald-300" : c.outcome === "pending" ? "bg-amber-500/15 text-amber-300" : "bg-white/10 text-gray-200"}`}
				>
					{c.outcome === "live" ? <CheckCircleIcon className="size-6" /> : c.outcome === "pending" ? <ClockIcon className="size-6" /> : <FlagIcon className="size-5" />}
				</span>
				<div>
					<p className="text-lg font-semibold text-white">{undone ? "Undone" : copy.title}</p>
					<p className="mt-0.5 text-sm text-gray-400">{undone ? "The page shows the old value again." : copy.body}</p>
				</div>
			</div>
			{c.outcome !== "flag" && (
				<div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 rounded-xl bg-white/[0.04] p-3 text-sm ring-1 ring-white/10">
					<span className="text-gray-500">Was</span>
					<span className="text-gray-400 line-through decoration-gray-600">{c.before}</span>
					<span className="text-gray-500">Now</span>
					<span className="font-medium text-gray-100">{c.after}</span>
				</div>
			)}
			{viewer === "guest" && c.outcome === "pending" && (
				<p className="text-sm text-gray-400">
					Signed-in members see their changes go live once we know them.{" "}
					<span className="font-semibold text-amber-500">Sign up</span>
				</p>
			)}
			<div className="flex flex-wrap gap-2">
				{c.outcome === "live" && !undone && (
					<button
						type="button"
						onClick={() => undo(c.id)}
						className="inline-flex min-h-10 cursor-pointer items-center gap-1.5 rounded-xl border border-white/15 bg-white/[0.06] px-4 font-semibold text-gray-100 hover:bg-white/10"
					>
						<ArrowUturnLeftIcon className="size-4" /> Undo
					</button>
				)}
				{onAnother && (
					<button type="button" onClick={onAnother} className="min-h-10 cursor-pointer rounded-xl px-4 font-semibold text-gray-300 hover:bg-white/10">
						Report something else
					</button>
				)}
				<button type="button" onClick={onClose} className="ml-auto min-h-10 cursor-pointer rounded-xl bg-white px-5 font-semibold text-black hover:bg-gray-200">
					Done
				</button>
			</div>
		</div>
	)
}

function Footer({ children }: { children: React.ReactNode }) {
	return <div className="sticky -bottom-4 -mx-4 mt-5 border-t border-white/10 bg-gray-950 px-4 pt-3 pb-5 sm:-mx-5 sm:px-5">{children}</div>
}

// --- The flow ---

export function ReportFlow({
	area,
	layout,
	onClose,
	onPickArea,
	areas,
}: {
	/** null: start with the section picker (layout "form"). */
	area: Area | null
	layout: Layout
	onClose: () => void
	onPickArea?: (a: Area | null) => void
	areas?: Area[]
}) {
	const { viewer, submit } = useFeedback()
	const [d, setD] = useState<Draft>(() => newDraft(area ?? "watch"))
	const [step, setStep] = useState(0)
	const [sent, setSent] = useState<Correction | null>(null)
	const set = (p: Partial<Draft>) => setD((x) => ({ ...x, ...p }))
	const restart = () => {
		setD(newDraft(area ?? "watch"))
		setStep(0)
		setSent(null)
		if (layout === "form") onPickArea?.(null)
	}
	if (sent) return <Result c={sent} onClose={onClose} onAnother={restart} />

	const def = AREAS[d.area]
	const pick = (problem: Problem) => set({ problem })
	const send = () => setSent(submit(d))
	const outcome = d.problem ? outcomeOf(d.problem, viewer) : null

	if (layout === "form" && area === null)
		return (
			<div className="flex flex-col gap-2">
				<p className="mb-1 text-sm text-gray-400">What part of the page?</p>
				<div className="grid grid-cols-2 gap-2">
					{(areas ?? []).map((a) => (
						<button
							key={a}
							type="button"
							onClick={() => onPickArea?.(a)}
							className="flex min-h-20 cursor-pointer flex-col items-start justify-between rounded-xl bg-white/[0.04] p-3 text-left ring-1 ring-white/10 hover:ring-white/30"
						>
							<span className="font-semibold text-gray-100">{AREAS[a].label}</span>
							<span className="text-xs text-gray-500">
								{AREAS[a].problems.every((p) => p.flag) ? "Flag it for us" : viewer === "trusted" ? "Fix it now" : "Suggest a fix"}
							</span>
						</button>
					))}
				</div>
			</div>
		)

	if (layout === "steps") {
		const hasQuestions = (d.problem?.ask.length ?? 0) > 0
		const stages = hasQuestions ? 3 : 2
		const valuesStep = hasQuestions ? 2 : 1
		const next = () => setStep((s) => s + 1)
		return (
			<div className="flex min-h-full flex-col">
				<p className="mb-3 text-xs font-semibold text-gray-500">
					Report a problem · Step {step + 1} of {d.problem ? stages : 3}
				</p>
				{step === 0 && (
					<div className="flex flex-col gap-2">
						<p className="mb-1 text-base font-semibold text-gray-100">What's wrong?</p>
						{def.problems.map((p) => (
							<Row key={p.id} on={d.problem?.id === p.id} onClick={() => pick(p)} hint={p.flag ? <FlagHint /> : null}>
								{p.label}
							</Row>
						))}
					</div>
				)}
				{step === 1 && hasQuestions && <Questions d={d} set={set} />}
				{step === valuesStep && <Values d={d} set={set} />}
				<Footer>
					{outcome && step === valuesStep && (
						<div className="mb-2">
							<OutcomeLine outcome={outcome} viewer={viewer} />
						</div>
					)}
					<div className="flex gap-2">
						{step > 0 && (
							<button type="button" onClick={() => setStep((s) => s - 1)} className="min-h-12 cursor-pointer rounded-xl px-4 font-semibold text-gray-300 hover:bg-white/10">
								Back
							</button>
						)}
						<div className="flex-1">
							{step === valuesStep && d.problem ? (
								<PrimaryButton type="button" onClick={send}>
									{outcome === "live" ? "Fix it" : "Send"}
								</PrimaryButton>
							) : (
								<PrimaryButton type="button" onClick={next} disabled={!ready(d, step === 0 ? "problem" : "questions")}>
									Next
								</PrimaryButton>
							)}
						</div>
					</div>
				</Footer>
			</div>
		)
	}

	// "form" with an area, and "chips": everything on one screen, opening as it's answered.
	const chips = layout === "chips"
	return (
		<div className="flex flex-col gap-5">
			{layout === "form" && (
				<button type="button" onClick={() => onPickArea?.(null)} className="-mb-2 self-start text-sm font-semibold text-amber-500 hover:text-amber-400">
					← Other parts
				</button>
			)}
			<div>
				<span className={LABEL}>What's wrong?</span>
				{chips ? (
					<div className="flex flex-wrap gap-2">
						{def.problems.map((p) => (
							<Chip key={p.id} on={d.problem?.id === p.id} onClick={() => pick(p)}>
								{p.flag && <FlagIcon className="size-3.5 opacity-60" aria-hidden />}
								{p.label}
							</Chip>
						))}
					</div>
				) : (
					<div className="flex flex-col gap-2">
						{def.problems.map((p) => (
							<Row key={p.id} on={d.problem?.id === p.id} onClick={() => pick(p)} hint={p.flag ? <FlagHint /> : null}>
								{p.label}
							</Row>
						))}
					</div>
				)}
			</div>
			{d.problem && <Questions d={d} set={set} compact={chips} />}
			{d.problem && ready(d, "questions") && <Values d={d} set={set} sideBySide={chips} />}
			<Footer>
				{outcome && (
					<div className="mb-2">
						<OutcomeLine outcome={outcome} viewer={viewer} />
					</div>
				)}
				<PrimaryButton type="button" onClick={send} disabled={!ready(d, "questions")}>
					{outcome === "live" ? "Fix it" : "Send"}
				</PrimaryButton>
			</Footer>
		</div>
	)
}
