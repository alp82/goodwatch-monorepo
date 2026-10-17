// PROTOTYPE - throwaway.
// Common Sense Media-style word grid: six areas as words with meters, an intensity line, who it's for, every trait on request.
import { ChevronDownIcon } from "@heroicons/react/20/solid"
import { Fragment, useState } from "react"
import fingerprintIcon from "~/img/fingerprint-72.webp"
import {
	AttributeGrid,
	HEX,
	Meter,
	PILLARS,
	type Pillar,
	PillarName,
	tint,
} from "~/ui/details/DetailsFingerprint"
import { PILLAR_CONFIG } from "~/ui/fingerprint/Pillars"
import { getFingerprintMeta } from "~/ui/fingerprint/fingerprintMeta"
import * as F from "~/ui/fingerprint/fingerprintText"
import MediaText from "~/ui/media-text/MediaText"
import { assetUrl } from "~/utils/asset-url"
import type { VariantProps } from "../types"

type Scores = F.TitleInput["fingerprint"]["scores"]
type Key = keyof Scores

// Copied from fingerprintText's PILLAR_WORDS (not exported), sentence case.
const AREA_WORDS: Record<Pillar, string[]> = {
	Energy: [
		"Calm",
		"Low-key",
		"Steady energy",
		"High energy",
		"Relentless energy",
	],
	Heart: [
		"Emotionally cool",
		"Light on feelings",
		"Some heart",
		"Big heart",
		"Deeply emotional",
	],
	Humor: ["No humor", "A touch of humor", "Light humor", "Funny", "Very funny"],
	World: [
		"Thin world",
		"Simple world",
		"Solid world",
		"Immersive world",
		"Fully immersive world",
	],
	Craft: [
		"Rough craft",
		"Plain craft",
		"Solid craft",
		"Strong craft",
		"Masterful craft",
	],
	Style: [
		"Plain style",
		"Modest style",
		"Clean style",
		"Striking style",
		"Stunning style",
	],
}

// Content intensity, IMDb parents guide words. Only categories above "none" (3+) are listed.
const INTENSITY: { key: Key; label: string }[] = [
	{ key: "violence", label: "Violence" },
	{ key: "grotesque", label: "Gore" },
	{ key: "scare", label: "Scares" },
	{ key: "eroticism", label: "Sex" },
]
const level = (n: number) =>
	n >= 9
		? "severe"
		: n >= 7
			? "strong"
			: n >= 5
				? "moderate"
				: n >= 3
					? "mild"
					: null

const LOW_INFO = ["Adults", "Solo Watch", "Public Viewing Safe"]
const ORDER = [
	"Kids",
	"Family Movie Night",
	"Teens",
	"Date Night",
	"Partner Watch",
	"Friends Night",
	"Party Vibe",
	"Intergenerational",
]
const rank = (n: string) =>
	ORDER.includes(n) ? ORDER.indexOf(n) : ORDER.length

function strongest(t: F.TitleInput): Pillar {
	const tiers = t.fingerprint.pillars
	return [...PILLARS].sort((a, b) => tiers[b] - tiers[a])[0]
}

