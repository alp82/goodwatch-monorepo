// PROTOTYPE - throwaway. Round 4: five takes on the equalizer block (round 3's
// fp 2) with round 3's trait bars. Each pillar gets a bold verdict, a quiet
// note, and the traits behind it. Audience text becomes chips.
// Round 3's five blocks are in b1c85b75.

import { Link } from "@remix-run/react"
import React from "react"
import fingerprintIcon from "~/img/fingerprint.webp"
import { getFingerprintMeta } from "~/ui/fingerprint/fingerprintMeta"
import { PILLAR_CONFIG } from "~/ui/fingerprint/Pillars"
import type { Media } from "~/ui/prototype/detail-parts"
import * as F from "~/ui/prototype/fingerprint-text"

export const FP_VARIANTS = {
	"0": "Current card",
	"1": "Columns with trait bars",
	"2": "One row per pillar",
	"3": "How it feels / how it's made",
	"4": "Ranked by strength",
	"5": "Bar chart with trait chips",
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

// --- 1: six columns, meter + verdict + trait bars ---

function Fp1({ t }: { t: F.TitleInput }) {
	const tiers = t.fingerprint.pillars
	return (
		<div>
			<Head t={t} />
			<div className="mt-8 grid grid-cols-2 gap-x-6 gap-y-10 md:grid-cols-3 lg:grid-cols-6">
				{PILLARS.map((p) => (
					<div key={p} className="flex flex-col gap-3">
						<div className="flex h-20 items-end gap-3">
							<div className="h-full w-8 shrink-0">
								<Meter tier={tiers[p]} p={p} vertical />
							</div>
							<div>
								<PillarName p={p} />
								<p className="text-xs text-gray-400">{TIER_WORD[tiers[p]]}</p>
							</div>
						</div>
						<Verdict t={t} p={p} />
						<TraitBars t={t} p={p} />
					</div>
				))}
			</div>
			<div className="mt-10 border-t border-white/10 pt-6">
				<Audience t={t} />
			</div>
		</div>
	)
}

// --- 2: one row per pillar, scannable like a spec sheet ---

function Fp2({ t }: { t: F.TitleInput }) {
	const tiers = t.fingerprint.pillars
	return (
		<div>
			<Head t={t} />
			<div className="mt-6 divide-y divide-white/10 border-y border-white/10">
				{PILLARS.map((p) => (
					<div key={p} className="grid gap-3 py-4 md:grid-cols-[11rem_1fr_16rem] md:items-center md:gap-8">
						<div className="flex items-center justify-between md:block">
							<PillarName p={p} />
							<div className="md:mt-2">
								<Meter tier={tiers[p]} p={p} />
							</div>
						</div>
						<Verdict t={t} p={p} size="lg" />
						<TraitBars t={t} p={p} compact />
					</div>
				))}
			</div>
			<div className="mt-8">
				<Audience t={t} />
			</div>
		</div>
	)
}

// --- 3: feelings get the big type, craft gets the compact treatment ---

function Fp3({ t }: { t: F.TitleInput }) {
	const tiers = t.fingerprint.pillars
	const feel: Pillar[] = ["Energy", "Heart", "Humor"]
	const made: Pillar[] = ["World", "Craft", "Style"]
	return (
		<div>
			<Head t={t} />
			<h3 className="mt-8 text-sm font-semibold text-gray-400">How it feels</h3>
			<div className="mt-3 grid gap-6 md:grid-cols-3">
				{feel.map((p) => (
					<div key={p} className="flex gap-4">
						<div className="h-32 w-3 shrink-0">
							<Meter tier={tiers[p]} p={p} vertical />
						</div>
						<div className="flex flex-col gap-2">
							<PillarName p={p} className="text-sm text-gray-300" />
							<Verdict t={t} p={p} size="2xl" />
							<TraitChips t={t} p={p} />
						</div>
					</div>
				))}
			</div>
			<h3 className="mt-10 text-sm font-semibold text-gray-400">How it's made</h3>
			<div className="mt-3 grid gap-6 rounded-xl bg-white/4 p-5 md:grid-cols-3">
				{made.map((p) => (
					<div key={p} className="flex flex-col gap-2">
						<div className="flex items-center justify-between">
							<PillarName p={p} className="text-sm" />
							<Meter tier={tiers[p]} p={p} />
						</div>
						<Verdict t={t} p={p} />
						<TraitBars t={t} p={p} />
					</div>
				))}
			</div>
			<div className="mt-8">
				<Audience t={t} />
			</div>
		</div>
	)
}

// --- 4: strongest pillars get the most room, weak ones collapse to a line ---

function Fp4({ t }: { t: F.TitleInput }) {
	const tiers = t.fingerprint.pillars
	const ranked = [...PILLARS].sort((a, b) => tiers[b] - tiers[a])
	const strong = ranked.filter((p) => tiers[p] >= 3)
	const mid = ranked.filter((p) => tiers[p] === 2)
	const weak = ranked.filter((p) => tiers[p] <= 1)
	return (
		<div>
			<Head t={t} />
			<div className="mt-6 grid gap-3 md:grid-cols-2 lg:grid-cols-4">
				{strong.map((p) => (
					<div
						key={p}
						className="flex flex-col gap-3 rounded-xl p-5 lg:col-span-2"
						style={{ background: `color-mix(in srgb, ${HEX[p]} ${6 + tiers[p] * 4}%, transparent)` }}
					>
						<div className="flex items-center justify-between">
							<PillarName p={p} className="text-lg" />
							<Meter tier={tiers[p]} p={p} />
						</div>
						<Verdict t={t} p={p} size="2xl" />
						<TraitBars t={t} p={p} />
					</div>
				))}
				{mid.map((p) => (
					<div key={p} className={`flex flex-col gap-2 rounded-xl bg-white/5 p-4 ${mid.length <= 2 ? "lg:col-span-2" : ""}`}>
						<div className="flex items-center justify-between">
							<PillarName p={p} />
							<Meter tier={tiers[p]} p={p} />
						</div>
						<Verdict t={t} p={p} />
						<TraitChips t={t} p={p} />
					</div>
				))}
			</div>
			{weak.length > 0 && (
				<p className="mt-4 text-sm text-gray-400">
					<span className="font-semibold text-gray-300">Barely there: </span>
					{weak.map((p, i) => (
						<React.Fragment key={p}>
							{i > 0 && ", "}
							{p} ({F.pillarBrief(t, p).verdict.toLowerCase()})
						</React.Fragment>
					))}
				</p>
			)}
			<div className="mt-8">
				<Audience t={t} />
			</div>
		</div>
	)
}

// --- 5: one big bar chart, verdicts under the bars, audience beside it ---

function Fp5({ t }: { t: F.TitleInput }) {
	const tiers = t.fingerprint.pillars
	return (
		<div className="grid gap-10 xl:grid-cols-[1fr_20rem]">
			<div>
				<Head t={t} />
				<div className="mt-8 grid grid-cols-3 gap-x-4 gap-y-8 lg:grid-cols-6">
					{PILLARS.map((p) => (
						<div key={p} className="flex flex-col gap-3">
							<div className="flex h-36 items-end rounded-lg bg-white/4 p-1.5">
								<div
									className="w-full rounded-md"
									style={{
										height: `${Math.max(tiers[p], 0.15) * 25}%`,
										background: `linear-gradient(to top, color-mix(in srgb, ${HEX[p]} 55%, transparent), ${HEX[p]})`,
									}}
									role="img"
									aria-label={`${p}: ${tiers[p]} of 4`}
								/>
							</div>
							<PillarName p={p} className="text-sm" />
							<Verdict t={t} p={p} />
							<TraitChips t={t} p={p} />
						</div>
					))}
				</div>
			</div>
			<aside className="xl:border-l xl:border-white/10 xl:pl-8">
				<Audience t={t} layout="stack" />
			</aside>
		</div>
	)
}

export function FingerprintBlock({ variant, media }: { variant: FpVariant; media: Media }) {
	if (!media.fingerprint || variant === "0") return null
	const t: F.TitleInput = {
		title: media.details.title,
		mediaType: media.mediaType,
		year: media.details.release_year,
		genres: media.details.genres,
		fingerprint: media.fingerprint,
	}
	const body = { "1": Fp1, "2": Fp2, "3": Fp3, "4": Fp4, "5": Fp5 }[variant]
	return (
		<section id="fingerprint" className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
			{React.createElement(body, { t })}
			<p className="mt-8 text-xs text-gray-500">
				Based on the GoodWatch fingerprint: our scores for 70+ traits of every {t.mediaType === "movie" ? "movie" : "show"}.
			</p>
		</section>
	)
}
