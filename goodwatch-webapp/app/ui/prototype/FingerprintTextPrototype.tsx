// PROTOTYPE - throwaway. Four ways to put the fingerprint into words on the
// detail page (`?variant=A|B|C|D`, `0` is the current page), switchable with
// the floating bar or the arrow keys. Text comes from ./fingerprint-text.

import { ChevronLeftIcon, ChevronRightIcon } from "@heroicons/react/24/solid"
import { Link, useLocation, useNavigate } from "@remix-run/react"
import React, { useEffect, useState } from "react"
import type { MovieResult, ShowResult } from "~/server/types/details-types"
import fingerprintIcon from "~/img/fingerprint.webp"
import { PILLAR_CONFIG } from "~/ui/fingerprint/Pillars"
import * as F from "~/ui/prototype/fingerprint-text"

export const FINGERPRINT_TEXT_VARIANTS = {
	"0": "Current page",
	A: "Words in the fingerprint card",
	B: "Viewing guide article",
	C: "Questions and answers",
	D: "Scorecard with mood links",
} as const
export type FingerprintTextVariant = keyof typeof FINGERPRINT_TEXT_VARIANTS

export function variantFromSearch(search: string): FingerprintTextVariant {
	const v = new URLSearchParams(search).get("variant") ?? "0"
	return v in FINGERPRINT_TEXT_VARIANTS ? (v as FingerprintTextVariant) : "0"
}

export function useFingerprintTextVariant() {
	return variantFromSearch(useLocation().search)
}

export function toTitleInput(media: MovieResult | ShowResult): F.TitleInput | null {
	if (!media.fingerprint) return null
	const { details } = media
	return {
		title: details.title,
		mediaType: media.mediaType,
		year: details.release_year,
		genres: details.genres,
		fingerprint: media.fingerprint,
	}
}

// Meta description for the route's `meta` export. Undefined keeps the current one.
export function prototypeMetaDescription(search: string, media: MovieResult | ShowResult) {
	if (variantFromSearch(search) === "0") return undefined
	const t = toTitleInput(media)
	if (!t) return undefined
	const where = media.streaming_services?.length ? " See where to stream it." : ""
	return `${media.details.title} (${media.details.release_year}): ${F.summary(t)} ${F.pillarLine(t)}.${where}`
}

// --- Variant A: words inside the existing fingerprint card ---

export function VariantA({ media }: { media: MovieResult | ShowResult }) {
	const t = toTitleInput(media)
	if (!t) return null
	const tiers = t.fingerprint.pillars
	return (
		<div className="md:mt-8 lg:max-w-lg space-y-4">
			<h2 className="flex items-center gap-2 text-2xl font-bold">
				<img src={fingerprintIcon} className="h-7 p-0.5 w-auto bg-amber-950/50" alt="" />
				{t.title} fingerprint
			</h2>
			<p className="text-lg font-semibold text-amber-200">{F.pillarLine(t)}.</p>
			<ul className="grid grid-cols-1 gap-1">
				{(Object.keys(PILLAR_CONFIG) as (keyof typeof PILLAR_CONFIG)[]).map((p) => (
					<li key={p} className="grid grid-cols-[7rem_4rem_1fr] items-center gap-3 px-3 py-1.5">
						<span className="flex items-center gap-2 font-medium">
							<span>{PILLAR_CONFIG[p].emoji}</span>
							{p}
						</span>
						<span className="font-mono text-lg">
							{Array.from({ length: tiers[p] }, (_, i) => (
								<span key={i} className={`${PILLAR_CONFIG[p].colors[i]} brightness-125`}>
									█
								</span>
							))}
							<span className="text-gray-600">{"░".repeat(4 - tiers[p])}</span>
						</span>
						<span className="text-sm text-gray-300">{F.pillarWord(p, tiers[p])}</span>
					</li>
				))}
			</ul>
			<p className="text-gray-200 leading-relaxed">{F.feelParagraph(t)}</p>
		</div>
	)
}

// --- Variant B: long-form viewing guide below About ---

