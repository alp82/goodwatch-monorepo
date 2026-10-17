// PROTOTYPE - throwaway.
// Closed questions with derived answers (StoryGraph, HowLongToBeat); tap an answer to see the traits behind it.
import { ChevronDownIcon } from "@heroicons/react/20/solid"
import type React from "react"
import { useState } from "react"
import { Bars, HEX, Head, type Pillar } from "~/ui/details/DetailsFingerprint"
import * as F from "~/ui/fingerprint/fingerprintText"
import type { VariantProps } from "../types"

type Scores = F.TitleInput["fingerprint"]["scores"]
type Key = keyof Scores

interface Answer {
	q: string
	a: string
	note?: string
	area: Pillar
	evidence: { label?: string; keys: Key[]; area: Pillar }[]
	extra?: React.ReactNode
}

const top2 = (xs: number[]) => {
	const b = [...xs].sort((x, y) => y - x)
	return (b[0] + (b[1] ?? 0)) / 2
}
const byScore = (s: Scores, keys: Key[]) =>
	[...keys].sort((a, b) => s[b] - s[a])

const HUMOR_WORD: Partial<Record<Key, string>> = {
	situational_comedy: "situational comedy",
	wit_wordplay: "sharp wit",
	physical_comedy: "slapstick",
	cringe_humor: "cringe comedy",
	absurdist_humor: "absurd humor",
	satire_parody: "satire",
	dark_humor: "dark humor",
}

function answers(t: F.TitleInput): Answer[] {
	const s = t.fingerprint.scores
	const who = t.fingerprint.socialSuitability.map((x) => x.name)
	const ctx = t.fingerprint.viewingContext.map((x) => x.name)
	const humor = t.fingerprint.pillars.Humor
	const humorKeys = byScore(s, Object.keys(HUMOR_WORD) as Key[])
	const kinds = humorKeys
		.filter((k) => s[k] >= 5)
		.slice(0, 2)
		.map((k) => HUMOR_WORD[k] ?? "")

	// Plot or characters: weighted character side against weighted plot side; a gap under 1 is "both".
	const character =
		(s.character_depth * 2 + s.pathos + s.dialogue_centrality) / 4
	const plot = (s.intrigue * 2 + s.spectacle + s.mystery) / 4
	const drive =
		character - plot >= 1
			? "Character-driven"
			: plot - character >= 1
				? "Plot-driven"
				: "Both, in balance"

	const demand = top2([
		s.complexity,
		s.non_linear_narrative,
		s.philosophical,
		s.ambiguity,
	])
	const easyCtx = ctx.some(
		(c) => c === "Background Watch" || c === "Drop-in Friendly",
	)
	const half =
		demand >= 8
			? "No, it needs attention"
			: demand >= 6
				? easyCtx
					? "Mostly, yes"
					: "Better with focus"
				: "Yes, easy to follow"

	const date = who.includes("Date Night")
		? "Yes"
		: who.includes("Partner Watch")
			? "Yes, as a couple"
			: who.includes("Family Movie Night") || who.includes("Kids")
				? "Better for family night"
				: "Not really"

	const scare =
		s.scare >= 8
			? "Yes"
			: s.scare >= 6
				? "At times"
				: s.scare >= 4
					? "Barely"
					: "No"
	const scareNote =
		s.scare < 6 && s.tension >= 8
			? "Tense, but not scary"
			: s.grotesque >= 7
				? "Some gruesome images"
				: undefined

	const mood = s.hopefulness - s.bleakness
	const after =
		mood >= 3
			? "Yes, it's uplifting"
			: mood <= -3
				? "No, it's bleak"
				: "Mixed feelings"

	return [
		{
			q: "Will it make me laugh?",
			a: ["Not really", "Not really", "A little", "Yes", "A lot"][humor],
			note: kinds.length ? `Mostly ${F.list(kinds)}` : undefined,
			area: "Humor",
			evidence: [{ keys: humorKeys.slice(0, 4), area: "Humor" }],
		},
		{
			q: "Plot or characters?",
			a: drive,
			area: "Craft",
			evidence: [
				{
					label: "Characters",
					keys: ["character_depth", "pathos", "dialogue_centrality"],
					area: "Heart",
				},
				{
					label: "Plot",
					keys: ["intrigue", "spectacle", "mystery"],
					area: "Energy",
				},
			],
		},
		{
			q: "Can I half-watch it?",
			a: half,
			note:
				demand >= 8 && s.complexity >= 8
					? "Layered plot, easy to lose the thread"
					: undefined,
			area: "Craft",
			evidence: [
				{
					keys: byScore(s, [
						"complexity",
						"non_linear_narrative",
						"philosophical",
						"ambiguity",
					]),
					area: "Craft",
				},
			],
		},
		{
			q: "Good for date night?",
			a: date,
			area: "Heart",
			evidence: [{ keys: ["romance", "eroticism"], area: "Heart" }],
			extra: (
				<div className="flex flex-wrap gap-1.5">
					{who.map((w) => (
						<span
							key={w}
							className="rounded-full bg-emerald-400/15 px-2.5 py-1 text-sm text-emerald-100"
						>
							{w}
						</span>
					))}
				</div>
			),
		},
		{
			q: "Will it scare me?",
			a: scare,
			note: scareNote,
			area: "Energy",
			evidence: [
				{
					keys: byScore(s, ["scare", "tension", "uncanny", "grotesque"]),
					area: "Energy",
				},
			],
		},
		{
			q: "Will I feel good after?",
			a: after,
			area: "Heart",
			evidence: [
				{
					keys: byScore(s, [
						"hopefulness",
						"wholesome",
						"bleakness",
						"melancholy",
					]),
					area: "Heart",
				},
			],
		},
	]
}

