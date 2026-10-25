// A picked part's questions on a title or person page: what's wrong, then the questions for it (which service, offer
// type, country, episode, person, title or score, from the page's own data), then what the page shows now with an
// optional suggestion and source link. Everything opens on one screen as it's answered.
import { FlagIcon } from "@heroicons/react/20/solid"
import { useEffect, useState } from "react"
import { useStreamingProviders } from "~/routes/api.streaming-providers"
import { TmdbImage } from "~/ui/TmdbImage"
import { PrimaryButton } from "~/ui/auth/kit"
import { regionName } from "~/utils/display-names"
import {
	brandName,
	getShorterProviderLabel,
	ignoredProviders,
} from "~/utils/streaming-links"
import {
	BeforeSendLine,
	Chip,
	FailureLine,
	GuestEmail,
	INPUT,
	LABEL,
	Result,
	SendFooter,
	useFixFlow,
	useSender,
} from "./kit"
import {
	DATE_PROBLEMS,
	type Draft,
	OFFERS,
	OFFER_LABEL,
	type Offer,
	type Problem,
	type Question,
	type RichArea,
	SOMETHING_ELSE,
	currentValue,
	listedServices,
	newDraft,
	offersOf,
	problemsOf,
	ready,
	reportOfDraft,
	spotOf,
} from "./problems"
import {
	buildReportRequest,
	emailProblem,
	fallbackOutcome,
	linkProblem,
} from "./request"
import type { FeedbackSubject, PersonSubject, TitleSubject } from "./subject"
import { type FeedbackOutcome, outcomeOf } from "~/utils/feedback"

/** How many of the country's other services "Where is it?" offers before "Something else". */
const MISSING_CHOICES = 8
/** How many cast members "Who?" offers before "Something else". */
const CAST_CHOICES = 12
const CREDIT_CHOICES = 12

