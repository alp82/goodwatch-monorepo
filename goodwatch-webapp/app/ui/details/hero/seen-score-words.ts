// The words of the question before a movie stops being Seen (NotSeenConfirm): what Not seen removes, and the
// button that does it. A score counts as Seen, so it goes too; so do the watches the member logged.
import type { Score } from "~/server/scores.server"
import { scoreLabels } from "../../../utils/ratings.ts"

/** `watches` is the number of watches the member logged, or null while the log is read. */
export function notSeenWords(score: Score | null, watches: number | null) {
	const scored = score ? `your score of ${score} (${scoreLabels[score]})` : ""
	const logged = watches
		? watches === 1
			? "your watch"
			: `your ${watches} watches`
		: ""
	const what = [scored, logged].filter(Boolean).join(" and ")
	return {
		text: `${what ? `This removes ${what}.` : "This marks it as not seen."}${score ? " Only movies you've seen have a score." : ""}`,
		action:
			score && watches
				? "Remove score and watches"
				: score
					? "Remove score"
					: watches === 1
						? "Remove watch"
						: watches
							? "Remove watches"
							: "Mark as not seen",
	}
}
