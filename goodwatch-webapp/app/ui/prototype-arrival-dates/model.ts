// PROTOTYPE - throwaway (#625, follows #489 prototype C). The prepared data and the words of /prototype/arrival-dates.
// Nothing is read from a service. The American and German titles are prototype C's, copied once from the production
// catalogue on 12 October 2026. The MUBI titles (United States) and the Brazilian titles were read once from TMDB on
// 15 October 2026: they are on those services, and their scores are TMDB ratings times ten.
//
// THE DAYS ARE MADE UP, AND THAT IS THE POINT. `on` holds the day a title really arrived on a service, spread over the
// last 14 days. What the page may say about that day depends on how GoodWatch learns of it, which is the question of
// #625. `whenOf` decides it per title for each variation:
//   daily   GoodWatch compares a service's list every day, so it knows the day (the day TMDB listed it, which can be a
//           day after the service added it).
//   weekly  GoodWatch rechecks each title once a week, so it knows the week and never the day.
// A title a member waits for is checked every day under every option, so its day is always known.

export type Kind = "movie" | "show"
export type ServiceKey =
	| "netflix"
	| "prime-video"
	| "disney-plus"
	| "hbo-max"
	| "hulu"
	| "paramount-plus"
	| "peacock"
	| "wow"
	| "mubi"
export type CountryKey = "US" | "DE" | "BR"

export interface Service {
	/** Its part of the page's address. */
	key: ServiceKey
	name: string
	logo: string
}

/** One entry per brand: plan tiers ("with ads", "Premium Plus") and channel resellers are folded into it. */
export const SERVICES: Record<ServiceKey, Service> = {
	netflix: {
		key: "netflix",
		name: "Netflix",
		logo: "/rK1KljqmbvO9HQa1PBFLILWah72.png",
	},
	"prime-video": {
		key: "prime-video",
		name: "Prime Video",
		logo: "/gMZdpavHmxFNnLpMHwVxfqeux2g.png",
	},
	"disney-plus": {
		key: "disney-plus",
		name: "Disney Plus",
		logo: "/5eZ872CghnHFLB1j8grszbrx0dx.png",
	},
	"hbo-max": {
		key: "hbo-max",
		name: "HBO Max",
		logo: "/skypuy7SXuugIQeYg0IglmzoKaS.png",
	},
	hulu: { key: "hulu", name: "Hulu", logo: "/44uAnmSqvA4yBOdbPWN8YgQHjWm.png" },
	"paramount-plus": {
		key: "paramount-plus",
		name: "Paramount Plus",
		logo: "/pkx3klJlwW5JdtaulvDx6hDNtch.png",
	},
	peacock: {
		key: "peacock",
		name: "Peacock",
		logo: "/a1UIdq5BrkcAxnxcUhFsNbXnxeu.png",
	},
	wow: { key: "wow", name: "WOW", logo: "/2o26YwA7tXQ7I6CSrMvO9Rj4oNi.png" },
	mubi: { key: "mubi", name: "MUBI", logo: "/k7iSlvgWzZuO4zU5PcBjhABMuia.png" },
}

export const COUNTRIES: Record<
	CountryKey,
	{ name: string; inThe: string; services: ServiceKey[] }
> = {
	US: {
		name: "United States",
		inThe: "in the United States",
		services: [
			"netflix",
			"prime-video",
			"hbo-max",
			"hulu",
			"disney-plus",
			"paramount-plus",
			"peacock",
			"mubi",
		],
	},
	DE: {
		name: "Germany",
		inThe: "in Germany",
		services: ["netflix", "prime-video", "disney-plus", "wow"],
	},
	BR: {
		name: "Brazil",
		inThe: "in Brazil",
		services: ["netflix", "prime-video", "disney-plus"],
	},
}

/** How far back the page looks, in days. */
export const WINDOW_DAYS = 14
/** The day the page calls today. Every date counts back from it, so the page looks the same on any day. */
export const TODAY = "2026-10-15"

interface Seed {
	type: Kind
	id: number
	title: string
	year: number
	score: number
	runtime: number | null
	poster: string
	backdrop: string
	/** Days since the title really arrived, by service. */
	on: Partial<Record<ServiceKey, number>>
}

