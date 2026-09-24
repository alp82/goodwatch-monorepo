// PROTOTYPE - throwaway. Round 6: three close variants of round 5's spec
// sheet (fp 1). Selecting a pillar swaps the whole block for a detailed view
// of that pillar at exactly the same height, so nothing below moves; Back
// returns to the overview. Every view stays in the HTML for crawlers.
// Round 5's blocks are in fe46f1ea.

import { Link } from "@remix-run/react"
import { ChevronLeftIcon, ChevronRightIcon } from "@heroicons/react/20/solid"
import React, { useEffect, useId, useRef, useState } from "react"
import fingerprintIcon from "~/img/fingerprint.webp"
import { getFingerprintMeta } from "~/ui/fingerprint/fingerprintMeta"
import { PILLAR_CONFIG } from "~/ui/fingerprint/Pillars"
import type { Media } from "~/ui/prototype/detail-parts"
import * as F from "~/ui/prototype/fingerprint-text"

export const FP_VARIANTS = {
	"0": "Current card",
	"1": "Detail with pillar tabs",
	"2": "Detail with previous / next",
	"3": "Detail with pillar rail",
} as const
export type FpVariant = keyof typeof FP_VARIANTS

type Pillar = keyof typeof PILLAR_CONFIG
const PILLARS = Object.keys(PILLAR_CONFIG) as Pillar[]
const HEX: Record<string, string> = {
	Energy: "#f59e0b",
	Heart: "#f43f5e",
	Humor: "#14b8a6",
	World: "#10b981",
	Craft: "#8b5cf6",
	Style: "#0ea5e9",
}
const TIER_WORD = ["None", "Low", "Medium", "High", "Very high"]

// --- Shared pieces ---

function Head({ t, children }: { t: F.TitleInput; children?: React.ReactNode }) {
	return (
		<div className="flex flex-wrap items-end justify-between gap-4">
			<div>
				<h2 className="flex items-center gap-2 text-lg font-semibold text-gray-300">
					<img src={fingerprintIcon} className="h-6 w-auto p-0.5 bg-amber-950/50 rounded-sm" alt="" />
					{t.title} fingerprint
				</h2>
				<p className="mt-2 text-3xl font-semibold tracking-tight text-amber-200">{F.pillarLine(t)}.</p>
			</div>
			{children}
		</div>
	)
}

function PillarName({ p, className = "" }: { p: Pillar; className?: string }) {
	return (
		<h3 className={`flex items-center gap-2 font-semibold ${className}`}>
			<span aria-hidden="true">{PILLAR_CONFIG[p].emoji}</span>
			{p}
		</h3>
	)
}

function Meter({ tier, p, vertical = false }: { tier: number; p: Pillar; vertical?: boolean }) {
	return (
		<span
			role="img"
			aria-label={`${p}: ${TIER_WORD[tier].toLowerCase()}, ${tier} of 4`}
			className={vertical ? "flex h-full w-full flex-col-reverse gap-1" : "inline-flex gap-0.5"}
		>
			{[0, 1, 2, 3].map((i) => (
				<span
					key={i}
					className={vertical ? "w-full flex-1 rounded-sm" : "h-2 w-5 rounded-sm"}
					style={{ background: i < tier ? HEX[p] : "rgba(255,255,255,.1)", opacity: i < tier ? 0.55 + i * 0.15 : 1 }}
				/>
			))}
		</span>
	)
}

function TraitBars({ t, p, compact = false }: { t: F.TitleInput; p: Pillar; compact?: boolean }) {
	return (
		<ul className={`space-y-1.5 ${compact ? "" : "mt-1"}`}>
			{F.pillarBrief(t, p).drivers.map((d) => (
				<li key={d.key} className="grid grid-cols-[1fr_auto] items-center gap-x-2 text-xs">
					<span className="truncate text-gray-300">{getFingerprintMeta(d.key).label}</span>
					<span className="tabular-nums text-gray-400">{d.score}</span>
					<span className="col-span-2 h-1.5 rounded-full bg-white/8">
						<span className="block h-1.5 rounded-full" style={{ width: `${d.score * 10}%`, background: HEX[p] }} />
					</span>
				</li>
			))}
		</ul>
	)
}

