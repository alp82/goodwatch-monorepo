// Every title's award mark (the top body it has a reported win at), for the poster cards. The browser loads it once
// per session (ui/awards/marks-store.ts); the server answers from memory (server/award-marks.server.ts). About 14 KB,
// 6 KB gzipped. Shape: domain/award-marks.ts `AwardMarksPayload`.
export async function loader() {
	const { awardIndex } = await import("~/server/award-marks.server")
	const index = await awardIndex()
	if (!index)
		return new Response(JSON.stringify({ error: "Award marks are loading" }), {
			status: 503,
			headers: {
				"Content-Type": "application/json",
				"Cache-Control": "no-store",
				"Retry-After": "60",
			},
		})
	return new Response(index.payload, {
		headers: {
			"Content-Type": "application/json",
			"Cache-Control":
				"public, max-age=3600, s-maxage=21600, stale-while-revalidate=86400",
		},
	})
}