const CATALOGUE: Record<CountryKey, Seed[]> = {
	US: [
		{
			type: "movie",
			id: 238,
			title: "The Godfather",
			year: 1972,
			score: 95,
			runtime: 175,
			poster: "/3bhkrj58Vtu7enYsRolD1fZdja1.jpg",
			backdrop: "/ejdD20cdHNFAYAN2DlqPToXKyzx.jpg",
			on: { "prime-video": 7 },
		},
		{
			type: "movie",
			id: 274,
			title: "The Silence of the Lambs",
			year: 1991,
			score: 89,
			runtime: 119,
			poster: "/uS9m8OBk1A8eM9I042bx8XXpqAq.jpg",
			backdrop: "/aYcnDyLMnpKce1FOYUpZrXtgUye.jpg",
			on: { peacock: 0 },
		},
		{
			type: "movie",
			id: 857,
			title: "Saving Private Ryan",
			year: 1998,
			score: 90,
			runtime: 169,
			poster: "/uqx37cS8cpHg8U35f9U5IBlrCV3.jpg",
			backdrop: "/bdD39MpSVhKjxarTxLSfX6baoMP.jpg",
			on: { peacock: 2 },
		},
		{
			type: "movie",
			id: 1422,
			title: "The Departed",
			year: 2006,
			score: 87,
			runtime: 151,
			poster: "/nT97ifVT2J1yMQmeq20Qblg61T.jpg",
			backdrop: "/6WRrGYalXXveItfpnipYdayFkQB.jpg",
			on: { "hbo-max": 1 },
		},
		{
			type: "movie",
			id: 1124,
			title: "The Prestige",
			year: 2006,
			score: 79,
			runtime: 130,
			poster: "/Ag2B2KHKQPukjH7WutmgnnSNurZ.jpg",
			backdrop: "/yaExZh6qE2cfyK3o4kAMEq0mkgy.jpg",
			on: { netflix: 8 },
		},
		{
			type: "movie",
			id: 752,
			title: "V for Vendetta",
			year: 2006,
			score: 76,
			runtime: 132,
			poster: "/piZOwjyk1g51oPHonc7zaQY3WOv.jpg",
			backdrop: "/sFEYsEfzTx7hhjetlNrme8B5OUo.jpg",
			on: { "paramount-plus": 3 },
		},
		{
			type: "movie",
			id: 280,
			title: "Terminator 2: Judgment Day",
			year: 1991,
			score: 85,
			runtime: 137,
			poster: "/jFTVD4XoWQTcg7wdyJKa8PEds5q.jpg",
			backdrop: "/izkMjmhauFx9DjoBQqM5sM5WAwE.jpg",
			on: { "prime-video": 6 },
		},
		{
			type: "movie",
			id: 6977,
			title: "No Country for Old Men",
			year: 2007,
			score: 88,
			runtime: 122,
			poster: "/6d5XOczc226jECq0LIX0siKtgHR.jpg",
			backdrop: "/gddUsvfyySrM5k8B8wwJy2VRlBx.jpg",
			on: { peacock: 4 },
		},
		{
			type: "movie",
			id: 694,
			title: "The Shining",
			year: 1980,
			score: 81,
			runtime: 144,
			poster: "/uAR0AWqhQL1hQa69UDEbb2rE5Wx.jpg",
			backdrop: "/AdKA2F1SzYPhSZdEbjH1Zh75UVQ.jpg",
			on: { "hbo-max": 2 },
		},
		{
			type: "movie",
			id: 496243,
			title: "Parasite",
			year: 2019,
			score: 93,
			runtime: 133,
			poster: "/7IiTTgloJzvGI1TAYymCfbfl3vT.jpg",
			backdrop: "/TU9NIjwzjoKPwQHoHshkFcQUCG.jpg",
			on: { "paramount-plus": 8 },
		},
		{
			type: "movie",
			id: 745,
			title: "The Sixth Sense",
			year: 1999,
			score: 73,
			runtime: 107,
			poster: "/vOyfUXNFSnaTk7Vk5AjpsKTUWsu.jpg",
			backdrop: "/6TjllWT3cGrPFyqDXurVZ3L8bBi.jpg",
			on: { netflix: 2 },
		},
		{
			type: "movie",
			id: 466272,
			title: "Once Upon a Time... in Hollywood",
			year: 2019,
			score: 79,
			runtime: 162,
			poster: "/8j58iEBw9pOXFD2L0nt0ZXeHviB.jpg",
			backdrop: "/kKTPv9LKKs5L3oO1y5FNObxAPWI.jpg",
			on: { "prime-video": 5 },
		},
		{
			type: "movie",
			id: 10191,
			title: "How to Train Your Dragon",
			year: 2010,
			score: 86,
			runtime: 98,
			poster: "/ygGmAO60t8GyqUo9xYeYxSZAR3b.jpg",
			backdrop: "/59vDC1BuEQvti24OMr0ZvtAK6R1.jpg",
			on: { "paramount-plus": 5 },
		},
		{
			type: "movie",
			id: 187,
			title: "Sin City",
			year: 2005,
			score: 77,
			runtime: 124,
			poster: "/i66G50wATMmPrvpP95f0XP6ZdVS.jpg",
			backdrop: "/t9kQnqiaxQ8TLB25rTzDKLd0fdM.jpg",
			on: { peacock: 5 },
		},
		{
			type: "movie",
			id: 329865,
			title: "Arrival",
			year: 2016,
			score: 84,
			runtime: 116,
			poster: "/pEzNVQfdzYDzVK0XqxERIw2x2se.jpg",
			backdrop: "/8MUZz7oPXQftFTslZpRP3CVMOoq.jpg",
			on: { peacock: 1 },
		},
		{
			type: "movie",
			id: 8363,
			title: "Superbad",
			year: 2007,
			score: 80,
			runtime: 113,
			poster: "/ek8e8txUyUwd2BNqj6lFEerJfbq.jpg",
			backdrop: "/coru98UcFBzJIU7bxZguxaePgu0.jpg",
			on: { "paramount-plus": 8 },
		},
		{
			type: "movie",
			id: 949,
			title: "Heat",
			year: 1995,
			score: 83,
			runtime: 170,
			poster: "/umSVjVdbVwtx5ryCA2QXL44Durm.jpg",
			backdrop: "/uI22JkEMediWyiRqhllNqeeGtW0.jpg",
			on: { "prime-video": 3 },
		},
		{
			type: "movie",
			id: 539,
			title: "Psycho",
			year: 1960,
			score: 93,
			runtime: 109,
			poster: "/yz4QVqPx3h1hD1DfqqQkCq3rmxW.jpg",
			backdrop: "/mufF1aYvwdpKerhq5R1YrVcbJLY.jpg",
			on: { netflix: 4 },
		},
		{
			type: "movie",
			id: 161,
			title: "Ocean's Eleven",
			year: 2001,
			score: 78,
			runtime: 116,
			poster: "/hQQCdZrsHtZyR6NbKH2YyCqd2fR.jpg",
			backdrop: "/ncoqdHs1poUaBqyKic9YI8ai7MP.jpg",
			on: { "hbo-max": 11 },
		},
		{
			type: "movie",
			id: 7345,
			title: "There Will Be Blood",
			year: 2007,
			score: 88,
			runtime: 158,
			poster: "/fa0RDkAlCec0STeMNAhPaF89q6U.jpg",
			backdrop: "/9UAKA6ceZi6TgQwTAAMt7DWwYPI.jpg",
			on: { "prime-video": 9 },
		},
		{
			type: "movie",
			id: 335984,
			title: "Blade Runner 2049",
			year: 2017,
			score: 83,
			runtime: 164,
			poster: "/gajva2L0rPYkEWjzgFlBXCAVBE5.jpg",
			backdrop: "/gNdLJU9TxrpGx4dkZidjys3fyy0.jpg",
			on: { "prime-video": 6 },
		},
		{
			type: "movie",
			id: 64688,
			title: "21 Jump Street",
			year: 2012,
			score: 76,
			runtime: 109,
			poster: "/8v3Sqv9UcIUC4ebmpKWROqPBINZ.jpg",
			backdrop: "/rXrpYOveFl76ivMmyb2612T7Q8w.jpg",
			on: { netflix: 9 },
		},
		{
			type: "movie",
			id: 607,
			title: "Men in Black",
			year: 1997,
			score: 79,
			runtime: 98,
			poster: "/uLOmOF5IzWoyrgIF5MfUnh5pa1X.jpg",
			backdrop: "/aJMhYOP80cVBtq5ku3uyqASF3Ol.jpg",
			on: { "paramount-plus": 13 },
		},
		{
			type: "movie",
			id: 8966,
			title: "Twilight",
			year: 2008,
			score: 55,
			runtime: 122,
			poster: "/3Gkb6jm6962ADUPaCBqzz9CTbn9.jpg",
			backdrop: "/weAYfu6FfrNxEDJ3xH1XpgQcqUv.jpg",
			on: { netflix: 3 },
		},
		{
			type: "movie",
			id: 162,
			title: "Edward Scissorhands",
			year: 1990,
			score: 83,
			runtime: 105,
			poster: "/e0FqKFvGPdQNWG8tF9cZBtev9Em.jpg",
			backdrop: "/uNLIMPxknsV4n3IAEDpS1iqF5dm.jpg",
			on: { hulu: 2 },
		},
		{
			type: "movie",
			id: 381288,
			title: "Split",
			year: 2017,
			score: 72,
			runtime: 117,
			poster: "/ow2BSQGKJtZpH2zZY1rmX8eXKAi.jpg",
			backdrop: "/9pkZesKMnblFfKxEhQx45YQ2kIe.jpg",
			on: { netflix: 6 },
		},
		{
			type: "movie",
			id: 425,
			title: "Ice Age",
			year: 2002,
			score: 73,
			runtime: 81,
			poster: "/gLhHHZUzeseRXShoDyC4VqLgsNv.jpg",
			backdrop: "/8pwIhymsxfAVjrAE7syDjQULn37.jpg",
			on: { netflix: 11 },
		},
		{
			type: "movie",
			id: 2105,
			title: "American Pie",
			year: 1999,
			score: 63,
			runtime: 95,
			poster: "/5P68by2Thn8wHAziyWGEw2O7hco.jpg",
			backdrop: "/cvH1gNIMRITdLzoWv1HNAbRyH3n.jpg",
			on: { "paramount-plus": 7 },
		},
		{
			type: "movie",
			id: 593643,
			title: "The Menu",
			year: 2022,
			score: 76,
			runtime: 107,
			poster: "/fPtUgMcLIboqlTlPrq0bQpKK8eq.jpg",
			backdrop: "/4vSBj7BYsyuKCx96EJzGyp20WfY.jpg",
			on: { netflix: 1, hulu: 1 },
		},
		{
			type: "movie",
			id: 933260,
			title: "The Substance",
			year: 2024,
			score: 77,
			runtime: 141,
			poster: "/lqoMzCcZYEFK729d6qzt349fB4o.jpg",
			backdrop: "/wMEhptvj6pcp2QSzHYcl4DFA5Pz.jpg",
			on: { hulu: 4 },
		},
		{
			type: "movie",
			id: 75780,
			title: "Jack Reacher",
			year: 2012,
			score: 62,
			runtime: 130,
			poster: "/uQBbjrLVsUibWxNDGA4Czzo8lwz.jpg",
			backdrop: "/iwvP8XVpYVmJ3xfF9xdBi5uAOWl.jpg",
			on: { peacock: 10 },
		},
		{
			type: "movie",
			id: 603692,
			title: "John Wick: Chapter 4",
			year: 2023,
			score: 84,
			runtime: 170,
			poster: "/vZloFAK7NmvMGKE7VkF5UHaz0I.jpg",
			backdrop: "/7I6VUdPj6tQECNHdviJkUHD2u89.jpg",
			on: { "prime-video": 9 },
		},
		{
			type: "show",
			id: 85271,
			title: "WandaVision",
			year: 2021,
			score: 82,
			runtime: null,
			poster: "/ijWWwINc8h71NQ8j1LTJMFSj5wr.jpg",
			backdrop: "/cq62fLH3vwOmiaLKMqkDI86tPtH.jpg",
			on: { hulu: 7 },
		},
		{
			type: "movie",
			id: 333371,
			title: "10 Cloverfield Lane",
			year: 2016,
			score: 79,
			runtime: 104,
			poster: "/q8A39vcBDruhvoDTJd6L8a4lnTi.jpg",
			backdrop: "/dMERTVrObB7TkRVIFmcndR2sZFH.jpg",
			on: { peacock: 7 },
		},
		{
			type: "movie",
			id: 398818,
			title: "Call Me by Your Name",
			year: 2017,
			score: 88,
			runtime: 132,
			poster: "/gXiE0WveDnT0n5J4sW9TMxXF4oT.jpg",
			backdrop: "/4Xh2a1WeTp6b8Ksvug0pAMbX3dT.jpg",
			on: { netflix: 0 },
		},
		{
			type: "movie",
			id: 376867,
			title: "Moonlight",
			year: 2016,
			score: 86,
			runtime: 112,
			poster: "/qLnfEmPrDjJfPyyddLJPkXmshkp.jpg",
			backdrop: "/jm1oD3eB08LImSwL1LrzF9AJQ5b.jpg",
			on: { netflix: 7 },
		},
		{
			type: "movie",
			id: 377,
			title: "A Nightmare on Elm Street",
			year: 1984,
			score: 81,
			runtime: 91,
			poster: "/tI0RQFYevX97NSdDSYmn0Z19i3r.jpg",
			backdrop: "/nzSjTiecdosBfwMGAdpt9CxltCI.jpg",
			on: { "hbo-max": 10 },
		},
		{
			type: "movie",
			id: 402431,
			title: "Wicked",
			year: 2024,
			score: 80,
			runtime: 162,
			poster: "/xDGbZ0JJ3mYaGKy4Nzd9Kph6M9L.jpg",
			backdrop: "/w22GVYotTIVC1dUd58mRhwPqiS.jpg",
			on: { hulu: 1 },
		},
		{
			type: "movie",
			id: 419704,
			title: "Ad Astra",
			year: 2019,
			score: 70,
			runtime: 123,
			poster: "/xBHvZcjRiWyobQ9kxBhO6B2dtRI.jpg",
			backdrop: "/AeDS2MKGFy6QcjgWbJBde0Ga6Hd.jpg",
			on: { netflix: 5 },
		},
		{
			type: "show",
			id: 4087,
			title: "The X-Files",
			year: 1993,
			score: 77,
			runtime: null,
			poster: "/rcBx0p8h51LHceyhquYMxbspJQu.jpg",
			backdrop: "/w00lfexrsOeR25dO4hsWhbcUnmD.jpg",
			on: { "disney-plus": 2 },
		},
		{
			type: "show",
			id: 1705,
			title: "Fringe",
			year: 2008,
			score: 82,
			runtime: 46,
			poster: "/sY9hg5dLJ93RJOyKEiu1nAtBRND.jpg",
			backdrop: "/rYlIRj9NA945UuYohw9jUbDEbts.jpg",
			on: { "prime-video": 1 },
		},
		{
			type: "show",
			id: 126308,
			title: "Shōgun",
			year: 2024,
			score: 89,
			runtime: null,
			poster: "/7O4iVfOMQmdCSxhOg1WnzG1AgYT.jpg",
			backdrop: "/bwSmgmd90hCWwqOKQYTEraeOZhJ.jpg",
			on: { "disney-plus": 12 },
		},
		{
			type: "movie",
			id: 1083381,
			title: "Backrooms",
			year: 2026,
			score: 75,
			runtime: 111,
			poster: "/rhGx6E3qRNMgj3i5su2oukNHwIQ.jpg",
			backdrop: "/dqmMWNWfLnExDRpMtIMqI97GQFR.jpg",
			on: { "hbo-max": 12 },
		},
		{
			type: "movie",
			id: 1089,
			title: "Point Break",
			year: 1991,
			score: 69,
			runtime: 122,
			poster: "/tlbERIghrQ4oofqlbF7H0K0EYnx.jpg",
			backdrop: "/yGOHbICOQwlJ20UjK8F2ChGJjvl.jpg",
			on: { netflix: 13 },
		},
		{
			type: "movie",
			id: 207932,
			title: "Inferno",
			year: 2016,
			score: 43,
			runtime: 122,
			poster: "/5T6iVetK5AB1kgwAEKbDM2hTZJU.jpg",
			backdrop: "/y3w1fdR3QfYy22ryvhRl6YyHohs.jpg",
			on: { netflix: 4 },
		},
		{
			type: "movie",
			id: 597208,
			title: "Nightmare Alley",
			year: 2021,
			score: 72,
			runtime: 151,
			poster: "/vfn1feL0V9HNSXuLLpaxAW8O6LO.jpg",
			backdrop: "/g0YNGpmlXsgHfhGnJz3c5uyzZ1B.jpg",
			on: { hulu: 5 },
		},
		{
			type: "movie",
			id: 446354,
			title: "The Post",
			year: 2017,
			score: 79,
			runtime: 116,
			poster: "/h4XG3g6uMMPIBPjAoQhC2QIMdkl.jpg",
			backdrop: "/8sb4aBST28vN3rBz704XJczS0Ld.jpg",
			on: { "hbo-max": 2 },
		},
		{
			type: "show",
			id: 95,
			title: "Buffy the Vampire Slayer",
			year: 1997,
			score: 84,
			runtime: null,
			poster: "/fYwBcPdzu3QjPcSCGJ7gAMT0aIu.jpg",
			backdrop: "/lBmlLro9ZfY815ZXE5NKhYNxPRQ.jpg",
			on: { "disney-plus": 5 },
		},
		{
			type: "movie",
			id: 313297,
			title: "Kubo and the Two Strings",
			year: 2016,
			score: 85,
			runtime: 102,
			poster: "/la6QA9tk4Foq8OBH2Dyh5dTcw6H.jpg",
			backdrop: "/bhspYsRMHgMqzUlxiVpIY8OrqMt.jpg",
			on: { "hbo-max": 3 },
		},
		{
			type: "movie",
			id: 10066,
			title: "House of Wax",
			year: 2005,
			score: 45,
			runtime: 113,
			poster: "/aCLSgw1DaqkRvosYc3YUttBTtpT.jpg",
			backdrop: "/2J7re6BvXXxLFXCYZpTUmRKkTHn.jpg",
			on: { "hbo-max": 7 },
		},
		{
			type: "show",
			id: 259909,
			title: "Dexter: Resurrection",
			year: 2025,
			score: 84,
			runtime: null,
			poster: "/o2Oyi3boT100bY5kCP4MBiTeetO.jpg",
			backdrop: "/vcpj6rRDS93ImHCLPY8bwBuFGjR.jpg",
			on: { "prime-video": 5 },
		},
		{
			type: "movie",
			id: 41402,
			title: "Let Me In",
			year: 2010,
			score: 78,
			runtime: 116,
			poster: "/rgNb9nwPKwV45c5PTvFqFmpzGt0.jpg",
			backdrop: "/4olBDCPKiKhyECMK7fNVp8iG1uF.jpg",
			on: { "prime-video": 10 },
		},
		{
			type: "movie",
			id: 840705,
			title: "Blink Twice",
			year: 2024,
			score: 68,
			runtime: 103,
			poster: "/lZGOK0I2DJSRlEPNOAFTSNxSjDD.jpg",
			backdrop: "/NqqLef2ITlK8olXT4iFuUXFwSh.jpg",
			on: { "paramount-plus": 0 },
		},
		{
			type: "movie",
			id: 1084244,
			title: "Toy Story 5",
			year: 2026,
			score: 81,
			runtime: 102,
			poster: "/sfQtVlIHljToOwYjhe21KPGzZWK.jpg",
			backdrop: "/4D1pdB27uph7J8HQzNf8QvvH9bn.jpg",
			on: { "disney-plus": 9 },
		},
		{
			type: "movie",
			id: 1311031,
			title: "Demon Slayer: Kimetsu no Yaiba Infinity Castle",
			year: 2025,
			score: 85,
			runtime: 156,
			poster: "/fWVSwgjpT2D78VUh6X8UBd2rorW.jpg",
			backdrop: "/1RgPyOhN4DRs225BGTlHJqCudII.jpg",
			on: { netflix: 0 },
		},
		{
			type: "show",
			id: 1981,
			title: "Charmed",
			year: 1998,
			score: 71,
			runtime: 42,
			poster: "/z4bPJ1BWU2EtV69NII2GVvsugQ2.jpg",
			backdrop: "/ueZFcwAUvkjyAB9beaiqJyg0M8H.jpg",
			on: { hulu: 4 },
		},
		{
			type: "show",
			id: 97951,
			title: "Mayor of Kingstown",
			year: 2021,
			score: 70,
			runtime: null,
			poster: "/6rWIip9MZELAA0SKii5WqsBDCYW.jpg",
			backdrop: "/39bifj2FNytJ2m1cqOBcWMTKgmV.jpg",
			on: { netflix: 0 },
		},
		{
			type: "movie",
			id: 139038,
			title: "A Haunted House",
			year: 2013,
			score: 34,
			runtime: 86,
			poster: "/f3ajCdwH7H8JTMVUsCaN5lUsnhi.jpg",
			backdrop: "/mgnMFeLCEaNTOiD7w2DOaqzddyJ.jpg",
			on: { netflix: 10 },
		},
		{
			type: "movie",
			id: 637920,
			title: "Miracle in Cell No. 7",
			year: 2019,
			score: 83,
			runtime: 132,
			poster: "/bOth4QmNyEkalwahfPCfiXjNh1r.jpg",
			backdrop: "/inEy3A5OPgeYW4rjRiGycfEeQzA.jpg",
			on: { netflix: 2 },
		},
		{
			type: "movie",
			id: 136,
			title: "Freaks",
			year: 1932,
			score: 84,
			runtime: 64,
			poster: "/fX2Wxd0W9E7eVClUd8kJTfennoV.jpg",
			backdrop: "/r18vpGFsNf6n984x4KdJmAAWKkP.jpg",
			on: { "hbo-max": 6 },
		},
		{
			type: "show",
			id: 204154,
			title: "Scavengers Reign",
			year: 2023,
			score: 90,
			runtime: null,
			poster: "/bFlVZV8TQbs8hcIY7PVYonYFMgK.jpg",
			backdrop: "/rTViEeltl4rO974PmkUAdhQqW2R.jpg",
			on: { "hbo-max": 5 },
		},
		{
			type: "show",
			id: 256721,
			title: "Gachiakuta",
			year: 2025,
			score: 93,
			runtime: 24,
			poster: "/jH78nLFrTU6aP7hY7KO6DZHFLoX.jpg",
			backdrop: "/vlFoUig0nHKH0cH0OY1tk2uxGRL.jpg",
			on: { hulu: 4 },
		},
		{
			type: "movie",
			id: 55,
			title: "Amores Perros",
			year: 2000,
			score: 76,
			runtime: 154,
			poster: "/1lX74fPZsBoOyyE5fWL5xT7k9sV.jpg",
			backdrop: "/iTkxwBriD9YKg4Q35qWEIlLXd6e.jpg",
			on: { mubi: 0 },
		},
		{
			type: "movie",
			id: 1240889,
			title: "Teenage Sex and Death at Camp Miasma",
			year: 2026,
			score: 62,
			runtime: 112,
			poster: "/6Q6Zo6GNXMLP600OJSh6MhW21um.jpg",
			backdrop: "/d1n2ySWSanU34eEsluRjfrjRq52.jpg",
			on: { mubi: 8 },
		},
		{
			type: "movie",
			id: 848685,
			title: "The Beasts",
			year: 2022,
			score: 75,
			runtime: 138,
			poster: "/ytWMRYLlusyzMFFjyuFRY1liteR.jpg",
			backdrop: "/vlhzpgLDoiiMCNa3Jxj2VcuRAoD.jpg",
			on: { mubi: 1 },
		},
		{
			type: "movie",
			id: 795811,
			title: "Wheel of Fortune and Fantasy",
			year: 2021,
			score: 72,
			runtime: 121,
			poster: "/z3xqVWOsetW6pSEgx1uiqXfzRet.jpg",
			backdrop: "/mTOUk5M0LXIATbJDZkeH4xzA2hV.jpg",
			on: { mubi: 5 },
		},
		{
			type: "movie",
			id: 705996,
			title: "Decision to Leave",
			year: 2022,
			score: 73,
			runtime: 139,
			poster: "/zI8KZ4EdLUymWKX1YEkpZ0gtPUa.jpg",
			backdrop: "/y7efrL5RlIRsGfrhcaiP35V1x2g.jpg",
			on: { mubi: 3 },
		},
		{
			type: "movie",
			id: 1075175,
			title: "How to Have Sex",
			year: 2023,
			score: 62,
			runtime: 91,
			poster: "/yQyoFCBLGJH5HXESmJAzaiXw9zU.jpg",
			backdrop: "/akvlTeB0LiNzw9U9YCAB8wwb5Qo.jpg",
			on: { mubi: 6 },
		},
		{
			type: "movie",
			id: 988402,
			title: "Humanist Vampire Seeking Consenting Suicidal Person",
			year: 2023,
			score: 75,
			runtime: 91,
			poster: "/m5OItLBY5T38ew1YI4VSIXjl5G2.jpg",
			backdrop: "/gbpy4mwYEodTutM9Z1HTEPK6i3S.jpg",
			on: { mubi: 10 },
		},
		{
			type: "movie",
			id: 820697,
			title: "The Five Devils",
			year: 2022,
			score: 67,
			runtime: 96,
			poster: "/eGk3tFSCdF48eEEFsEgV0UwCHqh.jpg",
			backdrop: "/iEqs3MI7YmjMPJPMbrdFLYzgp5t.jpg",
			on: { mubi: 12 },
		},
	],
	DE: [
		{
			type: "movie",
			id: 49051,
			title: "The Hobbit: An Unexpected Journey",
			year: 2012,
			score: 70,
			runtime: 169,
			poster: "/yHA9Fc37VmpUA5UncTxxo3rTGVA.jpg",
			backdrop: "/xyXmtuvsoM5J3yNad0nvcetpBdY.jpg",
			on: { "prime-video": 6 },
		},
		{
			type: "movie",
			id: 10191,
			title: "How to Train Your Dragon",
			year: 2010,
			score: 86,
			runtime: 98,
			poster: "/ygGmAO60t8GyqUo9xYeYxSZAR3b.jpg",
			backdrop: "/59vDC1BuEQvti24OMr0ZvtAK6R1.jpg",
			on: { wow: 8 },
		},
		{
			type: "movie",
			id: 37799,
			title: "The Social Network",
			year: 2010,
			score: 88,
			runtime: 121,
			poster: "/n0ybibhJtQ5icDqTp8eRytcIHJx.jpg",
			backdrop: "/1PXwh3nJzgRkkYnqfWInJNypeL4.jpg",
			on: { "prime-video": 1 },
		},
		{
			type: "movie",
			id: 56292,
			title: "Mission: Impossible - Ghost Protocol",
			year: 2011,
			score: 79,
			runtime: 133,
			poster: "/eRZTGx7GsiKqPch96k27LK005ZL.jpg",
			backdrop: "/hqyjzDRCs1N5gEsh2gklzPdsEFD.jpg",
			on: { "disney-plus": 2 },
		},
		{
			type: "movie",
			id: 324857,
			title: "Spider-Man: Into the Spider-Verse",
			year: 2018,
			score: 90,
			runtime: 117,
			poster: "/iiZZdoQBEYBv6id8su7ImL0oCbD.jpg",
			backdrop: "/1ntePsIqeklfmrQJqZPncCydsqY.jpg",
			on: { "disney-plus": 11 },
		},
		{
			type: "movie",
			id: 346698,
			title: "Barbie",
			year: 2023,
			score: 75,
			runtime: 114,
			poster: "/iuFNMS8U5cb6xfzi51Dbkovj7vM.jpg",
			backdrop: "/1esAE8sLJRWWFsLLeh5r3g2WanI.jpg",
			on: { "prime-video": 5 },
		},
		{
			type: "show",
			id: 1429,
			title: "Attack on Titan",
			year: 2013,
			score: 93,
			runtime: null,
			poster: "/hTP1DtLGFamjfu8WqjnuQdP1n4i.jpg",
			backdrop: "/wg0GsFpeHAFPbbcfsntTQBggWCo.jpg",
			on: { "prime-video": 6 },
		},
		{
			type: "movie",
			id: 425,
			title: "Ice Age",
			year: 2002,
			score: 73,
			runtime: 81,
			poster: "/gLhHHZUzeseRXShoDyC4VqLgsNv.jpg",
			backdrop: "/8pwIhymsxfAVjrAE7syDjQULn37.jpg",
			on: { netflix: 3 },
		},
		{
			type: "movie",
			id: 353081,
			title: "Mission: Impossible - Fallout",
			year: 2018,
			score: 87,
			runtime: 147,
			poster: "/AkJQpZp9WoNdj7pLYSj1L0RcMMN.jpg",
			backdrop: "/5jnoAA74Qwb5w6B9FMvnc20n6Ie.jpg",
			on: { "disney-plus": 0 },
		},
		{
			type: "movie",
			id: 1311031,
			title: "Demon Slayer: Kimetsu no Yaiba Infinity Castle",
			year: 2025,
			score: 85,
			runtime: 156,
			poster: "/fWVSwgjpT2D78VUh6X8UBd2rorW.jpg",
			backdrop: "/1RgPyOhN4DRs225BGTlHJqCudII.jpg",
			on: { netflix: 2 },
		},
		{
			type: "movie",
			id: 1226863,
			title: "The Super Mario Galaxy Movie",
			year: 2026,
			score: 58,
			runtime: 98,
			poster: "/eJGWx219ZcEMVQJhAgMiqo8tYY.jpg",
			backdrop: "/kxQiIJ4gVcD3K6o14MJ72p5yRcE.jpg",
			on: { wow: 1 },
		},
		{
			type: "show",
			id: 97951,
			title: "Mayor of Kingstown",
			year: 2021,
			score: 70,
			runtime: null,
			poster: "/6rWIip9MZELAA0SKii5WqsBDCYW.jpg",
			backdrop: "/39bifj2FNytJ2m1cqOBcWMTKgmV.jpg",
			on: { netflix: 0 },
		},
		{
			type: "movie",
			id: 637920,
			title: "Miracle in Cell No. 7",
			year: 2019,
			score: 83,
			runtime: 132,
			poster: "/bOth4QmNyEkalwahfPCfiXjNh1r.jpg",
			backdrop: "/inEy3A5OPgeYW4rjRiGycfEeQzA.jpg",
			on: { netflix: 3 },
		},
		{
			type: "show",
			id: 314,
			title: "Star Trek: Enterprise",
			year: 2001,
			score: 69,
			runtime: 44,
			poster: "/tsbBTABtNgu0ycsFpnIhiQ5woOM.jpg",
			backdrop: "/gH5HQbMsSfPc0R41JYTefjB7klZ.jpg",
			on: { wow: 8 },
		},
		{
			type: "show",
			id: 39276,
			title: "Unforgettable",
			year: 2011,
			score: 60,
			runtime: 45,
			poster: "/AvbMRqe3wSe4DBzIYl56CBlcalw.jpg",
			backdrop: "/xadC4VMl6UPRdBINAUgTBmYL7BF.jpg",
			on: { netflix: 3 },
		},
	],
	BR: [
		{
			type: "movie",
			id: 1236045,
			title: "Animals",
			year: 2026,
			score: 72,
			runtime: 106,
			poster: "/iISM36voS1E8gX9BM0DVK0kgi3E.jpg",
			backdrop: "/tzoarEu7TsG959upiELyYPm5kO9.jpg",
			on: { netflix: 0 },
		},
		{
			type: "movie",
			id: 1184918,
			title: "The Wild Robot",
			year: 2024,
			score: 83,
			runtime: 102,
			poster: "/wTnV3PCVW5O92JMrFvvrRcV39RU.jpg",
			backdrop: "/1pmXyN3sKeYoUhu5VBZiDU4BX21.jpg",
			on: { netflix: 2 },
		},
		{
			type: "movie",
			id: 129,
			title: "Spirited Away",
			year: 2001,
			score: 85,
			runtime: 125,
			poster: "/39wmItIWsg5sZMyRUHLkWBcuVCM.jpg",
			backdrop: "/6oaL4DP75yABrd5EbC4H2zq5ghc.jpg",
			on: { netflix: 9 },
		},
		{
			type: "movie",
			id: 57800,
			title: "Ice Age: Continental Drift",
			year: 2012,
			score: 64,
			runtime: 88,
			poster: "/dfp1BZF7FxbBUyzHvMOI9t8NWDD.jpg",
			backdrop: "/scLQDnf1m2AqEEQSjAEdMRD6K9I.jpg",
			on: { netflix: 4 },
		},
		{
			type: "movie",
			id: 1233413,
			title: "Sinners",
			year: 2025,
			score: 75,
			runtime: 138,
			poster: "/fWPgbnt2LSqkQ6cdQc0SZN9CpLm.jpg",
			backdrop: "/nAxGnGHOsfzufThz20zgmRwKur3.jpg",
			on: { netflix: 1 },
		},
		{
			type: "movie",
			id: 3933,
			title: "Corpse Bride",
			year: 2005,
			score: 76,
			runtime: 77,
			poster: "/3RAoVTxUk1OzZClscAsynuu670p.jpg",
			backdrop: "/v23fWgJUEt8EMmvn19btIacxP8E.jpg",
			on: { netflix: 12 },
		},
		{
			type: "movie",
			id: 786892,
			title: "Furiosa: A Mad Max Saga",
			year: 2024,
			score: 74,
			runtime: 149,
			poster: "/iADOJ8Zymht2JPMoy3R7xceZprc.jpg",
			backdrop: "/raph7qjAGTMXaIjVxt6ZDSXRzUr.jpg",
			on: { netflix: 6 },
		},
		{
			type: "movie",
			id: 8355,
			title: "Ice Age: Dawn of the Dinosaurs",
			year: 2009,
			score: 68,
			runtime: 94,
			poster: "/cXOLaxcNjNAYmEx1trZxOTKhK3Q.jpg",
			backdrop: "/6Ybbh8TrO8bkEfQXDedekLwVDfA.jpg",
			on: { netflix: 3 },
		},
		{
			type: "movie",
			id: 10192,
			title: "Shrek Forever After",
			year: 2010,
			score: 64,
			runtime: 93,
			poster: "/6HrfPZtKcGmX2tUWW3cnciZTaSD.jpg",
			backdrop: "/uzzTystB8lL0mRDII5Sfs5HxgkI.jpg",
			on: { netflix: 8 },
		},
		{
			type: "movie",
			id: 803796,
			title: "KPop Demon Hunters",
			year: 2025,
			score: 80,
			runtime: 96,
			poster: "/zT7Lhw3BhJbMkRqm9Zlx2YGMsY0.jpg",
			backdrop: "/w3Bi0wygeFQctn6AqFTwhGNXRwL.jpg",
			on: { netflix: 5 },
		},
		{
			type: "movie",
			id: 324552,
			title: "John Wick: Chapter 2",
			year: 2017,
			score: 73,
			runtime: 122,
			poster: "/hXWBc0ioZP3cN4zCu6SN3YHXZVO.jpg",
			backdrop: "/Aa9Lx6gotP0szl9tlt5SPCN08oF.jpg",
			on: { netflix: 11 },
		},
		{
			type: "show",
			id: 2734,
			title: "Law & Order: Special Victims Unit",
			year: 1999,
			score: 80,
			runtime: null,
			poster: "/pHNhUwSXuDQ9jPZOCb8SgJaQZsc.jpg",
			backdrop: "/xhK9YCxNwnE0OB1SWvCY39heHQI.jpg",
			on: { netflix: 0 },
		},
		{
			type: "show",
			id: 2316,
			title: "The Office",
			year: 2005,
			score: 86,
			runtime: null,
			poster: "/7DJKHzAi83BmQrWLrYYOqcoKfhR.jpg",
			backdrop: "/9vMzIrMIncPmtalcxh1MOrgcE6C.jpg",
			on: { netflix: 7 },
		},
		{
			type: "show",
			id: 5920,
			title: "The Mentalist",
			year: 2008,
			score: 84,
			runtime: null,
			poster: "/acYXu4KaDj1NIkMgObnhe4C4a0T.jpg",
			backdrop: "/rJFqKcmMSttdNP58l0dVzY2NcTA.jpg",
			on: { netflix: 10 },
		},
		{
			type: "show",
			id: 79744,
			title: "The Rookie",
			year: 2018,
			score: 85,
			runtime: null,
			poster: "/70kTz0OmjjZe7zHvIDrq2iKW7PJ.jpg",
			backdrop: "/6iNWfGVCEfASDdlNb05TP5nG0ll.jpg",
			on: { netflix: 13 },
		},
		{
			type: "movie",
			id: 122917,
			title: "The Hobbit: The Battle of the Five Armies",
			year: 2014,
			score: 73,
			runtime: 144,
			poster: "/xT98tLqatZPQApyRmlPL12LtiWp.jpg",
			backdrop: "/3UbaCMmqOd7mca4Y5DOzY2ZVTyX.jpg",
			on: { "prime-video": 1 },
		},
		{
			type: "movie",
			id: 687163,
			title: "Project Hail Mary",
			year: 2026,
			score: 86,
			runtime: 157,
			poster: "/iOb2fjXLbpJgyQXe46n1WtGCnaa.jpg",
			backdrop: "/8Tfys3mDZVp4tNoH2ktm06a0Tau.jpg",
			on: { "prime-video": 4 },
		},
		{
			type: "movie",
			id: 1032863,
			title: "The Love Hypothesis",
			year: 2026,
			score: 80,
			runtime: 112,
			poster: "/vfZxVHextAGC70zrNhS8lsROqP1.jpg",
			backdrop: "/o7Oy9Gbx1CCyaweL8xUhtMW4Puq.jpg",
			on: { "prime-video": 0 },
		},
		{
			type: "movie",
			id: 157336,
			title: "Interstellar",
			year: 2014,
			score: 85,
			runtime: 169,
			poster: "/yQvGrMoipbRoddT0ZR8tPoR7NfX.jpg",
			backdrop: "/8sNiAPPYU14PUepFNeSNGUTiHW.jpg",
			on: { "prime-video": 9 },
		},
		{
			type: "movie",
			id: 98,
			title: "Gladiator",
			year: 2000,
			score: 82,
			runtime: 155,
			poster: "/aDb548BOkFfI4nFm0kx8A3Ezh7H.jpg",
			backdrop: "/Ar7QuJ7sJEiC0oP3I8fKBKIQD9u.jpg",
			on: { "prime-video": 6 },
		},
		{
			type: "movie",
			id: 1084244,
			title: "Toy Story 5",
			year: 2026,
			score: 83,
			runtime: 102,
			poster: "/sfQtVlIHljToOwYjhe21KPGzZWK.jpg",
			backdrop: "/qjTqY5coNiz6sVtPng40IzltsoN.jpg",
			on: { "disney-plus": 2 },
		},
		{
			type: "movie",
			id: 1022789,
			title: "Inside Out 2",
			year: 2024,
			score: 75,
			runtime: 97,
			poster: "/vpnVM9B6NMmQpWeZvzLvDESb2QY.jpg",
			backdrop: "/p5ozvmdgsmbWe0H8Xk7Rc8SCwAB.jpg",
			on: { "disney-plus": 0 },
		},
		{
			type: "movie",
			id: 299536,
			title: "Avengers: Infinity War",
			year: 2018,
			score: 82,
			runtime: 149,
			poster: "/7WsyChQLEftFiDOVTGkv3hFpyyt.jpg",
			backdrop: "/mDfJG3LC3Dqb67AZ52x3Z0jU0uB.jpg",
			on: { "disney-plus": 7 },
		},
		{
			type: "movie",
			id: 122,
			title: "The Lord of the Rings: The Return of the King",
			year: 2003,
			score: 85,
			runtime: 201,
			poster: "/rCzpDGLbOoPwLjy3OAm5NUPOTrC.jpg",
			backdrop: "/ctiw6FZK4N36LmkjSklWEbuvlq9.jpg",
			on: { "disney-plus": 11 },
		},
		{
			type: "movie",
			id: 83533,
			title: "Avatar: Fire and Ash",
			year: 2025,
			score: 76,
			runtime: 198,
			poster: "/bRBeSHfGHwkEpImlhxPmOcUsaeg.jpg",
			backdrop: "/u8DU5fkLoM5tTRukzPC31oGPxaQ.jpg",
			on: { "disney-plus": 5 },
		},
	],
}