function Questions({
	d,
	set,
	subject,
}: { d: Draft; set: (p: Partial<Draft>) => void; subject: FeedbackSubject }) {
	const ask = d.problem?.ask ?? []
	const title = subject.kind === "title" ? subject : null
	const person = subject.kind === "person" ? subject : null
	const isOther = (q: Question) => q in d.others
	/** A regular answer drops the question's "Something else". */
	const answer = (q: Question, p: Partial<Draft>) => {
		const { [q]: _, ...rest } = d.others
		set({ ...p, others: rest })
	}
	const other = (q: Question, clear: Partial<Draft> = {}) => (
		<Chip
			on={isOther(q)}
			onClick={() =>
				set({ ...clear, others: { ...d.others, [q]: d.others[q] ?? "" } })
			}
		>
			{SOMETHING_ELSE}
		</Chip>
	)
	const otherField = (q: Question, placeholder: string) =>
		isOther(q) && (
			<input
				// biome-ignore lint/a11y/noAutofocus: it opens because the member just asked for it
				autoFocus
				value={d.others[q] ?? ""}
				onChange={(e) => set({ others: { ...d.others, [q]: e.target.value } })}
				aria-label={placeholder}
				placeholder={placeholder}
				className={`${INPUT} mt-2`}
			/>
		)
	const offers: Offer[] =
		title && ask.includes("provider") ? offersOf(title, d.provider) : OFFERS
	return (
		<div className="flex flex-col gap-4">
			{title && ask.includes("provider") && (
				<div>
					<span className={LABEL}>Which service?</span>
					<div className="flex flex-wrap gap-2">
						{listedServices(title).map((s) => (
							<Chip
								key={s.providerId}
								on={d.provider === s.providerId && !isOther("provider")}
								onClick={() => {
									const types = offersOf(title, s.providerId)
									answer("provider", {
										provider: s.providerId,
										providerName: s.name,
										offer: types.length === 1 ? types[0] : undefined,
									})
								}}
								spot={`provider:${s.providerId}`}
								className="pl-1.5"
							>
								<TmdbImage
									kind="logo"
									path={s.logo}
									width={24}
									ratio={1}
									alt=""
									className="size-6 rounded-md"
								/>
								{s.name}
							</Chip>
						))}
						{other("provider", {
							provider: undefined,
							providerName: undefined,
						})}
					</div>
					{otherField("provider", "Which service?")}
				</div>
			)}
			{title && ask.includes("missingProvider") && (
				<MissingService d={d} subject={title} answer={answer} other={other} />
			)}
			{ask.includes("missingProvider") &&
				otherField("missingProvider", "Which service?")}
			{ask.includes("offer") && (
				<div>
					<span className={LABEL}>How?</span>
					<div className="flex flex-wrap gap-2">
						{offers.map((o) => (
							<Chip
								key={o}
								on={d.offer === o && !isOther("offer")}
								onClick={() => answer("offer", { offer: o })}
								spot={`offer:${o}`}
							>
								{OFFER_LABEL[o]}
							</Chip>
						))}
						{other("offer", { offer: undefined })}
					</div>
					{otherField("offer", "How can you watch it there?")}
				</div>
			)}
			{title && ask.includes("country") && (
				<div>
					<span className={LABEL}>In which country?</span>
					<div className="flex flex-wrap gap-2">
						<Chip
							on={d.country === title.country && !isOther("country")}
							onClick={() => answer("country", { country: title.country })}
							spot="country"
						>
							{regionName(title.country)}
						</Chip>
						{other("country", { country: undefined })}
					</div>
					{otherField("country", "Which country?")}
				</div>
			)}
			{title && ask.includes("episode") && (
				<div>
					<span className={LABEL}>Which episode?</span>
					{title.grid.length > 0 && (
						<div className="flex flex-wrap gap-2">
							{title.grid.map((s) => (
								<Chip
									key={s.number}
									on={d.season === s.number && !isOther("episode")}
									onClick={() =>
										answer("episode", {
											season: s.number,
											episode: s.episodes[0]?.number,
										})
									}
									spot={`season:${s.number}`}
								>
									Season {s.number}
								</Chip>
							))}
							{other("episode")}
						</div>
					)}
					{title.grid.length === 0 && !isOther("episode") && (
						<div className="flex flex-wrap gap-2">{other("episode")}</div>
					)}
					{otherField("episode", "Which episode? Season, number or title")}
					{!isOther("episode") && title.grid.length > 0 && (
						<select
							aria-label="Episode"
							value={d.episode ?? ""}
							onChange={(e) => set({ episode: Number(e.target.value) })}
							className={`${INPUT} mt-2`}
						>
							{title.grid
								.find((s) => s.number === d.season)
								?.episodes.map((e) => (
									<option key={e.number} value={e.number}>
										Episode {e.number} · {e.name}
									</option>
								))}
						</select>
					)}
				</div>
			)}
			{title && ask.includes("person") && (
				<div>
					<span className={LABEL}>Who?</span>
					<div className="flex flex-wrap gap-2">
						{title.cast.slice(0, CAST_CHOICES).map((c) => (
							<Chip
								key={c.id}
								on={d.person === c.id && !isOther("person")}
								onClick={() => answer("person", { person: c.id })}
								spot={`person:${c.id}`}
								className="pl-1"
							>
								<TmdbImage
									kind="profile"
									path={c.profilePath}
									width={28}
									ratio={1}
									alt=""
									className="size-7 rounded-full object-cover"
								/>
								{c.name}
							</Chip>
						))}
						{other("person", { person: undefined })}
					</div>
					{otherField("person", "Who? Their name")}
				</div>
			)}
			{person && ask.includes("credit") && (
				<CreditChoice d={d} subject={person} answer={answer} other={other} />
			)}
			{ask.includes("credit") && otherField("credit", "Which title?")}
			{title && ask.includes("source") && (
				<div>
					<span className={LABEL}>Which score?</span>
					<div className="flex flex-wrap gap-2">
						{title.scores.map((s) => (
							<Chip
								key={s.id}
								on={d.source === s.id && !isOther("source")}
								onClick={() => answer("source", { source: s.id })}
								spot={`source:${s.id}`}
							>
								{s.label}{" "}
								<span className="tabular-nums opacity-60">{s.value}</span>
							</Chip>
						))}
						{other("source", { source: undefined })}
					</div>
					{otherField("source", "Which score?")}
				</div>
			)}
		</div>
	)
}

type Answer = (q: Question, p: Partial<Draft>) => void
type Other = (q: Question, clear?: Partial<Draft>) => React.ReactNode

