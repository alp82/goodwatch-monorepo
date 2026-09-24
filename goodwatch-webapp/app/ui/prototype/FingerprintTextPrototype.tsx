// PROTOTYPE - throwaway. Round 3: two independent switches on the detail page.
// `?hero=0..5` arranges poster, trailer, actions, ratings, and streaming.
// `?fp=0..5` picks the full-width fingerprint block. `0` is the current page.
// Round 1 (A-D) is in 8c92bcf4, round 2 (E-H) in f768c72a.

import { ChevronLeftIcon, ChevronRightIcon } from "@heroicons/react/24/solid"
import { useLocation, useNavigate } from "@remix-run/react"
import React, { useEffect, useState } from "react"
import type { MovieResult, ShowResult } from "~/server/types/details-types"
import { FP_VARIANTS, type FpVariant } from "~/ui/prototype/FingerprintBlocks"
import { HERO_VARIANTS, type HeroVariant } from "~/ui/prototype/HeroVariants"
import { factFaqs } from "~/ui/prototype/fact-faqs"
import * as F from "~/ui/prototype/fingerprint-text"

type Media = MovieResult | ShowResult

export function variantsFromSearch(search: string) {
	const p = new URLSearchParams(search)
	const hero = p.get("hero") ?? "0"
	const fp = p.get("fp") ?? "0"
	return {
		hero: (hero in HERO_VARIANTS ? hero : "0") as HeroVariant,
		fp: (fp in FP_VARIANTS ? fp : "0") as FpVariant,
	}
}

export function usePrototypeVariants() {
	return variantsFromSearch(useLocation().search)
}

const isActive = (v: { hero: string; fp: string }) => v.hero !== "0" || v.fp !== "0"

export function toTitleInput(media: Media): F.TitleInput | null {
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
export function prototypeMetaDescription(search: string, media: Media) {
	if (!isActive(variantsFromSearch(search))) return undefined
	const t = toTitleInput(media)
	if (!t) return undefined
	return `${media.details.title} (${media.details.release_year}): ${F.summary(t)} ${F.pillarLine(t)}. See where to stream it legally.`
}

// --- Fact questions below Media ---

export function FingerprintFaqSection({ media, country }: { media: Media; country: string }) {
	const variants = usePrototypeVariants()
	if (!isActive(variants)) return null
	const faqs = factFaqs(media, country)
	if (!faqs.length) return null
	const jsonLd = {
		"@context": "https://schema.org",
		"@type": "FAQPage",
		mainEntity: faqs.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
	}
	return (
		<section className="max-w-4xl">
			<h2 className="text-2xl font-bold">{media.details.title}: questions and answers</h2>
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

// Floating switcher, not part of the design. ← → cycles the hero,
// Shift+← → cycles the fingerprint block.

export function PrototypeSwitcher() {
	const location = useLocation()
	const navigate = useNavigate()
	const current = usePrototypeVariants()

	const cycle = (param: "hero" | "fp", step: number) => {
		const keys = Object.keys(param === "hero" ? HERO_VARIANTS : FP_VARIANTS)
		const next = keys[(keys.indexOf(current[param]) + step + keys.length) % keys.length]
		const searchParams = new URLSearchParams(location.search)
		searchParams.set(param, next)
		searchParams.delete("variant")
		navigate(`${location.pathname}?${searchParams.toString()}`, { replace: true, preventScrollReset: true })
	}

	useEffect(() => {
		const handleKeyDown = (event: KeyboardEvent) => {
			const target = event.target as HTMLElement | null
			if (target?.closest("input, textarea, select, [contenteditable]")) return
			const param = event.shiftKey ? "fp" : "hero"
			if (event.key === "ArrowLeft") cycle(param, -1)
			if (event.key === "ArrowRight") cycle(param, 1)
		}
		window.addEventListener("keydown", handleKeyDown)
		return () => window.removeEventListener("keydown", handleKeyDown)
	})

	const [collapsed, setCollapsed] = useState(false)
	if (!import.meta.env.DEV) return null

	const row = (param: "hero" | "fp", label: string, names: Record<string, string>) => (
		<div className="flex items-center gap-1">
			<button type="button" className="p-1 rounded-full hover:bg-black/15 cursor-pointer" aria-label={`Previous ${label}`} onClick={() => cycle(param, -1)}>
				<ChevronLeftIcon className="h-4 w-4" />
			</button>
			<span className="w-64 text-center truncate">
				<span className="font-normal opacity-70">{label}</span> {current[param]} - {names[current[param]]}
			</span>
			<button type="button" className="p-1 rounded-full hover:bg-black/15 cursor-pointer" aria-label={`Next ${label}`} onClick={() => cycle(param, 1)}>
				<ChevronRightIcon className="h-4 w-4" />
			</button>
		</div>
	)

	return (
		<div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[100] rounded-2xl bg-yellow-300 text-black text-sm font-semibold shadow-xl shadow-black px-2 py-1">
			{collapsed ? (
				<button type="button" className="px-2 py-1 cursor-pointer" onClick={() => setCollapsed(false)}>
					Hero {current.hero} · Fingerprint {current.fp}
				</button>
			) : (
				<div className="flex flex-col sm:flex-row sm:items-center sm:gap-2">
					{row("hero", "Hero", HERO_VARIANTS)}
					<span className="hidden sm:block h-5 w-px bg-black/20" />
					{row("fp", "Fingerprint", FP_VARIANTS)}
					<button type="button" className="px-1.5 cursor-pointer opacity-60 hover:opacity-100" aria-label="Collapse switcher" onClick={() => setCollapsed(true)}>
						–
					</button>
				</div>
			)}
		</div>
	)
}
