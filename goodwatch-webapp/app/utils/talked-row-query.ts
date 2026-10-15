import type { TalkedRow } from "../domain/talked-about-now.ts"
import { mediaLanguageUrl, presentationLanguage } from "./media-presentation.ts"

/** Only media fields vary; source-language social prose and the canonical board order stay literal. */
export function talkedRowQuery(language: string) {
	const selected = presentationLanguage(language)
	return {
		queryKey: ["talked-about-now", selected] as const,
		queryFn: async (): Promise<TalkedRow | null> => {
			const response = await fetch(
				mediaLanguageUrl("/api/talked-about-now", selected),
			)
			if (response.status === 404) return null
			if (!response.ok) throw new Error(`Talked about now: ${response.status}`)
			return ((await response.json()) as { row: TalkedRow | null }).row
		},
	}
}