// ---------------------------------------------------------------------------------------------------------
// The variations: one data option each, and what GoodWatch then knows about a title's day

export type Variant = "A" | "B" | "C" | "D" | "E" | "F"
export const VARIANTS: Record<Variant, string> = {
	A: "A day per arrival",
	B: "This week",
	C: "Mix by service size",
	D: "Mix by country",
	E: "Mix by popularity",
	F: "No days (control)",
}
/** The data option of the research each variation shows. */
export const DATA_OPTIONS: Record<Variant, string> = {
	A: "1. Daily lists everywhere",
	B: "2. Weekly or slower rechecks",
	C: "3. Mix by service size",
	D: "4. Mix by country",
	E: "5. Mix by title popularity",
	F: "Any option: the page never says a day",
}

export type Cadence = "daily" | "weekly"
/** Option 3: services with fewer than about 1,000 titles in a country are rechecked weekly. */
export const SMALL_SERVICES: ServiceKey[] = ["mubi"]
/** Option 4: the countries members live in are watched daily (two of the twelve here), the rest weekly. */
export const DAILY_COUNTRIES: CountryKey[] = ["US", "DE"]
/** Option 5: titles many people look at (say the top few thousand on TMDB) are rechecked daily. */
const POPULAR = new Set([
	"movie-1084244", // Toy Story 5
	"movie-402431", // Wicked
	"movie-1311031", // Demon Slayer: Infinity Castle
	"movie-933260", // The Substance
	"movie-603692", // John Wick: Chapter 4
	"show-126308", // Shōgun
	"show-259909", // Dexter: Resurrection
	"show-256721", // Gachiakuta
	"movie-593643", // The Menu
	"show-97951", // Mayor of Kingstown
	"movie-10191", // How to Train Your Dragon
	"movie-840705", // Blink Twice
	"movie-8966", // Twilight
	"movie-1240889", // Teenage Sex and Death at Camp Miasma
	"movie-1226863", // The Super Mario Galaxy Movie
	"movie-346698", // Barbie
	"movie-1236045", // Animals
	"movie-803796", // KPop Demon Hunters
	"movie-1233413", // Sinners
	"movie-1184918", // The Wild Robot
	"movie-687163", // Project Hail Mary
	"movie-83533", // Avatar: Fire and Ash
	"movie-1032863", // The Love Hypothesis
])
export const isPopular = (key: string) => POPULAR.has(key)

