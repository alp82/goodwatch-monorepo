// PROTOTYPE - throwaway.
// Shared bits for the slidepop, slideflip and slideside variants: groups, a refined track, row faces, trait bars in words, links.
import { Link } from "@remix-run/react"
import type React from "react"
import { HEX, type Pillar } from "~/ui/details/DetailsFingerprint"
import { getFingerprintMeta } from "~/ui/fingerprint/fingerprintMeta"
import * as F from "~/ui/fingerprint/fingerprintText"
import { AREA_SCALES, INTENSITY_SCALE, SCALES, type Scale, reading, scaleTraits } from "./slidestrip-parts"
import fingerprintIcon from "~/img/fingerprint-72.webp"
import MediaText from "~/ui/media-text/MediaText"
import { assetUrl } from "~/utils/asset-url"
import { cleanMood, kindOf } from "./strip-parts"

export type { Scale }
export { reading, scaleTraits }

// The section heading; the title and "fingerprint" wrap as one line of text.
export function SectionTitle({ t }: { t: F.TitleInput }) {
	return (
		<h2 className="flex items-start gap-2 text-lg font-semibold text-gray-300">
			<img src={assetUrl(fingerprintIcon)} className="mt-0.5 h-6 w-auto shrink-0 rounded-sm bg-amber-950/50 p-0.5" alt="" />
			<span>
				<MediaText value={{ text: t.title, lang: t.titleLang ?? "en" }} /> fingerprint
			</span>
		</h2>
	)
}

const [PACE, TONE, SETTING, ATTENTION] = SCALES
const A = AREA_SCALES

// Same readings and grouping as allsliders.
export const GROUPS: { name: string; scales: Scale[] }[] = [
	{ name: "Feel", scales: [PACE, A.Energy, INTENSITY_SCALE, TONE, A.Heart, A.Humor] },
	{ name: "Story", scales: [ATTENTION, SETTING, A.World] },
	{ name: "Look", scales: [A.Style, A.Craft] },
]
export const ALL_SCALES = GROUPS.flatMap((g) => g.scales)
export const groupOf = (sc: Scale) => GROUPS.find((g) => g.scales.includes(sc))?.name ?? ""

// What each scale measures, in one plain line.
export const BLURB: Record<string, string> = {
	Pace: "How quickly the story moves.",
	Energy: "How much drive and adrenaline it carries.",
	Intensity: "The strongest of its violence, gore and scares.",
	Tone: "Where it lands between bleak and hopeful.",
	Heart: "How much it makes you feel.",
	Humor: "How much it makes you laugh.",
	Attention: "How much focus it asks of you.",
	Setting: "How far its world sits from everyday life.",
	World: "How rich and absorbing its world is.",
	Style: "How striking it looks and sounds.",
	Craft: "How well it is made: writing, acting, directing.",
}

export const id = (prefix: string, sc: Scale) => `${prefix}-${sc.name.toLowerCase()}`
export const glow = (area: Pillar, pct: number) => `color-mix(in srgb, ${HEX[area]} ${pct}%, transparent)`

// The reading furthest from the middle; the default for panels.
export function strongest(t: F.TitleInput) {
	return ALL_SCALES.map((sc) => ({ sc, d: Math.abs(reading(sc, t).v - 0.5) })).sort((a, b) => b.d - a.d)[0].sc
}

// --- Track ---

