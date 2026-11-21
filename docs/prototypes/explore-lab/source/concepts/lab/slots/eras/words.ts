// PROTOTYPE - throwaway (prototype/explore-r5). What a decade can be obsessed with: the fingerprint attributes that
// say what titles are about, each under the noun a person would use ("war", not "warfare 6.2"). Pure: loader and
// browser. The order is the fingerprint's.
export interface ObsessionWord {
	/** The fingerprint key. */
	key: string
	/** The noun, lowercase: "the future". */
	noun: string
	/** After "couldn't stop making movies about ...": mostly the noun itself. */
	about?: string
}

export const OBSESSIONS: ObsessionWord[] = [
	{ key: "adrenaline", noun: "thrills" },
	{ key: "tension", noun: "suspense" },
	{ key: "scare", noun: "fear" },
	{ key: "violence", noun: "violence" },
	{ key: "romance", noun: "romance" },
	{ key: "eroticism", noun: "desire" },
	{ key: "wholesome", noun: "kindness" },
	{ key: "wonder", noun: "wonder" },
	{ key: "melancholy", noun: "longing" },
	{ key: "uncanny", noun: "the uncanny" },
	{ key: "nostalgia", noun: "nostalgia" },
	{ key: "wit_wordplay", noun: "wit" },
	{ key: "physical_comedy", noun: "slapstick" },
	{ key: "cringe_humor", noun: "awkwardness" },
	{ key: "absurdist_humor", noun: "the absurd" },
	{ key: "satire_parody", noun: "satire" },
	{ key: "dark_humor", noun: "gallows humor" },
	{ key: "fantasy", noun: "magic" },
	{ key: "futuristic", noun: "the future" },
	{ key: "historical", noun: "the past" },
	{ key: "contemporary_realism", noun: "real life" },
	{ key: "crime", noun: "crime" },
	{ key: "mystery", noun: "mysteries" },
	{ key: "warfare", noun: "war" },
	{ key: "political", noun: "politics" },
	{ key: "sports", noun: "sport" },
	{ key: "biographical", noun: "true lives" },
	{ key: "coming_of_age", noun: "growing up" },
	{ key: "family_dynamics", noun: "family" },
	{ key: "psychological", noun: "the mind" },
	{ key: "showbiz", noun: "show business" },
	{ key: "gaming", noun: "games" },
	{ key: "pop_culture", noun: "pop culture" },
	{ key: "social_commentary", noun: "society" },
	{ key: "class_and_capitalism", noun: "money and class" },
	{ key: "technology_and_humanity", noun: "machines" },
	{ key: "spiritual", noun: "faith" },
	{ key: "hopefulness", noun: "hope" },
	{ key: "bleakness", noun: "despair" },
	{ key: "ambiguity", noun: "doubt" },
	{ key: "surrealism", noun: "dreams" },
	{ key: "eccentricity", noun: "oddballs" },
	{ key: "philosophical", noun: "big questions" },
	{ key: "spectacle", noun: "spectacle" },
	{ key: "visual_stylization", noun: "style" },
	{ key: "psychedelic", noun: "trips" },
	{ key: "grotesque", noun: "the grotesque" },
	{ key: "camp_and_irony", noun: "camp" },
	{ key: "music_centrality", noun: "music" },
]
