// PROTOTYPE - throwaway. What should the title page's overview (the panel beside the poster) look like for a
// signed-in member? Four variants of it on one route, switchable with the floating bar or the arrow keys:
//   /prototype/title-overview?v=A|B|C|D
//     &s=show-watching|show-new|show-caught-up|movie-new|movie-seen   the sample member and title
//     &p=one|many|none                                                how many streaming services have the title
// The owner's complaints about today's panel: the ratings are not grouped, the member's own score is not shown
// nicely, the full score picker should be behind a control, and there is sometimes empty space under the poster.
// Sample data is hard-coded (ui/prototype-title-overview/model.ts) and every press stays in React state: the loader
// reads nothing, and the page calls no endpoint. Notes and screenshots: docs/prototypes/title-overview/README.md.
import { json } from "@remix-run/node"
import { type ShouldRevalidateFunction, useSearchParams } from "@remix-run/react"
import { useEffect } from "react"
import { PROVIDERS, type ProviderKey, SCENARIOS, type ScenarioKey, TITLES, useMember } from "~/ui/prototype-title-overview/model"
import { VariantA, VariantB, VariantC, VariantD, type VariantProps } from "~/ui/prototype-title-overview/variants"

export async function loader() {
	if (process.env.NODE_ENV === "production") throw new Response("Not found", { status: 404 })
	return json({})
}

export const meta = () => [{ title: "Title overview prototype · GoodWatch" }, { name: "robots", content: "noindex, nofollow" }]
export const shouldRevalidate: ShouldRevalidateFunction = () => false

const VARIANTS = {
	A: { name: "Scoreboard", Component: VariantA, note: "Two rings, the title's and yours, beside a table of the sites with critics and audience in columns. Your ring opens the picker as a popover (a sheet on a phone). The poster follows the panel's height." },
	B: { name: "Yours under the poster", Component: VariantB, note: "The panel is about the title; your score and your actions are one card under the poster, and the score tile opens the picker in place. Both columns stretch to the same height." },
	C: { name: "One card, poster inset", Component: VariantC, note: "A strip of four tiles: GoodWatch, Critics, Audience, You. The You tile opens the picker in place. The poster is small and inside the card, and where to watch runs the full width under it." },
	D: { name: "Banner", Component: VariantD, note: "The backdrop as a banner with a small poster over its edge, and one bar for every rating with your score as a pill in it. The pill opens the picker as a dialog (a sheet on a phone)." },
} satisfies Record<string, { name: string; note: string; Component: (props: VariantProps) => React.ReactNode }>
type VariantKey = keyof typeof VARIANTS
const KEYS = Object.keys(VARIANTS) as VariantKey[]

export default function TitleOverviewPrototype() {
	const [params, setParams] = useSearchParams()
	const variant = (KEYS.includes(params.get("v") as VariantKey) ? params.get("v") : "A") as VariantKey
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
	return (
		<div data-prototype={variant} className="mx-auto max-w-7xl px-4 pb-44 pt-4 text-white sm:px-6 lg:px-8">
			<header className="mb-4">
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
							{variant} · {VARIANTS[variant].name}
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
					Prototype, variant {variant}: {VARIANTS[variant].name}.
				</span>{" "}
				{note}
			</p>
		</>
	)
}