export function VariantB({ media }: { media: MovieResult | ShowResult }) {
	const t = toTitleInput(media)
	if (!t) return null
	const skip = F.skipIf(t)
	const moods = F.matchingMoods(t)
	return (
		<article className="rounded-xl border border-white/5 bg-white/3 p-4 sm:p-8 max-w-3xl">
			<h2 className="text-2xl font-bold">What watching {t.title} is like</h2>
			<p className="mt-2 text-lg text-amber-200">{F.summary(t)}</p>

			<h3 className="mt-6 text-lg font-semibold">Mood and pace</h3>
			<p className="mt-1 text-gray-200 leading-relaxed">{F.feelParagraph(t)}</p>

			{F.craftSentence(t) && (
				<>
					<h3 className="mt-6 text-lg font-semibold">What stands out</h3>
					<p className="mt-1 text-gray-200 leading-relaxed">{F.craftSentence(t)}</p>
				</>
			)}

			<h3 className="mt-6 text-lg font-semibold">Who it's for</h3>
			<p className="mt-1 text-gray-200 leading-relaxed">{F.bestForSentence(t)}</p>

			{skip.length > 0 && (
				<>
					<h3 className="mt-6 text-lg font-semibold">Skip it if</h3>
					<ul className="mt-1 list-disc pl-5 text-gray-200">
						{skip.map((s) => (
							<li key={s}>{s}</li>
						))}
					</ul>
				</>
			)}

			{moods.length > 0 && (
				<p className="mt-6 text-gray-300">
					Find more like it:{" "}
					{moods.map((m, i) => (
						<React.Fragment key={m.url}>
							{i > 0 && ", "}
							<Link to={m.url} className="underline hover:text-white">
								{m.label.replace(/\s*\p{Extended_Pictographic}.*$/u, "").toLowerCase()} {t.mediaType === "movie" ? "movies" : "shows"}
							</Link>
						</React.Fragment>
					))}
					.
				</p>
			)}
			<p className="mt-6 text-xs text-gray-500">
				Based on the GoodWatch fingerprint, our scores for 70+ traits of every {t.mediaType === "movie" ? "movie" : "show"}.
			</p>
		</article>
	)
}

// --- Variant C: questions people search for, with FAQPage JSON-LD ---

export function VariantC({ media }: { media: MovieResult | ShowResult }) {
	const t = toTitleInput(media)
	if (!t) return null
	const faqs = F.faqs(t)
	const jsonLd = {
		"@context": "https://schema.org",
		"@type": "FAQPage",
		mainEntity: faqs.map((f) => ({
			"@type": "Question",
			name: f.q,
			acceptedAnswer: { "@type": "Answer", text: f.a },
		})),
	}
	return (
		<section className="max-w-3xl">
			<h2 className="text-2xl font-bold">{t.title}: common questions</h2>
			<p className="mt-2 text-gray-300">
				{F.pillarLine(t)}. Answers come from the GoodWatch fingerprint scores.
			</p>
			<dl className="mt-4 divide-y divide-white/10 border-y border-white/10">
				{faqs.map((f) => (
					<div key={f.q} className="py-3 sm:grid sm:grid-cols-[18rem_1fr] sm:gap-6">
						<dt className="font-semibold">{f.q}</dt>
						<dd className="mt-1 sm:mt-0 text-gray-300">{f.a}</dd>
					</div>
				))}
			</dl>
			<script
				type="application/ld+json"
				// biome-ignore lint/security/noDangerouslySetInnerHtml: prototype JSON-LD
				dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
			/>
		</section>
	)
}

// --- Variant D: scannable scorecard, links to the mood pages it belongs to ---

export function VariantD({ media }: { media: MovieResult | ShowResult }) {
	const t = toTitleInput(media)
	if (!t) return null
	const s = t.fingerprint.scores
	const moods = F.matchingMoods(t)
	const best = F.bestFor(t)
	const skip = F.skipIf(t)
	const craft = F.standouts(t)
	const rows: [string, React.ReactNode][] = [
		["In short", F.pillarLine(t)],
		["Feels", F.summary(t)],
		[
			"Pace",
			s.slow_burn >= 7
				? `Slow burn (${s.slow_burn}/10)`
				: s.fast_pace >= 7
					? `Fast (${s.fast_pace}/10)`
					: "Moderate",
		],
		["Complexity", `${s.complexity}/10${s.complexity >= 8 ? ", needs full attention" : ""}`],
		["Scares / violence", `${s.scare}/10 · ${s.violence}/10`],
		[
			"Standouts",
			craft.length ? craft.map((c) => `${c.label} ${c.score}/10`).join(" · ") : "None above 8/10",
		],
		["Best for", best.length ? F.list(best, "or") : "No specific setting"],
		["Skip if", skip.length ? F.list(skip, "or") : "Nothing notable"],
		[
			"Moods",
			moods.length ? (
				<span className="flex flex-wrap gap-2">
					{moods.map((m) => (
						<Link
							key={m.url}
							to={m.url}
							className="px-2 py-0.5 rounded-md bg-gray-800 border border-gray-600 hover:border-gray-300 text-sm"
						>
							{m.label}
						</Link>
					))}
				</span>
			) : (
				"Doesn't match a mood collection"
			),
		],
	]
	return (
		<section>
			<h2 className="text-2xl font-bold">{t.title} at a glance</h2>
			<table className="mt-4 w-full max-w-4xl text-left">
				<tbody>
					{rows.map(([k, v]) => (
						<tr key={k} className="border-b border-white/10 align-top">
							<th scope="row" className="py-2 pr-6 w-44 font-medium text-gray-400 whitespace-nowrap">
								{k}
							</th>
							<td className="py-2 text-gray-100">{v}</td>
						</tr>
					))}
				</tbody>
			</table>
		</section>
	)
}

