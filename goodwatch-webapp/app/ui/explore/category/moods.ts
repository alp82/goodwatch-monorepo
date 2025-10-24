import type { PageData } from "~/ui/explore/config"

export const moods: Record<string, PageData> = {
	scary: {
		type: "all",
		label: "Scary 👻",
		path: "scary",
		subtitle: "Chills Down Your Spine",
		description:
			"Heart-pounding moments that'll make you check the locks twice. From jump scares that hit like espresso shots to lingering dread that sticks around like uninvited guests.",
		backdrop_path: "qtWjZgCmslPwjP4DFUcLBUj13GV.jpg",
		discoverParams: {
			fingerprintConditions: JSON.stringify([
				{
					logic: "AND",
					conditions: [
						{ field: "scare", operator: ">=", value: 8 },
						{
							logic: "OR",
							conditions: [
								{ field: "tension", operator: ">=", value: 7 },
								{ field: "psychological", operator: ">=", value: 6 },
								{ field: "uncanny", operator: ">=", value: 6 },
							],
						},
					],
				},
			]),
		},
		faq: [
			{
				q: "What makes something 'scary' versus regular horror?",
				a: "We focus on content where tension never lets up - stories that get under your skin through atmosphere and anticipation, not just gore. Think creeping dread rather than shock value.",
			},
			{
				q: "Are there different types of scares?",
				a: "Absolutely! Some stories build fear through unknown threats, others through psychological manipulation. We include everything from paranormal chills to real-world terrors.",
			},
		],
	},
	"feel-good": {
		type: "all",
		label: "Feel Good ❤",
		path: "feel-good",
		subtitle: "Warmth and Smiles",
		description:
			"Stories that hug your soul. Expect underdog victories, friendship goals, and happy endings so sweet they should come with a dentist warning.",
		backdrop_path: "i9zpVfvLYJpoenHkklveIR07Em5.jpg",
		discoverParams: {
			fingerprintConditions: JSON.stringify([
				{
					logic: "AND",
					conditions: [
						{ field: "hopefulness", operator: ">=", value: 8 },
						{ field: "wholesome", operator: ">=", value: 7 },
						{ field: "catharsis", operator: ">=", value: 5 },
						{ field: "bleakness", operator: "<=", value: 4 },
					],
				},
			]),
			suitabilityFilters: "suitability_family,suitability_teens",
			contextFilters: "context_is_pure_escapism,context_is_comfort_watch",
		},
		faq: [
			{
				q: "What defines a feel-good story?",
				a: "Core themes of hope and human connection. These are tales where kindness wins, personal growth happens, and the world feels a little brighter by the end.",
			},
			{
				q: "Do these avoid all conflict?",
				a: "Not at all! The best feel-good stories earn their warmth by overcoming real challenges - they just focus on resilience rather than cynicism.",
			},
		],
	},
	suspense: {
		type: "all",
		label: "Suspense ⏳",
		path: "suspense",
		subtitle: "Nerve-Tingling Tension",
		description:
			"Clock's ticking, traps are set, and every shadow could change everything. These stories grab you by the collar and don't let go.",
		backdrop_path: "kZGaVeXSkkvrpMYvD97sxHj291k.jpg",
		discoverParams: {
			fingerprintConditions: JSON.stringify([
				{
					logic: "AND",
					conditions: [
						{
							logic: "OR",
							conditions: [
								{ field: "tension", operator: ">=", value: 8 },
								{ field: "intrigue", operator: ">=", value: 8 },
							],
						},
						{ field: "scare", operator: "<=", value: 7 },
					],
				},
			]),
		},
		faq: [
			{
				q: "How is suspense different from action?",
				a: "It's all about the buildup - suspense makes you lean forward wondering what's next, while action delivers constant payoffs. The best stories balance both.",
			},
			{
				q: "What creates good suspense?",
				a: "High stakes with personal consequences. Whether it's a bomb defusal or a family secret, you need to truly care about what happens next.",
			},
		],
	},
	motivational: {
		type: "all",
		label: "Motivational 💪",
		path: "motivational",
		subtitle: "Rise to the Challenge",
		description:
			"Against-all-odds victories, personal bests smashed, and heroes who redefine 'possible'. Warning: May inspire sudden life changes.",
		backdrop_path: "8OGGM7clS3CN4n2pTEZs6tRll4n.jpg",
		discoverParams: {
			fingerprintConditions: JSON.stringify([
				{
					logic: "AND",
					conditions: [
						{ field: "catharsis", operator: ">=", value: 8 },
						{ field: "hopefulness", operator: ">=", value: 7 },
						{ field: "biographical", operator: ">=", value: 5 },
						{
							logic: "OR",
							conditions: [
								{ field: "character_depth", operator: ">=", value: 5 },
								{ field: "pathos", operator: ">=", value: 5 },
								{ field: "sports", operator: ">=", value: 5 },
							],
						},
					],
				},
			]),
		},
		faq: [
			{
				q: "What makes a story truly motivational?",
				a: "Authentic struggles rather than easy wins. We highlight stories where effort and perseverance matter more than natural talent or luck.",
			},
			{
				q: "Are these all sports stories?",
				a: "Not at all! While we include athletic triumphs, we also feature artistic breakthroughs, scientific discoveries, and everyday people doing extraordinary things.",
			},
		],
	},
	funny: {
		type: "all",
		label: "Funny 😂",
		path: "funny",
		subtitle: "Laughter Guaranteed",
		description:
			"From dad joke disasters to sarcastic comebacks that deserve applause. These aren't just jokes - they're survival skills for life's awkwardest moments.",
		backdrop_path: "8tZ90NxuoXjkHXELFOcnZDRr63G.jpg",
		discoverParams: {
			fingerprintConditions: JSON.stringify([
				{
					logic: "AND",
					conditions: [
						{
							logic: "OR",
							conditions: [
								{ field: "situational_comedy", operator: ">=", value: 7 },
								{ field: "physical_comedy", operator: ">=", value: 7 },
								{ field: "cringe_humor", operator: ">=", value: 7 },
								{ field: "absurdist_humor", operator: ">=", value: 7 },
								{ field: "dark_humor", operator: ">=", value: 7 },
							],
						},
						{ field: "bleakness", operator: "<=", value: 5 },
						{ field: "violence", operator: "<=", value: 5 },
					],
				},
			]),
		},
		faq: [
			{
				q: "What makes humor universal?",
				a: "It's all about timing and relatability. We curate stories where comedy arises from authentic human experiences - the messier, the better.",
			},
			{
				q: "How do you handle different humor styles?",
				a: "From witty banter to physical comedy, our picks celebrate diverse approaches. The common thread? Laughter that feels earned rather than forced.",
			},
		],
	},
	psychological: {
		type: "all",
		label: "Psychological 🧠",
		path: "psychological",
		subtitle: "Mind Over Matter",
		description:
			"Reality-bending narratives, unreliable narrators, and twists that'll leave you questioning everything. Consider this a workout for your brain.",
		backdrop_path: "p1PLSI5Nw2krGxD7X4ulul1tDAk.jpg",
		discoverParams: {
			fingerprintConditions: JSON.stringify([
				{
					logic: "AND",
					conditions: [
						{ field: "psychological", operator: ">=", value: 8 },
						{ field: "complexity", operator: ">=", value: 7 },
						{
							logic: "OR",
							conditions: [
								{ field: "ambiguity", operator: ">=", value: 6 },
								{ field: "philosophical", operator: ">=", value: 6 },
								{ field: "narrative_structure", operator: ">=", value: 7 },
							],
						},
					],
				},
			]),
			contextFilters: "context_is_thought_provoking",
		},
		faq: [
			{
				q: "What defines psychological storytelling?",
				a: "Focus on internal rather than external conflicts. These stories explore how characters perceive reality, often blurring lines between truth and delusion.",
			},
			{
				q: "Are these stories always dark?",
				a: "While many explore complex themes, some use psychological elements for clever puzzles or fascinating character studies. The mind itself is the main antagonist.",
			},
		],
	},
	nostalgic: {
		type: "all",
		label: "Nostalgic 🎞",
		path: "nostalgic",
		subtitle: "Remembering the Good Times",
		description:
			"Films that transport you back with warm memories and a reflective vibe.",
		backdrop_path: "rhy8pbeNdfUGX5DkR0Zv1zswP2d.jpg",
		discoverParams: {
			fingerprintConditions: JSON.stringify([
				{
					logic: "AND",
					conditions: [
						{ field: "nostalgia", operator: ">=", value: 8 },
						{ field: "rewatchability", operator: ">=", value: 7 },
						{
							logic: "OR",
							conditions: [
								{ field: "historical", operator: ">=", value: 6 },
								{ field: "coming_of_age", operator: ">=", value: 6 },
								{ field: "family_dynamics", operator: ">=", value: 6 },
								{ field: "scare", operator: "<=", value: 6 },
							],
						},
					],
				},
			]),
			maxYear: "2015",
		},
		faq: [
			{
				q: "What makes a movie nostalgic?",
				a: "It evokes the past with warmth and a hint of longing.",
			},
		],
	},
	melancholic: {
		type: "all",
		label: "Melancholic 🌧",
		path: "melancholic",
		subtitle: "Somber & Reflective",
		description:
			"Films that stir deep emotions with a mix of beauty and sorrow.",
		backdrop_path: "fAuXblS0qUiQ2SWJzpvFMH1su6i.jpg",
		discoverParams: {
			fingerprintConditions: JSON.stringify([
				{
					logic: "AND",
					conditions: [
						{ field: "melancholy", operator: ">=", value: 8 },
						{ field: "pathos", operator: ">=", value: 7 },
						{
							logic: "OR",
							conditions: [
								{ field: "philosophical", operator: ">=", value: 5 },
								{ field: "character_depth", operator: ">=", value: 5 },
								{ field: "slow_burn", operator: ">=", value: 5 },
							],
						},
					],
				},
			]),
		},
		faq: [
			{
				q: "What defines a melancholic film?",
				a: "It blends sadness and beauty, inviting introspection.",
			},
		],
	},
	bittersweet: {
		type: "all",
		label: "Bittersweet 🍂",
		path: "bittersweet",
		subtitle: "Joy with a Touch of Sorrow",
		description:
			"Stories where happy moments mix with the sting of loss, echoing real life.",
		backdrop_path: "zZRXGoHo5TeUD0L1LqYIJjlPvJC.jpg",
		discoverParams: {
			fingerprintConditions: JSON.stringify([
				{
					logic: "AND",
					conditions: [
						{ field: "catharsis", operator: ">=", value: 5 },
						{ field: "melancholy", operator: ">=", value: 6 },
						{
							logic: "OR",
							conditions: [
								{ field: "romance", operator: ">=", value: 5 },
								{ field: "family_dynamics", operator: ">=", value: 6 },
								{ field: "coming_of_age", operator: ">=", value: 5 },
							],
						},
						{ field: "hopefulness", operator: ">=", value: 4 },
						{ field: "hopefulness", operator: "<=", value: 7 },
					],
				},
			]),
		},
		faq: [
			{
				q: "Why opt for bittersweet?",
				a: "It mirrors life—joy and pain often go hand in hand.",
			},
		],
	},
	whimsical: {
		type: "all",
		label: "Whimsical ✨",
		path: "whimsical",
		subtitle: "Playful & Dreamlike",
		description:
			"Lighthearted films that embrace the quirky and imaginative side of life.",
		backdrop_path: "dfQtPf0lw9C1MWYFMJseM5RZI6P.jpg",
		discoverParams: {
			fingerprintConditions: JSON.stringify([
				{
					logic: "AND",
					conditions: [
						{ field: "wonder", operator: ">=", value: 8 },
						{ field: "wholesome", operator: ">=", value: 6 },
						{ field: "bleakness", operator: "<=", value: 3 },
						{
							logic: "OR",
							conditions: [
								{ field: "eccentricity", operator: ">=", value: 7 },
								{ field: "novelty", operator: ">=", value: 7 },
							],
						},
					],
				},
			]),
			suitabilityFilters: "suitability_family",
		},
		faq: [
			{
				q: "What makes a film whimsical?",
				a: "It charms with playful twists and unexpected magic.",
			},
		],
	},
	peaceful: {
		type: "all",
		label: "Peaceful 🌿",
		path: "peaceful",
		subtitle: "Calm & Serene",
		description:
			"Films that offer a quiet, soothing escape for reflection and relaxation.",
		backdrop_path: "syfmYmITnWPJU3hhaP0ckny5hMN.jpg",
		discoverParams: {
			fingerprintConditions: JSON.stringify([
				{
					logic: "AND",
					conditions: [
						{ field: "slow_burn", operator: ">=", value: 5 },
						{ field: "tension", operator: "<=", value: 4 },
						{ field: "adrenaline", operator: "<=", value: 4 },
						{ field: "violence", operator: "<=", value: 4 },
						{
							logic: "OR",
							conditions: [
								{ field: "philosophical", operator: ">=", value: 5 },
								{ field: "wholesome", operator: ">=", value: 5 },
								{ field: "world_immersion", operator: ">=", value: 5 },
							],
						},
					],
				},
			]),
			contextFilters: "context_is_comfort_watch,context_is_background_friendly",
		},
		faq: [
			{
				q: "What defines a peaceful film?",
				a: "A calming atmosphere that helps you unwind and find balance.",
			},
		],
	},
	adrenaline: {
		type: "all",
		label: "Adrenaline 🔥",
		path: "adrenaline",
		subtitle: "High-Octane Action",
		description:
			"Pure adrenaline rush with non-stop action, explosive sequences, and heart-pounding intensity. These stories deliver immediate thrills without psychological complexity.",
		backdrop_path: "jii7rIJEwksGDA8x77VRW6YCqhC.jpg",
		discoverParams: {
			fingerprintConditions: JSON.stringify([
				{
					logic: "AND",
					conditions: [
						{ field: "fast_pace", operator: ">=", value: 9 },
						{ field: "adrenaline", operator: ">=", value: 8 },
						{ field: "psychological", operator: "<=", value: 6 },
						{ field: "scare", operator: "<=", value: 6 },
					],
				},
			]),
		},
		faq: [
			{
				q: "What defines an adrenaline-fueled story?",
				a: "High-energy action with immediate payoffs rather than slow-building tension. Think car chases, fight sequences, and explosive set pieces.",
			},
		],
	},
	epic: {
		type: "all",
		label: "Epic ⚔️",
		path: "epic",
		subtitle: "Grand Scale Heroism",
		description:
			"Sweeping tales of heroism, grand adventures, and larger-than-life conflicts. These stories operate on a massive scale with high stakes and triumphant moments.",
		backdrop_path: "xrBtWELclopNgWjBzUT8l9eYGxZ.jpg",
		discoverParams: {
			fingerprintConditions: JSON.stringify([
				{
					logic: "AND",
					conditions: [
						{ field: "cinematography", operator: ">=", value: 9 },
						{ field: "spectacle", operator: ">=", value: 8 },
						{ field: "catharsis", operator: ">=", value: 7 },
						{ field: "world_immersion", operator: ">=", value: 7 },
						{ field: "music_centrality", operator: ">=", value: 7 },
						{ field: "sound_centrality", operator: ">=", value: 7 },
						{
							logic: "OR",
							conditions: [
								{ field: "fantasy", operator: ">=", value: 6 },
								{ field: "futuristic", operator: ">=", value: 6 },
								{ field: "historical", operator: ">=", value: 6 },
							],
						},
					],
				},
			]),
		},
		faq: [
			{
				q: "What makes a story epic?",
				a: "Grand scope, heroic characters facing overwhelming odds, and conflicts that affect entire worlds or civilizations.",
			},
		],
	},
	romantic: {
		type: "all",
		label: "Romantic 💕",
		path: "romantic",
		subtitle: "Matters of the Heart",
		description:
			"Pure romantic chemistry and emotional connection. These stories focus on love, relationships, and the complexities of human attraction.",
		backdrop_path: "2zXeZgsS7Giim88TgM20qVz6qxF.jpg",
		discoverParams: {
			fingerprintConditions: JSON.stringify([
				{
					logic: "AND",
					conditions: [
						{ field: "romance", operator: ">=", value: 8 },
						{ field: "character_depth", operator: ">=", value: 6 },
						{ field: "violence", operator: "<=", value: 4 },
						{
							logic: "OR",
							conditions: [
								{ field: "dialogue_quality", operator: ">=", value: 6 },
								{ field: "dialogue_centrality", operator: ">=", value: 6 },
							],
						},
					],
				},
			]),
			suitabilityFilters: "suitability_date_night",
		},
		faq: [
			{
				q: "How is this different from bittersweet romance?",
				a: "These focus on the joy and chemistry of romance itself, rather than complex mixed emotions or tragic elements.",
			},
		],
	},
	gritty: {
		type: "all",
		label: "Gritty 🌆",
		path: "gritty",
		subtitle: "Raw Urban Reality",
		description:
			"Unflinching looks at harsh realities, social issues, and the darker side of human nature. These stories don't shy away from difficult truths.",
		backdrop_path: "hnP7J6e1SGUxrInNpXItZd9DqXg.jpg",
		discoverParams: {
			fingerprintConditions: JSON.stringify([
				{
					logic: "AND",
					conditions: [
						{ field: "contemporary_realism", operator: ">=", value: 7 },
						{ field: "bleakness", operator: ">=", value: 6 },
						{ field: "social_commentary", operator: ">=", value: 6 },
						{ field: "crime", operator: ">=", value: 5 },
						{ field: "melancholy", operator: "<=", value: 5 },
						{ field: "wholesome", operator: "<=", value: 3 },
					],
				},
			]),
			contextFilters: "context_is_thought_provoking",
		},
		faq: [
			{
				q: "What defines gritty storytelling?",
				a: "Realistic portrayals of difficult subjects without romanticizing or softening the harsh realities.",
			},
		],
	},
	"mind-bending": {
		type: "all",
		label: "Mind-Bending 🌀",
		path: "mind-bending",
		subtitle: "Reality-Defying Narratives",
		description:
			"Complex narratives that challenge perception, featuring unreliable narrators, twisted timelines, and reality-bending concepts that keep you guessing.",
		backdrop_path: "7x4J86NsOMb6o2IZ4fcW6sO4iV5.jpg",
		discoverParams: {
			fingerprintConditions: JSON.stringify([
				{
					logic: "AND",
					conditions: [
						{ field: "narrative_structure", operator: ">=", value: 9 },
						{ field: "rewatchability", operator: ">=", value: 8 },
						{ field: "philosophical", operator: ">=", value: 7 },
					],
				},
			]),
			contextFilters: "context_is_thought_provoking",
		},
		faq: [
			{
				q: "How is this different from psychological stories?",
				a: "Mind-bending focuses on narrative puzzles and reality manipulation, while psychological explores character mental states.",
			},
		],
	},
	"morally-complex": {
		type: "all",
		label: "Morally Complex ⚖️",
		path: "morally-complex",
		subtitle: "Ethical Dilemmas",
		description:
			"Stories that explore moral ambiguity, ethical dilemmas, and the gray areas between right and wrong. No easy answers, just complex human choices.",
		backdrop_path: "keblhZFIZYiWflmURWNHEuS2jqL.jpg",
		discoverParams: {
			fingerprintConditions: JSON.stringify([
				{
					logic: "AND",
					conditions: [
						{ field: "complexity", operator: ">=", value: 9 },
						{ field: "ambiguity", operator: ">=", value: 8 },
						{
							logic: "OR",
							conditions: [
								{ field: "philosophical", operator: ">=", value: 5 },
								{ field: "social_commentary", operator: ">=", value: 5 },
							],
						},
					],
				},
			]),
			contextFilters: "context_is_thought_provoking",
		},
		faq: [
			{
				q: "What makes a story morally complex?",
				a: "Characters face difficult choices where there's no clear right answer, forcing viewers to question their own moral assumptions.",
			},
		],
	},
	atmospheric: {
		type: "all",
		label: "Atmospheric 🌫️",
		path: "atmospheric",
		subtitle: "Immersive Ambiance",
		description:
			"Stories that create rich, immersive atmospheres through mood, setting, and ambiance. These films transport you into their world through pure atmosphere.",
		backdrop_path: "c5LgP6wKlyT2ld4tun0C6z3uWyV.jpg",
		discoverParams: {
			fingerprintConditions: JSON.stringify([
				{
					logic: "AND",
					conditions: [
						{ field: "world_immersion", operator: ">=", value: 8 },
						{ field: "cinematography", operator: ">=", value: 6 },
						{ field: "adrenaline", operator: "<=", value: 4 },
						{
							logic: "OR",
							conditions: [{ field: "slow_burn", operator: ">=", value: 5 }],
						},
					],
				},
			]),
		},
		faq: [
			{
				q: "What creates good atmosphere in storytelling?",
				a: "A combination of visual design, sound, pacing, and mood that creates an immersive world you can feel.",
			},
		],
	},
	"visually-stunning": {
		type: "all",
		label: "Visually Stunning 🎨",
		path: "visually-stunning",
		subtitle: "Visual Spectacle",
		description:
			"Breathtaking visual experiences that showcase the art of cinema. These stories are feasts for the eyes with stunning cinematography and visual design.",
		backdrop_path: "o869RihWTdTyBcEZBjz0izvEsVf.jpg",
		discoverParams: {
			fingerprintConditions: JSON.stringify([
				{
					logic: "AND",
					conditions: [
						{ field: "visual_stylization", operator: ">=", value: 9 },
						{ field: "spectacle", operator: ">=", value: 8 },
						{ field: "cinematography", operator: ">=", value: 7 },
					],
				},
			]),
		},
		faq: [
			{
				q: "What makes visuals truly stunning?",
				a: "Exceptional cinematography, production design, and visual effects that create memorable and beautiful imagery.",
			},
		],
	},
	educational: {
		type: "all",
		label: "Educational 📚",
		path: "educational",
		subtitle: "Learn Something New",
		description:
			"Stories that inform and educate while entertaining. These films teach you about history, science, culture, or important social issues.",
		backdrop_path: "p9G7YwAzCbeFjYe8PB1hFXUSTOn.jpg",
		discoverParams: {
			fingerprintConditions: JSON.stringify([
				{
					logic: "AND",
					conditions: [
						{ field: "educational", operator: ">=", value: 8 },
						{
							logic: "OR",
							conditions: [
								{ field: "historical", operator: ">=", value: 6 },
								{ field: "contemporary_realism", operator: ">=", value: 6 },
								{ field: "social_commentary", operator: ">=", value: 5 },
							],
						},
						{ field: "fantasy", operator: "<=", value: 4 },
					],
				},
			]),
		},
		faq: [
			{
				q: "Can educational content still be entertaining?",
				a: "Absolutely! The best educational stories make learning engaging through compelling narratives and characters.",
			},
		],
	},
}