/** How GoodWatch learns of arrivals on a service in a country under the variation's option. "by-title" for E. */
export function cadenceOf(
	variant: Variant,
	country: CountryKey,
	service: ServiceKey,
): Cadence | "by-title" {
	if (variant === "B") return "weekly"
	if (variant === "C")
		return SMALL_SERVICES.includes(service) ? "weekly" : "daily"
	if (variant === "D")
		return DAILY_COUNTRIES.includes(country) ? "daily" : "weekly"
	if (variant === "E") return "by-title"
	return "daily"
}

/** What the page may say about when a title arrived. */
export type When =
	| { kind: "day"; days: number; why: "list" | "wanted" | "popular" }
	| { kind: "week"; week: 0 | 1 }
	| { kind: "none" }

/**
 * The whole page in one word. daily: every title has a day. weekly: every title has a week. mixed: some have a day
 * and some a week. none: the control, no day at all.
 */
export type Mode = "daily" | "weekly" | "mixed" | "none"

export function modeOf(choice: Choice): Mode {
	if (choice.variant === "F") return "none"
	const cadences = new Set(
		choice.services.map((s) => cadenceOf(choice.variant, choice.country, s)),
	)
	if (cadences.size === 1 && cadences.has("daily")) return "daily"
	if (cadences.size === 1 && cadences.has("weekly")) return "weekly"
	return "mixed"
}