export default function Grid({ t }: VariantProps) {
	const s = t.fingerprint.scores
	const tiers = t.fingerprint.pillars
	const [open, setOpen] = useState(false)
	const [area, setArea] = useState<Pillar>(() => strongest(t))
	const intense = INTENSITY.map((x) => ({
		...x,
		word: level(s[x.key]),
	})).filter((x) => x.word)
	// Capped and ordered by how much each flag says: "Adults", "Solo Watch" and
	// "Public Viewing Safe" are true for most titles, so they're left out here.
	const who = t.fingerprint.socialSuitability
		.map((x) => x.name)
		.filter((n) => !LOW_INFO.includes(n))
		.sort((a, b) => rank(a) - rank(b))
		.slice(0, 5)
	const ctx = t.fingerprint.viewingContext.map((x) => x.name).slice(0, 3)

	const show = (p: Pillar) => {
		setArea(p)
		setOpen(true)
	}

	return (
		<div>
			<h2 className="flex items-center gap-2 text-lg font-semibold text-gray-300">
				<img
					src={assetUrl(fingerprintIcon)}
					className="h-6 w-auto rounded-sm bg-amber-950/50 p-0.5"
					alt=""
				/>
				<MediaText value={{ text: t.title, lang: t.titleLang ?? "en" }} />{" "}
				fingerprint
			</h2>
			<p className="mt-2 max-w-3xl text-gray-300">{F.summary(t)}</p>

			<div className="mt-6 grid grid-cols-1 gap-8 lg:grid-cols-[3fr_2fr] lg:gap-12 [&>*]:min-w-0">
				<ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
					{PILLARS.map((p) => {
						const lead = F.pillarDrivers(t, p)
							.filter((d) => d.score >= 6)
							.slice(0, 2)
							.map((d) => getFingerprintMeta(d.key).label.toLowerCase())
						const on = open && area === p
						return (
							<li key={p}>
								<button
									type="button"
									onClick={() => (on ? setOpen(false) : show(p))}
									aria-pressed={on}
									aria-label={`${p}: ${AREA_WORDS[p][tiers[p]]}. Show every ${p.toLowerCase()} trait`}
									className={`h-full w-full cursor-pointer rounded-xl border px-3 py-3 text-left hover:bg-white/5 focus-visible:outline-2 focus-visible:outline-amber-300 ${on ? "border-white/30" : "border-white/8"}`}
									style={tint(p, on ? 18 : 8)}
								>
									<span className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1.5">
										<PillarName p={p} className="text-sm text-gray-300" />
										<Meter tier={tiers[p]} p={p} />
									</span>
									<span className="mt-1.5 block font-semibold leading-snug text-white">
										{AREA_WORDS[p][tiers[p]]}
									</span>
									{lead.length > 0 && (
										<span className="mt-0.5 block truncate text-xs text-gray-400">
											{F.list(lead)}
										</span>
									)}
								</button>
							</li>
						)
					})}
				</ul>

				<div className="space-y-5">
					<section>
						<h3 className="text-sm font-semibold text-gray-300">Intensity</h3>
						<p className="mt-1.5 text-base leading-relaxed">
							{intense.length === 0 && (
								<span className="text-gray-200">Nothing intense to flag</span>
							)}
							{intense.map((x, i) => (
								<Fragment key={x.key}>
									{i > 0 && (
										<span className="text-gray-600"> &nbsp;·&nbsp; </span>
									)}
									<span className="whitespace-nowrap">
										<span className="text-gray-400">{x.label}:</span>{" "}
										<span className="font-semibold text-white">{x.word}</span>
									</span>
								</Fragment>
							))}
						</p>
						<p className="mt-1 text-xs text-gray-500">
							Estimated from our trait scores, not a parental rating.
						</p>
					</section>
					<section>
						<h3 className="text-sm font-semibold text-gray-300">
							Who it's for
						</h3>
						<div className="mt-2 flex flex-wrap gap-1.5">
							{who.map((w) => (
								<span
									key={w}
									className="rounded-full bg-emerald-400/15 px-2.5 py-1 text-sm text-emerald-100"
								>
									{w}
								</span>
							))}
							{ctx.map((c) => (
								<span
									key={c}
									className="rounded-full bg-sky-400/15 px-2.5 py-1 text-sm text-sky-100"
								>
									{c}
								</span>
							))}
						</div>
					</section>
				</div>
			</div>

			<button
				type="button"
				aria-expanded={open}
				aria-controls="fp-grid-traits"
				onClick={() => setOpen(!open)}
				className="mt-5 inline-flex h-9 cursor-pointer items-center gap-1 rounded-full bg-white/10 pl-3.5 pr-2 text-sm font-semibold hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-amber-300"
			>
				{open ? "Hide traits" : "See every trait"}
				<ChevronDownIcon
					className={`h-5 w-5 transition-transform ${open ? "rotate-180" : ""}`}
					aria-hidden="true"
				/>
			</button>

			{open && (
				<div
					id="fp-grid-traits"
					className="mt-4 rounded-2xl border border-white/10 p-5 motion-safe:animate-[fpgrid_150ms_ease-out] sm:p-6"
					style={tint(area)}
					onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
				>
					<style>
						{
							"@keyframes fpgrid{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:none}}"
						}
					</style>
					<div
						role="tablist"
						aria-label="Fingerprint areas"
						className="-mx-5 flex gap-1.5 overflow-x-auto px-5 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0"
					>
						{PILLARS.map((q) => (
							<button
								key={q}
								type="button"
								role="tab"
								aria-selected={q === area}
								onClick={() => setArea(q)}
								className={`h-9 shrink-0 cursor-pointer whitespace-nowrap rounded-full px-3.5 text-sm ${q === area ? "font-semibold text-black" : "bg-white/5 text-gray-300 hover:bg-white/10"}`}
								style={q === area ? { background: HEX[q] } : undefined}
							>
								{PILLAR_CONFIG[q].emoji} {q}
							</button>
						))}
					</div>
					<div className="mt-6">
						<AttributeGrid t={t} p={area} meaning={false} />
					</div>
				</div>
			)}
		</div>
	)
}
