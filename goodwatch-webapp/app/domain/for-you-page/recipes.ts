import { type FamilyId, type ForYouTaste, familyOf } from "./contract"
import { FLAT, type Levels, type Recipe, shapeOf } from "./shape"
// Source of truth: ~/ui/profile/taste/model FAMILY_COLOR; kept here to avoid server UI imports.
const FAMILY_COLOR: Record<FamilyId, string> = {
	feel: "#fb7185",
	humor: "#facc15",
	world: "#38bdf8",
	story: "#a78bfa",
	craft: "#34d399",
}
export const MIN_FIT = 15

export const LIBRARY: Recipe[] = [
	{
		// Feel-good rule: wholesome and hopeful high, bleakness low.
		id: "cozy",
		name: "Cozy night in",
		sub: "Warm, gentle, never grim",
		word: "cozy",
		lean: "feelgood",
		hue: "#fb923c",
		tone: "lighter",
		shape: shapeOf({ feel: 2, humor: 1 }),

		attrs: {
			wholesome: 1,
			hopefulness: 0.9,
			nostalgia: 0.4,
			wonder: 0.3,
			bleakness: -0.8,
			violence: -0.6,
			scare: -0.6,
			tension: -0.4,
		},
	},
	{
		// Funny rule: any humor score high, bleakness low.
		id: "laugh",
		name: "Make me laugh",
		sub: "Comedy first",
		word: "funny",
		lean: "funny",
		hue: "#facc15",
		tone: "lighter",
		shape: shapeOf({ humor: 2 }),

		attrs: {
			situational_comedy: 0.7,
			wit_wordplay: 0.7,
			absurdist_humor: 0.8,
			satire_parody: 0.6,
			physical_comedy: 0.5,
			bleakness: -0.6,
		},
	},
	{
		// Mind-bending rule: surrealism, or complexity with philosophy or a non-linear story.
		id: "mind",
		name: "Bend my mind",
		sub: "Surreal and layered",
		word: "mind-bending",
		lean: "mind",
		hue: "#c084fc",
		tone: "stranger",
		shape: shapeOf({ story: 2, craft: 1 }),

		attrs: {
			surrealism: 1,
			complexity: 0.8,
			philosophical: 0.8,
			non_linear_narrative: 0.7,
			ambiguity: 0.5,
			meta_narrative: 0.4,
		},
	},
	{
		// Crime & mystery rule plus tension and pace.
		id: "seat",
		name: "Edge of my seat",
		sub: "Tense and twisty",
		word: "gripping",
		lean: "crime",
		hue: "#60a5fa",
		tone: "tenser",
		shape: shapeOf({ feel: 2, story: 1 }),

		attrs: {
			tension: 1,
			intrigue: 0.8,
			mystery: 0.6,
			fast_pace: 0.6,
			adrenaline: 0.5,
			slow_burn: -0.5,
		},
	},
	{
		// The Stylized style plus the craft scores.
		id: "beautiful",
		name: "Something beautiful",
		sub: "Gorgeous to look at",
		word: "beautiful",
		hue: "#2dd4bf",
		shape: shapeOf({ craft: 2, feel: 1 }),

		attrs: {
			cinematography: 1,
			visual_stylization: 0.8,
			wonder: 0.7,
			music_composition: 0.5,
			direction: 0.5,
			catharsis: 0.3,
		},
	},
	{
		// Action rule: adrenaline and spectacle high.
		id: "big",
		name: "Go big",
		sub: "Spectacle, adrenaline",
		word: "big",
		lean: "action",
		hue: "#ef4444",
		tone: "louder",
		shape: shapeOf({ feel: 2, craft: 1, world: 1 }),

		attrs: {
			spectacle: 1,
			adrenaline: 0.9,
			world_immersion: 0.7,
			futuristic: 0.3,
			fantasy: 0.3,
			slow_burn: -0.6,
		},
	},
	{
		// Heavy rule: pathos or melancholy high.
		id: "cry",
		name: "A good cry",
		sub: "Moving, cathartic",
		word: "moving",
		lean: "heavy",
		hue: "#94a3b8",
		tone: "heavier",
		shape: shapeOf({ feel: 2, story: 1, humor: -1 }),

		attrs: {
			pathos: 1,
			catharsis: 0.8,
			melancholy: 0.6,
			character_depth: 0.6,
			acting: 0.4,
			situational_comedy: -0.4,
		},
	},
	{
		// Mystery theme: mystery 8 or more; intrigue and a well-built plot.
		id: "whodunit",
		name: "A proper whodunit",
		sub: "Clues, suspects, a reveal",
		word: "puzzling",
		lean: "crime",
		hue: "#5b7fa8",
		shape: shapeOf({ world: 1, story: 2 }),

		attrs: {
			mystery: 1,
			intrigue: 0.8,
			crime: 0.5,
			complexity: 0.5,
			narrative_structure: 0.4,
		},
	},
	{
		// Scary rule: scare 7 or more; uncanny and tension help.
		id: "chills",
		name: "Give me chills",
		sub: "Scary and uncanny",
		word: "chilling",
		lean: "scary",
		hue: "#a3e635",
		tone: "darker",
		shape: shapeOf({ feel: 2, craft: 1 }),

		attrs: {
			scare: 1,
			uncanny: 0.8,
			tension: 0.6,
			sound_centrality: 0.3,
			grotesque: 0.2,
			wholesome: -0.5,
		},
	},
	{
		// Romance rule: romance 7 or more.
		id: "love",
		name: "Fall in love",
		sub: "Romance with heart",
		word: "romantic",
		lean: "romance",
		hue: "#f472b6",
		tone: "softer",
		shape: shapeOf({ feel: 2, story: 1, world: -1 }),

		attrs: {
			romance: 1,
			wholesome: 0.4,
			hopefulness: 0.4,
			character_depth: 0.4,
			eroticism: 0.2,
			bleakness: -0.3,
		},
	},
	{
		// Other worlds rule: fantasy or futuristic 7 or more; immersion makes it a place.
		id: "elsewhere",
		name: "Somewhere else",
		sub: "Other worlds, wonder",
		word: "otherworldly",
		lean: "worlds",
		hue: "#d4508a",
		shape: shapeOf({ world: 2, craft: 1, feel: 1 }),

		attrs: {
			fantasy: 0.9,
			world_immersion: 0.8,
			wonder: 0.6,
			futuristic: 0.5,
			contemporary_realism: -0.5,
		},
	},
	{
		// Future theme: futuristic or technology 7 or more; with ideas.
		id: "future",
		name: "Tomorrow's problems",
		sub: "Sci-fi with ideas",
		word: "sci-fi",
		lean: "worlds",
		hue: "#3fc1b0",
		shape: shapeOf({ world: 2, story: 1 }),

		attrs: {
			futuristic: 1,
			technology_and_humanity: 0.9,
			philosophical: 0.5,
			social_commentary: 0.3,
		},
	},
	{
		// History rule: biographical 6 or more, or historical 8 or more.
		id: "history",
		name: "Back in time",
		sub: "History, true stories",
		word: "historical",
		lean: "history",
		hue: "#d4a373",
		shape: shapeOf({ world: 2, craft: 1, humor: -1 }),

		attrs: {
			historical: 1,
			biographical: 0.7,
			acting: 0.4,
			warfare: 0.2,
			futuristic: -0.5,
		},
	},
	{
		// Satire plus the Politics theme.
		id: "satire",
		name: "Sharp and satirical",
		sub: "Jokes with a point",
		word: "sharp",
		lean: "funny",
		hue: "#8e62d6",
		shape: shapeOf({ humor: 2, world: 1 }),

		attrs: {
			satire_parody: 1,
			wit_wordplay: 0.8,
			social_commentary: 0.6,
			political: 0.5,
			physical_comedy: -0.3,
		},
	},
	{
		// Dark humor and Satire rules: bleak, absurd comedy.
		id: "darkjokes",
		name: "Laugh in the dark",
		sub: "Bleak and very funny",
		word: "darkly funny",
		lean: "funny",
		hue: "#7fae3a",
		tone: "darker",
		shape: shapeOf({ humor: 2, story: 1, feel: -1 }),
		attrs: {
			dark_humor: 1,
			absurdist_humor: 0.5,
			bleakness: 0.4,
			satire_parody: 0.3,
			wholesome: -0.5,
		},
	},
	{
		// Slow burn style: slow_burn 8 or more; depth carries it.
		id: "slowburn",
		name: "A slow burn",
		sub: "Patient, deep, quiet",
		word: "slow-burning",
		hue: "#64748b",
		tone: "slower",
		shape: shapeOf({ story: 2, feel: -1 }),

		attrs: {
			slow_burn: 1,
			character_depth: 0.8,
			ambiguity: 0.5,
			acting: 0.5,
			adrenaline: -0.6,
			fast_pace: -0.6,
		},
	},
	{
		// Fast-paced style plus the action rule's adrenaline.
		id: "rush",
		name: "Pure adrenaline",
		sub: "Fast, loud, no breaks",
		word: "fast",
		lean: "action",
		hue: "#c2413a",
		tone: "faster",
		shape: shapeOf({ feel: 2, story: 1, craft: 1 }),

		attrs: {
			fast_pace: 1,
			adrenaline: 1,
			editing: 0.5,
			violence: 0.4,
			slow_burn: -0.8,
		},
	},
	{
		// Mind-bending rule with absurd humor, eccentricity and novelty.
		id: "weird",
		name: "Weird and wonderful",
		sub: "Odd, playful, original",
		word: "weird",
		hue: "#e38fb8",
		tone: "odder",
		shape: shapeOf({ story: 2, humor: 1, craft: 1 }),
		attrs: {
			eccentricity: 1,
			novelty: 0.8,
			absurdist_humor: 0.6,
			surrealism: 0.5,
			pastiche: 0.3,
		},
	},
	{
		// Coming of age rule: coming_of_age 8 or more.
		id: "growing",
		name: "Growing up",
		sub: "Coming of age",
		word: "coming-of-age",
		lean: "growing",
		hue: "#f5d0fe",
		tone: "softer",
		shape: shapeOf({ world: 2, feel: 1 }),

		attrs: {
			coming_of_age: 1,
			nostalgia: 0.6,
			character_depth: 0.5,
			family_dynamics: 0.4,
			hopefulness: 0.3,
		},
	},
	{
		// Talky style: dialogue_centrality 8 or more; and the dialogue is good.
		id: "talky",
		name: "Great conversations",
		sub: "Dialogue to lean in for",
		word: "talky",
		hue: "#b98a5a",
		tone: "quieter",
		shape: shapeOf({ story: 2, craft: 1, feel: -1 }),

		attrs: {
			dialogue_quality: 1,
			dialogue_centrality: 0.8,
			character_depth: 0.6,
			wit_wordplay: 0.4,
			spectacle: -0.5,
		},
	},
	{
		// Music style: music_centrality 7 or more.
		id: "music",
		name: "Turn it up",
		sub: "Music at the heart",
		word: "musical",
		hue: "#e2cf55",
		shape: shapeOf({ craft: 2, feel: 1, humor: 1 }),

		attrs: {
			music_centrality: 1,
			music_composition: 0.8,
			sound_centrality: 0.6,
			catharsis: 0.3,
		},
	},
	{
		// Feel-good rule and Slow burn style: warmth with low tension and violence.
		id: "gentle",
		name: "Quiet and gentle",
		sub: "Soft, slow, kind",
		word: "gentle",
		hue: "#7cc4e8",
		tone: "quieter",
		shape: shapeOf({ feel: -1, craft: 1 }),
		attrs: {
			wholesome: 0.6,
			wonder: 0.5,
			slow_burn: 0.5,
			cinematography: 0.4,
			adrenaline: -0.8,
			violence: -0.8,
			tension: -0.6,
		},
	},
	{
		// Funny and Feel-good rules with low complexity.
		id: "easy",
		name: "Easy watching",
		sub: "Light, fun, no homework",
		word: "easy",
		hue: "#fde047",
		tone: "lighter",
		shape: shapeOf({ humor: 1, feel: 1, story: -1 }),
		attrs: {
			rewatchability: 1,
			situational_comedy: 0.6,
			hopefulness: 0.5,
			complexity: -0.7,
			bleakness: -0.6,
			philosophical: -0.4,
		},
	},
	{
		// Other worlds rule reversed: realism over fantasy, with character depth.
		id: "real",
		name: "Real life",
		sub: "Grounded, human, now",
		word: "grounded",
		hue: "#9aa3ad",
		tone: "grounded",
		shape: shapeOf({ world: 2, story: 1, craft: -1 }),
		attrs: {
			contemporary_realism: 1,
			character_depth: 0.7,
			social_commentary: 0.5,
			family_dynamics: 0.4,
			fantasy: -0.6,
			spectacle: -0.5,
		},
	},
]

const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1)

export function ownRecipes(sides: ForYouTaste["groups"]): Recipe[] {
	return [...sides]
		.sort((a, b) => b.count - a.count)
		.map((s) => {
			const count: Partial<Record<FamilyId, number>> = {}
			for (const k of s.keys) {
				const f = familyOf(k)
				if (f) count[f] = (count[f] ?? 0) + 1
			}
			const top = Math.max(...Object.values(count), 0)
			const shape: Levels = { ...FLAT }
			for (const [f, n] of Object.entries(count) as [FamilyId, number][])
				shape[f] = n === top ? 2 : 1
			return {
				id: s.id,
				name: s.name,
				sub: "From your taste",
				word: lowerFirst(s.name).replace(/\s+\S+$/, ""),
				hue: FAMILY_COLOR[familyOf(s.keys[0]) ?? "feel"],
				yours: true,
				shape,
				attrs: Object.fromEntries(
					s.keys.map((k, i) => [k, i === 0 ? 0.95 : 0.8]),
				),
			}
		})
}
