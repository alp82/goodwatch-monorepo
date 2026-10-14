import resources from "../locales/media/templates.json" with { type: "json" }
import * as F from "../ui/fingerprint/fingerprintText.ts"
import {
	ageInfo,
	agreement,
	SOURCE_KEYWORDS,
	titleQuestions,
} from "../ui/details/titleQuestions.ts"
import { createHash } from "node:crypto"
const proseRevision = (text: string) =>
	createHash("sha256").update(text, "utf8").digest("hex")
import {
	presentationLanguage,
	canonicalMediaTitle,
} from "../utils/media-presentation.ts"
import type { MovieResult, ShowResult } from "./types/details-types"
import type { TitleTemplateProse } from "../utils/media-template-types"
export { resources as mediaTemplateResources }
export function formatMediaTemplate(
	locale: string,
	key: keyof typeof resources.locales.en,
	values: Record<string, string | number> = {},
) {
	const pack = resources.locales[presentationLanguage(locale)]
	return pack[key].replace(/\{([a-zA-Z]+)\}/g, (_, name: string) => {
		if (!(name in values))
			throw new Error(`Missing media template placeholder: ${name}`)
		return String(values[name])
	})
}

/** A selected-language factual projection after canonical facts/alignment. All UI controls stay English. */
export function presentTitleTemplates<T extends MovieResult | ShowResult>(
	media: T,
	country: string,
	selected: string,
): T & { templateProse?: TitleTemplateProse } {
	const language = presentationLanguage(selected)
	if (language === "en") return media
	const d = media.details
	const canonical = {
		...media,
		details: { ...d, title: canonicalMediaTitle(d) },
		templateProse: undefined,
	}
	const questions = titleQuestions(canonical, country)
	const format = (
		key: keyof typeof resources.locales.en,
		values: Record<string, string | number> = {},
	) => formatMediaTemplate(language, key, values)
	const raw = d as unknown as Record<string, unknown>
	const year = (value: unknown) =>
		value ? new Date(value as number | string).getUTCFullYear() : null
	const numeric = (key: string) =>
		typeof raw[key] === "number" ? (raw[key] as number) : null
	const answers: Partial<Record<string, string>> = {}
	const services = [
		...new Set(
			media.streaming_availabilities
				.map(
					(a) =>
						media.streaming_services.find(
							(s) => s.tmdb_id === a.streaming_service_id,
						)?.name,
				)
				.filter((name): name is string => !!name),
		),
	]
	answers.stream = services.length
		? format("options", { country, services: services.join(", ") })
		: format("noOptions", { country })
	if (d.goodwatch_overall_score_normalized_percent != null)
		answers.worth = format("score", {
			score: Math.round(d.goodwatch_overall_score_normalized_percent),
		})
	const age = ageInfo(media, country)
	if (age.cert)
		answers.rated = format("rating", { country: age.cc, rating: age.cert })
	if (media.mediaType === "movie" && numeric("runtime"))
		answers.length = format("runtime", {
			hours: Math.floor(numeric("runtime")! / 60),
			minutes: numeric("runtime")! % 60,
		})
	if (
		media.mediaType === "show" &&
		numeric("number_of_seasons") &&
		numeric("number_of_episodes") != null
	)
		answers.length = format("seasons", {
			seasons: numeric("number_of_seasons")!,
			episodes: numeric("number_of_episodes")!,
		})
	const { critics, audience } = agreement(media)
	if (critics != null && audience != null)
		answers.agree = format("agreement", { critics, audience })
	if (d.budget && d.revenue)
		answers.boxoffice = format("boxoffice", {
			budget: `$${d.budget}`,
			revenue: `$${d.revenue}`,
		})
	const from = year(raw.first_air_date),
		to = year(raw.last_air_date)
	if (from)
		answers.aired = format("aired", {
			from,
			to: to ?? from,
			status: format(raw.in_production ? "running" : "ended"),
		})
	answers.language = format("originalLanguage", {
		language: d.original_language_code ?? "und",
	})
	answers.countries = format("countries", {
		count: d.streaming_country_codes?.length ?? 0,
	})
	answers.tropes = format("tropes", {
		count: d.tropes_count ?? d.tropes?.length ?? 0,
	})
	const keywords = d.keywords ?? []
	const source =
		keywords.includes(SOURCE_KEYWORDS[0]) ||
		(media.fingerprint?.scores.biographical ?? 0) >= 7
			? "trueStory"
			: keywords.includes(SOURCE_KEYWORDS[1])
			? "novel"
			: keywords.includes(SOURCE_KEYWORDS[2])
			? "comic"
			: keywords.includes(SOURCE_KEYWORDS[3])
			? "game"
			: undefined
	if (source) answers.source = format(source)
	const questionKeys = {
		stream: "streamQ",
		worth: "worthQ",
		rated: "ratedQ",
		length: media.mediaType === "movie" ? "lengthMovieQ" : "lengthShowQ",
		source: "sourceQ",
		agree: "agreeQ",
		boxoffice: "boxofficeQ",
		aired: "airedQ",
		language: "languageQ",
		countries: "countriesQ",
		tropes: "tropesQ",
	} as const
	const localizedQuestions = questions.map((q) => ({
		...q,
		q: answers[q.id] ? format(questionKeys[q.id], { title: d.title }) : q.q,
		a: answers[q.id] ?? q.a,
		language: answers[q.id] ? language : "en",
		sourceRevision: proseRevision(`${q.q}\n${q.a}`),
	}))
	const fingerprint: TitleTemplateProse["fingerprint"] = {
		line: "",
		skip: [],
		briefs: {},
		sentences: {},
	}
	if (media.fingerprint) {
		const t: F.TitleInput = {
			title: canonicalMediaTitle(d),
			year: "",
			genres: d.genres,
			mediaType: media.mediaType,
			fingerprint: media.fingerprint,
		}
		const skipKeys = [
			"skipLaugh",
			"skipUplifting",
			"skipFast",
			"skipDistracted",
			"skipViolence",
			"skipScare",
			"skipFamily",
			"skipQuiet",
			"skipDark",
		] as const
		const canonicalSkip = F.skipIf(t)
		fingerprint.skipLanguages = canonicalSkip.map((text) =>
			skipKeys.some((key) => resources.locales.en[key] === text)
				? language
				: "en",
		)
		fingerprint.skip = canonicalSkip.map((text) => {
			const key = skipKeys.find((key) => resources.locales.en[key] === text)
			return key ? format(key) : text
		})
		const levels = ["none", "low", "medium", "high", "veryHigh"] as const
		const pillars = [
			"Energy",
			"Heart",
			"Humor",
			"World",
			"Craft",
			"Style",
		] as const
		for (const pillar of pillars) {
			const score = media.fingerprint.pillars[pillar]
			const level = format(levels[Math.max(0, Math.min(4, Math.round(score)))])
			fingerprint.sentences[pillar] = format("pillar", {
				pillar: format(pillar),
				level,
				score,
			})
			fingerprint.briefs[pillar] = {
				verdict: level,
				note: "",
				drivers: F.pillarDrivers(t, pillar),
			}
		}
		fingerprint.line =
			pillars
				.filter((p) => media.fingerprint!.pillars[p] >= 3)
				.slice(0, 2)
				.map((p) => fingerprint.sentences[p])
				.join(" ") || fingerprint.sentences.Energy
	}
	return {
		...media,
		templateProse: {
			language,
			revision: resources.revision,
			sourceRevision: proseRevision(
				JSON.stringify({
					revision: resources.revision,
					questions,
					scores: media.fingerprint?.scores,
					pillars: media.fingerprint?.pillars,
					country,
				}),
			),
			country,
			questions: localizedQuestions,
			fingerprint,
		},
	}
}
