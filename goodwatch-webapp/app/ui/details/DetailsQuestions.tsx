// Questions people search for, answered from GoodWatch data, as cards with a
// small visual each. The same questions go into FAQPage structured data.

import {
	BanknotesIcon,
	BookOpenIcon,
	CalendarDaysIcon,
	ClockIcon,
	GlobeAltIcon,
	LanguageIcon,
	ScaleIcon,
	ShieldCheckIcon,
	SparklesIcon,
	StarIcon,
	TvIcon,
} from "@heroicons/react/24/outline"
import type React from "react"
import type { MovieResult, ShowResult } from "~/server/types/details-types"
import ScoreRing from "~/ui/details/hero/ScoreRing"
import { useStreamingLinks } from "~/ui/details/hero/WhereToWatch"
import { type QuestionId, ageInfo, agreement, FEATURED_TROPES, featuredTropes, money, titleQuestions, tropeCount } from "~/ui/details/titleQuestions"

type Media = MovieResult | ShowResult

export default function DetailsQuestions({ media, country }: { media: Media; country: string }) {
	const faqs = titleQuestions(media, country)
	if (!faqs.length) return null
	const jsonLd = {
		"@context": "https://schema.org",
		"@type": "FAQPage",
		mainEntity: faqs.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
	}
	return (
		<section>
			<h2 className="text-2xl font-bold">Questions about {media.details.title}</h2>
			<p className="mt-1 text-gray-400">Quick answers from GoodWatch data.</p>
			<div className="mt-6 grid gap-4 md:grid-cols-2">
				{faqs.map((f, i) => {
					// An odd card out at the end spans both columns so the grid has no hole.
					const narrow = faqs.filter((x) => !WIDE.includes(x.id))
					const lastOdd = narrow.length % 2 === 1 && f.id === narrow[narrow.length - 1].id
					return <QuestionCard key={f.id} media={media} country={country} faq={f} wide={lastOdd} />
				})}
			</div>
			<script
				type="application/ld+json"
				// biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD from our own data
				dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
			/>
		</section>
	)
}

const FAQ_ICON: Record<QuestionId, React.ComponentType<{ className?: string }>> = {
	stream: TvIcon,
	worth: StarIcon,
	rated: ShieldCheckIcon,
	length: ClockIcon,
	source: BookOpenIcon,
	agree: ScaleIcon,
	boxoffice: BanknotesIcon,
	aired: CalendarDaysIcon,
	language: LanguageIcon,
	countries: GlobeAltIcon,
	tropes: SparklesIcon,
}

const WIDE: QuestionId[] = ["stream", "tropes"]

function QuestionCard({ media, country, faq, wide = false }: { media: Media; country: string; faq: { id: QuestionId; q: string; a: string }; wide?: boolean }) {
	const Icon = FAQ_ICON[faq.id]
	return (
		<article className={`flex gap-4 rounded-2xl border border-white/8 bg-white/4 p-5 sm:p-6 ${WIDE.includes(faq.id) || wide ? "md:col-span-2" : ""}`}>
			<span className="hidden sm:flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-300/15 text-amber-200">
				<Icon className="h-5 w-5" />
			</span>
			<div className="min-w-0 grow">
				<h3 className="text-lg font-semibold leading-snug">{faq.q}</h3>
				<AnswerVisual media={media} country={country} id={faq.id} />
				<p className="mt-3 text-gray-300 leading-relaxed">{faq.a}</p>
			</div>
		</article>
	)
}

function AnswerVisual({ media, country, id }: { media: Media; country: string; id: QuestionId }) {
	const links = useStreamingLinks(media, country, ["flatrate", "flatrate_and_buy", "free", "ads"])
	if (id === "stream" && links.length > 0)
		return (
			<div className="mt-4 flex flex-wrap gap-2">
				{links.slice(0, 8).map((l) => (
					<a key={l.id} href={l.url} target="_blank" rel="noreferrer" className="flex h-10 items-center gap-2 rounded-lg border border-white/15 bg-white/5 pr-3 hover:bg-white/10">
						<img src={l.logo} alt="" className="h-full aspect-square rounded-md" />
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
	if (id === "rated") {
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
	if (id === "length") {
		const d = media.details as unknown as Record<string, unknown>
		const rt = d.runtime as number | null
		const figure =
			media.mediaType === "movie"
				? rt
					? `${Math.floor(rt / 60)} h ${rt % 60} min`
					: null
				: d.number_of_seasons
					? `${d.number_of_seasons} season${d.number_of_seasons === 1 ? "" : "s"}`
					: null
		return figure ? <p className="mt-3 text-3xl font-bold tracking-tight">{figure}</p> : null
	}
	if (id === "agree") {
		const { critics, audience } = agreement(media)
		const bar = (label: string, v: number | null, color: string) => (
			<div className="grid grid-cols-[5.5rem_1fr_2rem] items-center gap-3 text-sm">
				<span className="text-gray-300">{label}</span>
				<span className="h-2.5 rounded-full bg-white/8">
					<span className="block h-2.5 rounded-full" style={{ width: `${v ?? 0}%`, background: color }} />
				</span>
				<span className="text-right font-semibold tabular-nums">{v ?? "–"}</span>
			</div>
		)
		return (
			<div className="mt-4 space-y-2">
				{bar("Critics", critics, "#a78bfa")}
				{bar("Audiences", audience, "#fbbf24")}
			</div>
		)
	}
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
	if (id === "aired" && media.mediaType === "show") {
		const seasons = (media as unknown as { seasons?: { season_number: number; episode_count: number }[] }).seasons ?? []
		const real = seasons.filter((x) => x.season_number > 0)
		const most = Math.max(1, ...real.map((x) => x.episode_count))
		// Long-running shows get thin bars and a label on every fifth season, so the chart
		// stays inside a phone's width.
		const many = real.length > 12
		return real.length ? (
			<div className={`mt-4 flex h-16 items-end ${many ? "gap-px" : "gap-1.5"}`} role="img" aria-label={real.map((x) => `Season ${x.season_number}: ${x.episode_count} episodes`).join(", ")}>
				{real.map((x, i) => (
					<span key={x.season_number} className="flex min-w-0 flex-1 flex-col items-center gap-1">
						<span className="w-full rounded-sm bg-sky-400/70" style={{ height: `${(x.episode_count / most) * 44}px` }} />
						<span className="whitespace-nowrap text-[10px] text-gray-400">{!many || i === 0 || x.season_number % 5 === 0 ? `S${x.season_number}` : "\u00a0"}</span>
					</span>
				))}
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
						{langLabel(c)}
					</span>
				))}
			</div>
		)
	}
	if (id === "countries") {
		const codes = media.details.streaming_country_codes ?? []
		return (
			<div className="mt-3 flex items-center gap-4">
				<span className="text-3xl font-bold tabular-nums">{codes.length}</span>
				<span className="flex flex-wrap gap-1">
					{codes.slice(0, 14).map((c) => (
						<img key={c} src={`https://purecatamphetamine.github.io/country-flag-icons/3x2/${c}.svg`} alt={c} title={c} className="h-3.5 rounded-[2px]" />
					))}
					{codes.length > 14 && <span className="text-xs text-gray-400">+{codes.length - 14}</span>}
				</span>
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

const langLabel = (code: string) => {
	try {
		return new Intl.DisplayNames(["en"], { type: "language" }).of(code) ?? code
	} catch {
		return code
	}
}