function TraitChips({ t, p }: { t: F.TitleInput; p: Pillar }) {
	return (
		<div className="flex flex-wrap gap-1.5">
			{F.pillarBrief(t, p).drivers.map((d) => (
				<span
					key={d.key}
					className="inline-flex max-w-full items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs whitespace-nowrap"
					style={{ borderColor: `color-mix(in srgb, ${HEX[p]} 60%, transparent)` }}
				>
					<span className="truncate">{getFingerprintMeta(d.key).label}</span>
					<span className="font-semibold tabular-nums" style={{ color: HEX[p] }}>
						{d.score}
					</span>
				</span>
			))}
		</div>
	)
}

function Verdict({ t, p, size = "base" }: { t: F.TitleInput; p: Pillar; size?: "base" | "lg" | "2xl" }) {
	const b = F.pillarBrief(t, p)
	const cls = { base: "text-base", lg: "text-lg", "2xl": "text-2xl tracking-tight" }[size]
	return (
		<div>
			<p className={`font-semibold leading-snug text-white ${cls}`}>{b.verdict}</p>
			{b.note && <p className="mt-1 text-sm text-gray-400 leading-relaxed">{b.note}</p>}
		</div>
	)
}

// Who it's for and Skip it if as chips; mood pages as links.
function Audience({ t, layout = "row" }: { t: F.TitleInput; layout?: "row" | "stack" }) {
	const who = t.fingerprint.socialSuitability.map((x) => x.name)
	const ctx = t.fingerprint.viewingContext.map((x) => x.name)
	const skip = F.skipIf(t)
	const moods = F.matchingMoods(t)
	const kind = t.mediaType === "movie" ? "movies" : "shows"
	const clean = (l: string) => l.replace(/\s*\p{Extended_Pictographic}.*$/u, "")
	return (
		<div className={layout === "row" ? "grid gap-6 md:grid-cols-3" : "flex flex-col gap-6"}>
			<section>
				<h3 className="text-sm font-semibold text-gray-300">Who it's for</h3>
				<div className="mt-2 flex flex-wrap gap-1.5">
					{who.map((w) => (
						<span key={w} className="rounded-full bg-emerald-400/15 px-2.5 py-1 text-sm text-emerald-100">
							{w}
						</span>
					))}
					{ctx.map((c) => (
						<span key={c} className="rounded-full bg-sky-400/15 px-2.5 py-1 text-sm text-sky-100">
							{c}
						</span>
					))}
				</div>
			</section>
			{skip.length > 0 && (
				<section>
					<h3 className="text-sm font-semibold text-gray-300">Skip it if</h3>
					<div className="mt-2 flex flex-wrap gap-1.5">
						{skip.map((s) => (
							<span key={s} className="rounded-full bg-rose-400/15 px-2.5 py-1 text-sm text-rose-100">
								{s.charAt(0).toUpperCase() + s.slice(1)}
							</span>
						))}
					</div>
				</section>
			)}
			{moods.length > 0 && (
				<section>
					<h3 className="text-sm font-semibold text-gray-300">Find more like it</h3>
					<div className="mt-2 flex flex-wrap gap-1.5">
						{moods.map((m) => (
							<Link
								key={m.url}
								to={m.url}
								className="rounded-full border border-white/20 px-2.5 py-1 text-sm hover:border-white/60 hover:bg-white/5"
							>
								{clean(m.label)} {kind}
							</Link>
						))}
					</div>
				</section>
			)}
		</div>
	)
}

type Trait = { key: string; score: number }

