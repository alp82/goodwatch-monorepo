// PROTOTYPE - throwaway.
// Sliders whose tracks also show the typical range for the title's main genre, read out in words, plus the area strip.
import { HEX, Meter, PILLARS } from "~/ui/details/DetailsFingerprint"
import { PILLAR_CONFIG } from "~/ui/fingerprint/Pillars"
import type { VariantProps } from "../types"
import { type Scale, SCALES, compare, typicalFor, wordAt } from "./relative-parts"
import { SectionTitle, shortWord, tagline } from "./strip-parts"

type Scores = VariantProps["t"]["fingerprint"]["scores"]

// Positions on the track keep the thumb (36 px wide) inside it, as in Sliders.
const at = (v: number) => `calc(18px + ${v} * (100% - 36px))`

function Slider({ sc, s, q, noun }: { sc: Scale; s: Scores; q: [number, number, number]; noun: string }) {
	const v = sc.value(s)
	const word = wordAt(sc, v)
	const versus = compare(sc, v, q, noun)
	const [p25, med, p75] = q
	return (
		<li className="grid grid-cols-[6.75rem_1fr] items-start gap-x-3 sm:grid-cols-[8rem_1fr]">
			<div>
				<p className="text-sm text-gray-400">{sc.name}</p>
				<p className="font-semibold leading-tight text-white">{word}</p>
			</div>
			<div className="pt-1">
				<div className="grid grid-cols-2 items-center gap-x-3 gap-y-1.5 sm:grid-cols-[5.5rem_1fr_5.5rem]">
					<span className="order-2 text-xs text-gray-500 sm:order-1 sm:text-right sm:text-sm">{sc.left}</span>
					<span
						role="img"
						aria-label={`${sc.name}: ${word}. ${versus}.`}
						className="relative order-1 col-span-2 h-3 rounded-full bg-white/8 sm:order-2 sm:col-span-1"
					>
						{/* Typical range for the genre: the middle half, with a tick at the median. */}
						<span
							className="absolute inset-y-0 rounded-full bg-white/12"
							style={{ left: `calc(${at(p25)} - 6px)`, width: `calc((${p75 - p25}) * (100% - 36px) + 12px)` }}
							aria-hidden="true"
						/>
						<span className="absolute -inset-y-1 w-0.5 -translate-x-1/2 rounded-full bg-white/45" style={{ left: at(med) }} aria-hidden="true" />
						<span
							className="absolute top-1/2 h-3.5 w-9 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-black/40"
							style={{ left: at(v), background: HEX[sc.area] }}
							aria-hidden="true"
						/>
					</span>
					<span className="order-3 text-right text-xs text-gray-500 sm:text-left sm:text-sm">{sc.right}</span>
				</div>
				<p className="mt-1 text-sm text-gray-300 sm:pl-[6.25rem]">{versus}</p>
			</div>
		</li>
	)
}

export default function Relative({ t, media }: VariantProps) {
	const s = t.fingerprint.scores
	const tiers = t.fingerprint.pillars
	const { noun, typical } = typicalFor(t)
	return (
		<div>
			<SectionTitle t={t} />
			<p className="mt-2 text-2xl font-semibold tracking-tight text-amber-200">{tagline(t, media)}.</p>

			<ul className="mt-6 grid gap-x-16 gap-y-5 lg:grid-cols-2">
				{SCALES.map((sc) => (
					<Slider key={sc.id} sc={sc} s={s} q={typical[sc.id]} noun={noun} />
				))}
			</ul>
			<p className="mt-3 flex items-center gap-2 text-xs text-gray-400">
				<span className="relative inline-block h-2.5 w-8 rounded-full bg-white/12" aria-hidden="true">
					<span className="absolute -inset-y-0.5 left-1/2 w-0.5 -translate-x-1/2 rounded-full bg-white/45" />
				</span>
				Shaded: the middle half of {noun}. Line: the typical one.
			</p>

			<ul className="mt-6 grid grid-cols-3 gap-2 lg:grid-cols-6">
				{PILLARS.map((p) => (
					<li key={p} className="flex flex-col items-start gap-1.5 rounded-xl border border-white/8 px-3 py-2.5">
						<span className="flex items-center gap-1.5 text-sm font-semibold text-gray-200">
							<span aria-hidden="true">{PILLAR_CONFIG[p].emoji}</span>
							{p}
						</span>
						<Meter tier={tiers[p]} p={p} />
						<span className="text-sm text-white">{shortWord(p, tiers[p])}</span>
					</li>
				))}
			</ul>
		</div>
	)
}