// ---------------------------------------------------------------------------------------------------------
// Who looks, and what they chose

/** A visitor, a member whose wanted titles landed, and a member for whom nothing they wait for did (most weeks). */
export type Viewer = "visitor" | "member" | "quiet"
export const VIEWERS: Record<Viewer, string> = {
	visitor: "Visitor",
	member: "Member, 5 wanted titles landed",
	quiet: "Member, nothing they wait for landed",
}
export type DataCase = "several" | "one" | "none" | "first"
export const CASES: Record<DataCase, string> = {
	several: "Several titles",
	one: "One title",
	none: "Nothing arrived",
	first: "First week of watching",
}
/** In the first-week case GoodWatch started watching yesterday: its first look found what was already there. */
export const STARTED_DAYS = 1
export type KindChoice = "all" | Kind

export interface Want {
	/** Want to See, or a show the member is Watching. */
	state: "want" | "watching"
	/** A new episode since the member last opened My shows. */
	episode?: string
}

/** The sample member: a saved country, four saved services (one small), and the titles they wait for. */
export const MEMBER: {
	country: CountryKey
	services: ServiceKey[]
	wants: Record<string, Want>
} = {
	country: "US",
	services: ["netflix", "hbo-max", "disney-plus", "mubi"],
	wants: {
		"movie-593643": { state: "want" }, // The Menu, Netflix, 1 day
		"show-97951": { state: "watching", episode: "S4 E3" }, // Mayor of Kingstown, Netflix, today
		"show-204154": { state: "want" }, // Scavengers Reign, HBO Max, 5 days
		"movie-1083381": { state: "want" }, // Backrooms, HBO Max, 12 days
		"movie-705996": { state: "want" }, // Decision to Leave, MUBI (small, weekly in C), 3 days
	},
}

