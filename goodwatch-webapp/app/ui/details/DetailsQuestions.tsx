// Questions people search for, answered from GoodWatch data, as cards with a small visual each. The questions are
// in the server's HTML as headings and paragraphs, without structured data: Google shows no FAQ results any more.

import { ChevronDownIcon } from "@heroicons/react/20/solid"
import {
	ArrowsRightLeftIcon,
	BanknotesIcon,
	ChartBarIcon,
	ClockIcon,
	FaceSmileIcon,
	FilmIcon,
	HeartIcon,
	LanguageIcon,
	MoonIcon,
	ShieldCheckIcon,
	SparklesIcon,
	StarIcon,
	SunIcon,
	TvIcon,
} from "@heroicons/react/24/outline"
import { Link } from "@remix-run/react"
import type React from "react"
import { useState } from "react"
import type { MovieResult, ShowResult } from "~/server/types/details-types"
import ScoreRing from "~/ui/details/hero/ScoreRing"
import { useStreamingLinks } from "~/ui/details/hero/WhereToWatch"
import { TmdbImage } from "~/ui/TmdbImage"
import { AREA_COLOR } from "~/ui/details/fingerprint/areas"
import type { FingerprintVisual } from "~/ui/details/fingerprintQuestions"
import { getFingerprintMeta } from "~/ui/fingerprint/fingerprintMeta"
import { type QuestionId, type TitleQuestion, ageInfo, FEATURED_TROPES, featuredTropes, money, tropeCount } from "~/ui/details/titleQuestions"
import { languageName } from "~/utils/display-names"
import MediaText from "~/ui/media-text/MediaText"
import { presentedText } from "~/ui/media-text/media-text"

type Media = MovieResult | ShowResult

export default function DetailsQuestions({
	media,
	country,
	questions,
}: {
	media: Media
	country: string
	/** The title's questions (useTitleQuestions). */
	questions: TitleQuestion[]
}) {
	const faqs = questions
	if (!faqs.length) return null
	return (
		<section>
			<h2 className="text-2xl font-bold">
				Questions about <MediaText value={presentedText(media.details, "title", media.details.title)} />
			</h2>
			<p className="mt-1 text-gray-400">Quick answers from GoodWatch data.</p>
			<div className="mt-6 grid gap-4 md:grid-cols-2">
				{faqs.map((f, i) => {
					// An odd card out at the end spans both columns so the grid has no hole.
					const narrow = faqs.filter((x) => !WIDE.includes(x.id))
					const lastOdd = narrow.length % 2 === 1 && f.id === narrow[narrow.length - 1].id
					return <QuestionCard key={f.id} media={media} country={country} faq={f} wide={lastOdd} />
				})}
			</div>
		</section>
	)
}

const FAQ_ICON: Record<QuestionId, React.ComponentType<{ className?: string }>> = {
	stream: TvIcon,
	worth: StarIcon,
	seasons: ChartBarIcon,
	sequel: FilmIcon,
	kids: ShieldCheckIcon,
	binge: ClockIcon,
	boxoffice: BanknotesIcon,
	language: LanguageIcon,
	tropes: SparklesIcon,
	laugh: FaceSmileIcon,
	drive: ArrowsRightLeftIcon,
	halfWatch: EyeIcon,
	date: HeartIcon,
	scare: MoonIcon,
	feelGood: SunIcon,
}

// Heroicons' outline eye, drawn here: other routes import EyeIcon too, so the
// import became its own script on every title page.
function EyeIcon(props: React.SVGProps<SVGSVGElement>) {
	return (
		<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true" {...props}>
			<path
				strokeLinecap="round"
				strokeLinejoin="round"
				d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z"
			/>
			<path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
		</svg>
	)
}

// The first and the last card: a wide card between two narrow ones would leave a hole beside each.
const WIDE: QuestionId[] = ["stream", "tropes"]

