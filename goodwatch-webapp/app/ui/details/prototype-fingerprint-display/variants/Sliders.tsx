// PROTOTYPE - throwaway.
// Vivino-style bipolar scales for true opposites (pace, tone, setting, attention), plus one word per area.
import fingerprintIcon from "~/img/fingerprint-72.webp"
import { HEX, PILLARS, type Pillar } from "~/ui/details/DetailsFingerprint"
import { PILLAR_CONFIG } from "~/ui/fingerprint/Pillars"
import * as F from "~/ui/fingerprint/fingerprintText"
import MediaText from "~/ui/media-text/MediaText"
import { assetUrl } from "~/utils/asset-url"
import type { VariantProps } from "../types"

type Scores = F.TitleInput["fingerprint"]["scores"]

const clamp = (v: number) => Math.min(1, Math.max(0, v))
const top2 = (xs: number[]) => {
	const b = [...xs].sort((x, y) => y - x)
	return (b[0] + (b[1] ?? 0)) / 2
}

interface Scale {
	name: string
	area: Pillar
	left: string
	right: string
	// Five words from the left pole to the right pole.
	words: [string, string, string, string, string]
	value: (s: Scores) => number
}

// Each scale puts two opposing traits against each other (difference / 16,
// centred), except Attention, which is a single "how demanding" reading.
const SCALES: Scale[] = [
	{
		name: "Pace",
		area: "Energy",
		left: "Slow burn",
		right: "Fast",
		words: ["Very slow", "Slow burn", "Steady", "Fast", "Breakneck"],
		value: (s) => clamp((s.fast_pace - s.slow_burn) / 16 + 0.5),
	},
	{
		name: "Tone",
		area: "Heart",
		left: "Bleak",
		right: "Hopeful",
		words: ["Bleak", "Mostly dark", "Mixed", "Mostly hopeful", "Uplifting"],
		value: (s) => clamp((s.hopefulness - s.bleakness) / 16 + 0.5),
	},
	{
		name: "Setting",
		area: "World",
		left: "Everyday",
		right: "Otherworldly",
		words: [
			"Real world",
			"Grounded",
			"Heightened",
			"Otherworldly",
			"Fantastical",
		],
		value: (s) =>
			clamp(
				(Math.max(s.fantasy, s.futuristic, s.surrealism) -
					Math.max(s.contemporary_realism, s.historical, s.biographical)) /
					16 +
					0.5,
			),
	},
	{
		name: "Attention",
		area: "Craft",
		left: "Easy watch",
		right: "Demanding",
		words: [
			"Easy watch",
			"Easy to follow",
			"Some focus",
			"Demanding",
			"Very demanding",
		],
		value: (s) =>
			clamp(
				(top2([
					s.complexity,
					s.philosophical,
					s.non_linear_narrative,
					s.ambiguity,
					s.meta_narrative,
				]) -
					2) /
					8,
			),
	},
]

const wordAt = (sc: Scale, v: number) =>
	sc.words[v < 0.15 ? 0 : v < 0.38 ? 1 : v <= 0.62 ? 2 : v <= 0.85 ? 3 : 4]

// One word per area and tier (0-4), shortened from the shared area wording.
const AREA_WORD: Record<Pillar, string[]> = {
	Energy: ["Calm", "Low-key", "Steady", "High", "Relentless"],
	Heart: ["Cool", "Reserved", "Warm", "Moving", "Profound"],
	Humor: ["None", "Rare", "Light", "Funny", "Hilarious"],
	World: ["Thin", "Simple", "Solid", "Rich", "Immersive"],
	Craft: ["Rough", "Plain", "Solid", "Strong", "Masterful"],
	Style: ["Plain", "Modest", "Clean", "Striking", "Stunning"],
}

function Slider({ sc, s }: { sc: Scale; s: Scores }) {
	const v = sc.value(s)
	const word = wordAt(sc, v)
	const near = v < 0.38 ? "left" : v > 0.62 ? "right" : null
	return (
		<li className="grid grid-cols-[6.75rem_1fr] items-center gap-x-3 gap-y-1 sm:grid-cols-[8rem_1fr]">
			<div>
				<p className="text-sm text-gray-400">{sc.name}</p>
				<p className="font-semibold leading-tight text-white">{word}</p>
			</div>
			<div className="grid grid-cols-2 items-center gap-x-3 gap-y-1.5 sm:grid-cols-[5.5rem_1fr_5.5rem]">
				<span
					className={`order-2 text-xs sm:order-1 sm:text-right sm:text-sm ${near === "left" ? "text-gray-200" : "text-gray-500"}`}
				>
					{sc.left}
				</span>
				<span
					role="img"
					aria-label={`${sc.name}: ${word}, between ${sc.left.toLowerCase()} and ${sc.right.toLowerCase()}`}
					className="relative col-span-2 order-1 h-3 rounded-full bg-white/8 sm:col-span-1 sm:order-2"
				>
					<span
						className="absolute inset-y-0 left-1/2 w-px bg-white/15"
						aria-hidden="true"
					/>
					<span
						className="absolute top-1/2 h-3.5 w-9 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-black/40"
						style={{ left: `calc(18px + ${v} * (100% - 36px))`, background: HEX[sc.area] }}
						aria-hidden="true"
					/>
				</span>
				<span
					className={`order-3 text-right text-xs sm:text-left sm:text-sm ${near === "right" ? "text-gray-200" : "text-gray-500"}`}
				>
					{sc.right}
				</span>
			</div>
		</li>
	)
}

export default function Sliders({ t }: VariantProps) {
	const s = t.fingerprint.scores
	const tiers = t.fingerprint.pillars
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
			<p className="mt-2 max-w-3xl text-xl leading-snug text-gray-200">
				{F.summary(t)}
			</p>

			<ul className="mt-7 grid gap-x-16 gap-y-5 lg:grid-cols-2">
				{SCALES.map((sc) => (
					<Slider key={sc.name} sc={sc} s={s} />
				))}
			</ul>

			<ul className="mt-8 grid grid-cols-3 gap-px overflow-hidden rounded-xl border border-white/8 bg-white/8 sm:grid-cols-6">
				{PILLARS.map((p) => (
					<li
						key={p}
						className="bg-stone-950/90 px-3 py-2.5"
						style={{ boxShadow: `inset 0 2px 0 ${HEX[p]}` }}
					>
						<p className="text-xs text-gray-400">
							<span aria-hidden="true">{PILLAR_CONFIG[p].emoji}</span> {p}
						</p>
						<p className="mt-0.5 font-semibold text-white">
							{AREA_WORD[p][tiers[p]]}
						</p>
					</li>
				))}
			</ul>
		</div>
	)
}