function Bars({ traits, color, showMeaning = false }: { traits: Trait[]; color: string; showMeaning?: boolean }) {
	return (
		<ul className="space-y-2">
			{traits.map((d) => {
				const meta = getFingerprintMeta(d.key)
				return (
					<li key={d.key} className="grid grid-cols-[1fr_auto] items-center gap-x-2 text-sm">
						<span className="truncate text-gray-200">{meta.label}</span>
						<span className="tabular-nums text-gray-400">{d.score}</span>
						<span className="col-span-2 h-1.5 rounded-full bg-white/8">
							<span className="block h-1.5 rounded-full" style={{ width: `${d.score * 10}%`, background: color }} />
						</span>
						{showMeaning && meta.description && <span className="col-span-2 text-xs text-gray-500">{meta.description}</span>}
					</li>
				)
			})}
		</ul>
	)
}

function MoreLinks({ t, p }: { t: F.TitleInput; p: Pillar }) {
	const { own } = F.pillarTraits(t, p)
	const moods = F.moodsForKeys(t, [...F.PILLAR_KEYS[p], ...F.RELATED_KEYS[p]])
	const kind = t.mediaType === "movie" ? "movies" : "shows"
	const topTrait = own[0]
	const clean = (l: string) => l.replace(/\s*\p{Extended_Pictographic}.*$/u, "")
	return (
		<div className="flex flex-wrap gap-2">
			{topTrait.score >= 6 && (
				<Link
					to={F.discoverUrl(t, topTrait.key)}
					className="rounded-full px-3 py-1 text-sm font-medium text-black hover:brightness-110"
					style={{ background: HEX[p] }}
				>
					More {kind} high in {getFingerprintMeta(topTrait.key).label.toLowerCase()}
				</Link>
			)}
			{moods.map((m) => (
				<Link key={m.url} to={m.url} className="rounded-full border border-white/20 px-3 py-1 text-sm hover:border-white/60 hover:bg-white/5">
					{clean(m.label)} {kind}
				</Link>
			))}
		</div>
	)
}

// --- Overview and detail share one box; the overview sets the height ---

interface ViewProps {
	t: F.TitleInput
	p: Pillar
	onBack: () => void
	onSelect: (p: Pillar) => void
	backRef: React.RefObject<HTMLButtonElement>
}

function Overview({ t, onSelect }: { t: F.TitleInput; onSelect: (p: Pillar) => void }) {
	const tiers = t.fingerprint.pillars
	return (
		<div>
			<div className="divide-y divide-white/10 border-y border-white/10">
				{PILLARS.map((p) => (
					// biome-ignore lint/a11y/useKeyWithClickEvents: the "See all" button handles keyboard
					<div
						key={p}
						onClick={() => onSelect(p)}
						className="group grid cursor-pointer gap-3 py-4 md:grid-cols-[11rem_1fr_16rem_2rem] md:items-center md:gap-8 hover:bg-white/3"
					>
						<div className="flex items-center justify-between md:block">
							<PillarName p={p} />
							<div className="md:mt-2">
								<Meter tier={tiers[p]} p={p} />
							</div>
						</div>
						<Verdict t={t} p={p} size="lg" />
						<TraitBars t={t} p={p} compact />
						<button
							type="button"
							data-pillar-open={p}
							aria-label={`See all ${p} traits`}
							onClick={(e) => {
								e.stopPropagation()
								onSelect(p)
							}}
							className="flex h-8 w-8 items-center justify-center rounded-full text-gray-400 hover:bg-white/10 group-hover:text-white cursor-pointer focus-visible:outline-2 focus-visible:outline-amber-300"
						>
							<ChevronRightIcon className="h-5 w-5" aria-hidden="true" />
						</button>
					</div>
				))}
			</div>
		</div>
	)
}

