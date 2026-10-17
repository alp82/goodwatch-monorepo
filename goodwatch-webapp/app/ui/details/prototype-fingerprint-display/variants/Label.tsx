// PROTOTYPE - throwaway. A dense "fingerprint facts" label in the spirit of a nutrition panel, all traits behind an expand.
import { ChevronDownIcon } from "@heroicons/react/20/solid"
import type React from "react"
import { useState } from "react"
import type { CoreScores } from "~/server/utils/fingerprint"
import * as F from "~/ui/fingerprint/fingerprintText"
import { HEX, PILLARS } from "../../DetailsFingerprint"
import type { VariantProps } from "../types"
import { FpHeading } from "./sheet-head"
import { AREA_WORD, cap, feelWords, goodFor, humorWord, intensityWord, paceWord, traitLabel } from "./sheet-words"

type Key = keyof CoreScores

const Thick = () => <div className="my-1.5 h-2 bg-gray-200" />
const Mid = () => <div className="my-1 h-1 bg-gray-200" />

function Row({ name, children, sub = false, last = false }: { name: string; children: React.ReactNode; sub?: boolean; last?: boolean }) {
	return (
		<div className={`flex items-baseline justify-between gap-4 py-1 ${last ? "" : "border-b border-gray-200/25"} ${sub ? "pl-4" : ""}`}>
			<dt className={`shrink-0 whitespace-nowrap ${sub ? "text-gray-300" : "font-bold text-white"}`}>{name}</dt>
			<dd className="text-right text-gray-100">{children}</dd>
		</div>
	)
}

const CRAFT_KEYS: Key[] = [
	"direction", "acting", "cinematography", "editing", "music_composition", "dialogue_quality", "character_depth",
	"narrative_structure", "visual_stylization", "world_immersion", "sound_centrality",
]

function serving({ media }: VariantProps) {
	if (media.mediaType === "movie") {
		const m = media.details.runtime
		return m ? `1 movie (${Math.floor(m / 60)} h ${m % 60} min)` : "1 movie"
	}
	const ep = media.details.episode_runtime?.[0]
	const n = media.details.number_of_episodes
	return `1 episode${ep ? ` (about ${ep} min)` : ""}${n ? `, ${n} in total` : ""}`
}

