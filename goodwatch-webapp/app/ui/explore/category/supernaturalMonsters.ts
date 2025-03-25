import type { PageData } from "~/ui/explore/config"

export const supernaturalMonsters: Record<string, PageData> = {
	zombie: {
		type: "all",
		label: "Zombie",
		path: "zombie",
		subtitle: "Undead Rising",
		description:
			"Brain-hungry hordes and last-human-outpost standoffs. Whether it's viral outbreaks or ancient curses, survival means shooting first and asking questions never.",
		backdrop_path: "oOZtWMhJft0QvPcnJXFgGlt0Jn7.jpg",
		discoverParams: {
			similarDNA:
				"36379464_Plot|Zombie+Outbreak,36406707_Plot|Battle+Against+Zombies,36444256_Place|Zombie-Infested+Areas,36375238_Sub-Genres|Zombie+Horror,36565868_Sub-Genres|Zombie+Thriller,36459602_Sub-Genres|Zombie+Apocalypse,36671062_Sub-Genres|Zombie+Drama,36380728_Plot|Zombie+Apocalypse",
			similarDNACombinationType: "any",
		},
		faq: [
			{
				q: "What makes zombie stories unique?",
				a: "They combine primal survival instincts with social commentary. The real monster is often what survivors do to each other when society collapses.",
			},
		],
	},
	vampire: {
		type: "all",
		label: "Vampire",
		path: "vampire",
		subtitle: "Immortal Temptations",
		description:
			"Bloodlust battles, centuries-old romances, and sunlight allergies that never get easier. Where eternal life comes with eternal problems.",
		backdrop_path: "j9E1pGqx2ZYnyGQYMB1JYtUxJ6u.jpg",
		discoverParams: {
			similarDNA:
				"36376181_Sub-Genres|Vampire+Film,36380684_Key+Props|Vampire+Fangs,36401520_Character+Types|Vampire,36386463_Plot|Vampire+Hunting,36374853_Plot|Vampire+Attacks",
			similarDNACombinationType: "any",
		},
		faq: [
			{
				q: "Why do vampire stories endure?",
				a: "They're the ultimate metaphor for forbidden desires and the price of power. Eternal youth always comes with sharp teeth.",
			},
		],
	},
	shark: {
		type: "all",
		label: "Shark",
		path: "shark",
		subtitle: "Jaws of Terror",
		description:
			"Dorsal fin sightings, chummed waters, and beaches that transform into feeding grounds. Nature's perfect predator meets human hubris.",
		backdrop_path: "xgU3KkqiME9pGe5gGCNpUYkoSWg.jpg",
		discoverParams: {
			similarDNA:
				"36378082_Key+Props|Shark+Cage,36388853_Plot|Shark+Attacks,36411279_Key+Props|Shark+Repellent,36454082_Key+Props|Shark+Fin",
			similarDNACombinationType: "any",
		},
		faq: [
			{
				q: "Why do shark stories captivate?",
				a: "They tap into primal fear of the unknown beneath us. The ocean becomes a character - beautiful, deadly, and utterly indifferent.",
			},
		],
	},
	monster: {
		type: "all",
		label: "Monster",
		path: "monster",
		subtitle: "Creature Features",
		description:
			"Ancient beasts, genetic experiments, and things that go chomp in the night. Sometimes the monster outside mirrors the one within.",
		backdrop_path: "oSJV6nAfHzyE9v6oEAXmDjbko00.jpg",
		discoverParams: {
			similarDNA:
				"309813_Plot|Monster+Attacks,36374861_Sub-Genres|Monster+Movie,36382887_Character+Types|Monster,36378229_Plot|Battle+Against+Monsters",
			similarDNACombinationType: "any",
		},
		faq: [
			{
				q: "What defines monster storytelling?",
				a: "They externalize our deepest fears. The creature is often less terrifying than the human flaws that unleash it.",
			},
		],
	},
	slasher: {
		type: "all",
		label: "Slasher",
		path: "slasher",
		subtitle: "Teen Screams",
		description:
			"Masked killers, reckless teenagers, and horror movie rules that everyone knows but nobody follows. Don't split up, don't say 'I'll be right back.'",
		backdrop_path: "1AjHJ0NP7BTI4zOVvmrmTXwGwvv.jpg",
		discoverParams: {
			similarDNA: "36376767_Sub-Genres|Slasher",
			similarDNACombinationType: "any",
		},
		faq: [
			{
				q: "What makes slasher stories endure?",
				a: "They combine primal fears with moral fables. Beneath the gore lies commentary on youth, innocence, and consequence.",
			},
		],
	},
	werewolf: {
		type: "all",
		label: "Werewolf",
		path: "werewolf",
		subtitle: "Lunar Curse",
		description:
			"Full moon transformations, primal urges, and the thin line between man and beast. When the wolf within breaks free, civilization bleeds.",
		backdrop_path: "psJX2MNGqngThU1fL7ECmbPxbYP.jpg",
		discoverParams: {
			similarDNA:
				"36376182_Sub-Genres|Werewolf+Film,36387742_Plot|Werewolf+Transformation,36422468_Character+Types|Werewolf",
			similarDNACombinationType: "any",
		},
		faq: [
			{
				q: "What defines werewolf narratives?",
				a: "The exploration of humanity's animal nature. These stories ask what separates man from beast when the moon is full.",
			},
		],
	},
	ghost: {
		type: "all",
		label: "Ghost",
		path: "ghost",
		subtitle: "Spectral Tales",
		description:
			"Haunted houses, unfinished business, and spirits who won't rest until their stories are told. Death is just the beginning.",
		backdrop_path: "yt2WimJVx0fmRh3ty2ral4UcYNj.jpg",
		discoverParams: {
			similarDNA:
				"36375965_Sub-Genres|Ghost+Story,36375966_Character+Types|Ghost,36375966_Plot|Ghost+Hunting",
			similarDNACombinationType: "any",
		},
		faq: [
			{
				q: "What makes ghost stories effective?",
				a: "They tap into universal fears of death while exploring grief, regret, and the things left unsaid. The best hauntings are deeply personal.",
			},
		],
	},
}