function BackButton({ onBack, backRef }: { onBack: () => void; backRef: ViewProps["backRef"] }) {
	return (
		<button
			ref={backRef}
			type="button"
			onClick={onBack}
			className="inline-flex h-9 items-center gap-1 rounded-full bg-white/10 pl-2 pr-3.5 text-sm font-semibold hover:bg-white/20 cursor-pointer focus-visible:outline-2 focus-visible:outline-amber-300"
		>
			<ChevronLeftIcon className="h-5 w-5" aria-hidden="true" />
			All pillars
		</button>
	)
}

function BigPillar({ t, p }: { t: F.TitleInput; p: Pillar }) {
	const tier = t.fingerprint.pillars[p]
	const b = F.pillarBrief(t, p)
	return (
		<div>
			<div className="flex flex-wrap items-center gap-x-4 gap-y-2">
				<h3 className="flex items-center gap-3 text-2xl font-bold">
					<span aria-hidden="true">{PILLAR_CONFIG[p].emoji}</span>
					{p}
				</h3>
				<span className="inline-flex items-center gap-2">
					<span className="inline-flex gap-1">
						{[0, 1, 2, 3].map((i) => (
							<span key={i} className="h-3 w-6 sm:w-8 rounded-sm" style={{ background: i < tier ? HEX[p] : "rgba(255,255,255,.1)", opacity: i < tier ? 0.55 + i * 0.15 : 1 }} />
						))}
					</span>
					<span className="text-sm text-gray-300">{TIER_WORD[tier]}</span>
				</span>
			</div>
			<p className="mt-5 text-4xl font-semibold leading-tight tracking-tight text-white">{b.verdict}</p>
			{b.note && <p className="mt-2 text-lg text-gray-300">{b.note}</p>}
		</div>
	)
}

function TraitGrid({ t, p, meaning = true }: { t: F.TitleInput; p: Pillar; meaning?: boolean }) {
	const { own, related } = F.pillarTraits(t, p)
	return (
		<div className="space-y-6">
			<div>
				<h4 className="mb-3 text-sm font-semibold text-gray-300">All {p.toLowerCase()} traits</h4>
				<div className="grid gap-x-8 gap-y-1 sm:grid-cols-2">
					<Bars traits={own.slice(0, Math.ceil(own.length / 2))} color={HEX[p]} showMeaning={meaning} />
					<Bars traits={own.slice(Math.ceil(own.length / 2))} color={HEX[p]} showMeaning={meaning} />
				</div>
			</div>
			{related.length > 0 && (
				<div>
					<h4 className="mb-3 text-sm font-semibold text-gray-300">Related traits</h4>
					<div className="grid gap-x-8 gap-y-1 sm:grid-cols-2">
						<Bars traits={related.slice(0, Math.ceil(related.length / 2))} color="#a8a29e" showMeaning={meaning} />
						<Bars traits={related.slice(Math.ceil(related.length / 2))} color="#a8a29e" showMeaning={meaning} />
					</div>
				</div>
			)}
		</div>
	)
}

const tint = (p: Pillar, pct = 9) => ({
	background: `linear-gradient(135deg, color-mix(in srgb, ${HEX[p]} ${pct}%, transparent), transparent 60%)`,
})

// 1: back button and pillar tabs on top; verdict left, all traits right.
function Detail1({ t, p, onBack, onSelect, backRef }: ViewProps) {
	return (
		<div className="flex min-h-full flex-col rounded-2xl border border-white/10 p-4 sm:p-6" style={tint(p)}>
			<div className="flex flex-wrap items-center gap-3">
				<BackButton onBack={onBack} backRef={backRef} />
				<div role="tablist" aria-label="Pillars" className="flex flex-wrap gap-1.5">
					{PILLARS.map((q) => (
						<button
							key={q}
							type="button"
							role="tab"
							aria-selected={q === p}
							onClick={() => onSelect(q)}
							className={`h-9 rounded-full px-3.5 text-sm cursor-pointer ${q === p ? "font-semibold text-black" : "bg-white/5 text-gray-300 hover:bg-white/10"}`}
							style={q === p ? { background: HEX[q] } : undefined}
						>
							{PILLAR_CONFIG[q].emoji} {q}
						</button>
					))}
				</div>
			</div>
			<div className="mt-8 grid min-h-0 content-start gap-10 lg:grid-cols-[5fr_7fr] [&>*]:min-w-0">
				<div className="space-y-6">
					<BigPillar t={t} p={p} />
					<p className="text-gray-200 leading-relaxed">{F.pillarSentence(t, p)}</p>
					<MoreLinks t={t} p={p} />
				</div>
				<TraitGrid t={t} p={p} />
			</div>
		</div>
	)
}