function Card({ x, s, i }: { x: Answer; s: Scores; i: number }) {
	const [open, setOpen] = useState(false)
	const id = `fp-q-${i}`
	return (
		<li
			className="rounded-xl border border-white/8 bg-white/[0.02]"
			style={{ boxShadow: `inset 3px 0 0 ${HEX[x.area]}` }}
			onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
		>
			<button
				type="button"
				aria-expanded={open}
				aria-controls={id}
				onClick={() => setOpen(!open)}
				className="flex w-full cursor-pointer items-center justify-between gap-3 rounded-xl px-4 py-3 text-left hover:bg-white/3 focus-visible:outline-2 focus-visible:outline-amber-300"
			>
				<span>
					<span className="block text-sm text-gray-400">{x.q}</span>
					<span className="block text-xl font-semibold leading-snug text-white">
						{x.a}
					</span>
					{x.note && (
						<span className="block text-sm text-gray-300">{x.note}</span>
					)}
				</span>
				<span className="flex shrink-0 items-center gap-1 text-xs text-gray-400">
					<span className="hidden sm:inline">{open ? "Hide" : "Why"}</span>
					<ChevronDownIcon
						className={`h-5 w-5 transition-transform ${open ? "rotate-180" : ""}`}
						aria-hidden="true"
					/>
				</span>
			</button>
			{open && (
				<div
					id={id}
					className="space-y-4 px-4 pt-1 pb-4 motion-safe:animate-[fpq_150ms_ease-out]"
				>
					<style>
						{
							"@keyframes fpq{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:none}}"
						}
					</style>
					{x.extra && (
						<div>
							<p className="mb-2 text-xs font-semibold text-gray-400">
								Our viewing guide says it suits
							</p>
							{x.extra}
						</div>
					)}
					{x.evidence.map((ev) => (
						<div key={ev.label ?? "traits"}>
							<p className="mb-2 text-xs font-semibold text-gray-400">
								{ev.label
									? `${ev.label} side`
									: x.extra
										? "Related traits"
										: "Based on these traits"}
							</p>
							<Bars
								attributes={ev.keys.map((k) => ({ key: k, score: s[k] }))}
								color={HEX[ev.area]}
							/>
						</div>
					))}
				</div>
			)}
		</li>
	)
}

export default function Questions({ t }: VariantProps) {
	const s = t.fingerprint.scores
	return (
		<div>
			<Head t={t} />
			<ul className="mt-6 grid items-start gap-3 md:grid-cols-2">
				{answers(t).map((x, i) => (
					<Card key={x.q} x={x} s={s} i={i} />
				))}
			</ul>
		</div>
	)
}
