// PROTOTYPE - throwaway. Five full-width fingerprint blocks (`?fp=1..5`).
// All show the same text so they're equal for SEO; only the form differs.

import { Link } from "@remix-run/react"
import React from "react"
import fingerprintIcon from "~/img/fingerprint.webp"
import type { CoreScores } from "~/server/utils/fingerprint"
import { getFingerprintMeta } from "~/ui/fingerprint/fingerprintMeta"
import { PILLAR_CONFIG } from "~/ui/fingerprint/Pillars"
import type { Media } from "~/ui/prototype/detail-parts"
import * as F from "~/ui/prototype/fingerprint-text"

export const FP_VARIANTS = {
	"0": "Current card",
	"1": "Radar",
	"2": "Equalizer columns",
	"3": "Ranked traits",
	"4": "Editorial",
	"5": "Pillar heat grid",
} as const
export type FpVariant = keyof typeof FP_VARIANTS

const PILLARS = Object.keys(PILLAR_CONFIG) as (keyof typeof PILLAR_CONFIG)[]
const HEX: Record<string, string> = {
	Energy: "#f59e0b",
	Heart: "#f43f5e",
	Humor: "#14b8a6",
	World: "#10b981",
	Craft: "#8b5cf6",
	Style: "#0ea5e9",
}
const pillarOfKey = (k: string) => PILLARS.find((p) => F.PILLAR_KEYS[p].includes(k as keyof CoreScores))

function Heading({ t }: { t: F.TitleInput }) {
	return (
		<h2 className="flex items-center gap-2 text-lg font-semibold text-gray-300">
			<img src={fingerprintIcon} className="h-6 w-auto p-0.5 bg-amber-950/50 rounded-sm" alt="" />
			{t.title} fingerprint
		</h2>
	)
}

function Meter({ tier, color, vertical = false, size = "md" }: { tier: number; color: string; vertical?: boolean; size?: "sm" | "md" | "lg" }) {
	const seg = { sm: "h-1.5 w-4", md: "h-2 w-7", lg: "h-2.5 w-10" }[size]
	return (
		<span
			role="img"
			aria-label={`${tier} of 4`}
			className={vertical ? "flex h-full w-full flex-col-reverse gap-1" : "inline-flex gap-0.5"}
		>
			{[0, 1, 2, 3].map((i) => (
				<span
					key={i}
					className={vertical ? "w-full flex-1 rounded-sm" : `${seg} rounded-sm`}
					style={{ background: i < tier ? color : "rgba(255,255,255,.1)", opacity: i < tier ? 0.55 + i * 0.15 : 1 }}
				/>
			))}
		</span>
	)
}

function MoodLinks({ t, style = "chips" }: { t: F.TitleInput; style?: "chips" | "text" }) {
	const moods = F.matchingMoods(t)
	if (!moods.length) return null
	const kind = t.mediaType === "movie" ? "movies" : "shows"
	const clean = (l: string) => l.replace(/\s*\p{Extended_Pictographic}.*$/u, "")
	if (style === "text")
		return (
			<p className="text-gray-300">
				More like this:{" "}
				{moods.map((m, i) => (
					<React.Fragment key={m.url}>
						{i > 0 && ", "}
						<Link to={m.url} className="underline decoration-white/30 underline-offset-4 hover:decoration-white">
							{clean(m.label).toLowerCase()} {kind}
						</Link>
					</React.Fragment>
				))}
			</p>
		)
	return (
		<div className="flex flex-wrap gap-2">
			{moods.map((m) => (
				<Link key={m.url} to={m.url} className="rounded-full border border-white/15 px-3 py-1 text-sm hover:border-white/50 hover:bg-white/5">
					{clean(m.label)} {kind}
				</Link>
			))}
		</div>
	)
}

// `withCraft` is off where the Craft pillar already says what stands out.
function GuideBlocks({ t, className = "", withCraft = true }: { t: F.TitleInput; className?: string; withCraft?: boolean }) {
	const skip = F.skipIf(t)
	const craft = withCraft ? F.craftSentence(t) : ""
	return (
		<div className={className}>
			{craft && (
				<section>
					<h3 className="font-semibold">What stands out</h3>
					<p className="mt-1 text-gray-300 leading-relaxed">{craft}</p>
				</section>
			)}
			<section>
				<h3 className="font-semibold">Who it's for</h3>
				<p className="mt-1 text-gray-300 leading-relaxed">{F.bestForSentence(t)}</p>
			</section>
			{skip.length > 0 && (
				<section>
					<h3 className="font-semibold">Skip it if</h3>
					<ul className="mt-1 space-y-0.5 text-gray-300">
						{skip.map((s) => (
							<li key={s} className="flex gap-2">
								<span aria-hidden="true" className="text-gray-500">
									–
								</span>
								{s}
							</li>
						))}
					</ul>
				</section>
			)}
		</div>
	)
}

