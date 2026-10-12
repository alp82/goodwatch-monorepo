// PROTOTYPE - throwaway (#489, prototype C). The prepared data and the words of /prototype/new-on-services.
// Nothing is read from a service: the titles below were copied once from the production catalogue on 12 October
// 2026 (the United States and Germany, subscription and free offers first found since 30 September) and are frozen
// here. Every date on the page counts back from that day, so the page looks the same on any day it is opened.
//
// THE LIMIT THE PAGE IS DESIGNED AROUND. `on` holds the days since GoodWatch first FOUND the offer, not since the
// title arrived. Only titles some member waits for are checked every day; the rest of the catalogue is checked again
// within about two weeks. So a title found today arrived at some point in the last two weeks, and "arrived today" is
// true only for the titles a member waits for. The numbers are the real ones: 35 of the 62 American titles were
// found on the one day, which is a check that caught up, not a day on which 35 titles arrived. Two were moved to
// cover the cases the ticket asks for: The Menu to 1 day, Backrooms to 12 days.

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
export type CountryKey = "US" | "DE"

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
		],
	},
	DE: {
		name: "Germany",
		inThe: "in Germany",
		services: ["netflix", "prime-video", "disney-plus", "wow"],
	},
}

/** How far back the page looks, in days since an offer was found. */
export const WINDOW_DAYS = 14
/** The day the data was frozen, which the page calls today. */
export const TODAY = "2026-10-12"

interface Seed {
	type: Kind
	id: number
	title: string
	year: number
	score: number
	runtime: number | null
	poster: string
	backdrop: string
	/** Days since the offer was first found, by service. */
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
			on: { peacock: 0 },
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
			on: { "hbo-max": 0 },
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
			on: { "paramount-plus": 0 },
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
			on: { "prime-video": 0 },
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
			on: { peacock: 0 },
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
			on: { "hbo-max": 0 },
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
			on: { netflix: 0 },
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
			on: { "paramount-plus": 0 },
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
			on: { peacock: 0 },
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
			on: { "paramount-plus": 0 },
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
			on: { "prime-video": 0 },
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
			on: { "hbo-max": 0 },
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
			on: { "prime-video": 0 },
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
			on: { "prime-video": 0 },
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
			on: { "paramount-plus": 0 },
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
			on: { hulu: 0 },
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
			on: { netflix: 0 },
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
			on: { netflix: 0 },
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
			on: { hulu: 0 },
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
			on: { hulu: 0 },
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
			on: { "hbo-max": 0 },
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
			on: { hulu: 0 },
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
			on: { netflix: 0 },
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
			on: { "disney-plus": 0 },
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
			on: { netflix: 0 },
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
			on: { "disney-plus": 0 },
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
			on: { "hbo-max": 0 },
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
			on: { netflix: 0 },
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
			on: { hulu: 0 },
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
			on: { "prime-video": 0 },
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
			on: { wow: 0 },
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
			on: { "prime-video": 0 },
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
			on: { "disney-plus": 0 },
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
			on: { "disney-plus": 0 },
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
			on: { "prime-video": 0 },
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
			on: { netflix: 0 },
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
			on: { netflix: 0 },
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
			on: { wow: 0 },
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
			on: { netflix: 0 },
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
}

// ---------------------------------------------------------------------------------------------------------
// Who looks, and what they chose

/** A visitor, a member whose wanted titles landed, and a member for whom nothing they wait for did (most weeks). */
export type Viewer = "visitor" | "member" | "quiet"
export const VIEWERS: Record<Viewer, string> = {
	visitor: "Visitor",
	member: "Member, 4 wanted titles landed",
	quiet: "Member, nothing they wait for landed",
}
export type DataCase = "several" | "one" | "none"
export const CASES: Record<DataCase, string> = {
	several: "Several titles",
	one: "One title",
	none: "Nothing arrived",
}
export type KindChoice = "all" | Kind

export interface Want {
	/** Want to See, or a show the member is Watching. */
	state: "want" | "watching"
	/** A new episode since the member last opened My shows. */
	episode?: string
}

/** The sample member: a saved country, three saved services, and the titles they wait for. */
export const MEMBER: {
	country: CountryKey
	services: ServiceKey[]
	wants: Record<string, Want>
} = {
	country: "US",
	services: ["netflix", "hbo-max", "disney-plus"],
	wants: {
		"movie-593643": { state: "want" }, // The Menu, found 1 day ago
		"show-97951": { state: "watching", episode: "S4 E3" }, // Mayor of Kingstown: a new episode and an arrival
		"show-204154": { state: "want" }, // Scavengers Reign
		"movie-1083381": { state: "want" }, // Backrooms, found 12 days ago
	},
}

export interface Choice {
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
	/** Days since it was found on the first of them. */
	days: number
	/** Set for a title the member waits for. Such a title is checked daily, so its day can be trusted. */
	want: Want | null
}