function QuestionCard({
	media,
	country,
	faq,
	wide = false,
}: {
	media: Media
	country: string
	faq: TitleQuestion
	wide?: boolean
}) {
	const { fingerprint } = faq
	const Icon = FAQ_ICON[faq.id]
	const [why, setWhy] = useState(false)
	const whyId = `faq-why-${faq.id}`
	return (
		<article className={`flex gap-4 rounded-2xl border border-white/8 bg-white/4 p-5 sm:p-6 ${WIDE.includes(faq.id) || wide ? "md:col-span-2" : ""}`}>
			<span className="hidden sm:flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-300/15 text-amber-200">
				<Icon className="h-5 w-5" />
			</span>
			<div className="min-w-0 grow">
				<h3 className="text-lg font-semibold leading-snug">{faq.q}</h3>
				{fingerprint ? <FingerprintAnswerVisual visual={fingerprint.visual} /> : <AnswerVisual media={media} country={country} faq={faq} />}
				<p className="mt-3 text-gray-300 leading-relaxed">
					{faq.a}
					{fingerprint && (
						<>
							{" "}
							<button
								type="button"
								aria-expanded={why}
								aria-controls={whyId}
								onClick={() => setWhy(!why)}
								onKeyDown={(e) => e.key === "Escape" && setWhy(false)}
								className="inline-flex cursor-pointer items-center gap-0.5 rounded text-sm text-gray-400 underline decoration-white/30 underline-offset-2 hover:text-white focus-visible:outline-2 focus-visible:outline-amber-300"
							>
								{why ? "Hide traits" : "Why"}
								<ChevronDownIcon className={`h-4 w-4 motion-safe:transition-transform ${why ? "rotate-180" : ""}`} aria-hidden="true" />
							</button>
						</>
					)}
				</p>
				{fingerprint && why && (
					<div id={whyId} className="mt-4 grid gap-4 sm:grid-cols-[repeat(auto-fit,minmax(12rem,1fr))] motion-safe:animate-[faq-why-in_150ms_ease-out]">
						{fingerprint.evidence.map((ev) => (
							<div key={ev.side ?? "traits"}>
								<p className="mb-2 text-xs font-semibold text-gray-400">{ev.side ? `${ev.side} side` : "Based on these traits"}</p>
								<TraitScores traits={ev.traits} color={AREA_COLOR[ev.area]} />
							</div>
						))}
					</div>
				)}
			</div>
		</article>
	)
}

// Scores out of 10 as labeled bars, for the traits behind a fingerprint answer.
function TraitScores({ traits, color }: { traits: { key: string; score: number }[]; color: string }) {
	return (
		<ul className="space-y-3">
			{traits.map((d) => (
				<li key={d.key} className="grid grid-cols-[1fr_auto] items-center gap-x-2 text-sm">
					<span className="truncate text-gray-200">{getFingerprintMeta(d.key).label}</span>
					<span className="tabular-nums text-gray-400">{d.score}</span>
					<span className="col-span-2 h-1.5 rounded-full bg-white/8">
						<span className="block h-1.5 rounded-full" style={{ width: `${d.score * 10}%`, background: color }} />
					</span>
				</li>
			))}
		</ul>
	)
}

