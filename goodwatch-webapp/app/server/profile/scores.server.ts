import { createHash } from "node:crypto"
import { seesPart, type ProfileShell } from "~/domain/profile"
import { scoresPage, type ScoresChoice } from "~/domain/profile-scores"
import { getProfileLibrary, type ProfileLibrary } from "./library.server"
import { yourScores } from "./your-scores.server"

const scoredTitles = (library: ProfileLibrary) =>
	[...library.scored.values()].map(({ genres: _genres, ...title }) => title)

/** Every caller, including each pagination request, must supply a freshly authorized profile shell. */
export async function loadProfileScores(
	ownerId: string,
	shell: ProfileShell,
	choice?: ScoresChoice,
	you: Record<string, number> | null = null,
	page?: { tier?: number; offset: number },
) {
	if (!seesPart(shell, "scores")) return scoresPage([], choice)
	const library = await getProfileLibrary(ownerId)
	return scoresPage(scoredTitles(library), choice, you, page)
}

export async function loadProfileScoreView(
	ownerId: string,
	viewerId: string | null,
	shell: ProfileShell,
	choice: ScoresChoice,
	batch?: { tier?: number; offset: number },
	expectedRevision?: string | null,
) {
	if (!seesPart(shell, "scores"))
		return {
			page: scoresPage([], choice),
			you: null,
			viewerKey: viewerId,
			revision: "hidden",
		}
	const library = await getProfileLibrary(ownerId)
	// Compute the comparison over the whole library, but send only the current batch's visitor scores.
	const yours =
		viewerId && shell.viewer === "member"
			? await yourScores(viewerId, library.scored.keys())
			: null
	const revision = createHash("sha256")
		.update(
			JSON.stringify([
				[...library.scored.values()].sort((a, b) => a.key.localeCompare(b.key)),
				yours && Object.entries(yours).sort(([a], [b]) => a.localeCompare(b)),
			]),
		)
		.digest("hex")
		.slice(0, 20)
	if (expectedRevision && expectedRevision !== revision)
		throw new Response("Scores changed; refresh to continue", {
			status: 409,
			headers: { "Cache-Control": "private, no-store" },
		})
	const page = scoresPage(scoredTitles(library), choice, yours, batch)
	const you =
		yours === null
			? null
			: Object.fromEntries(
					page.tiers
						.flatMap((t) => t.titles)
						.filter((t) => yours[t.key] != null)
						.map((t) => [t.key, yours[t.key]]),
				)
	return { page, you, viewerKey: viewerId, revision }
}
