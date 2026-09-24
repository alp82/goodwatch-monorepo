// PROTOTYPE - throwaway. Round 5: five designs of round 4's "one row per
// pillar" block. Every row opens a deep dive: all of the pillar's traits,
// related traits, what each trait means, and links to more titles like it.
// Collapsed text stays in the HTML. Round 4's blocks are in 15a4dc8a.

import { Link } from "@remix-run/react"
import { ChevronDownIcon } from "@heroicons/react/20/solid"
import React, { useId, useState } from "react"
import fingerprintIcon from "~/img/fingerprint.webp"
import { getFingerprintMeta } from "~/ui/fingerprint/fingerprintMeta"
import { PILLAR_CONFIG } from "~/ui/fingerprint/Pillars"
import type { Media } from "~/ui/prototype/detail-parts"
import * as F from "~/ui/prototype/fingerprint-text"

export const FP_VARIANTS = {
	"0": "Current card",
	"1": "Spec sheet, deep dive in columns",
	"2": "Strength-tinted rows",
	"3": "Dot plot on a 0-10 scale",
	"4": "Two columns of rows",
	"5": "Big verdicts, trait meanings",
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

// --- Expanding rows ---

type Brief = ReturnType<typeof F.pillarBrief>
type Trait = { key: string; score: number }

function useOpenPillar() {
	const [open, setOpen] = useState<Pillar | null>(null)
	return { open, toggle: (p: Pillar) => setOpen((o) => (o === p ? null : p)) }
}

// Animates height with grid rows; closed content stays in the DOM for crawlers
// but is invisible to keyboard and screen readers.
function Expand({ open, id, children }: { open: boolean; id: string; children: React.ReactNode }) {
	return (
		<div
			id={id}
			role="region"
			className={`grid transition-[grid-template-rows] duration-300 ease-out motion-reduce:transition-none ${open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
		>
			<div className={`min-h-0 overflow-hidden ${open ? "visible" : "invisible"}`}>{children}</div>
		</div>
	)
}

// The whole row is a click target for pointer users; the chevron is the real
// button for keyboard and screen reader users, so headings keep their meaning.
function RowButton({ onClick, children, className = "" }: { open: boolean; controls: string; onClick: () => void; children: React.ReactNode; className?: string }) {
	return (
		// biome-ignore lint/a11y/useKeyWithClickEvents: the chevron button inside handles keyboard
		<div onClick={onClick} className={`group w-full cursor-pointer rounded-lg ${className}`}>
			{children}
		</div>
	)
}

function Chevron({ open, controls, label, onClick }: { open: boolean; controls: string; label: string; onClick: () => void }) {
	return (
		<button
			type="button"
			aria-expanded={open}
			aria-controls={controls}
			aria-label={`${open ? "Hide" : "Show"} all ${label} traits`}
			onClick={(e) => {
				e.stopPropagation()
				onClick()
			}}
			className="flex h-7 w-7 items-center justify-center rounded-full text-gray-400 hover:bg-white/10 group-hover:text-white cursor-pointer focus-visible:outline-2 focus-visible:outline-amber-300"
		>
			<ChevronDownIcon aria-hidden="true" className={`h-5 w-5 transition-transform motion-reduce:transition-none ${open ? "rotate-180" : ""}`} />
		</button>
	)
}

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

// --- 1: round 4's spec sheet, each row opens a three-column deep dive ---

function Fp1({ t }: { t: F.TitleInput }) {
	const tiers = t.fingerprint.pillars
	const { open, toggle } = useOpenPillar()
	const uid = useId()
	return (
		<div>
			<Head t={t} />
			<div className="mt-6 divide-y divide-white/10 border-y border-white/10">
				{PILLARS.map((p) => {
					const isOpen = open === p
					const { own, related } = F.pillarTraits(t, p)
					return (
						<div key={p}>
							<RowButton open={isOpen} controls={`${uid}-${p}`} onClick={() => toggle(p)} className="grid gap-3 py-4 md:grid-cols-[11rem_1fr_16rem_1.5rem] md:items-center md:gap-8 hover:bg-white/3">
								<div className="flex items-center justify-between md:block">
									<PillarName p={p} />
									<div className="md:mt-2">
										<Meter tier={tiers[p]} p={p} />
									</div>
								</div>
								<Verdict t={t} p={p} size="lg" />
								<TraitBars t={t} p={p} compact />
								<Chevron open={isOpen} controls={`${uid}-${p}`} label={p} onClick={() => toggle(p)} />
							</RowButton>
							<Expand open={isOpen} id={`${uid}-${p}`}>
								<div className="grid gap-8 pb-6 pt-2 md:grid-cols-[1fr_16rem_16rem] md:pl-[13rem]">
									<div className="space-y-4">
										<p className="text-gray-200 leading-relaxed">{F.pillarSentence(t, p)}</p>
										<MoreLinks t={t} p={p} />
									</div>
									<div>
										<h4 className="mb-2 text-xs font-semibold text-gray-400">All {p.toLowerCase()} traits</h4>
										<Bars traits={own} color={HEX[p]} />
									</div>
									{related.length > 0 && (
										<div>
											<h4 className="mb-2 text-xs font-semibold text-gray-400">Related traits</h4>
											<Bars traits={related} color="#a8a29e" />
										</div>
									)}
								</div>
							</Expand>
						</div>
					)
				})}
			</div>
			<div className="mt-8">
				<Audience t={t} />
			</div>
		</div>
	)
}

// --- 2: each row is tinted as far as the pillar reaches; open rows sort traits by strength ---

function Fp2({ t }: { t: F.TitleInput }) {
	const tiers = t.fingerprint.pillars
	const { open, toggle } = useOpenPillar()
	const uid = useId()
	const band = (xs: Trait[], lo: number, hi: number) => xs.filter((x) => x.score >= lo && x.score <= hi)
	return (
		<div>
			<Head t={t} />
			<div className="mt-6 flex flex-col gap-1.5">
				{PILLARS.map((p) => {
					const isOpen = open === p
					const { own, related } = F.pillarTraits(t, p)
					const all = [...own, ...related].sort((a, b) => b.score - a.score)
					const groups: [string, Trait[]][] = [
						["Strong", band(all, 7, 10)],
						["Some", band(all, 4, 6)],
						["Barely", band(all, 0, 3)],
					]
					return (
						<div key={p} className="overflow-hidden rounded-xl bg-white/3">
							<RowButton open={isOpen} controls={`${uid}-${p}`} onClick={() => toggle(p)} className="relative block">
								<span
									aria-hidden="true"
									className="absolute inset-y-0 left-0"
									style={{ width: `${Math.max(tiers[p], 0.3) * 25}%`, background: `linear-gradient(to right, color-mix(in srgb, ${HEX[p]} 28%, transparent), transparent)` }}
								/>
								<span className="relative grid items-center gap-3 px-5 py-4 md:grid-cols-[10rem_1fr_auto_1.5rem] md:gap-8">
									<span className="flex items-center justify-between md:block">
										<PillarName p={p} />
										<span className="text-xs text-gray-300 md:mt-1 md:block">{TIER_WORD[tiers[p]]}</span>
									</span>
									<Verdict t={t} p={p} size="lg" />
									<TraitChips t={t} p={p} />
									<Chevron open={isOpen} controls={`${uid}-${p}`} label={p} onClick={() => toggle(p)} />
								</span>
							</RowButton>
							<Expand open={isOpen} id={`${uid}-${p}`}>
								<div className="grid gap-6 border-t border-white/10 px-5 py-5 md:grid-cols-[10rem_1fr] md:gap-8">
									<p className="hidden md:block text-xs text-gray-500">Every {p.toLowerCase()} trait and related trait, by strength.</p>
									<div className="space-y-5">
										<div className="grid gap-5 sm:grid-cols-3">
											{groups.map(([label, xs]) => (
												<div key={label}>
													<h4 className="text-xs font-semibold text-gray-400">{label}</h4>
													<div className="mt-2 flex flex-wrap gap-1.5">
														{xs.length === 0 && <span className="text-sm text-gray-500">None</span>}
														{xs.map((x) => (
															<Link
																key={x.key}
																to={F.discoverUrl(t, x.key as never)}
																title={getFingerprintMeta(x.key).description}
																className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-sm hover:bg-white/5"
																style={{ borderColor: label === "Barely" ? "rgba(255,255,255,.12)" : `color-mix(in srgb, ${HEX[p]} ${label === "Strong" ? 70 : 35}%, transparent)` }}
															>
																{getFingerprintMeta(x.key).label}
																<span className="font-semibold tabular-nums" style={{ color: label === "Barely" ? "#9ca3af" : HEX[p] }}>
																	{x.score}
																</span>
															</Link>
														))}
													</div>
												</div>
											))}
										</div>
										<p className="text-gray-300 leading-relaxed">{F.pillarSentence(t, p)}</p>
									</div>
								</div>
							</Expand>
						</div>
					)
				})}
			</div>
			<div className="mt-8">
				<Audience t={t} />
			</div>
		</div>
	)
}

// --- 3: traits as dots on one 0-10 scale, so strengths line up across rows ---

function DotAxis({ traits, color, labels = false }: { traits: Trait[]; color: string; labels?: boolean }) {
	return (
		<div className="relative h-8">
			<div className="absolute inset-x-0 top-1/2 h-px bg-white/15" />
			{[0, 5, 10].map((x) => (
				<span key={x} className="absolute top-1/2 h-2 w-px -translate-y-1/2 bg-white/25" style={{ left: `${x * 10}%` }} />
			))}
			{traits.map((d, i) => (
				<span
					key={d.key}
					title={`${getFingerprintMeta(d.key).label} ${d.score}`}
					className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-stone-950"
					style={{ left: `${d.score * 10}%`, background: color, opacity: 1 - i * 0.22 }}
				/>
			))}
			{labels && (
				<span className="absolute -bottom-3 inset-x-0 flex justify-between text-[10px] text-gray-500">
					<span>0</span>
					<span>5</span>
					<span>10</span>
				</span>
			)}
		</div>
	)
}

function Fp3({ t }: { t: F.TitleInput }) {
	const tiers = t.fingerprint.pillars
	const { open, toggle } = useOpenPillar()
	const uid = useId()
	return (
		<div>
			<Head t={t} />
			<div className="mt-6 divide-y divide-white/10 border-y border-white/10">
				{PILLARS.map((p) => {
					const isOpen = open === p
					const { own, related } = F.pillarTraits(t, p)
					const b: Brief = F.pillarBrief(t, p)
					return (
						<div key={p}>
							<RowButton open={isOpen} controls={`${uid}-${p}`} onClick={() => toggle(p)} className="grid items-center gap-3 py-4 md:grid-cols-[3px_10rem_1fr_18rem_1.5rem] md:gap-6 hover:bg-white/3">
								<span aria-hidden="true" className="hidden md:block h-12 rounded-full" style={{ background: HEX[p], opacity: 0.35 + tiers[p] * 0.16 }} />
								<span className="flex items-center justify-between md:block">
									<PillarName p={p} />
									<span className="md:mt-2 md:block">
										<Meter tier={tiers[p]} p={p} />
									</span>
								</span>
								<Verdict t={t} p={p} size="lg" />
								<span className="block">
									<DotAxis traits={b.drivers} color={HEX[p]} />
									<span className="mt-1 block truncate text-xs text-gray-400">
										{b.drivers.map((d) => `${getFingerprintMeta(d.key).label} ${d.score}`).join(", ")}
									</span>
								</span>
								<Chevron open={isOpen} controls={`${uid}-${p}`} label={p} onClick={() => toggle(p)} />
							</RowButton>
							<Expand open={isOpen} id={`${uid}-${p}`}>
								<div className="grid gap-8 pb-8 pt-2 md:grid-cols-[1fr_24rem] md:pl-[calc(3px+10rem+3rem)]">
									<div className="space-y-4">
										<p className="text-gray-200 leading-relaxed">{F.pillarSentence(t, p)}</p>
										<MoreLinks t={t} p={p} />
									</div>
									<div className="space-y-2.5">
										{[...own, ...related].map((d, i) => (
											<div key={d.key} className="grid grid-cols-[9rem_1fr_1.5rem] items-center gap-3">
												<span className={`truncate text-sm ${i < own.length ? "text-gray-200" : "text-gray-400"}`}>{getFingerprintMeta(d.key).label}</span>
												<DotAxis traits={[d]} color={i < own.length ? HEX[p] : "#a8a29e"} />
												<span className="text-right text-sm tabular-nums text-gray-400">{d.score}</span>
											</div>
										))}
										{related.length > 0 && <p className="pt-1 text-xs text-gray-500">Gray dots are related traits outside the {p} score.</p>}
									</div>
								</div>
							</Expand>
						</div>
					)
				})}
			</div>
			<div className="mt-8">
				<Audience t={t} />
			</div>
		</div>
	)
}

// --- 4: denser, two columns of rows; an open row takes the full width ---

function Fp4({ t }: { t: F.TitleInput }) {
	const tiers = t.fingerprint.pillars
	const { open, toggle } = useOpenPillar()
	const uid = useId()
	return (
		<div>
			<Head t={t} />
			<div className="mt-6 grid grid-flow-row-dense gap-x-10 md:grid-cols-2">
				{PILLARS.map((p) => {
					const isOpen = open === p
					const { own, related } = F.pillarTraits(t, p)
					return (
						<div key={p} className={`border-b border-white/10 ${isOpen ? "md:col-span-2" : ""}`}>
							<RowButton open={isOpen} controls={`${uid}-${p}`} onClick={() => toggle(p)} className="grid grid-cols-[1fr_auto] items-start gap-4 py-4 hover:bg-white/3">
								<span className="block space-y-2">
									<span className="flex items-center gap-3">
										<PillarName p={p} />
										<Meter tier={tiers[p]} p={p} />
									</span>
									<Verdict t={t} p={p} size="lg" />
									<TraitChips t={t} p={p} />
								</span>
								<Chevron open={isOpen} controls={`${uid}-${p}`} label={p} onClick={() => toggle(p)} />
							</RowButton>
							<Expand open={isOpen} id={`${uid}-${p}`}>
								<div className="grid gap-8 pb-6 pt-2 lg:grid-cols-[1fr_1fr_1fr]">
									<div className="space-y-4">
										<p className="text-gray-200 leading-relaxed">{F.pillarSentence(t, p)}</p>
										<MoreLinks t={t} p={p} />
									</div>
									<div>
										<h4 className="mb-2 text-xs font-semibold text-gray-400">All {p.toLowerCase()} traits</h4>
										<Bars traits={own} color={HEX[p]} showMeaning />
									</div>
									{related.length > 0 && (
										<div>
											<h4 className="mb-2 text-xs font-semibold text-gray-400">Related traits</h4>
											<Bars traits={related} color="#a8a29e" showMeaning />
										</div>
									)}
								</div>
							</Expand>
						</div>
					)
				})}
			</div>
			<div className="mt-8">
				<Audience t={t} />
			</div>
		</div>
	)
}

// --- 5: the verdict is the row; opening it explains each trait in words ---

function Fp5({ t }: { t: F.TitleInput }) {
	const tiers = t.fingerprint.pillars
	const { open, toggle } = useOpenPillar()
	const uid = useId()
	return (
		<div>
			<Head t={t} />
			<div className="mt-6 divide-y divide-white/10 border-y border-white/10">
				{PILLARS.map((p) => {
					const isOpen = open === p
					const b = F.pillarBrief(t, p)
					const { own, related } = F.pillarTraits(t, p)
					const lows = own.filter((x) => x.score <= 3)
					return (
						<div key={p}>
							<RowButton open={isOpen} controls={`${uid}-${p}`} onClick={() => toggle(p)} className="grid items-center gap-2 py-5 md:grid-cols-[8rem_1fr_auto_1.5rem] md:gap-6 hover:bg-white/3">
								<span className="flex items-center gap-3 md:block">
									<span className="block text-sm font-semibold" style={{ color: HEX[p] }}>
										{PILLAR_CONFIG[p].emoji} {p}
									</span>
									<span className="md:mt-2 md:block">
										<Meter tier={tiers[p]} p={p} />
									</span>
								</span>
								<span className="block">
									<span className="block text-2xl font-semibold tracking-tight text-white">{b.verdict}</span>
									{b.note && <span className="mt-1 block text-sm text-gray-400">{b.note}</span>}
								</span>
								<span className="hidden lg:block">
									<TraitChips t={t} p={p} />
								</span>
								<Chevron open={isOpen} controls={`${uid}-${p}`} label={p} onClick={() => toggle(p)} />
							</RowButton>
							<Expand open={isOpen} id={`${uid}-${p}`}>
								<div className="grid gap-8 pb-8 md:grid-cols-[1fr_18rem] md:pl-[9.5rem]">
									<dl className="space-y-3">
										{[...own.filter((x) => x.score >= 4), ...related].map((d) => {
											const meta = getFingerprintMeta(d.key)
											return (
												<div key={d.key} className="grid grid-cols-[2.25rem_1fr] gap-3">
													<dd
														className="flex h-9 w-9 items-center justify-center rounded-lg text-sm font-bold tabular-nums"
														style={{
															background: `color-mix(in srgb, ${own.includes(d) ? HEX[p] : "#a8a29e"} ${10 + d.score * 5}%, transparent)`,
														}}
													>
														{d.score}
													</dd>
													<dt>
														<span className="font-semibold text-gray-100">{meta.label}</span>
														<span className="block text-sm text-gray-400">{meta.description}</span>
													</dt>
												</div>
											)
										})}
									</dl>
									<div className="space-y-5">
										{lows.length > 0 && (
											<div>
												<h4 className="text-xs font-semibold text-gray-400">Barely there</h4>
												<p className="mt-1 text-sm text-gray-300">
													{lows.map((x) => `${getFingerprintMeta(x.key).label} ${x.score}`).join(", ")}
												</p>
											</div>
										)}
										<div>
											<h4 className="mb-2 text-xs font-semibold text-gray-400">Find more like it</h4>
											<MoreLinks t={t} p={p} />
										</div>
									</div>
								</div>
							</Expand>
						</div>
					)
				})}
			</div>
			<div className="mt-8">
				<Audience t={t} />
			</div>
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
				Based on the GoodWatch fingerprint: our scores for 70+ traits of every {t.mediaType === "movie" ? "movie" : "show"}. Select a row to see all of its traits.
			</p>
		</section>
	)
}