// A slim rail with quiet ticks, a soft fill from the middle to the thumb, and a lit pill thumb.
export function Track({ v, area, label, active = false, className = "" }: { v: number; area: Pillar; label: string; active?: boolean; className?: string }) {
	const pos = `calc(14px + ${v} * (100% - 28px))`
	const from = Math.min(v, 0.5)
	const to = Math.max(v, 0.5)
	const c = HEX[area]
	return (
		<span role="img" aria-label={label} className={`relative block h-3.5 ${className}`}>
			<span className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-white/[0.06] shadow-[inset_0_1px_1px_rgba(0,0,0,0.5)]" aria-hidden="true" />
			{[0.25, 0.75].map((x) => (
				<span key={x} className="absolute top-1/2 h-1 w-px -translate-y-1/2 bg-white/10" style={{ left: `${x * 100}%` }} aria-hidden="true" />
			))}
			<span className="absolute top-1/2 h-2.5 w-px -translate-y-1/2 bg-white/20" style={{ left: "50%" }} aria-hidden="true" />
			<span
				className="absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full"
				style={{
					left: `calc(14px + ${from} * (100% - 28px))`,
					width: `calc(${to - from} * (100% - 28px))`,
					background: `linear-gradient(${v < 0.5 ? "to left" : "to right"}, ${glow(area, 8)}, ${glow(area, 55)})`,
				}}
				aria-hidden="true"
			/>
			<span
				className="absolute top-1/2 h-3.5 w-7 rounded-full transition-transform duration-200"
				style={{
					left: pos,
					transform: `translate(-50%, -50%) ${active ? "scale(1.12)" : ""}`,
					background: `linear-gradient(180deg, color-mix(in srgb, ${c} 82%, white), ${c} 55%)`,
					boxShadow: `0 0 0 2px rgba(0,0,0,0.55), 0 0 14px ${glow(area, active ? 70 : 40)}, inset 0 1px 0 rgba(255,255,255,0.35)`,
				}}
				aria-hidden="true"
			/>
		</span>
	)
}

// --- Row face: label + word, track, poles ---

export function RowLabel({ sc, word }: { sc: Scale; word: string }) {
	return (
		<span className="min-w-0">
			<span className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.08em] text-gray-500">
				<span className="h-1.5 w-1.5 rounded-full" style={{ background: HEX[sc.area] }} aria-hidden="true" />
				{sc.name}
			</span>
			<span className="mt-0.5 block text-sm font-semibold leading-tight text-white sm:text-[15px]">{word}</span>
		</span>
	)
}

// "inline" puts the poles beside the track from sm up; "stacked" always puts them under it.
export function RowFace({ sc, t, active = false, layout = "inline" }: { sc: Scale; t: F.TitleInput; active?: boolean; layout?: "inline" | "stacked" }) {
	const r = reading(sc, t)
	const inline = layout === "inline"
	const pole = (side: "left" | "right") =>
		`text-xs transition-colors ${r.near === side ? "text-gray-100" : "text-gray-500"}`
	return (
		<span className={`grid w-full grid-cols-[7.25rem_1fr] items-center gap-x-3 ${inline ? "sm:grid-cols-[7.75rem_1fr]" : ""}`}>
			<span className="min-w-0">
				<span className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.08em] text-gray-500">
					<span className="h-1.5 w-1.5 rounded-full" style={{ background: HEX[sc.area] }} aria-hidden="true" />
					{sc.name}
				</span>
				<span className="mt-0.5 block text-sm font-semibold leading-tight text-white sm:text-[15px]">{r.word}</span>
			</span>
			<span className={`grid grid-cols-2 items-center gap-x-3 gap-y-1 ${inline ? "sm:grid-cols-[5.5rem_1fr_7.5rem]" : ""}`}>
				<span className={`order-2 ${inline ? "sm:order-1 sm:text-right" : ""} ${pole("left")}`}>{sc.left}</span>
				<Track
					v={r.v}
					area={sc.area}
					active={active}
					className={`order-1 col-span-2 ${inline ? "sm:order-2 sm:col-span-1" : ""}`}
					label={`${sc.name}: ${r.word}, between ${sc.left.toLowerCase()} and ${sc.right.toLowerCase()}`}
				/>
				<span className={`order-3 text-right ${inline ? "sm:text-left" : ""} ${pole("right")}`}>{sc.right}</span>
			</span>
		</span>
	)
}

export function GroupHead({ name }: { name: string }) {
	return (
		<h3 className="mb-1.5 flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-400">
			{name}
			<span className="h-px flex-1 bg-gradient-to-r from-white/12 to-transparent" aria-hidden="true" />
		</h3>
	)
}

// --- Traits in words ---

export const strength = (n: number) => (n >= 9 ? "Very strong" : n >= 7 ? "Strong" : n >= 5 ? "Clear" : n >= 3 ? "Some" : "Faint")