function FingerprintAnswerVisual({ visual }: { visual: FingerprintVisual }) {
	if (visual.kind === "meter")
		return (
			<div className="mt-4 flex items-center gap-3">
				<span role="img" aria-label={`${visual.area}: ${visual.word.toLowerCase()}, ${visual.tier} of 4`} className="inline-flex gap-0.5">
					{[0, 1, 2, 3].map((i) => (
						<span
							key={i}
							className="h-2 w-5 rounded-sm"
							style={{ background: i < visual.tier ? AREA_COLOR[visual.area] : "rgba(255,255,255,.1)", opacity: i < visual.tier ? 0.55 + i * 0.15 : 1 }}
						/>
					))}
				</span>
				<span className="text-sm text-gray-300">{visual.word}</span>
			</div>
		)
	if (visual.kind === "chips") {
		// The flags the answer rests on first, then a few others; the rest are counted, not shown.
		const shown = [...visual.items.filter((w) => visual.highlighted.includes(w)), ...visual.items.filter((w) => !visual.highlighted.includes(w))].slice(0, 5)
		const more = visual.items.length - shown.length
		return visual.items.length ? (
			<div className="mt-4 flex flex-wrap items-center gap-1.5">
				{more > 0 && <span className="order-last px-1 text-sm text-gray-400">and {more} more</span>}
				{shown.map((w) => (
					<span
						key={w}
						className={`rounded-full px-2.5 py-1 text-sm ${visual.highlighted.includes(w) ? "bg-emerald-400/20 font-semibold text-emerald-100" : "bg-white/8 text-gray-300"}`}
					>
						{w}
					</span>
				))}
			</div>
		) : null
	}
	return (
		<div className="mt-4 grid grid-cols-[auto_1fr_auto] items-center gap-3 text-sm">
			<span className="text-gray-400">{visual.left}</span>
			<span
				role="img"
				aria-label={`${visual.label}: ${Math.round(visual.position * 100)}% of the way from ${visual.left.toLowerCase()} to ${visual.right.toLowerCase()}`}
				className="relative h-3 rounded-full bg-white/8"
			>
				<span className="absolute inset-y-0 left-1/2 w-px bg-white/15" aria-hidden="true" />
				<span
					className="absolute top-1/2 h-3.5 w-9 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-black/40"
					style={{ left: `calc(18px + ${visual.position} * (100% - 36px))`, background: AREA_COLOR[visual.area] }}
					aria-hidden="true"
				/>
			</span>
			<span className="text-gray-400">{visual.right}</span>
		</div>
	)
}

