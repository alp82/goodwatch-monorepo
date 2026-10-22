import type { Candidate } from "../../../packages/yepwatch-contracts/continuous.ts"
/** Existing canonical details getter owns videos/genre metadata; only transport projection here. */
export async function enrichContinuousCandidates(
	candidates: Candidate[],
	country: string,
): Promise<Candidate[]> {
	const { getDetailsForMovie, getDetailsForShow } = await import(
		"../details.server.ts"
	)
	const result: Candidate[] = []
	for (let offset = 0; offset < candidates.length; offset += 4)
		result.push(
			...(await Promise.all(
				candidates.slice(offset, offset + 4).map(async (c) => {
					try {
						const media =
							c.identity.kind === "movie"
								? await getDetailsForMovie(
										{
											movieId: String(c.identity.tmdbId),
											country,
											language: "en",
										},
										{ canonical: true },
									)
								: await getDetailsForShow(
										{
											showId: String(c.identity.tmdbId),
											country,
											language: "en",
										},
										{ canonical: true },
									)
						if (!media?.details) return c
						const trailer = media.videos.trailers?.find((video) =>
							/^[\w-]{11}$/.test(video.key),
						)
						return {
							...c,
							trailerUrl: trailer
								? `https://www.youtube.com/watch?v=${trailer.key}`
								: null,
							genres: media.details.genres ?? [],
						}
					} catch {
						return c
					} // Missing optional metadata remains absent; do not manufacture a video or fail offers.
				}),
			)),
		)
	return result
}
