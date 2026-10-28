// PROTOTYPE (start page lab, 2026-10-27): the composed start page for the variants in the URL, plus the lab bar.
import { useSearchParams } from "@remix-run/react"
import { useCallback, useMemo, useState } from "react"
import { LabBar, type BarSection } from "./LabBar"
import { Room, RoomParts } from "./Room"
import { DEFAULTS, SECTIONS, type SectionId, choiceFromParams } from "./choice"
import { PERSONAS, personaFor } from "./personas"
import { REGISTRY, pick } from "./registry"
import { type IntroFrom, type Lab, type LabCard, LabContext, type LabData } from "./types"

// Round 12: the bar offers only what is still open; decided sections stay at DEFAULTS.
const ROUND2_SCENES = (id: string) => id === "nook-r9-bay-sofa-a" || id === "nook-r11-d" || id.startsWith("nook-r12-") || id.startsWith("nook-r15-")

export function LabPage({ data: loaded }: { data: LabData }) {
	const [params] = useSearchParams()
	const choice = useMemo(() => choiceFromParams(params), [params])
	// Round 4: the member's data as the chosen persona has it (lab/personas.ts).
	const persona = personaFor(choice.round === 2 ? choice.persona : undefined)
	const data = useMemo<LabData>(
		() => (loaded.member ? { ...loaded, member: persona.make(loaded.member) } : loaded),
		[loaded, persona],
	)
	const reg = REGISTRY[choice.round]
	const def = DEFAULTS[choice.round]
	const want = (id: SectionId) => choice[id] ?? def[id]
	const scene = data.scenes.find((s) => s.id === want("scene")) ?? data.scenes[0]
	// The intro hint needs a TV: the chosen scene's own, or its room's TV corner (nook-stage → nook-illustrated).
	const tvScene =
		scene && !scene.landscape.tv
			? // Round 3: the room's own TV corner, painted from the other side so it doesn't repeat the stage.
				(data.scenes.find((s) => s.landscape.tv && s.id === `${scene.id.split("-")[0]}-tv-corner`) ??
				data.scenes.find((s) => s.landscape.tv && s.id === scene.id.replace(/-stage(-tv)?$/, "-illustrated")) ??
				data.scenes.find((s) => s.landscape.tv && s.id.startsWith(scene.id.split("-")[0])) ??
				data.scenes.find((s) => s.landscape.tv) ??
				scene)
			: scene
	const shelf = pick(reg.shelf, want("shelf"))
	const tv = pick(reg.tv, want("tv"))
	const layout = pick(reg.layout, want("layout"))
	const stage = pick(reg.stage, want("stage"))
	const hero = pick(reg.hero, want("hero"))
	const recs = pick(reg.recs, want("recs"))
	const how = pick(reg.how, want("how"))
	const browse = pick(reg.browse, want("browse"))
	const member = pick(reg.member, want("member"))

	const defaultShelf = choice.as === "member" ? (data.member?.forYou ?? []) : data.guest.popular
	const [shelfOverride, setShelfTitles] = useState<{ as: string; cards: LabCard[] } | null>(null)
	const shelfTitles = shelfOverride?.as === choice.as ? shelfOverride.cards : defaultShelf
	const [theater, setTheater] = useState<{ from: IntroFrom | null } | null>(null)
	const playIntro = useCallback((from: IntroFrom | null) => setTheater({ from }), [])
	const setShelf = useCallback((cards: LabCard[]) => setShelfTitles({ as: choice.as, cards }), [choice.as])

	const lab = useMemo<Lab | null>(
		() =>
			scene
				? { data, choice, scene, tvScene: tvScene ?? scene, round: choice.round, shelfTitles, setShelfTitles: setShelf, playIntro, Room }
				: null,
		[data, choice, scene, tvScene, shelfTitles, setShelf, playIntro],
	)

	const chosen: Partial<Record<SectionId, string>> = {
		scene: scene?.id,
		shelf: shelf.key,
		tv: tv.key,
		layout: layout.key,
		stage: stage.key,
		hero: hero.key,
		recs: recs.key,
		how: how.key,
		browse: browse.key,
		member: member.key,
		persona: persona.key,
		searchbar: pick(reg.searchbar, want("searchbar")).key,
		light: pick(reg.light, want("light")).key,
	}
	const sections: BarSection[] = SECTIONS.map((s) => ({
		id: s.id,
		name: s.name,
		current: chosen[s.id] ?? "",
		variants:
			s.id === "scene"
				? data.scenes.filter((p) => choice.round === 1 || ROUND2_SCENES(p.id)).map((p) => ({ key: p.id, name: `${p.landscape.title} · ${p.landscape.style}` }))
				: s.id === "persona"
					? PERSONAS.map((p) => ({ key: p.key, name: p.name }))
				: ((reg as Record<string, readonly { key: string; name: string }[]>)[s.id] ?? [])
						.filter((v) => choice.round === 1 || s.id !== "shelf" || v.key >= "f")
						// PROTOTYPE · Round 15: round 2 offers stage j and the two mood pickers (l, m) only.
						.filter((v) => choice.round === 1 || s.id !== "stage" || ["j", "l", "m"].includes(v.key))
						.map((v) => ({ key: v.key, name: v.name })),
	}))

	if (!lab) return <p className="p-8 text-white">No scenes in public/prototype-start-lab/scenes.</p>
	const Layout = layout.C
	const Stage = stage.C
	const How = how.C
	const Browse = browse.C
	const Member = member.C
	const Theater = tv.Theater
	// A new variant starts fresh: its key changes with every choice that shapes it.
	const pageKey = [choice.round, choice.as, persona.key, layout.key, stage.key, hero.key, recs.key, how.key, browse.key, member.key].join(".")
	return (
		<LabContext.Provider value={lab}>
			<RoomParts.Provider value={{ shelf, tv }}>
				<div className="min-h-screen bg-gray-950 text-white" key={pageKey}>
					{choice.as === "guest" && choice.round === 2 ? (
						// Round 2: the stage owns the first screen; How it works (with the TV) and browse follow.
						<div className="pb-24">
							<Stage />
							<How />
							<Browse />
						</div>
					) : choice.as === "guest" ? (
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