/** "Where is it?": the country's services the page doesn't list, most common first. */
function MissingService({
	d,
	subject,
	answer,
	other,
}: { d: Draft; subject: TitleSubject; answer: Answer; other: Other }) {
	const { data } = useStreamingProviders({ country: subject.country })
	const listed = new Set(subject.offers.map((o) => o.providerId))
	const seen = new Set<string>()
	const choices = (data ?? [])
		.filter((p) => !listed.has(p.id) && !ignoredProviders.includes(p.id))
		.map((p) => ({ ...p, name: brandName(getShorterProviderLabel(p.name)) }))
		.filter((p) => !seen.has(p.name) && seen.add(p.name))
		.slice(0, MISSING_CHOICES)
	return (
		<div>
			<span className={LABEL}>Where is it?</span>
			<div className="flex min-h-9 flex-wrap gap-2">
				{choices.map((s) => (
					<Chip
						key={s.id}
						on={d.provider === s.id && !("missingProvider" in d.others)}
						onClick={() =>
							answer("missingProvider", {
								provider: s.id,
								providerName: s.name,
							})
						}
						className="pl-1.5"
					>
						<TmdbImage
							kind="logo"
							path={s.logo_path}
							width={24}
							ratio={1}
							alt=""
							className="size-6 rounded-md"
						/>
						{s.name}
					</Chip>
				))}
				{other("missingProvider", {
					provider: undefined,
					providerName: undefined,
				})}
			</div>
		</div>
	)
}

function CreditChoice({
	d,
	subject,
	answer,
	other,
}: { d: Draft; subject: PersonSubject; answer: Answer; other: Other }) {
	return (
		<div>
			<span className={LABEL}>Which title?</span>
			<div className="flex flex-wrap gap-2">
				{subject.credits.slice(0, CREDIT_CHOICES).map((c) => {
					const key = `${c.mediaType}:${c.tmdbId}`
					return (
						<Chip
							key={key}
							on={d.credit === key && !("credit" in d.others)}
							onClick={() => answer("credit", { credit: key })}
							spot={`credit:${key}`}
						>
							{c.title}{" "}
							{c.year && <span className="text-xs opacity-60">{c.year}</span>}
						</Chip>
					)
				})}
				{other("credit", { credit: undefined })}
			</div>
		</div>
	)
}

