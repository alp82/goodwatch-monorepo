// The catalog numbers for the footer cinema's montage, stinger and end credits, picked from the /stats snapshot. The
// cinema asks for them when someone reaches for its projector; until the first snapshot is counted it plays without
// them. Shape: domain/cinema-numbers.ts `CinemaNumbers`.
import { cinemaNumbersFrom } from "~/domain/cinema-numbers"

export async function loader() {
	const { readStatsSnapshot } = await import("~/server/stats/stats.server")
	const snapshot = await readStatsSnapshot()
	const numbers = snapshot ? cinemaNumbersFrom(snapshot) : null
	if (!numbers)
		return new Response(
			JSON.stringify({ error: "The numbers are being counted" }),
			{
				status: 503,
				headers: {
					"Content-Type": "application/json",
					"Cache-Control": "no-store",
					"Retry-After": "60",
				},
			},
		)
	return new Response(JSON.stringify(numbers), {
		headers: {
			"Content-Type": "application/json",
			"Cache-Control":
				"public, max-age=3600, s-maxage=21600, stale-while-revalidate=86400",
		},
	})
}