export default function Label(props: VariantProps) {
	const { t } = props
	const s = t.fingerprint.scores
	const tiers = t.fingerprint.pillars
	const [all, setAll] = useState(false)
	const humor = humorWord(t)
	const craft = CRAFT_KEYS.filter((k) => s[k] >= 9).sort((a, b) => s[b] - s[a]).slice(0, 4)
	const craftFallback = CRAFT_KEYS.filter((k) => s[k] >= 8).sort((a, b) => s[b] - s[a]).slice(0, 3)
	const good = goodFor(t, 5).shown
	const skip = F.skipIf(t)
	const intensity: [string, Key][] = [["Violence", "violence"], ["Scares", "scare"], ["Gore", "grotesque"], ["Sex", "eroticism"]]

	const areaKeys = new Set(PILLARS.flatMap((p) => F.PILLAR_KEYS[p]))
	const others = (Object.keys(s) as Key[]).filter((k) => !areaKeys.has(k)).sort((a, b) => s[b] - s[a])
	const groups: { name: string; color: string; keys: Key[] }[] = [
		...PILLARS.map((p) => ({ name: p, color: HEX[p], keys: [...F.PILLAR_KEYS[p]].sort((a, b) => s[b] - s[a]) })),
		{ name: "Story and themes", color: "#a8a29e", keys: others },
	]

	return (
		<div>
			<FpHeading t={t} />
			<div className="mt-5 max-w-4xl border-2 border-gray-200 bg-stone-950/70 p-3 text-sm leading-snug text-gray-100 sm:p-4">
				<div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-1">
					<h3 className="text-3xl font-black tracking-tight text-white sm:text-4xl">Fingerprint facts</h3>
					<p className="pb-1 text-gray-300">
						<span className="font-bold text-white">Serving size</span> {serving(props)}
					</p>
				</div>
				<Thick />
				<div className="grid md:grid-cols-2 md:gap-x-6">
					<dl>
						<Row name="Feel">{cap(feelWords(t, 4, 6).join(", ")) || "Calm, low-key"}</Row>
						<Row name="Pace">{paceWord(t)}</Row>
						<Row name="Humor" last>
							{humor.level}
							{humor.kinds.length > 0 && <span className="text-gray-400"> ({humor.kinds.join(", ")})</span>}
						</Row>
						<Mid />
						<div className="flex items-baseline justify-between py-0.5 text-xs text-gray-400">
							<span className="font-bold text-white">Intensity</span>
							<span>Level</span>
						</div>
						{intensity.map(([name, k], i) => (
							<Row key={k} name={name} sub last={i === intensity.length - 1}>
								<span className={s[k] >= 7 ? "font-bold text-white" : s[k] <= 2 ? "text-gray-500" : ""}>{intensityWord(s[k])}</span>
							</Row>
						))}
						<Thick />
					</dl>
					<dl className="max-md:-mt-1">
						<Row name="Craft standouts">
							{cap((craft.length ? craft : craftFallback).map(traitLabel).join(", ").toLowerCase()) || "Solid throughout"}
						</Row>
						<Row name="Best with">{good.length ? cap(good.join(", ").toLowerCase()) : "Anyone"}</Row>
						<Row name="Skip if" last>
							{skip.length ? cap(F.list(skip.slice(0, 2), "or")) : "Nothing stands out"}
						</Row>
						<Mid />
						<div className="py-0.5 text-xs font-bold text-white">By area</div>
						<div className="grid grid-cols-2 gap-x-4">
							{PILLARS.map((p, i) => (
								<div key={p} className={`flex items-baseline justify-between gap-2 py-1 sm:pl-4 ${i < 4 ? "border-b border-gray-200/25" : ""}`}>
									<span className="flex items-center gap-1.5 text-gray-300">
										<span className="h-2 w-2 shrink-0 rounded-full" style={{ background: HEX[p] }} aria-hidden="true" />
										{p}
									</span>
									<span className="font-semibold">{AREA_WORD[p][tiers[p]]}</span>
								</div>
							))}
						</div>
						<Thick />
					</dl>
				</div>
				<div className="flex flex-wrap items-center justify-between gap-2">
					<p className="text-xs text-gray-400">Words come from our scores for 70+ traits, each 0 to 10.</p>
					<button
						type="button"
						aria-expanded={all}
						aria-controls="fp-label-all"
						onClick={() => setAll(!all)}
						className="inline-flex h-8 cursor-pointer items-center gap-1 border border-gray-200/60 px-3 text-xs font-bold uppercase tracking-wide text-white hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-amber-300"
					>
						{all ? "Hide all traits" : "Show all traits"}
						<ChevronDownIcon className={`h-4 w-4 transition-transform ${all ? "rotate-180" : ""}`} aria-hidden="true" />
					</button>
				</div>
				<div id="fp-label-all" hidden={!all}>
					<Thick />
					<div className="gap-x-6 sm:columns-2 lg:columns-3">
						{groups.map((g) => (
							<section key={g.name} className="mb-3 break-inside-avoid">
								<h4 className="flex items-center gap-1.5 border-b-4 border-gray-200 pb-0.5 text-xs font-bold uppercase tracking-wide text-white">
									<span className="h-2 w-2 rounded-full" style={{ background: g.color }} aria-hidden="true" />
									{g.name}
								</h4>
								<dl>
									{g.keys.map((k) => (
										<div key={k} className="flex items-baseline justify-between gap-3 border-b border-gray-200/20 py-0.5 text-xs">
											<dt className={s[k] >= 7 ? "text-white" : "text-gray-400"}>{traitLabel(k)}</dt>
											<dd className={`tabular-nums ${s[k] >= 7 ? "font-bold text-white" : "text-gray-400"}`}>{s[k]}</dd>
										</div>
									))}
								</dl>
							</section>
						))}
					</div>
				</div>
			</div>
		</div>
	)
}