// 1: hexagon radar of the six pillars, text beside it.
function Radar({ t }: { t: F.TitleInput }) {
	const size = 320
	const c = size / 2
	const R = 112
	const pt = (i: number, r: number) => {
		const a = (Math.PI / 3) * i - Math.PI / 2
		return [c + r * Math.cos(a), c + r * Math.sin(a)]
	}
	const poly = (r: (i: number) => number) => PILLARS.map((_, i) => pt(i, r(i)).join(",")).join(" ")
	const tiers = t.fingerprint.pillars
	return (
		<svg viewBox={`0 0 ${size} ${size}`} className="w-full max-w-80" role="img" aria-label={PILLARS.map((p) => `${p} ${tiers[p]} of 4`).join(", ")}>
			{[1, 2, 3, 4].map((ring) => (
				<polygon key={ring} points={poly(() => (R * ring) / 4)} fill="none" stroke="rgba(255,255,255,.1)" />
			))}
			{PILLARS.map((_, i) => {
				const [x, y] = pt(i, R)
				return <line key={i} x1={c} y1={c} x2={x} y2={y} stroke="rgba(255,255,255,.08)" />
			})}
			<polygon points={poly((i) => (R * Math.max(tiers[PILLARS[i]], 0.3)) / 4)} fill="rgba(252,211,77,.18)" stroke="#fcd34d" strokeWidth={2} strokeLinejoin="round" />
			{PILLARS.map((p, i) => {
				const [x, y] = pt(i, (R * Math.max(tiers[p], 0.3)) / 4)
				return <circle key={p} cx={x} cy={y} r={5} fill={HEX[p]} stroke="#1c1917" strokeWidth={2} />
			})}
			{PILLARS.map((p, i) => {
				const [x, y] = pt(i, R + 26)
				return (
					<text key={p} x={x} y={y} textAnchor="middle" dominantBaseline="middle" className="fill-gray-200 text-[13px] font-medium">
						{PILLAR_CONFIG[p].emoji} {p}
					</text>
				)
			})}
		</svg>
	)
}

function Fp1({ t }: { t: F.TitleInput }) {
	return (
		<div className="grid gap-8 lg:grid-cols-[20rem_1fr] lg:items-center">
			<div className="flex justify-center">
				<Radar t={t} />
			</div>
			<div>
				<Heading t={t} />
				<p className="mt-3 text-3xl font-semibold tracking-tight text-amber-200">{F.pillarLine(t)}.</p>
				<p className="mt-3 max-w-3xl text-lg text-gray-200 leading-relaxed">{F.feelParagraph(t)}</p>
				<GuideBlocks t={t} className="mt-6 grid gap-6 md:grid-cols-3" />
				<div className="mt-6">
					<MoodLinks t={t} />
				</div>
			</div>
		</div>
	)
}

// 2: six vertical meters, each explained by its own sentence.
function Fp2({ t }: { t: F.TitleInput }) {
	const tiers = t.fingerprint.pillars
	return (
		<div>
			<Heading t={t} />
			<p className="mt-2 text-3xl font-semibold tracking-tight text-amber-200">{F.pillarLine(t)}.</p>
			<div className="mt-8 grid grid-cols-2 gap-x-6 gap-y-8 md:grid-cols-3 lg:grid-cols-6">
				{PILLARS.map((p) => (
					<div key={p} className="flex flex-col">
						<div className="flex h-28 items-end gap-3">
							<div className="h-full w-10">
								<Meter tier={tiers[p]} color={HEX[p]} vertical />
							</div>
							<div className="pb-0.5">
								<div className="text-2xl" aria-hidden="true">
									{PILLAR_CONFIG[p].emoji}
								</div>
								<h3 className="font-semibold">{p}</h3>
							</div>
						</div>
						<p className="mt-3 text-sm text-gray-300 leading-relaxed">{F.pillarSentence(t, p)}</p>
					</div>
				))}
			</div>
			<GuideBlocks t={t} withCraft={false} className="mt-10 grid gap-6 border-t border-white/10 pt-6 md:grid-cols-2" />
			<div className="mt-6">
				<MoodLinks t={t} />
			</div>
		</div>
	)
}