// Renders the variant's section below About. Variant A lives in the fingerprint card instead.
export function FingerprintTextSection({ media }: { media: MovieResult | ShowResult }) {
	const v = useFingerprintTextVariant()
	if (v === "B") return <VariantB media={media} />
	if (v === "C") return <VariantC media={media} />
	if (v === "D") return <VariantD media={media} />
	return null
}

// Floating variant switcher, not part of the design.

export function PrototypeSwitcher({ media }: { media: MovieResult | ShowResult }) {
	const location = useLocation()
	const navigate = useNavigate()
	const current = useFingerprintTextVariant()
	const keys = Object.keys(FINGERPRINT_TEXT_VARIANTS) as FingerprintTextVariant[]
	const [open, setOpen] = useState(false)

	const cycle = (step: number) => {
		const next = keys[(keys.indexOf(current) + step + keys.length) % keys.length]
		const searchParams = new URLSearchParams(location.search)
		searchParams.set("variant", next)
		navigate(`${location.pathname}?${searchParams.toString()}`, {
			replace: true,
			preventScrollReset: true,
		})
	}

	useEffect(() => {
		const handleKeyDown = (event: KeyboardEvent) => {
			const target = event.target as HTMLElement | null
			if (target?.closest("input, textarea, select, [contenteditable]")) return
			if (event.key === "ArrowLeft") cycle(-1)
			if (event.key === "ArrowRight") cycle(1)
		}
		window.addEventListener("keydown", handleKeyDown)
		return () => window.removeEventListener("keydown", handleKeyDown)
	})

	if (!import.meta.env.DEV) return null

	// Surface the state: the meta description this variant would ship, and
	// how many GoodWatch-only words it adds to the page.
	const meta = prototypeMetaDescription(location.search, media)
	const addedWords = countWords(current)

	return (
		<div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[100] flex flex-col items-center gap-2 max-w-[calc(100vw-2rem)]">
			{open && (
				<div className="w-[36rem] max-w-full rounded-lg bg-yellow-100 text-black text-xs p-3 shadow-xl shadow-black space-y-1">
					<div>
						<b>Meta description ({meta?.length ?? 0} chars):</b> {meta ?? "unchanged"}
					</div>
					<div>
						<b>GoodWatch-only words added:</b> {addedWords}
					</div>
				</div>
			)}
			<div className="flex items-center gap-2 px-2 py-1.5 rounded-full bg-yellow-300 text-black text-sm font-semibold shadow-xl shadow-black">
				<button
					type="button"
					className="p-1 rounded-full hover:bg-black/15 cursor-pointer"
					aria-label="Previous variant"
					onClick={() => cycle(-1)}
				>
					<ChevronLeftIcon className="h-5 w-5" />
				</button>
				<button type="button" className="min-w-64 text-center cursor-pointer" onClick={() => setOpen(!open)}>
					{current} - {FINGERPRINT_TEXT_VARIANTS[current]}
				</button>
				<button
					type="button"
					className="p-1 rounded-full hover:bg-black/15 cursor-pointer"
					aria-label="Next variant"
					onClick={() => cycle(1)}
				>
					<ChevronRightIcon className="h-5 w-5" />
				</button>
			</div>
		</div>
	)

	function countWords(v: FingerprintTextVariant) {
		const t = toTitleInput(media)
		if (!t || v === "0") return 0
		if (v === "A") return F.wordCount([F.pillarLine(t), F.feelParagraph(t)])
		if (v === "B")
			return F.wordCount([F.summary(t), F.feelParagraph(t), F.craftSentence(t), F.bestForSentence(t), ...F.skipIf(t)])
		if (v === "C") return F.wordCount(F.faqs(t).flatMap((f) => [f.q, f.a]))
		return F.wordCount([F.pillarLine(t), F.summary(t), ...F.bestFor(t), ...F.skipIf(t)])
	}
}