/** The current value, filled in, and what it should be. */
function Values({
	d,
	set,
	subject,
}: { d: Draft; set: (p: Partial<Draft>) => void; subject: FeedbackSubject }) {
	const p = d.problem
	if (!p) return null
	const removing = ["not-there", "not-in-it", "not-theirs"].includes(p.id)
	const badLink = linkProblem(d.link)
	const link = (
		<label>
			<span className={LABEL}>
				Source link{" "}
				<span className="normal-case tracking-normal text-gray-600">
					· {p.id === "missing" ? "helps us add it" : "optional"}
				</span>
			</span>
			<input
				value={d.link}
				onChange={(e) => set({ link: e.target.value })}
				inputMode="url"
				placeholder="https://…"
				aria-invalid={badLink || undefined}
				className={INPUT}
			/>
			{badLink && (
				<span className="mt-1 block text-xs text-amber-300">
					Paste the whole link, starting with https://
				</span>
			)}
		</label>
	)
	if (p.id === "other")
		return (
			<div className="flex flex-col gap-4">
				<label>
					<span className={LABEL}>What's wrong?</span>
					<textarea
						// biome-ignore lint/a11y/noAutofocus: it opens because the member just picked "Something else"
						autoFocus
						value={d.note}
						onChange={(e) => set({ note: e.target.value })}
						rows={3}
						maxLength={2000}
						placeholder="Tell us in your words"
						className={`${INPUT} py-2.5`}
					/>
				</label>
				{link}
			</div>
		)
	const isDate = DATE_PROBLEMS.includes(p.id)
	return (
		<div className="flex flex-col gap-4">
			<div
				className={p.suggest ? "grid grid-cols-2 gap-2" : "flex flex-col gap-4"}
			>
				<div className="min-w-0">
					<span className={LABEL}>On GoodWatch now</span>
					<p className="break-words rounded-lg bg-white/[0.04] px-3 py-2.5 text-sm text-gray-300 ring-1 ring-white/10">
						{currentValue(d, subject)}
					</p>
				</div>
				{p.suggest && (
					<label className="min-w-0">
						<span className={LABEL}>
							{p.suggest}{" "}
							<span className="normal-case tracking-normal text-gray-600">
								· optional
							</span>
						</span>
						<input
							type={isDate ? "date" : "text"}
							value={d.suggested}
							onChange={(e) => set({ suggested: e.target.value })}
							maxLength={500}
							placeholder={isDate ? undefined : "Type it here"}
							className={INPUT}
						/>
					</label>
				)}
			</div>
			{removing && <p className="text-sm text-gray-400">We'll take it off.</p>}
			{p.flag && (
				<label>
					<span className={LABEL}>
						What looks off?{" "}
						<span className="normal-case tracking-normal text-gray-600">
							· optional
						</span>
					</span>
					<textarea
						value={d.note}
						onChange={(e) => set({ note: e.target.value })}
						rows={3}
						maxLength={2000}
						placeholder="A few words help us find it"
						className={`${INPUT} py-2.5`}
					/>
				</label>
			)}
			{!p.flag && link}
		</div>
	)
}

export function ReportFlow({
	area,
	subject,
}: { area: RichArea; subject: FeedbackSubject }) {
	const flow = useFixFlow()
	const guest = flow?.guest ?? false
	const sender = useSender()
	const [d, setD] = useState<Draft>(() => newDraft(area, subject))
	const [email, setEmail] = useState("")
	const [sent, setSent] = useState<{
		outcome: FeedbackOutcome
		correctionId: string | null
		before?: string
		after?: string
	} | null>(null)
	const pinned = sent ? null : spotOf(d)
	useEffect(() => flow?.setPinned(pinned), [pinned, flow?.setPinned])
	useEffect(() => () => flow?.setPinned(null), [flow?.setPinned])
	const set = (p: Partial<Draft>) => setD((x) => ({ ...x, ...p }))
	const restart = () => {
		setD(newDraft(area, subject))
		setSent(null)
		sender.reset()
		flow?.again()
	}
	if (sent)
		return (
			<Result
				{...sent}
				email={email}
				onAnother={restart}
				onDone={() => flow?.done()}
			/>
		)

	const problems = problemsOf(area)
	const pick = (problem: Problem) => set({ problem })
	const kind = d.problem ? (d.problem.flag ? "flag" : "fix") : null
	const blocked =
		!ready(d, "send") ||
		linkProblem(d.link) ||
		(guest && emailProblem(email)) ||
		sender.sending
	const send = async () => {
		const report = reportOfDraft(d, subject)
		const response = await sender.send(
			(e) => buildReportRequest(report, e),
			guest ? email : undefined,
		)
		if (!response) return
		const result = outcomeOf(response, fallbackOutcome(report.kind))
		setSent({
			...result,
			before: report.currentValue,
			after: report.suggestedValue,
		})
		flow?.sent()
	}
	return (
		<div className="flex flex-col gap-5" data-report-flow={area}>
			<div>
				<span className={LABEL}>What's wrong?</span>
				<div className="flex flex-wrap gap-2">
					{problems.map((p) => (
						<Chip
							key={p.id}
							on={d.problem?.id === p.id}
							onClick={() => pick(p)}
						>
							{p.flag && (
								<FlagIcon className="size-3.5 opacity-60" aria-hidden />
							)}
							{p.label}
						</Chip>
					))}
				</div>
			</div>
			{d.problem && <Questions d={d} set={set} subject={subject} />}
			{d.problem && ready(d, "questions") && (
				<Values d={d} set={set} subject={subject} />
			)}
			{d.problem && ready(d, "questions") && guest && (
				<GuestEmail
					value={email}
					onChange={setEmail}
					invalid={emailProblem(email)}
				/>
			)}
			<SendFooter>
				<FailureLine failure={sender.failure} />
				{kind && (
					<div className="mb-2">
						<BeforeSendLine kind={kind} />
					</div>
				)}
				<PrimaryButton type="button" onClick={send} disabled={blocked}>
					{sender.sending ? "Sending…" : "Send"}
				</PrimaryButton>
			</SendFooter>
		</div>
	)
}