export interface Choice {
	variant: Variant
	viewer: Viewer
	data: DataCase
	country: CountryKey
	/** The services looked at. For a member without a choice in the address these are the saved ones. */
	services: ServiceKey[]
	/** True when the services are the member's saved ones, untouched. */
	saved: boolean
	kind: KindChoice
}

export interface Arrival extends Omit<Seed, "on"> {
	key: string
	/** The chosen services that carry it, the one that had it first leading. */
	services: ServiceKey[]
	/** Days since it really arrived on the first of them. The page may not know this: see `when`. */
	days: number
	/** Set for a title the member waits for. Such a title is checked daily, so its day can be trusted. */
	want: Want | null
	/** What the page may say about its day. */
	when: When
}

export const isMember = (viewer: Viewer) => viewer !== "visitor"

function whenOf(
	choice: Choice,
	service: ServiceKey,
	key: string,
	days: number,
	wanted: boolean,
): When {
	if (wanted) return { kind: "day", days, why: "wanted" }
	if (choice.variant === "F") return { kind: "none" }
	const cadence = cadenceOf(choice.variant, choice.country, service)
	if (cadence === "daily") return { kind: "day", days, why: "list" }
	if (cadence === "by-title" && isPopular(key))
		return { kind: "day", days, why: "popular" }
	return { kind: "week", week: days < 7 ? 0 : 1 }
}