// 2: back and previous / next on top; a trait list with score tiles.
function Detail2({ t, p, onBack, onSelect, backRef }: ViewProps) {
	const i = PILLARS.indexOf(p)
	const prev = PILLARS[(i + PILLARS.length - 1) % PILLARS.length]
	const next = PILLARS[(i + 1) % PILLARS.length]
	const { own, related } = F.pillarTraits(t, p)
	const nav = (q: Pillar, dir: "prev" | "next") => (
		<button
			type="button"
			onClick={() => onSelect(q)}
			className="inline-flex h-9 items-center gap-1 rounded-full bg-white/5 px-3 text-sm text-gray-300 hover:bg-white/10 cursor-pointer"
		>
			{dir === "prev" && <ChevronLeftIcon className="h-4 w-4" aria-hidden="true" />}
			{PILLAR_CONFIG[q].emoji} {q}
			{dir === "next" && <ChevronRightIcon className="h-4 w-4" aria-hidden="true" />}
		</button>
	)
	const tile = (d: Trait, color: string) => {
		const meta = getFingerprintMeta(d.key)
		return (
			<div key={d.key} className="grid grid-cols-[2.5rem_1fr] items-start gap-3">
				<span
					className="flex h-10 w-10 items-center justify-center rounded-lg text-base font-bold tabular-nums"
					style={{ background: `color-mix(in srgb, ${color} ${10 + d.score * 5}%, transparent)` }}
				>
					{d.score}
				</span>
				<span>
					<span className="block font-semibold text-gray-100">{meta.label}</span>
					<span className="block text-sm text-gray-400">{meta.description}</span>
				</span>
			</div>
		)
	}
	return (
		<div className="flex min-h-full flex-col rounded-2xl border border-white/10 p-4 sm:p-6" style={tint(p, 11)}>
			<div className="flex items-center gap-3">
				<BackButton onBack={onBack} backRef={backRef} />
				<div className="ml-auto flex gap-2">
					{nav(prev, "prev")}
					{nav(next, "next")}
				</div>
			</div>
			<div className="mt-8 grid content-start gap-10 lg:grid-cols-[1fr_1.3fr] [&>*]:min-w-0">
				<div className="space-y-6">
					<BigPillar t={t} p={p} />
					<p className="text-gray-200 leading-relaxed">{F.pillarSentence(t, p)}</p>
					<MoreLinks t={t} p={p} />
				</div>
				<div className="grid content-start gap-4 sm:grid-cols-2">
					{own.map((d) => tile(d, HEX[p]))}
					{related.map((d) => tile(d, "#a8a29e"))}
				</div>
			</div>
		</div>
	)
}

