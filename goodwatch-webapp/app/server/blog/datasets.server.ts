// The downloadable data of a blog post, for its Dataset structured data. A post without data has none.
import study from "~/content/blog/streaming-by-country-2026/data.json"
import type { DatasetInfo } from "~/utils/blog-structured-data"

const fmt = (n: number) => n.toLocaleString("en-US")

const streamingStudy = (): DatasetInfo => {
	const base = study.csv.base
	return {
		name: "Where well-known movies and shows stream, country by country (2026)",
		description: `How many of ${fmt(study.movies.titles)} movies and ${fmt(study.shows.titles)} shows with at least 50,000 IMDb votes stream on a subscription, free with ads, with a library card, or to rent or buy, in each of ${study.countries.length} countries, read from TMDB's watch providers (data from JustWatch) on ${study.snapshot.date}.`,
		date: study.snapshot.date,
		keywords: [
			"streaming",
			"Netflix",
			"streaming catalogue",
			"movies",
			"TV shows",
			"JustWatch",
			"countries",
		],
		files: [
			{
				name: "Streaming by country",
				path: `${base}/${study.csv.countries}`,
				description: "One row per country with the counts of the study.",
			},
			{
				name: "Streaming by title",
				path: `${base}/${study.csv.titles}`,
				description:
					"One row per movie and show: in how many countries it streams, and how.",
			},
		],
		sources: [
			{
				name: "TMDB watch providers",
				url: "https://developer.themoviedb.org/reference/movie-watch-providers",
			},
			{ name: "JustWatch", url: "https://www.justwatch.com" },
		],
	}
}

const DATASETS: Record<string, () => DatasetInfo> = {
	[study.slug]: streamingStudy,
}

export const blogDataset = (slug: string) => DATASETS[slug]?.() ?? null