export const isMember = (viewer: Viewer) => viewer !== "visitor"

/** What arrived on the chosen services, the latest found first and the better score first within a day. */
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
		return [
			{
				...title,
				key,
				services,
				days: on[services[0]] ?? 0,
				want: wants[key] ?? null,
			},
		]
	})
	const sorted = all.sort((a, b) => a.days - b.days || b.score - a.score)
	if (choice.data === "one")
		return sorted
			.filter((a) => a.key === "movie-593643" || choice.country !== "US")
			.slice(0, 1)
	return sorted.filter((a) => choice.kind === "all" || a.type === choice.kind)
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

/** By service, in the order chosen. A title two services got is in both. */
export const byService = (arrivals: Arrival[], services: ServiceKey[]) =>
	services
		.map(
			(service) =>
				[
					service,
					arrivals.filter((a) => a.services.includes(service)),
				] as const,
		)
		.filter(([, list]) => list.length)

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

/** "12 October", or "Monday 12 October". */
export const dateWords = (days: number, weekday = false) => {
	const date = dayBefore(days)
	const words = `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]}`
	return weekday ? `${WEEKDAYS[date.getUTCDay()]} ${words}` : words
}

/** A heading for a day: "Today", "Yesterday", "Thursday 8 October". */
export const dayName = (days: number) =>
	days === 0 ? "Today" : days === 1 ? "Yesterday" : dateWords(days, true)

/** "since today", "since yesterday", "since Thursday", "for 12 days". Only said of a title checked daily. */
export const sinceWords = (days: number) =>
	days === 0
		? "since today"
		: days === 1
			? "since yesterday"
			: days < 7
				? `since ${WEEKDAYS[dayBefore(days).getUTCDay()]}`
				: `for ${days} days`

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

// ---------------------------------------------------------------------------------------------------------
// The page in a search result: its address, title, heading and description

export interface Seo {
	/** The address the real page would have. */
	address: string
	/** Whether a search engine may list it, and why not. */
	indexed: string
	title: string
	heading: string
	line: string
	description: string
	ogImage: string
}

export function seoOf(choice: Choice, arrivals: Arrival[]): Seo {
	const country = COUNTRIES[choice.country]
	const lower = choice.country.toLowerCase()
	const all = choice.services.length === country.services.length
	const one = choice.services.length === 1 ? choice.services[0] : null
	const names = serviceNames(choice.services)
	const count = arrivals.length ? countWords(arrivals) : "nothing"
	const found = `found ${country.inThe} in the last two weeks`
	if (isMember(choice.viewer) && choice.saved)
		return {
			address: "/new",
			indexed: "No: personal to the member (noindex)",
			title: "New on your services | GoodWatch",
			heading: "New on your services",
			line: `${names} ${country.inThe}`,
			description: "What arrived on your streaming services lately.",
			ogImage: "None: a personal page has no og image",
		}
	if (one)
		return {
			address: `/new/${lower}/${one}`,
			indexed: "Yes",
			title: `New on ${names} (${choice.country}): the latest movies and shows | GoodWatch`,
			heading: `New on ${names}`,
			line: `${count} ${found}`,
			description: `What is new on ${names} ${country.inThe}: ${count} found in the last two weeks, with GoodWatch scores. Checked on ${dateWords(0)} 2026.`,
			ogImage: `The ${names} logo, "New on ${names}", and the four best posters`,
		}
	if (all)
		return {
			address: `/new/${lower}`,
			indexed: "Yes",
			title: `New on streaming ${country.inThe}: the latest movies and shows | GoodWatch`,
			heading: `New on streaming ${country.inThe}`,
			line: `${count} ${found}, on ${plural(choice.services.length, "service")}`,
			description: `What is new on ${names} ${country.inThe}: ${count} found in the last two weeks, with GoodWatch scores. Checked on ${dateWords(0)} 2026.`,
			ogImage: `"New on streaming", the flag, and the four best posters`,
		}
	return {
		address: `/new/${lower}?services=${choice.services.join(",")}`,
		indexed: `No: a mix of services points to /new/${lower} as its canonical page`,
		title: `New on ${names} (${choice.country}) | GoodWatch`,
		heading: `New on ${names}`,
		line: `${count} ${found}`,
		description: `What is new on ${names} ${country.inThe}.`,
		ogImage: `The og image of /new/${lower}`,
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
 * gets every service of the country (the real page would guess the country from the request).
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
	const asked = offered.filter((service) =>
		(params.get("services") ?? "").split(",").includes(service),
	)
	const saved = member && !asked.length && country === MEMBER.country
	return {
		viewer,
		data: pick(CASES, params.get("data"), "several"),
		country,
		services: asked.length ? asked : saved ? MEMBER.services : offered,
		saved,
		kind: pick({ all: 0, movie: 0, show: 0 }, params.get("kind"), "all"),
	}
}
