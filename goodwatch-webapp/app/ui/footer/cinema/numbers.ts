// The words the footer cinema puts its numbers in: the trivia montage, the stinger and the end credits. The browser reads
// the numbers from /api/cinema-numbers when someone reaches for the projector, so they never join a page's first bundle.
import type { CinemaNumbers } from "~/domain/cinema-numbers"

/** The world a montage fact plays in: its colors and its flourish (see pixelfx/fx/cinema-show/_montage.js). */
type World = "sea" | "grave" | "snow" | "storm" | "clock" | "sepia"

/** One montage fact, in pixel type: a big number, its label and a wink under it. */
export interface MontageFact {
	n: string
	label: string
	sub: string
	world: World
}

/** The stinger: THANKS FOR WATCHING, then the years it takes to watch everything. */
export interface Finale {
	thanks: string[]
	n: string
	unit: string
	sub: string
}

/** An end-credits block: a role, then the names (numbers) under it. */
export interface CreditBlock {
	role: string
	names: string[]
}

export interface CinemaText {
	facts: MontageFact[]
	finale: Finale
	credits: CreditBlock[]
	/** The montage and the stinger in words, for screen readers. */
	montageSay: string
	finaleSay: string
}

const MINUTES_PER_YEAR = 60 * 24 * 365

const whole = (v: number) => Math.round(v).toLocaleString("en-US")

/** 2.59 billion, 32.3 million, 4,663. */
export function large(v: number) {
	if (v >= 1e9)
		return `${(v / 1e9).toFixed(v >= 1e10 ? 0 : 2).replace(/\.?0+$/, "")} billion`
	if (v >= 1e6)
		return `${(v / 1e6).toFixed(v >= 1e8 ? 0 : 1).replace(/\.0$/, "")} million`
	return whole(v)
}

/** Keeps only what the pixel font can draw, in capitals. */
export function pixelText(v: string) {
	return v
		.toUpperCase()
		.normalize("NFD")
		.replace(/\p{M}/gu, "")
		.replace(/[^0-9A-Z ?+\-.,:/%*'<>=()#]/g, "")
}

const capitalized = (v: string) => `${v.charAt(0).toUpperCase()}${v.slice(1)}`

export function cinemaText(n: CinemaNumbers): CinemaText {
	const years = whole(n.watchMinutes / MINUTES_PER_YEAR)
	const longestHours = whole(n.longestMovie.minutes / 60)
	const said = [
		`${whole(n.sharkMovies)} shark movies. The water was never safe.`,
		`${whole(n.zombieMovies)} zombie movies, and they keep coming back.`,
		`${whole(n.christmasMovies)} Christmas movies. Most of them are the same one.`,
		`${whole(n.fridayThe13thHorror)} horror movies came out on a Friday the 13th.`,
		`The longest movie, ${n.longestMovie.title}, runs ${longestHours} hours. Bring snacks.`,
		`The oldest title is from ${n.oldestTitle.year}: ${n.oldestTitle.title}.`,
	]
	return {
		facts: [
			{
				n: whole(n.sharkMovies),
				label: "SHARK MOVIES",
				sub: "THE WATER WAS NEVER SAFE",
				world: "sea",
			},
			{
				n: whole(n.zombieMovies),
				label: "ZOMBIE MOVIES",
				sub: "AND THEY KEEP COMING BACK",
				world: "grave",
			},
			{
				n: whole(n.christmasMovies),
				label: "CHRISTMAS MOVIES",
				sub: "MOST OF THEM ARE THE SAME ONE",
				world: "snow",
			},
			{
				n: whole(n.fridayThe13thHorror),
				label: "HORROR MOVIES",
				sub: "RELEASED ON A FRIDAY THE 13TH",
				world: "storm",
			},
			{
				n: `${longestHours} HOURS`,
				label: "THE LONGEST MOVIE",
				sub: pixelText(`${n.longestMovie.title}. Bring snacks.`),
				world: "clock",
			},
			{
				n: String(n.oldestTitle.year),
				label: "THE OLDEST TITLE",
				sub: pixelText(n.oldestTitle.title),
				world: "sepia",
			},
		],
		finale: {
			thanks: ["THANKS FOR", "WATCHING"],
			n: years,
			unit: "YEARS",
			sub: "EVERY TITLE HERE, BACK TO BACK",
		},
		credits: [
			{ role: "Starring", names: [`${whole(n.people)} people`] },
			{ role: "As", names: [`${whole(n.characters)} characters`] },
			{
				role: "In",
				names: [
					`${whole(n.movies)} movies`,
					`${whole(n.shows)} shows`,
					`${whole(n.episodes)} episodes`,
				],
			},
			{ role: "Running time", names: [`${years} years, give or take`] },
			{
				role: "Audience",
				names: [
					`${large(n.letterboxdRatings)} Letterboxd ratings`,
					`${large(n.imdbVotes)} IMDb votes`,
					`${large(n.metacriticUserRatings)} Metacritic user ratings`,
					`${large(n.tmdbVotes)} TMDB votes`,
				],
			},
			{
				role: "Critics",
				names: [`${whole(n.metacriticCriticReviews)} reviews`],
			},
			{
				role: "Most frequent role",
				names: [
					`${capitalized(n.mostCommonRole.role)}, ${whole(n.mostCommonRole.credits)} times`,
				],
			},
			{
				role: "Most common title",
				names: [
					`${n.mostCommonTitle.title}, ${whole(n.mostCommonTitle.movies)} movies`,
				],
			},
			{
				role: "Shot on location",
				names: [
					`${whole(n.countries)} countries, ${whole(n.services)} services`,
				],
			},
			{ role: "Trailers", names: [whole(n.trailers)] },
			{
				role: "Tropes",
				names: [
					`${whole(n.tropeKinds)} kinds, ${whole(n.tropeMentions)} sightings`,
				],
			},
			{ role: "Shark wrangling", names: [`${whole(n.sharkMovies)} movies`] },
			{
				role: "Snow department",
				names: [`${whole(n.christmasMovies)} Christmas movies`],
			},
			{
				role: "Special thanks",
				names: [
					`${whole(n.watchers)} members who log what they watch`,
					"and you, for reading the credits",
				],
			},
		],
		montageSay: `Did you know? ${said.join(" ")}`,
		finaleSay: `Thanks for watching. ${years} years: every movie and episode on GoodWatch, back to back.`,
	}
}
