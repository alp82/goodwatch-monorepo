// PROTOTYPE - throwaway. What should the title page's overview (the panel beside the poster) look like for a
// signed-in member? Variants of it on one route, switchable with the floating bar or the arrow keys.
// Round 4: the owner chose round 3's I as the baseline and asked for five changes to it. L, M and N all have them
// and differ in what is still open; I and J (round 3) and A and D (round 1) stay for comparison.
//   /prototype/title-overview?v=L|M|N|I|J|A|D
//     &s=show-watching|show-new|show-caught-up|movie-new|movie-seen   the sample member and title
//     &p=one|many|none                                                how many streaming services have the title
// The owner's complaints about today's panel: the ratings are not grouped, the member's own score is not shown
// nicely, the full score picker should be behind a control, and there is sometimes empty space under the poster.
// Sample data is hard-coded (ui/prototype-title-overview/model.ts) and every press stays in React state: the loader
// reads nothing, and the page calls no endpoint. Notes and screenshots: docs/prototypes/title-overview/README.md.
import { json } from "@remix-run/node"
import { type ShouldRevalidateFunction, useSearchParams } from "@remix-run/react"
import { useEffect, useState } from "react"
import { PROVIDERS, type ProviderKey, SCENARIOS, type ScenarioKey, TITLES, useMember } from "~/ui/prototype-title-overview/model"
import { VariantI, VariantJ } from "~/ui/prototype-title-overview/round3"
import { VariantL, VariantM, VariantN } from "~/ui/prototype-title-overview/round4"
import { VariantA, VariantD, type VariantProps } from "~/ui/prototype-title-overview/variants"

export async function loader() {
	if (process.env.NODE_ENV === "production") throw new Response("Not found", { status: 404 })
	return json({})
}

export const meta = () => [{ title: "Title overview prototype · GoodWatch" }, { name: "robots", content: "noindex, nofollow" }]
export const shouldRevalidate: ShouldRevalidateFunction = () => false

const VARIANTS = {
	L: { name: "L · I with the five changes", ownTitle: true, Component: VariantL, note: "I, changed as asked and nothing else: your score is J's rectangle at the right edge, every row runs edge to edge, the episode ratings are the Grid toggle's miniature at the right of the site chips, and where to watch has J's cards. The ratings stay on the banner; the actions have their own row." },
	M: { name: "M · Ratings under the banner", ownTitle: true, Component: VariantM, note: "The same five changes, but the banner is only the poster and the title: the ratings are the first of three blocks, and the miniature stands in the tracking line, before the Next episode chip." },
	N: { name: "N · Tighter, actions on the line", ownTitle: true, Component: VariantN, note: "L made denser, with the wider miniature (a row per season). From 768 px up the actions stand on the tracking line; on a phone they keep their own row." },
	I: { name: "I (round 3) · Rings on the banner", ownTitle: true, Component: VariantI, note: "Round 3, the baseline, kept for comparison. A's two rings and the site chips on the banner; then your show, and where to watch as a row of logos to swipe." },
	J: { name: "J (round 3) · Three cards", ownTitle: true, Component: VariantJ, note: "Round 3, kept for comparison: its own-score rectangle and its service cards are what round 4 takes." },
	A: { name: "A (round 1) · Scoreboard", Component: VariantA, note: "Round 1, kept for reference. Two rings, the title's and yours, beside a table of the sites. Your ring opens the picker as a popover (a sheet on a phone). The poster follows the panel's height." },
	D: { name: "D (round 1) · Banner", Component: VariantD, note: "Round 1, kept for reference. The backdrop as a banner with a small poster over its edge, and one bar for every rating with your score as a pill in it." },
} satisfies Record<string, { name: string; note: string; ownTitle?: boolean; Component: (props: VariantProps) => React.ReactNode }>
type VariantKey = keyof typeof VARIANTS
const KEYS = Object.keys(VARIANTS) as VariantKey[]