/** What arrived on the chosen services, the latest first and the better score first within a day. */
export function arrivalsOf(choice: Choice): Arrival[] {
	if (choice.data === "none") return []
	const wants = choice.viewer === "member" ? MEMBER.wants : {}
	const all = CATALOGUE[choice.country].flatMap((seed): Arrival[] => {
		const { on, ...title } = seed
		const services = choice.services
			.filter((service) => on[service] !== undefined)
			.sort((a, b) => (on[b] ?? 0) - (on[a] ?? 0))
		if (!services.length) return []
		const key = `${seed.type}-${seed.id}`
		const days = on[services[0]] ?? 0
		const want = wants[key] ?? null
		return [
			{
				...title,
				key,
				services,
				days,
				want,
				when: whenOf(choice, services[0], key, days, Boolean(want)),
			},
		]
	})
	const sorted = all.sort((a, b) => a.days - b.days || b.score - a.score)
	if (choice.data === "one") {
		const menu = sorted.find((a) => a.key === "movie-593643")
		return [menu ?? sorted[0]].filter(Boolean)
	}
	// The first week: the first look found a backlog that is not news. A title a member waits for was checked daily
	// before, so it stays. A daily list has one day of real news (today); a weekly recheck has none yet.
	const fresh =
		choice.data === "first"
			? sorted.filter(
					(a) => a.want || (a.when.kind !== "week" && a.days < STARTED_DAYS),
				)
			: sorted
	return fresh.filter((a) => choice.kind === "all" || a.type === choice.kind)
}

export const byScore = (arrivals: Arrival[]) =>
	[...arrivals].sort((a, b) => b.score - a.score || a.days - b.days)

export const wantedOf = (arrivals: Arrival[]) =>
	arrivals.filter((a) => a.want).sort((a, b) => a.days - b.days)

export function groupBy<K extends string | number>(
	arrivals: Arrival[],
	keyOf: (arrival: Arrival) => K,
): [K, Arrival[]][] {
	const groups = new Map<K, Arrival[]>()
	for (const arrival of arrivals) {
		const key = keyOf(arrival)
		groups.set(key, [...(groups.get(key) ?? []), arrival])
	}
	return [...groups]
}

// ---------------------------------------------------------------------------------------------------------
// Words

const WEEKDAYS = [
	"Sunday",
	"Monday",
	"Tuesday",
	"Wednesday",
	"Thursday",
	"Friday",
	"Saturday",
]
const MONTHS = [
	"January",
	"February",
	"March",
	"April",
	"May",
	"June",
	"July",
	"August",
	"September",
	"October",
	"November",
	"December",
]
const dayBefore = (days: number) =>
	new Date(Date.parse(`${TODAY}T12:00:00Z`) - days * 86_400_000)

/** "October 13", or "Tuesday, October 13". A negative number is a day ahead. */
export const dateWords = (days: number, weekday = false) => {
	const date = dayBefore(days)
	const words = `${MONTHS[date.getUTCMonth()]} ${date.getUTCDate()}`
	return weekday ? `${WEEKDAYS[date.getUTCDay()]}, ${words}` : words
}

