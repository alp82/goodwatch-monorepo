// The fingerprint as a full-width section: one row per pillar with a verdict
// and its strongest attributes. Selecting a row swaps the rows for a detailed
// view of that pillar. From md up the detail takes exactly the rows' height,
// so nothing below moves; on phones it replaces the rows in the page flow.
// Every view stays in the HTML. The interface avoids the word "pillar".

import { Link } from "@remix-run/react"
import { ChevronLeftIcon, ChevronRightIcon } from "@heroicons/react/20/solid"
import type React from "react"
import { useEffect, useRef, useState } from "react"
import fingerprintIcon from "~/img/fingerprint.webp"
import { getFingerprintMeta } from "~/ui/fingerprint/fingerprintMeta"
import { PILLAR_CONFIG } from "~/ui/fingerprint/Pillars"
import type { MovieResult, ShowResult } from "~/server/types/details-types"
import * as F from "~/ui/fingerprint/fingerprintText"


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

function DriverBars({ t, p, compact = false }: { t: F.TitleInput; p: Pillar; compact?: boolean }) {
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

type AttributeScore = { key: string; score: number }

function Bars({ attributes, color, showMeaning = false }: { attributes: AttributeScore[]; color: string; showMeaning?: boolean }) {
	return (
		<ul className="space-y-3">
			{attributes.map((d) => {
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

// "More like this" goes to Discover with the pillar filter the filter bar
// shows, plus the mood pages whose rules use this pillar's attributes.
const FILTER_WORD: Record<number, string> = { 1: "low", 2: "medium", 3: "high" }

function MoreLinks({ t, p }: { t: F.TitleInput; p: Pillar }) {
	const tier = t.fingerprint.pillars[p]
	const moods = F.moodsForKeys(t, [...F.PILLAR_KEYS[p], ...F.RELATED_KEYS[p]])
	const kind = t.mediaType === "movie" ? "movies" : "shows"
	const minTier = Math.min(3, tier)
	const clean = (l: string) => l.replace(/\s*\p{Extended_Pictographic}.*$/u, "")
	return (
		<div className="flex flex-wrap gap-2">
			{tier >= 2 && (
				<Link
					to={`/discover/${kind}?fingerprintPillars=${p}&fingerprintPillarMinTier=${minTier}`}
					className="rounded-full px-3.5 py-1.5 text-sm font-semibold text-black hover:brightness-110"
					style={{ background: HEX[p] }}
				>
					More {kind} with {FILTER_WORD[minTier]} {p.toLowerCase()}
				</Link>
			)}
			{moods.map((m) => (
				<Link key={m.url} to={m.url} className="rounded-full border border-white/20 px-3.5 py-1.5 text-sm hover:border-white/60 hover:bg-white/5">
					{clean(m.label)} {kind}
				</Link>
			))}
		</div>
	)
}

// --- Rows and detail share one box; the rows set its height from md up ---

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
			<div className="divide-y divide-white/8 border-y border-white/8">
				{PILLARS.map((p) => (
					// biome-ignore lint/a11y/useKeyWithClickEvents: the "See all" button handles keyboard
					<div
						key={p}
						onClick={() => onSelect(p)}
						className="group grid cursor-pointer gap-4 rounded-xl px-2 py-6 lg:-mx-2 lg:grid-cols-[12rem_1fr_17rem_2rem] lg:items-center lg:gap-10 hover:bg-white/3"
					>
						<div className="flex items-center justify-between lg:block">
							<PillarName p={p} />
							<div className="lg:mt-2">
								<Meter tier={tiers[p]} p={p} />
							</div>
						</div>
						<Verdict t={t} p={p} size="lg" />
						<DriverBars t={t} p={p} compact />
						<button
							type="button"
							data-pillar-open={p}
							aria-label={`See all ${p} traits`}
							onClick={(e) => {
								e.stopPropagation()
								onSelect(p)
							}}
							className="flex h-8 items-center justify-center gap-1 justify-self-start rounded-full text-sm text-gray-300 hover:bg-white/10 group-hover:text-white cursor-pointer focus-visible:outline-2 focus-visible:outline-amber-300 lg:w-8"
						>
							<span className="lg:hidden">See all traits</span>
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
			Back to fingerprint
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

function AttributeGrid({ t, p, meaning = true }: { t: F.TitleInput; p: Pillar; meaning?: boolean }) {
	const { own, related } = F.pillarAttributes(t, p)
	return (
		<div className="space-y-8">
			<div>
				<h4 className="mb-4 text-sm font-semibold text-gray-300">All {p.toLowerCase()} traits</h4>
				<div className="grid gap-x-10 gap-y-3 sm:grid-cols-2">
					<Bars attributes={own.slice(0, Math.ceil(own.length / 2))} color={HEX[p]} showMeaning={meaning} />
					<Bars attributes={own.slice(Math.ceil(own.length / 2))} color={HEX[p]} showMeaning={meaning} />
				</div>
			</div>
			{related.length > 0 && (
				<div>
					<h4 className="mb-4 text-sm font-semibold text-gray-300">Related traits</h4>
					<div className="grid gap-x-10 gap-y-3 sm:grid-cols-2">
						<Bars attributes={related.slice(0, Math.ceil(related.length / 2))} color="#a8a29e" showMeaning={meaning} />
						<Bars attributes={related.slice(Math.ceil(related.length / 2))} color="#a8a29e" showMeaning={meaning} />
					</div>
				</div>
			)}
		</div>
	)
}

const tint = (p: Pillar, pct = 9) => ({
	background: `linear-gradient(135deg, color-mix(in srgb, ${HEX[p]} ${pct}%, transparent), transparent 60%)`,
})

// Back button and pillar tabs on top; verdict and prose left, all attributes right.
function PillarDetail({ t, p, onBack, onSelect, backRef }: ViewProps) {
	return (
		<div className="flex min-h-full flex-col rounded-2xl border border-white/10 p-5 sm:p-8" style={tint(p)}>
			<div className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-center">
				<BackButton onBack={onBack} backRef={backRef} />
				<div role="tablist" aria-label="Fingerprint areas" className="-mx-5 flex gap-1.5 overflow-x-auto px-5 pb-1 [scrollbar-width:none] md:mx-0 md:flex-wrap md:overflow-visible md:px-0 md:pb-0">
					{PILLARS.map((q) => (
						<button
							key={q}
							type="button"
							role="tab"
							aria-selected={q === p}
							onClick={() => onSelect(q)}
							className={`h-9 shrink-0 whitespace-nowrap rounded-full px-3.5 text-sm cursor-pointer ${q === p ? "font-semibold text-black" : "bg-white/5 text-gray-300 hover:bg-white/10"}`}
							style={q === p ? { background: HEX[q] } : undefined}
						>
							{PILLAR_CONFIG[q].emoji} {q}
						</button>
					))}
				</div>
			</div>
			<div className="mt-10 grid min-h-0 content-start gap-12 lg:grid-cols-[5fr_7fr] lg:gap-16 [&>*]:min-w-0">
				<div className="space-y-7">
					<BigPillar t={t} p={p} />
					<p className="text-gray-200 leading-relaxed">{F.pillarSentence(t, p)}</p>
					<MoreLinks t={t} p={p} />
				</div>
				<AttributeGrid t={t} p={p} />
			</div>
		</div>
	)
}

function Switcher({ t }: { t: F.TitleInput }) {
	const [open, setOpen] = useState<Pillar | null>(null)
	const [last, setLast] = useState<Pillar | null>(null)
	const backRef = useRef<HTMLButtonElement>(null)
	const boxRef = useRef<HTMLDivElement>(null)
	// Move focus into the detail on open and back to the row on close.
	// On phones the detail replaces the rows in the page flow, so bring its top into view.
	useEffect(() => {
		const phone = window.matchMedia("(max-width: 767px)").matches
		if (open) backRef.current?.focus({ preventScroll: true })
		else if (last) boxRef.current?.querySelector<HTMLButtonElement>(`[data-pillar-open="${last}"]`)?.focus({ preventScroll: true })
		if (phone && (open || last)) {
			// Keep the fingerprint heading in view: land its top just below the
			// sticky header, whatever the header's current height.
			const el = boxRef.current?.closest<HTMLElement>("#fingerprint")
			// Wait a frame so the swapped-in view has its final height.
			if (el)
				requestAnimationFrame(() => {
					const header = document.querySelector("[data-details-header]")?.getBoundingClientRect().bottom ?? 0
					window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - header - 12, behavior: "instant" })
				})
		}
	}, [open, last])
	const select = (p: Pillar) => {
		setOpen(p)
		setLast(p)
	}
	return (
		<div ref={boxRef} className="relative mt-6 scroll-mt-40 [overflow-anchor:none]">
			<div className={`transition-opacity duration-200 motion-reduce:transition-none ${open ? "max-md:hidden invisible opacity-0" : "opacity-100"}`}>
				<Overview t={t} onSelect={select} />
			</div>
			{PILLARS.map((p) => (
				<section
					key={p}
					aria-label={`${p} in detail`}
					className={`scroll-mt-40 md:absolute md:inset-0 md:overflow-y-auto overflow-x-hidden transition-[opacity,translate] duration-200 motion-reduce:transition-none ${
						open === p ? "visible opacity-100 translate-y-0" : "max-md:hidden invisible opacity-0 translate-y-1"
					}`}
				>
					<PillarDetail t={t} p={p} onBack={() => setOpen(null)} onSelect={select} backRef={open === p ? backRef : { current: null }} />
				</section>
			))}
		</div>
	)
}

export default function DetailsFingerprint({
	media,
	sectionProps,
}: {
	media: MovieResult | ShowResult
	sectionProps: { id: string; className: string; ref: (el: HTMLDivElement) => void }
}) {
	if (!media.fingerprint) return null
	const t: F.TitleInput = {
		title: media.details.title,
		mediaType: media.mediaType,
		year: media.details.release_year,
		genres: media.details.genres,
		fingerprint: media.fingerprint,
	}
	return (
		<section className="relative mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
			<div {...sectionProps}>
				<Head t={t} />
				<Switcher t={t} />
				<div className="mt-12">
					<Audience t={t} />
				</div>
				<p className="mt-8 text-xs text-gray-500">
					Based on the GoodWatch fingerprint: our scores for 70+ attributes of every {t.mediaType === "movie" ? "movie" : "show"}. Select a row to see all of them.
				</p>
			</div>
		</section>
	)
}
