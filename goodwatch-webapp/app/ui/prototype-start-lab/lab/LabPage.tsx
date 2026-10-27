// PROTOTYPE (start page lab, 2026-10-27): the composed start page for the variants in the URL, plus the lab bar.
import { useSearchParams } from "@remix-run/react"
import { useCallback, useMemo, useState } from "react"
import { LabBar, type BarSection } from "./LabBar"
import { Room, RoomParts } from "./Room"
import { SECTIONS, choiceFromParams } from "./choice"
import { REGISTRY, pick } from "./registry"
import { type IntroFrom, type Lab, type LabCard, LabContext, type LabData } from "./types"

export function LabPage({ data }: { data: LabData }) {
	const [params] = useSearchParams()
	const choice = useMemo(() => choiceFromParams(params), [params])
	const scene = data.scenes.find((s) => s.id === choice.scene) ?? data.scenes[0]
	const shelf = pick(REGISTRY.shelf, choice.shelf)
	const tv = pick(REGISTRY.tv, choice.tv)
	const layout = pick(REGISTRY.layout, choice.layout)
	const hero = pick(REGISTRY.hero, choice.hero)
	const recs = pick(REGISTRY.recs, choice.recs)
	const how = pick(REGISTRY.how, choice.how)
	const browse = pick(REGISTRY.browse, choice.browse)
	const member = pick(REGISTRY.member, choice.member)

	const defaultShelf = choice.as === "member" ? (data.member?.forYou ?? []) : data.guest.popular
	const [shelfOverride, setShelfTitles] = useState<{ as: string; cards: LabCard[] } | null>(null)
	const shelfTitles = shelfOverride?.as === choice.as ? shelfOverride.cards : defaultShelf
	const [theater, setTheater] = useState<{ from: IntroFrom | null } | null>(null)
	const playIntro = useCallback((from: IntroFrom | null) => setTheater({ from }), [])
	const setShelf = useCallback((cards: LabCard[]) => setShelfTitles({ as: choice.as, cards }), [choice.as])

	const lab = useMemo<Lab | null>(
		() =>
			scene
				? { data, choice, scene, shelfTitles, setShelfTitles: setShelf, playIntro, Room }
				: null,
		[data, choice, scene, shelfTitles, setShelf, playIntro],
	)

	const sections: BarSection[] = SECTIONS.map((s) => ({
		id: s.id,
		name: s.name,
		variants:
			s.id === "scene"
				? data.scenes.map((p) => ({ key: p.id, name: `${p.landscape.title} · ${p.landscape.style}` }))
				: (REGISTRY[s.id as keyof typeof REGISTRY] ?? []).map((v) => ({ key: v.key, name: v.name })),
	}))

	if (!lab) return <p className="p-8 text-white">No scenes in public/prototype-start-lab/scenes.</p>
	const Layout = layout.C
	const Member = member.C
	const Theater = tv.Theater
	// A new variant starts fresh: its key changes with every choice that shapes it.
	const pageKey = [choice.as, layout.key, hero.key, recs.key, how.key, browse.key, member.key].join(".")
	return (
		<LabContext.Provider value={lab}>
			<RoomParts.Provider value={{ shelf, tv }}>
				<div className="min-h-screen bg-gray-950 text-white" key={pageKey}>
					{choice.as === "guest" ? (
						<Layout Hero={hero.C} Recs={recs.C} How={how.C} Browse={browse.C} />
					) : data.member ? (
						<Member />
					) : (
						<p className="p-8">No member.json in {data.fixtures}.</p>
					)}
				</div>
				{theater ? <Theater from={theater.from} onClose={() => setTheater(null)} /> : null}
				{/* Out of the way while the intro plays: it would cover the film's chapter bar, and its keys switch variants. */}
				{theater ? null : <LabBar choice={choice} sections={sections} />}
			</RoomParts.Provider>
		</LabContext.Provider>
	)
}
