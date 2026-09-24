// PROTOTYPE - throwaway. Round 2: the fingerprint card keeps its headline and
// pillars and opens a viewing guide; fact questions move below Media.
// `?variant=E|F|G|H`, `0` is the current page. Round 1 (A-D) is in 8c92bcf4.

import { ChevronLeftIcon, ChevronRightIcon, XMarkIcon } from "@heroicons/react/24/solid"
import { Link, useLocation, useNavigate } from "@remix-run/react"
import React, { useEffect, useState } from "react"
import type { MovieResult, ShowResult } from "~/server/types/details-types"
import fingerprintIcon from "~/img/fingerprint.webp"
import { getFingerprintMeta } from "~/ui/fingerprint/fingerprintMeta"
import Pillars, { type PillarName, PILLAR_CONFIG } from "~/ui/fingerprint/Pillars"
import { factFaqs } from "~/ui/prototype/fact-faqs"
import * as F from "~/ui/prototype/fingerprint-text"

export const FINGERPRINT_TEXT_VARIANTS = {
	"0": "Current page",
	E: "Guide overlays ratings",
	F: "Guide drawer below",
	G: "Pillar drill-down",
	H: "Highlights + tabbed guide",
} as const
export type FingerprintTextVariant = keyof typeof FINGERPRINT_TEXT_VARIANTS

export function variantFromSearch(search: string): FingerprintTextVariant {
	const v = new URLSearchParams(search).get("variant") ?? "0"
	return v in FINGERPRINT_TEXT_VARIANTS ? (v as FingerprintTextVariant) : "0"
}

export function useFingerprintTextVariant() {
	return variantFromSearch(useLocation().search)
}

type Media = MovieResult | ShowResult

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
	if (variantFromSearch(search) === "0") return undefined
	const t = toTitleInput(media)
	if (!t) return undefined
	return `${media.details.title} (${media.details.release_year}): ${F.summary(t)} ${F.pillarLine(t)}. See where to stream it legally.`
}

// --- Shared pieces ---

function CardHead({ t }: { t: F.TitleInput }) {
	return (
		<>
			<h2 className="flex items-center gap-2 text-2xl font-bold">
				<img src={fingerprintIcon} className="h-7 p-0.5 w-auto bg-amber-950/50" alt="" />
				{t.title} fingerprint
			</h2>
			<p className="text-lg font-semibold text-amber-200">{F.pillarLine(t)}.</p>
		</>
	)
}

function ExpandButton({ open, onClick, label = "Read the full fingerprint" }: { open: boolean; onClick: () => void; label?: string }) {
	return (
		<button
			type="button"
			aria-expanded={open}
			onClick={onClick}
			className="w-full rounded-lg border border-amber-300/30 bg-amber-300/10 px-3 py-2 text-sm font-semibold text-amber-100 hover:bg-amber-300/20 cursor-pointer"
		>
			{open ? "Close" : label} {open ? "↑" : "→"}
		</button>
	)
}

interface GuidePart {
	id: string
	title: string
	body: React.ReactNode
}

function guideParts(t: F.TitleInput): GuidePart[] {
	const skip = F.skipIf(t)
	const moods = F.matchingMoods(t)
	const kind = t.mediaType === "movie" ? "movies" : "shows"
	const parts: GuidePart[] = [
		{ id: "mood", title: "Mood and pace", body: <p>{F.feelParagraph(t)}</p> },
	]
	if (F.craftSentence(t)) parts.push({ id: "craft", title: "What stands out", body: <p>{F.craftSentence(t)}</p> })
	parts.push({ id: "who", title: "Who it's for", body: <p>{F.bestForSentence(t)}</p> })
	if (skip.length)
		parts.push({
			id: "skip",
			title: "Skip it if",
			body: (
				<ul className="list-disc pl-5">
					{skip.map((s) => (
						<li key={s}>{s}</li>
					))}
				</ul>
			),
		})
	if (moods.length)
		parts.push({
			id: "more",
			title: "Find more like it",
			body: (
				<p className="flex flex-wrap gap-2">
					{moods.map((m) => (
						<Link
							key={m.url}
							to={m.url}
							className="px-2 py-0.5 rounded-md bg-gray-800 border border-gray-600 hover:border-gray-300 text-sm"
						>
							{m.label.replace(/\s*\p{Extended_Pictographic}.*$/u, "")} {kind}
						</Link>
					))}
				</p>
			),
		})
	return parts
}

function Guide({ t, columns }: { t: F.TitleInput; columns: string }) {
	return (
		<div>
			<p className="text-lg text-amber-200">{F.summary(t)}</p>
			<div className={`mt-4 grid gap-x-8 gap-y-5 ${columns}`}>
				{guideParts(t).map((p) => (
					<section key={p.id}>
						<h3 className="font-semibold">{p.title}</h3>
						<div className="mt-1 text-gray-200 leading-relaxed">{p.body}</div>
					</section>
				))}
			</div>
			<p className="mt-5 text-xs text-gray-500">
				Based on the GoodWatch fingerprint: our scores for 70+ traits of every {t.mediaType === "movie" ? "movie" : "show"}.
			</p>
		</div>
	)
}