export default function TitleOverviewPrototype() {
	const [params, setParams] = useSearchParams()
	const variant = (KEYS.includes(params.get("v") as VariantKey) ? params.get("v") : "L") as VariantKey
	const scenario = ((params.get("s") ?? "") in SCENARIOS ? params.get("s") : "show-watching") as ScenarioKey
	const providers = ((params.get("p") ?? "") in PROVIDERS ? params.get("p") : "one") as ProviderKey
	const set = (key: string, value: string) => {
		const next = new URLSearchParams(params)
		next.set(key, value)
		setParams(next, { replace: true, preventScrollReset: true })
	}
	const step = (by: number) => set("v", KEYS[(KEYS.indexOf(variant) + by + KEYS.length) % KEYS.length])
	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if ((e.target as HTMLElement).closest("input, textarea, select, [contenteditable]")) return
			if (e.key === "ArrowLeft") step(-1)
			if (e.key === "ArrowRight") step(1)
		}
		window.addEventListener("keydown", onKey)
		return () => window.removeEventListener("keydown", onKey)
	})
	const title = TITLES[SCENARIOS[scenario].kind]
	// For the check scripts: the page answers presses from here on.
	const [ready, setReady] = useState(false)
	useEffect(() => setReady(true), [])
	return (
		<div data-prototype={variant} data-ready={ready || undefined} className="mx-auto max-w-7xl px-4 pb-44 pt-4 text-white sm:px-6 lg:px-8">
			{/* Round 2's variants carry the title on their banner. */}
			<header className={`mb-4 ${"ownTitle" in VARIANTS[variant] ? "hidden" : ""}`}>
				<h1 className="text-2xl font-bold tracking-tight sm:text-4xl">{title.name}</h1>
				<p className="mt-1 text-sm text-gray-400">{title.facts.join(" · ")}</p>
			</header>
			{/* A new scenario or variant starts the sample member over. */}
			<Stage key={`${variant}:${scenario}`} variant={variant} scenario={scenario} providers={providers} />
			<div aria-hidden="true" className="mt-10 space-y-8 opacity-60">
				{(title.kind === "show" ? ["Episodes", "About", "Cast"] : ["About", "Cast"]).map((name) => (
					<section key={name} id={name === "Episodes" ? "episodes" : undefined}>
						<h2 className="text-xl font-bold">{name}</h2>
						<div className="mt-3 h-28 rounded-xl border border-dashed border-white/15 bg-white/[0.03]" />
					</section>
				))}
			</div>
			{process.env.NODE_ENV !== "production" && (
				<div data-prototype-bar className="fixed bottom-[4.75rem] left-1/2 z-50 lg:bottom-3 w-max max-w-[calc(100vw-1rem)] -translate-x-1/2 rounded-2xl bg-white px-2 py-1.5 text-xs font-semibold text-black shadow-2xl ring-2 ring-fuchsia-500">
					<div className="flex items-center justify-center gap-1">
						<button type="button" onClick={() => step(-1)} aria-label="Previous variant" className="h-8 w-9 cursor-pointer rounded-full text-base hover:bg-neutral-200">
							←
						</button>
						<span className="min-w-48 text-center text-sm">
							{VARIANTS[variant].name}
						</span>
						<button type="button" onClick={() => step(1)} aria-label="Next variant" className="h-8 w-9 cursor-pointer rounded-full text-base hover:bg-neutral-200">
							→
						</button>
					</div>
					<div className="mt-1 flex items-center justify-center gap-1.5 border-t border-neutral-200 pt-1.5">
						<select aria-label="Sample scenario" value={scenario} onChange={(e) => set("s", e.target.value)} className="h-8 min-w-0 cursor-pointer rounded-lg border border-neutral-300 bg-white px-1.5 text-xs font-semibold text-black">
							{Object.entries(SCENARIOS).map(([key, value]) => (
								<option key={key} value={key}>
									{value.label}
								</option>
							))}
						</select>
						<select aria-label="Streaming services" value={providers} onChange={(e) => set("p", e.target.value)} className="h-8 min-w-0 cursor-pointer rounded-lg border border-neutral-300 bg-white px-1.5 text-xs font-semibold text-black">
							{Object.entries(PROVIDERS).map(([key, value]) => (
								<option key={key} value={key}>
									{value.label}
								</option>
							))}
						</select>
					</div>
				</div>
			)}
		</div>
	)
}

function Stage({ variant, scenario, providers }: { variant: VariantKey; scenario: ScenarioKey; providers: ProviderKey }) {
	const title = TITLES[SCENARIOS[scenario].kind]
	const { m, api } = useMember(title, SCENARIOS[scenario].member)
	const { Component, note } = VARIANTS[variant]
	return (
		<>
			<Component title={title} m={m} api={api} providers={providers} />
			<p data-prototype-note className="mt-4 max-w-3xl rounded-lg border border-dashed border-fuchsia-500/50 px-3 py-2 text-xs leading-relaxed text-fuchsia-200/90">
				<span className="font-semibold">
					Prototype, variant {VARIANTS[variant].name}.
				</span>{" "}
				{note}
			</p>
		</>
	)
}