// 3: a compact rail of all pillars on the left, the detail beside it.
function Detail3({ t, p, onBack, onSelect, backRef }: ViewProps) {
	const tiers = t.fingerprint.pillars
	return (
		<div className="grid min-h-full content-start gap-6 rounded-2xl border border-white/10 p-4 md:grid-cols-[14rem_1fr]" style={tint(p, 7)}>
			<nav aria-label="Pillars" className="flex flex-col gap-1 md:border-r md:border-white/10 md:pr-4">
				<div className="mb-3">
					<BackButton onBack={onBack} backRef={backRef} />
				</div>
				{PILLARS.map((q) => (
					<button
						key={q}
						type="button"
						aria-current={q === p ? "true" : undefined}
						onClick={() => onSelect(q)}
						className={`flex items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-left cursor-pointer ${q === p ? "bg-white/10" : "hover:bg-white/5"}`}
					>
						<span className={`flex items-center gap-2 text-sm ${q === p ? "font-semibold text-white" : "text-gray-300"}`}>
							<span aria-hidden="true">{PILLAR_CONFIG[q].emoji}</span>
							{q}
						</span>
						<Meter tier={tiers[q]} p={q} />
					</button>
				))}
			</nav>
			<div className="grid min-w-0 content-start gap-8 p-2 lg:grid-cols-[1fr_1.2fr] [&>*]:min-w-0">
				<div className="space-y-6">
					<BigPillar t={t} p={p} />
					<p className="text-gray-200 leading-relaxed">{F.pillarSentence(t, p)}</p>
					<MoreLinks t={t} p={p} />
				</div>
				<TraitGrid t={t} p={p} />
			</div>
		</div>
	)
}

function Switcher({ t, Detail }: { t: F.TitleInput; Detail: (props: ViewProps) => React.ReactElement }) {
	const [open, setOpen] = useState<Pillar | null>(null)
	const [last, setLast] = useState<Pillar | null>(null)
	const backRef = useRef<HTMLButtonElement>(null)
	const boxRef = useRef<HTMLDivElement>(null)
	// Move focus into the detail on open and back to the row on close.
	useEffect(() => {
		if (open) backRef.current?.focus({ preventScroll: true })
		else if (last) boxRef.current?.querySelector<HTMLButtonElement>(`[data-pillar-open="${last}"]`)?.focus({ preventScroll: true })
	}, [open, last])
	const select = (p: Pillar) => {
		setOpen(p)
		setLast(p)
	}
	return (
		<div ref={boxRef} className="relative mt-6">
			<div className={`transition-opacity duration-200 motion-reduce:transition-none ${open ? "invisible opacity-0" : "opacity-100"}`}>
				<Overview t={t} onSelect={select} />
			</div>
			{PILLARS.map((p) => (
				<div
					key={p}
					role="region"
					aria-label={`${p} in detail`}
					className={`absolute inset-0 overflow-y-auto overflow-x-hidden transition-[opacity,translate] duration-200 motion-reduce:transition-none ${
						open === p ? "visible opacity-100 translate-y-0" : "invisible opacity-0 translate-y-1"
					}`}
				>
					<Detail t={t} p={p} onBack={() => setOpen(null)} onSelect={select} backRef={open === p ? backRef : { current: null }} />
				</div>
			))}
		</div>
	)
}

export function FingerprintBlock({ variant, media, sectionProps }: { variant: FpVariant; media: Media; sectionProps?: { id: string; className: string; ref: (el: HTMLDivElement) => void } }) {
	if (!media.fingerprint || variant === "0") return null
	const t: F.TitleInput = {
		title: media.details.title,
		mediaType: media.mediaType,
		year: media.details.release_year,
		genres: media.details.genres,
		fingerprint: media.fingerprint,
	}
	const Detail = { "1": Detail1, "2": Detail2, "3": Detail3 }[variant]
	return (
		<section className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
			<div {...sectionProps} id="fingerprint" className={sectionProps?.className}>
				<Head t={t} />
				<Switcher t={t} Detail={Detail} />
				<div className="mt-8">
					<Audience t={t} />
				</div>
				<p className="mt-8 text-xs text-gray-500">
					Based on the GoodWatch fingerprint: our scores for 70+ traits of every {t.mediaType === "movie" ? "movie" : "show"}. Select a pillar to see all of its traits.
				</p>
			</div>
		</section>
	)
}