// The collapsed guide stays in the HTML (hidden with CSS) so crawlers read it.
function Overlay({ open, onClose, children, label }: { open: boolean; onClose: () => void; children: React.ReactNode; label: string }) {
	return (
		<div
			role="region"
			aria-label={label}
			className={`${open ? "lg:block" : "lg:hidden"} hidden lg:absolute lg:inset-0 z-20 overflow-y-auto rounded-xl border border-amber-300/20 bg-stone-950/95 backdrop-blur p-6 shadow-2xl`}
		>
			<button
				type="button"
				onClick={onClose}
				aria-label="Close"
				className="absolute top-3 right-3 p-1 rounded-full hover:bg-white/10 cursor-pointer"
			>
				<XMarkIcon className="h-5 w-5" />
			</button>
			{children}
		</div>
	)
}

// Small screens have no ratings column to cover, so the guide opens inline there.
function MobileInline({ open, children }: { open: boolean; children: React.ReactNode }) {
	return <div className={`${open ? "block" : "hidden"} lg:hidden mt-4 rounded-xl bg-white/5 p-4`}>{children}</div>
}

// --- Variant E: guide overlays the ratings and streaming column ---

function RowE({ t, right }: { t: F.TitleInput; right: React.ReactNode }) {
	const [open, setOpen] = useState(false)
	return (
		<div className="flex flex-col lg:flex-row gap-8">
			<div className="md:mt-8 lg:w-md shrink-0 space-y-4">
				<CardHead t={t} />
				<Pillars pillars={t.fingerprint.pillars} />
				<ExpandButton open={open} onClick={() => setOpen(!open)} />
				<MobileInline open={open}>
					<Guide t={t} columns="grid-cols-1" />
				</MobileInline>
			</div>
			<div className="relative w-full flex flex-col justify-between">
				{right}
				<Overlay open={open} onClose={() => setOpen(false)} label={`${t.title} viewing guide`}>
					<Guide t={t} columns="grid-cols-2" />
				</Overlay>
			</div>
		</div>
	)
}

// --- Variant F: guide opens as a full-width drawer below the row ---

function RowF({ t, right }: { t: F.TitleInput; right: React.ReactNode }) {
	const [open, setOpen] = useState(false)
	return (
		<div>
			<div className="flex flex-col lg:flex-row gap-8">
				<div className="md:mt-8 lg:w-md shrink-0 space-y-4">
					<CardHead t={t} />
					<Pillars pillars={t.fingerprint.pillars} />
					<ExpandButton open={open} onClick={() => setOpen(!open)} />
				</div>
				<div className="w-full flex flex-col justify-between">{right}</div>
			</div>
			<div className={`${open ? "block" : "hidden"} mt-6 rounded-xl border border-amber-300/20 bg-white/3 p-6`}>
				<Guide t={t} columns="grid-cols-1 md:grid-cols-2 lg:grid-cols-3" />
			</div>
		</div>
	)
}

// --- Variant G: click a pillar to see what drives it ---

function PillarPanel({ t, pillar }: { t: F.TitleInput; pillar: string }) {
	const cfg = PILLAR_CONFIG[pillar as PillarName]
	return (
		<div>
			<h3 className="text-xl font-bold">
				{cfg.emoji} {pillar}
			</h3>
			<p className="mt-2 text-lg text-gray-100 leading-relaxed">{F.pillarSentence(t, pillar)}</p>
			<ul className="mt-4 space-y-2 max-w-md">
				{F.pillarDrivers(t, pillar).map((d) => {
					const meta = getFingerprintMeta(d.key)
					return (
						<li key={d.key} className="grid grid-cols-[12rem_1fr_2.5rem] items-center gap-3 text-sm">
							<span>
								{meta.emoji} {meta.label}
							</span>
							<span className="h-2 rounded bg-white/10">
								<span className="block h-2 rounded" style={{ width: `${d.score * 10}%`, background: meta.color }} />
							</span>
							<span className="text-right text-gray-400">{d.score}/10</span>
						</li>
					)
				})}
			</ul>
		</div>
	)
}

function RowG({ t, right }: { t: F.TitleInput; right: React.ReactNode }) {
	const [selected, setSelected] = useState<string | null>(null)
	const pillars = Object.keys(PILLAR_CONFIG)
	const panels = [...pillars, "Guide"]
	return (
		<div className="flex flex-col lg:flex-row gap-8">
			<div className="md:mt-8 lg:w-md shrink-0 space-y-4">
				<CardHead t={t} />
				<Pillars
					pillars={t.fingerprint.pillars}
					selectedPillar={selected as PillarName | null}
					onSelect={(p) => setSelected(selected === p ? null : p)}
				/>
				<p className="text-xs text-gray-500 px-3">Select a pillar to see what drives it.</p>
				<ExpandButton open={selected === "Guide"} onClick={() => setSelected(selected === "Guide" ? null : "Guide")} />
			</div>
			<div className="relative w-full flex flex-col justify-between">
				{right}
				{panels.map((p) => (
					<Overlay key={p} open={selected === p} onClose={() => setSelected(null)} label={`${p} details`}>
						{p === "Guide" ? <Guide t={t} columns="grid-cols-2" /> : <PillarPanel t={t} pillar={p} />}
					</Overlay>
				))}
			</div>
			<MobileInline open={!!selected}>
				{selected === "Guide" ? <Guide t={t} columns="grid-cols-1" /> : selected ? <PillarPanel t={t} pillar={selected} /> : null}
			</MobileInline>
		</div>
	)
}

