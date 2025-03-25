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
				"36382538_Key+Props|Football,36388849_Place|Football+Field,36472220_Target+Audience|Football+Fans,36377284_Key+Props|Soccer+Ball,36377282_Place|Soccer+Fields",
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
				"36374803_Key+Props|Baseball+Glove,36395203_Place|Baseball+Stadium,36395725_Key+Props|Baseball+Equipment,36385194_Key+Props|Baseball,36425701_Sub-Genres|Baseball+Film",
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
				"36385142_Key+Props|Basketball,36390796_Place|Basketball+Court,36423796_Plot|Basketball+Tournament",
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
				"36373930_Sub-Genres|Sports+Drama,36382543_Target+Audience|Sports+Enthusiasts,36376247_Target+Audience|Sports+Fans,36382540_Costume+and+Set|Sports+Uniforms",
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
