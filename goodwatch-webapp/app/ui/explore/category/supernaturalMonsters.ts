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
				"316449_Plot|Zombie+Outbreak,292940_Plot|Battle+Against+Zombies,317281_Place|Zombie-Infested+Areas,314948_Sub-Genres|Zombie+Comedy,4685460_Sub-Genres|Zombie+Movie,5054166_Sub-Genres|Zombie+Thriller,5054167_Sub-Genres|Zombie,6648856_Sub-Genres|Zombie+Drama,4685458_Themes|Zombie+Horror",
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
				"309816_Key+Props|Vampire+Fangs,307210_Character+Types|Vampire,304954_Plot|Vampire+Hunting,206775_Plot|Vampire+Attacks",
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
				"132233_Key+Props|Shark+Cage,159462_Plot|Shark+Attacks,146529_Key+Props|Shark+Repellent",
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
				"309813_Plot|Monster+Attacks,295891_Sub-Genres|Monster+Movie,292417_Character+Types|Monster",
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
			similarDNA: "312394_Sub-Genres|Slasher",
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
				"260938_Sub-Genres|Werewolf+Film,201122_Plot|Werewolf+Transformation,219182_Character+Types|Werewolf",
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
			similarDNA: "312970_Sub-Genres|Ghost+Story,314469_Character+Types|Ghosts",
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