// --- Variant H: highlight chips, guide overlay with tabs ---

function RowH({ t, right }: { t: F.TitleInput; right: React.ReactNode }) {
	const [open, setOpen] = useState(false)
	const parts = guideParts(t)
	const [tab, setTab] = useState(parts[0].id)
	const s = t.fingerprint.scores
	const chips = t.fingerprint.highlightKeys.slice(0, 5).map((k) => ({ ...getFingerprintMeta(k), score: s[k as keyof typeof s] }))
	return (
		<div className="flex flex-col lg:flex-row gap-8">
			<div className="md:mt-8 lg:w-md shrink-0 space-y-4">
				<CardHead t={t} />
				<div className="flex flex-wrap gap-2">
					{chips.map((c) => (
						<span key={c.key} className="px-2 py-1 rounded-md text-sm bg-gray-800 border border-gray-600">
							{c.emoji} {c.label} <span className="text-gray-400">{c.score}</span>
						</span>
					))}
				</div>
				<Pillars pillars={t.fingerprint.pillars} />
				<ExpandButton open={open} onClick={() => setOpen(!open)} />
			</div>
			<div className="relative w-full flex flex-col justify-between">
				{right}
				<Overlay open={open} onClose={() => setOpen(false)} label={`${t.title} viewing guide`}>
					<p className="text-lg text-amber-200 pr-8">{F.summary(t)}</p>
					<div role="tablist" className="mt-4 flex flex-wrap gap-1 border-b border-white/10">
						{parts.map((p) => (
							<button
								key={p.id}
								type="button"
								role="tab"
								aria-selected={tab === p.id}
								onClick={() => setTab(p.id)}
								className={`px-3 py-1.5 text-sm rounded-t-md cursor-pointer ${tab === p.id ? "bg-amber-300/20 text-amber-100" : "text-gray-400 hover:text-white"}`}
							>
								{p.title}
							</button>
						))}
					</div>
					{parts.map((p) => (
						<div key={p.id} role="tabpanel" className={`${tab === p.id ? "block" : "hidden"} mt-4 text-lg text-gray-200 leading-relaxed`}>
							<h3 className="sr-only">{p.title}</h3>
							{p.body}
						</div>
					))}
				</Overlay>
			</div>
			<MobileInline open={open}>
				<Guide t={t} columns="grid-cols-1" />
			</MobileInline>
		</div>
	)
}

export function FingerprintRow({ variant, media, right }: { variant: FingerprintTextVariant; media: Media; right: React.ReactNode }) {
	const t = toTitleInput(media)
	if (!t) return null
	if (variant === "F") return <RowF t={t} right={right} />
	if (variant === "G") return <RowG t={t} right={right} />
	if (variant === "H") return <RowH t={t} right={right} />
	return <RowE t={t} right={right} />
}

// --- Fact questions below Media, same for every variant ---

export function FingerprintFaqSection({ media, country }: { media: Media; country: string }) {
	const variant = useFingerprintTextVariant()
	if (variant === "0") return null
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

// Floating variant switcher, not part of the design.

export function PrototypeSwitcher({ media }: { media: Media }) {
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

	// Surface the state: the meta description this variant ships and how many
	// GoodWatch-only words land in the HTML (including collapsed text).
	const meta = prototypeMetaDescription(location.search, media)
	const t = toTitleInput(media)
	const words =
		t && current !== "0"
			? F.wordCount([
					F.pillarLine(t),
					F.summary(t),
					F.feelParagraph(t),
					F.craftSentence(t),
					F.bestForSentence(t),
					...F.skipIf(t),
					...(current === "G" ? Object.keys(PILLAR_CONFIG).map((p) => F.pillarSentence(t, p)) : []),
				]) + F.wordCount(factFaqs(media, new URLSearchParams(location.search).get("country") ?? "").flatMap((f) => [f.q, f.a]))
			: 0

	return (
		<div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[100] flex flex-col items-center gap-2 max-w-[calc(100vw-2rem)]">
			{open && (
				<div className="w-[36rem] max-w-full rounded-lg bg-yellow-100 text-black text-xs p-3 shadow-xl shadow-black space-y-1">
					<div>
						<b>Meta description ({meta?.length ?? 0} chars):</b> {meta ?? "unchanged"}
					</div>
					<div>
						<b>GoodWatch-only words in the HTML:</b> {words}
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
}