export function TraitBars({ sc, t, n = 4, meaning = false }: { sc: Scale; t: F.TitleInput; n?: number; meaning?: boolean }) {
	return (
		<ul className="space-y-2.5">
			{scaleTraits(sc, t, n).map((d) => {
				const meta = getFingerprintMeta(d.key)
				return (
					<li key={d.key} className="grid grid-cols-[1fr_auto] items-baseline gap-x-2 text-sm" aria-label={`${meta.label}: ${d.score} out of 10`}>
						<span className="truncate text-gray-200">{meta.label}</span>
						<span className="text-xs text-gray-400">{strength(d.score)}</span>
						<span className="col-span-2 mt-1 h-1 rounded-full bg-white/[0.07]" aria-hidden="true">
							<span className="block h-1 rounded-full" style={{ width: `${d.score * 10}%`, background: HEX[sc.area] }} />
						</span>
						{meaning && meta.description && <span className="col-span-2 mt-1 text-xs text-gray-500">{meta.description}</span>}
					</li>
				)
			})}
		</ul>
	)
}

// --- More like this ---

const FILTER_WORD: Record<number, string> = { 1: "low", 2: "medium", 3: "high" }
const AREAS = new Set(["Energy", "Heart", "Humor", "World", "Craft", "Style"])

export interface MoreLink {
	label: string
	url: string
	primary: boolean
}

// A Discover link for an area scale at medium or above, then mood pages built on the scale's traits.
export function moreLinks(sc: Scale, t: F.TitleInput, max = 2): MoreLink[] {
	const kind = kindOf(t)
	const out: MoreLink[] = []
	const isArea = AREAS.has(sc.name)
	if (isArea) {
		const tier = t.fingerprint.pillars[sc.area]
		const minTier = Math.min(3, tier)
		if (tier >= 2)
			out.push({
				label: `More ${kind} with ${FILTER_WORD[minTier]} ${sc.area.toLowerCase()}`,
				url: `/discover/${kind}?fingerprintPillars=${sc.area}&fingerprintPillarMinTier=${minTier}`,
				primary: true,
			})
	}
	const keys = isArea ? [...F.PILLAR_KEYS[sc.area], ...F.RELATED_KEYS[sc.area]] : sc.keys(t)
	for (const m of F.moodsForKeys(t, keys)) out.push({ label: `${cleanMood(m.label)} ${kind}`, url: m.url, primary: false })
	return out.slice(0, max)
}

export function MoreLinkChips({ links, area, size = "sm", onNavigate }: { links: MoreLink[]; area: Pillar; size?: "sm" | "xs"; onNavigate?: () => void }) {
	if (!links.length) return null
	const pad = size === "sm" ? "px-3 py-1.5 text-sm" : "px-2.5 py-1 text-xs"
	return (
		<div className="flex flex-wrap gap-2">
			{links.map((l) =>
				l.primary ? (
					<Link key={l.url} to={l.url} onClick={onNavigate} className={`rounded-full font-semibold text-black hover:brightness-110 ${pad}`} style={{ background: HEX[area] }}>
						{l.label}
					</Link>
				) : (
					<Link key={l.url} to={l.url} onClick={onNavigate} className={`rounded-full border border-white/20 text-gray-100 hover:border-white/60 hover:bg-white/5 ${pad}`}>
						{l.label}
					</Link>
				),
			)}
		</div>
	)
}

// A tinted card surface in the area color; solid underneath (no backdrop blur).
export const cardStyle = (area: Pillar): React.CSSProperties => ({
	background: `linear-gradient(155deg, ${glow(area, 16)}, transparent 55%), #0e1015`,
})

export const KEYFRAMES =
	"@keyframes fpIn{from{opacity:0;transform:translateY(4px) scale(.98)}to{opacity:1;transform:none}}@keyframes fpUp{from{transform:translateY(100%)}to{transform:none}}@keyframes fpFade{from{opacity:0}to{opacity:1}}@keyframes fpSwap{from{opacity:0;transform:translateY(3px)}to{opacity:1;transform:none}}"