/** A heading for a day: "Today", "Yesterday", "Tuesday, October 13". */
export const dayName = (days: number) =>
	days === 0 ? "Today" : days === 1 ? "Yesterday" : dateWords(days, true)

/** "today", "yesterday", "on Tuesday", "on October 8". */
export const dayWords = (days: number) =>
	days === 0
		? "today"
		: days === 1
			? "yesterday"
			: days < 7
				? `on ${WEEKDAYS[dayBefore(days).getUTCDay()]}`
				: `on ${dateWords(days)}`

/** "since today", "since yesterday", "since Tuesday", "since October 3". Only said of a title with a known day. */
export const sinceWords = (days: number) =>
	days === 0
		? "since today"
		: days === 1
			? "since yesterday"
			: days < 7
				? `since ${WEEKDAYS[dayBefore(days).getUTCDay()]}`
				: `since ${dateWords(days)}`

/** "today", "on Tuesday", "this week", "last week", or nothing. */
export const whenWords = (when: When) =>
	when.kind === "day"
		? dayWords(when.days)
		: when.kind === "week"
			? when.week === 0
				? "this week"
				: "last week"
			: ""

/** A short stamp: "Today", "Tue, Oct 13", "This week", "Last week". */
export const whenStamp = (when: When) => {
	if (when.kind === "week") return when.week === 0 ? "This week" : "Last week"
	if (when.kind === "none") return ""
	if (when.days < 2) return when.days === 0 ? "Today" : "Yesterday"
	const date = dayBefore(when.days)
	return `${WEEKDAYS[date.getUTCDay()].slice(0, 3)}, ${MONTHS[date.getUTCMonth()].slice(0, 3)} ${date.getUTCDate()}`
}

export const plural = (n: number, one: string, many = `${one}s`) =>
	`${n} ${n === 1 ? one : many}`

export const listWords = (names: string[]) =>
	names.length < 2
		? (names[0] ?? "")
		: `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`

export const serviceNames = (services: ServiceKey[]) =>
	listWords(services.map((service) => SERVICES[service].name))

/** "17 movies and shows", "3 movies", "1 show". */
export function countWords(arrivals: Arrival[]) {
	const movies = arrivals.filter((a) => a.type === "movie").length
	const shows = arrivals.length - movies
	if (movies && shows) return `${arrivals.length} movies and shows`
	return movies ? plural(movies, "movie") : plural(shows, "show")
}

export const runtimeWords = (arrival: Arrival) =>
	arrival.runtime
		? arrival.type === "movie"
			? `${Math.floor(arrival.runtime / 60)}h ${arrival.runtime % 60}m`
			: `${arrival.runtime} min episodes`
		: null

export const titleHref = (arrival: Arrival) =>
	`/${arrival.type}/${arrival.id}-${arrival.title
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-|-$/g, "")}`

/** What a wanted title says: the service, the day (it is checked daily), and a new episode. */
export function wantedWords(arrival: Arrival) {
	const service = SERVICES[arrival.services[0]].name
	return {
		lead:
			arrival.want?.state === "watching"
				? "You are watching"
				: "You want to see",
		landed: `On ${service} ${sinceWords(arrival.days)}`,
		episode: arrival.want?.episode
			? `New episode ${arrival.want.episode}`
			: null,
	}
}

/** Services by how they are checked, for the line that says it: [daily, weekly]. */
export function servicesByCadence(choice: Choice) {
	const daily = choice.services.filter(
		(s) => cadenceOf(choice.variant, choice.country, s) === "daily",
	)
	const weekly = choice.services.filter(
		(s) => cadenceOf(choice.variant, choice.country, s) === "weekly",
	)
	return { daily, weekly }
}

/** The numbers the page says up top, in the words its data allows. */
export function tallyWords(arrivals: Arrival[], mode: Mode) {
	const today = arrivals.filter(
		(a) => a.when.kind === "day" && a.when.days === 0,
	).length
	const thisWeek = arrivals.filter((a) => a.days < 7).length
	const lastWeek = arrivals.length - thisWeek
	if (!arrivals.length) return "Nothing new"
	if (mode === "daily")
		return `${countWords(arrivals)} in the last ${WINDOW_DAYS} days${today ? `, ${today} of them today` : ", none today"}`
	if (mode === "weekly")
		return `${thisWeek} new this week, ${lastWeek} last week`
	return `${countWords(arrivals)} in the last ${WINDOW_DAYS} days`
}

// ---------------------------------------------------------------------------------------------------------
// The page in a search result: its address, title, heading and description

export interface Seo {
	/** The address the real page would have. */
	address: string
	/** Whether a search engine may list it, and why not. */
	indexed: string
	title: string
	heading: string
	description: string
	ogImage: string
}

export function seoOf(choice: Choice, arrivals: Arrival[]): Seo {
	const mode = modeOf(choice)
	const country = COUNTRIES[choice.country]
	const lower = choice.country.toLowerCase()
	const all = choice.services.length === country.services.length
	const one = choice.services.length === 1 ? choice.services[0] : null
	const names = all ? "streaming" : serviceNames(choice.services)
	const tally = tallyWords(arrivals, mode)
	// What the title may promise: "today" needs a day, "this week" needs a week.
	const promise =
		mode === "daily"
			? "new today and this week"
			: mode === "weekly"
				? "new this week"
				: "the latest movies and shows"
	const how =
		mode === "daily"
			? "Updated daily."
			: mode === "weekly"
				? "Updated weekly."
				: `Checked on ${dateWords(0)}.`
	if (isMember(choice.viewer) && choice.saved)
		return {
			address: "/new",
			indexed: "No: personal to the member (noindex)",
			title: "New on your services | GoodWatch",
			heading: "New on your services",
			description: "What arrived on your streaming services lately.",
			ogImage: "None: a personal page has no og image",
		}
	const where = all ? country.inThe : `(${choice.country})`
	return {
		address: one
			? `/new/${lower}/${one}`
			: all
				? `/new/${lower}`
				: `/new/${lower}?services=${choice.services.join(",")}`,
		indexed:
			one || all
				? "Yes"
				: `No: a mix of services points to /new/${lower} as its canonical page`,
		title: `New on ${names} ${where}: ${promise} | GoodWatch`,
		heading: all ? `New on streaming ${country.inThe}` : `New on ${names}`,
		description: `What is new on ${names} ${country.inThe}: ${tally.toLowerCase()}, with GoodWatch scores. ${how}`,
		ogImage: one
			? `The ${names} logo, "New on ${names}", and the four best posters`
			: `"New on streaming", the flag, and the four best posters`,
	}
}

// ---------------------------------------------------------------------------------------------------------
// The page's address

export const pick = <K extends string>(
	choices: Record<K, unknown>,
	value: string | null,
	fallback: NoInfer<K>,
): K => (value !== null && value in choices ? (value as K) : fallback)

/**
 * What the address says. A member without a choice of their own gets their saved country and services; a visitor
 * gets every service of the country (the real page would guess the country from the request). `service` is a
 * shorter way to say one service.
 */
export function choiceOf(params: URLSearchParams): Choice {
	const viewer = pick(VIEWERS, params.get("viewer"), "visitor")
	const member = isMember(viewer)
	const country = pick(
		COUNTRIES,
		params.get("country"),
		member ? MEMBER.country : "US",
	)
	const offered = COUNTRIES[country].services
	const wanted = (params.get("services") ?? params.get("service") ?? "").split(
		",",
	)
	const asked = offered.filter((service) => wanted.includes(service))
	const saved = member && !asked.length && country === MEMBER.country
	return {
		variant: pick(VARIANTS, params.get("variant"), "A"),
		viewer,
		data: pick(CASES, params.get("data"), "several"),
		country,
		services: asked.length ? asked : saved ? MEMBER.services : offered,
		saved,
		kind: pick({ all: 0, movie: 0, show: 0 }, params.get("kind"), "all"),
	}
}