function AnswerVisual({ media, country, faq }: { media: Media; country: string; faq: TitleQuestion }) {
	const id = faq.id
	const links = useStreamingLinks(media, country, ["flatrate", "flatrate_and_buy", "free", "ads"])
	if (id === "stream" && links.length > 0)
		return (
			<div className="mt-4 flex flex-wrap gap-2">
				{links.slice(0, 8).map((l) => (
					<a key={l.id} href={l.url} data-product-event="streaming service clicked" data-provider-id={l.id} data-tmdb-id={media.details.tmdb_id} data-media-type={media.mediaType} data-country={country} data-offer-type={l.type} target="_blank" rel="noreferrer" className="flex h-10 items-center gap-2 rounded-lg border border-white/15 bg-white/5 pr-3 hover:bg-white/10">
						<TmdbImage kind="logo" path={l.logoPath} width={40} ratio={1} className="h-full w-auto aspect-square rounded-md" />
						<span className="text-sm font-medium">{l.name}</span>
					</a>
				))}
			</div>
		)
	if (id === "worth")
		return (
			<div className="mt-4">
				<ScoreRing media={media} size={52} />
			</div>
		)
	if (id === "kids") {
		const { cert, advisories } = ageInfo(media, country)
		return (
			<div className="mt-4 flex flex-wrap items-center gap-2">
				{cert && <span className="rounded-md border-2 border-white/60 px-2.5 py-0.5 text-lg font-bold">{cert}</span>}
				{advisories.map((a) => (
					<span key={a} className="rounded-full bg-rose-400/15 px-2.5 py-1 text-sm text-rose-100">
						{a.charAt(0).toUpperCase() + a.slice(1)}
					</span>
				))}
			</div>
		)
	}
	if (id === "binge") {
		const d = media.details as unknown as { number_of_episodes?: number; episode_runtime?: number[] | null }
		const minutes = (d.number_of_episodes ?? 0) * (d.episode_runtime?.[0] ?? 0)
		return minutes ? <p className="mt-3 text-3xl font-bold tracking-tight">{`${Math.round(minutes / 60)} h`}</p> : null
	}
	if (id === "seasons" && media.mediaType === "show") {
		const seasons = media.season_summary?.seasons ?? []
		const scores = seasons.map((x) => x.score)
		const top = Math.max(...scores)
		const low = Math.min(...scores)
		// Bars from a floor under the weakest season, so the differences show. Long-running shows get thin bars and a
		// label on every fifth season, so the chart stays inside a phone's width.
		const floor = Math.max(0, Math.floor(low) - 1)
		const many = seasons.length > 12
		return seasons.length ? (
			<div
				className={`mt-4 flex h-20 items-end ${many ? "gap-px" : "gap-1.5"}`}
				role="img"
				aria-label={seasons.map((x) => `Season ${x.number}: ${x.score.toFixed(1)}`).join(", ")}
			>
				{seasons.map((x, i) => (
					<span key={x.number} className="flex min-w-0 flex-1 flex-col items-center gap-1">
						{!many && <span className="text-[10px] tabular-nums text-gray-300">{x.score.toFixed(1)}</span>}
						<span
							className={`w-full rounded-sm ${x.score === top ? "bg-emerald-400/80" : x.score === low ? "bg-rose-400/70" : "bg-sky-400/60"}`}
							style={{ height: `${Math.max(3, ((x.score - floor) / Math.max(0.1, top - floor)) * 40)}px` }}
						/>
						<span className="whitespace-nowrap text-[10px] text-gray-400">{!many || i === 0 || x.number % 5 === 0 ? `S${x.number}` : " "}</span>
					</span>
				))}
			</div>
		) : null
	}
	if (id === "sequel" && faq.titles?.length)
		return (
			<ol className="mt-4 flex flex-wrap gap-2 text-sm">
				{faq.titles.map((t) => (
					<li key={t.id}>
						{t.current ? (
							<span aria-current="page" className="inline-flex rounded-full bg-white px-2.5 py-1 font-semibold text-black">
								{t.label}
							</span>
						) : (
							<Link prefetch="intent" to={t.path} className="inline-flex rounded-full border border-white/15 px-2.5 py-1 text-gray-200 hover:bg-white/10">
								{t.label}
							</Link>
						)}
					</li>
				))}
			</ol>
		)
	if (id === "boxoffice") {
		const { budget, revenue } = media.details
		const max = Math.max(budget ?? 0, revenue ?? 0)
		const bar = (label: string, v: number, color: string) => (
			<div className="grid grid-cols-[5.5rem_1fr] items-center gap-3 text-sm">
				<span className="text-gray-300">{label}</span>
				<span className="flex items-center gap-2">
					<span className="h-2.5 rounded-full" style={{ width: `${Math.max(2, (v / max) * 100)}%`, background: color }} />
					<span className="whitespace-nowrap font-semibold">{money(v)}</span>
				</span>
			</div>
		)
		return budget && revenue ? (
			<div className="mt-4 space-y-2">
				{bar("Budget", budget, "#94a3b8")}
				{bar("Box office", revenue, "#34d399")}
			</div>
		) : null
	}
	if (id === "language") {
		const d = media.details
		const langs = [d.original_language_code, ...(d.spoken_language_codes ?? []).filter((c) => c !== d.original_language_code)]
		return (
			<div className="mt-4 flex flex-wrap gap-1.5">
				{langs.map((c, i) => (
					<span key={c} className={`rounded-full px-2.5 py-1 text-sm ${i === 0 ? "bg-white text-black font-semibold" : "bg-white/10 text-gray-200"}`}>
						{languageName(c)}
					</span>
				))}
			</div>
		)
	}
	if (id === "tropes") {
		const count = tropeCount(media)
		return (
			<div className="mt-4 flex flex-wrap gap-1.5">
				{featuredTropes(media).map((tr) => (
					<span key={tr} className="rounded-full border border-white/15 px-2.5 py-1 text-sm text-gray-200">
						{tr}
					</span>
				))}
				{count > FEATURED_TROPES && <span className="px-1 py-1 text-sm text-gray-400">and {count - FEATURED_TROPES} more</span>}
			</div>
		)
	}
	return null
}
