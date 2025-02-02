import type { PageData } from "~/ui/explore/config"

export const sportsCompetition: Record<string, PageData> = {
	football: {
		type: "all",
		label: "Football",
		path: "football",
		subtitle: "Gridiron Glory",
		description:
			"Hail Mary passes, bone-crunching tackles, and locker room speeches that could motivate statues. Friday night lights to Super Bowl heights.",
		backdrop_path: "w8Zc27VbwvaWPqDyCRES68TtfVV.jpg",
		discoverParams: {
			similarDNA:
				"293335_Key+Props|Football,315524_Place|Football+Field,294470_Target+Audience|Football+Fans,316664_Key+Props|Soccer+Ball,260245_Place|Soccer+Fields",
			similarDNACombinationType: "any",
		},
		faq: [
			{
				q: "What defines great football storytelling?",
				a: "The collision of individual talent and team dynamics. Every game is a war with clearly defined battle lines.",
			},
		],
	},
	baseball: {
		type: "all",
		label: "Baseball",
		path: "baseball",
		subtitle: "Diamond Dreams",
		description:
			"Crack of the bat, 7th-inning stretches, and curses that outlive generations. Where statistics meet superstition.",
		backdrop_path: "UGjqtFPoAmerCtqjvWqGzzNPnh.jpg",
		discoverParams: {
			similarDNA:
				"279520_Key+Props|Baseball+Glove,307027_Place|Baseball+Stadium,277594_Key+Props|Baseball+Equipment,287004_Key+Props|Baseball,249548_Sub-Genres|Baseball+Film",
			similarDNACombinationType: "any",
		},
		faq: [
			{
				q: "Why does baseball inspire stories?",
				a: "Its pace allows for human moments - the tension between pitches, the strategy hidden in stillness.",
			},
		],
	},
	basketball: {
		type: "all",
		label: "Basketball",
		path: "basketball",
		subtitle: "Hardwood Dreams",
		description:
			"Buzzer-beaters, playground legends, and teams that become family. Where gravity is just another rule to break.",
		backdrop_path: "fy3WUGHWoTnxZKhWics6fSFL5i0.jpg",
		discoverParams: {
			similarDNA:
				"310139_Key+Props|Basketball,277247_Place|Basketball+Court,233888_Plot|Basketball+Tournament",
			similarDNACombinationType: "any",
		},
		faq: [
			{
				q: "What makes basketball stories compelling?",
				a: "The blend of individual brilliance and team chemistry. Every fast break is poetry in motion, every championship run a hero's journey.",
			},
		],
	},
	sports: {
		type: "all",
		label: "Sports",
		path: "sports",
		subtitle: "Glory on the Field",
		description:
			"Underdog comebacks, personal bests shattered, and locker room drama that's juicier than halftime oranges. Where victory is sweet but the journey's sweeter.",
		backdrop_path: "lrviX1RwNTfeq4Z9KjeqoxSyqtK.jpg",
		discoverParams: {
			similarDNA:
				"310058_Sub-Genres|Sports+Drama,310063_Target+Audience|Sports+Enthusiasts,308248_Target+Audience|Sports+Fans,310062_Costume+and+Set|Sports+Uniforms",
			similarDNACombinationType: "any",
		},
		faq: [
			{
				q: "What makes sports stories universally appealing?",
				a: "They're human drama amplified - every game is a microcosm of struggle, teamwork, and overcoming impossible odds.",
			},
		],
	},
}