// 3: the actual trait scores, ranked, next to the prose.
function Fp3({ t }: { t: F.TitleInput }) {
	const s = t.fingerprint.scores
	const traits = (Object.keys(s) as (keyof CoreScores)[])
		.sort((a, b) => s[b] - s[a])
		.slice(0, 12)
	return (
		<div className="grid gap-10 lg:grid-cols-[1fr_1.1fr]">
			<div>
				<Heading t={t} />
				<p className="mt-3 text-3xl font-semibold tracking-tight text-amber-200">{F.pillarLine(t)}.</p>
				<div className="mt-4 flex flex-wrap gap-x-5 gap-y-2">
					{PILLARS.map((p) => (
						<span key={p} className="inline-flex items-center gap-2 text-sm">
							<span className="text-gray-300">{p}</span>
							<Meter tier={t.fingerprint.pillars[p]} color={HEX[p]} size="sm" />
						</span>
					))}
				</div>
				<p className="mt-6 text-lg text-gray-200 leading-relaxed">{F.feelParagraph(t)}</p>
				<GuideBlocks t={t} className="mt-6 grid gap-6 sm:grid-cols-2" />
				<div className="mt-6">
					<MoodLinks t={t} />
				</div>
			</div>
			<div>
				<h3 className="text-sm font-semibold text-gray-400">Strongest traits, scored 0 to 10</h3>
				<ol className="mt-3 space-y-2.5">
					{traits.map((k) => {
						const meta = getFingerprintMeta(k)
						const p = pillarOfKey(k)
						return (
							<li key={k} className="grid grid-cols-[11rem_1fr_2rem] items-center gap-3">
								<span className="truncate text-sm">
									<span aria-hidden="true">{meta.emoji}</span> {meta.label}
								</span>
								<span className="h-2.5 rounded-full bg-white/8">
									<span
										className="block h-2.5 rounded-full"
										style={{ width: `${s[k] * 10}%`, background: p ? HEX[p] : "#a8a29e" }}
									/>
								</span>
								<span className="text-right text-sm tabular-nums text-gray-300">{s[k]}</span>
							</li>
						)
					})}
				</ol>
				<p className="mt-3 text-xs text-gray-500">Bar color shows the pillar a trait belongs to. Gray traits are themes.</p>
			</div>
		</div>
	)
}

// 4: type-led. The headline is the design; everything else is quiet.
function Fp4({ t }: { t: F.TitleInput }) {
	const tiers = t.fingerprint.pillars
	return (
		<div className="max-w-5xl">
			<Heading t={t} />
			<p className="mt-4 text-4xl sm:text-5xl lg:text-6xl font-semibold tracking-tight leading-[1.05] text-amber-100">{F.pillarLine(t)}.</p>
			<ul className="mt-6 flex flex-wrap gap-x-6 gap-y-3">
				{PILLARS.map((p) => (
					<li key={p} className="flex items-center gap-2 text-sm text-gray-300">
						{p}
						<Meter tier={tiers[p]} color={HEX[p]} size="sm" />
					</li>
				))}
			</ul>
			<p className="mt-8 max-w-3xl text-xl text-gray-100 leading-relaxed">{F.feelParagraph(t)}</p>
			<GuideBlocks
				t={t}
				className="mt-10 grid gap-8 md:grid-cols-3 md:gap-0 md:divide-x md:divide-white/10 [&>section]:md:px-6 [&>section:first-child]:md:pl-0"
			/>
			<div className="mt-8">
				<MoodLinks t={t} style="text" />
			</div>
		</div>
	)
}

// 5: tiles tinted by pillar strength, each with what drives it.
function Fp5({ t }: { t: F.TitleInput }) {
	const tiers = t.fingerprint.pillars
	return (
		<div>
			<div className="flex flex-wrap items-end justify-between gap-4">
				<div>
					<Heading t={t} />
					<p className="mt-2 text-3xl font-semibold tracking-tight text-amber-200">{F.pillarLine(t)}.</p>
				</div>
				<MoodLinks t={t} />
			</div>
			<div className="mt-6 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
				{PILLARS.map((p) => {
					const top = F.pillarDrivers(t, p)[0]
					const meta = getFingerprintMeta(top.key)
					return (
						<div
							key={p}
							className="rounded-xl p-4"
							style={{ background: `color-mix(in srgb, ${HEX[p]} ${5 + tiers[p] * 6}%, transparent)` }}
						>
							<div className="flex items-center justify-between">
								<h3 className="flex items-center gap-2 font-semibold">
									<span aria-hidden="true">{PILLAR_CONFIG[p].emoji}</span>
									{p}
								</h3>
								<Meter tier={tiers[p]} color={HEX[p]} size="sm" />
							</div>
							<p className="mt-2 text-sm text-gray-100 leading-relaxed">{F.pillarSentence(t, p)}</p>
							<p className="mt-2 text-xs text-gray-300">
								Strongest: {meta.label} {top.score}/10
							</p>
						</div>
					)
				})}
			</div>
			<GuideBlocks t={t} withCraft={false} className="mt-8 grid gap-6 md:grid-cols-2" />
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
