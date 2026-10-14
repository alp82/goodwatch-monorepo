import type { TitleQuestion } from "../ui/details/titleQuestions"
import type { PillarBrief } from "../ui/fingerprint/fingerprintText"
export interface TitleTemplateProse {
	language: string
	revision: string
	sourceRevision: string
	country: string
	questions: (TitleQuestion & { language: string; sourceRevision: string })[]
	fingerprint: {
		line: string
		skip: string[]
		skipLanguages?: string[]
		briefs: Record<string, PillarBrief>
		sentences: Record<string, string>
	}
}
