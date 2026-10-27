// PROTOTYPE (start page lab, round 4): members with less data than the owner, for empty and sparse states. The bar's
// "Member data" section picks one (`?persona=`); the member pages get the trimmed data through useLab().data.member.
import type { LabMember } from "~/server/prototype-start-lab.server"

export const PERSONAS: { key: string; name: string; make: (m: LabMember) => LabMember }[] = [
	{ key: "full", name: "Full (the owner's data)", make: (m) => m },
	{
		key: "few",
		name: "A few of everything",
		// One show in progress, two Wishlist movies, four ratings: For you is still forming.
		make: (m) => ({
			...m,
			ratings: 4,
			shows: m.shows.map((s, i) => ({ ...s, titles: i === 0 ? s.titles.slice(0, 1) : [] })),
			wishlistMovies: m.wishlistMovies.slice(0, 2),
			forYou: m.forYou.slice(0, 6),
			forYouShows: m.forYouShows.slice(0, 3),
		}),
	},
	{
		key: "no-shows",
		name: "No shows",
		make: (m) => ({
			...m,
			shows: m.shows.map((s) => ({ ...s, titles: [] })),
			tonight: m.wishlistMovies.slice(0, 1),
			tonightRaw: null,
		}),
	},
	{
		key: "no-wishlist",
		name: "Empty Wishlist",
		make: (m) => ({
			...m,
			wishlistMovies: [],
			shows: m.shows.map((s) => (/want/i.test(s.name) ? { ...s, titles: [] } : s)),
		}),
	},
	{
		key: "new",
		name: "Brand new (nothing yet)",
		make: (m) => ({
			...m,
			ratings: 0,
			tonight: [],
			tonightRaw: null,
			shows: m.shows.map((s) => ({ ...s, titles: [] })),
			wishlistMovies: [],
			forYou: [],
			forYouShows: [],
		}),
	},
]

export const personaFor = (key: string | undefined) => PERSONAS.find((p) => p.key === key) ?? PERSONAS[0]
