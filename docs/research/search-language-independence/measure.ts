// Research script for issue #106. Standalone: bun docs/research/search-language-independence/measure.ts
// Copies the question shapes of readFlags (full criteria) and readWantAvoid ("short" wording)
// from goodwatch-webapp/app/server/prototype-jev-vector.server.ts.
// Reads TYPESAFE_API_KEY from the env, or from the file named in TYPESAFE_KEY_FILE.
import { readFileSync, writeFileSync } from "node:fs"
import { FINGERPRINT_META } from "../../../goodwatch-webapp/app/ui/fingerprint/fingerprintMeta"
import { VALID_FINGERPRINT_KEYS } from "../../../goodwatch-webapp/app/server/utils/fingerprint"

const keyFromFile = () =>
	process.env.TYPESAFE_KEY_FILE
		? readFileSync(process.env.TYPESAFE_KEY_FILE, "utf8").split("\n").find((l) => l.startsWith("TYPESAFE_API_KEY="))?.split("=", 2)[1]?.trim()
		: undefined
const KEY = process.env.TYPESAFE_API_KEY || keyFromFile()
if (!KEY) throw new Error("TYPESAFE_API_KEY missing")
const USD = 0.042 / 1_000_000
let totalTokens = 0

const jev = async (state: unknown, questions: Record<string, unknown>) => {
	const started = Date.now()
	for (let attempt = 0; ; attempt++) {
		const response = await fetch("https://api.typesafe.ai/v1/systemone", {
			method: "POST",
			headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
			body: JSON.stringify({ state, model: "jev-latest", questions }),
		})
		if ((response.status === 429 || response.status === 529) && attempt < 5) {
			await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt))
			continue
		}
		if (!response.ok) throw new Error(`Jev ${response.status}: ${(await response.text()).slice(0, 300)}`)
		const body = (await response.json()) as any
		totalTokens += body.usage.input_tokens
		return { answers: body.answers as Record<string, any>, tokens: body.usage.input_tokens as number, ms: Date.now() - started }
	}
}

const label = (key: string) => FINGERPRINT_META[key]?.label ?? key
const describe = (key: string) => `"${label(key)}" (${FINGERPRINT_META[key]?.description ?? key})`

// --- copied shapes -------------------------------------------------------------------------
const SHORT_TASK =
	"A person describes what they want to watch in `request`. Each question names one quality of movies and shows. 'Asks for' includes clear implication. 'Avoid' includes wanting little of it."
const readWantAvoid = async (request: string) => {
	const questions: Record<string, unknown> = {}
	for (const key of VALID_FINGERPRINT_KEYS) {
		questions[`want:${key}`] = { type: "noul", instructions: `Does \`request\` ask for ${describe(key)}?` }
		questions[`avoid:${key}`] = { type: "noul", instructions: `Does \`request\` ask to avoid ${describe(key)}?` }
	}
	const r = await jev({ task: SHORT_TASK, request }, questions)
	const weights: Record<string, number> = {}
	for (const key of VALID_FINGERPRINT_KEYS) weights[key] = 2 * (r.answers[`want:${key}`].noul - r.answers[`avoid:${key}`].noul)
	return { weights, tokens: r.tokens, ms: r.ms }
}

const FLAGS: [string, string, string][] = [
	["movie", "Movie", "A feature film, not a series."],
	["show", "TV show", "A series with episodes, not a film."],
	["is_anime", "Anime", "Japanese-style animation (anime)."],
	["animated", "Animated", "Any animated production, as opposed to live action."],
	["live_action", "Live action", "Filmed with real actors, not animated."],
	["suitability_adults", "Adults", "Mature themes, not for kids."],
	["suitability_date_night", "Date night", "Great for a romantic evening."],
	["suitability_family", "Family movie night", "Good for watching with the whole family."],
	["suitability_friends", "Friends night", "A fun watch with a group of friends."],
	["suitability_group_party", "Party vibe", "Lively and great for a group setting."],
	["suitability_intergenerational", "Intergenerational", "Enjoyable for a wide range of ages, for example with parents or grandparents."],
	["suitability_kids", "Kids", "Made for children."],
	["suitability_partner", "Partner watch", "Good to watch with a significant other."],
	["suitability_public_viewing_safe", "Public viewing safe", "No awkward scenes when watching in public."],
	["suitability_solo_watch", "Solo watch", "Best enjoyed alone."],
	["suitability_teens", "Teens", "Aimed at a teenage audience."],
	["context_is_background_friendly", "Background watch", "Doesn't require full attention."],
	["context_is_binge_friendly", "Binge-friendly", "Makes you want to watch episode after episode."],
	["context_is_comfort_watch", "Comfort watch", "Cozy, familiar, and reassuring."],
	["context_is_drop_in_friendly", "Drop-in friendly", "Easy to follow even if you miss a bit."],
	["context_is_pure_escapism", "Pure escapism", "Lets you completely disconnect from reality."],
	["context_is_thought_provoking", "Thought-provoking", "Leaves you with a lot to think about."],
]
const PHRASE_INSTRUCTIONS =
	"A person describes what they want to watch in `request`. A search engine will look for one phrase in written descriptions of titles. Which phrase is the best search phrase: the one that most specifically names what the person wants to find in the title?"
const phraseQuestion = (candidates: string[]) => ({ type: "choice", instructions: PHRASE_INSTRUCTIONS, criteria: Object.fromEntries(candidates.map((c) => [c, null])) })

const readFlags = async (request: string, words: string[], candidates: string[]) => {
	const questions: Record<string, unknown> = {}
	for (const [id, l, d] of FLAGS) {
		questions[id] = {
			type: "choice",
			instructions: `A person describes what they want to watch in \`request\`. What does the request say about the attribute "${l}" (${d})?`,
			criteria: {
				required: "The request asks for this attribute, directly or by clear implication",
				excluded: "The request rules this attribute out, directly or by clear implication",
				not_mentioned: "The request says nothing that settles this attribute",
			},
		}
	}
	words.forEach((_, i) => {
		questions[`word:${i}`] = {
			type: "noul",
			instructions: `A person describes what they want to watch in \`request\`. Does the word \`words[${i}]\`, as used in the request, name something that would appear on screen or in the plot of the wanted title?`,
			criteria: {
				true: "It names a concrete thing: an object, vehicle, place, profession, kind of character, creature, event, or plot device",
				false: "It describes mood, tone, pace, intensity, quality, genre, or style, or it describes the viewing situation, such as who is watching or when",
			},
		}
	})
	if (candidates.length > 1) questions.phrase = phraseQuestion(candidates)
	const r = await jev({ request, words }, questions)
	const flags: Record<string, string> = {}
	const flagProbs: Record<string, { required: number; excluded: number }> = {}
	for (const [id] of FLAGS) {
		const p = r.answers[id].probabilities
		flagProbs[id] = { required: p.required ?? 0, excluded: p.excluded ?? 0 }
		flags[id] = (p.required ?? 0) >= 0.6 ? "required" : (p.excluded ?? 0) >= 0.6 ? "excluded" : "none"
	}
	const split = words.map((word, i) => ({ word, concrete: r.answers[`word:${i}`].noul as number }))
	const phrase = r.answers.phrase ? { choice: r.answers.phrase.choice, confidence: r.answers.phrase.confidence, probabilities: r.answers.phrase.probabilities } : null
	return { flags, flagProbs, split, phrase, tokens: r.tokens, ms: r.ms }
}

// --- English-only prototype code, copied verbatim ------------------------------------------
const NEGATIONS = /^(not|no|non|without|never|nothing|little|less|few|fewer|minimal|low|barely|hardly)\b/
const STOPWORDS = new Set(
	"a an and the but or not no non without with for that this some something any anything to of in on at by my our your i we you it is are be goes go going like want wants very really little lot more less than too also about".split(" "),
)
const tropeTermsEnglishCode = (request: string) =>
	request.toLowerCase().split(/,|;|\bbut\b/).map((c) => c.trim()).filter((c) => c && !NEGATIONS.test(c))
		.flatMap((c) => c.split(/[^a-z0-9'-]+/)).filter((w) => w.length > 2 && !STOPWORDS.has(w))
const phraseCandidatesEnglishCode = (request: string) => {
	const candidates: string[] = []
	for (const clause of request.toLowerCase().split(/,|;|\bbut\b/).map((c) => c.trim())) {
		if (!clause || NEGATIONS.test(clause)) continue
		const words = clause.split(/[^a-z0-9'-]+/).filter((w) => w.length > 2 && !STOPWORDS.has(w))
		words.forEach((w, i) => {
			candidates.push(w)
			if (i + 1 < words.length) candidates.push(`${w} ${words[i + 1]}`)
		})
	}
	return [...new Set(candidates)].slice(0, 20)
}

// --- Unicode-aware per-language variant, written for this test ------------------------------
const LANG: Record<string, { but: RegExp; negStart: RegExp; negEnd?: RegExp; stop: string }> = {
	en: { but: /,|;|\bbut\b/, negStart: NEGATIONS, stop: [...STOPWORDS].join(" ") },
	de: { but: /,|;|\baber\b/, negStart: /^(nicht|kein|keine|keinen|ohne|wenig|wenige|nie|kaum)(?=\s|$)/, stop: "ein eine einen einem einer der die das den dem und oder aber mit für von über meinen meine mein ich wir schiefgeht sehr" },
	es: { but: /,|;|\bpero\b/, negStart: /^(no|sin|poco|poca|pocos|pocas|nada|nunca)(?=\s|$)/, stop: "un una unos unas el la los las y o pero con para de del sobre mis que sale muy" },
	fr: { but: /,|;|\bmais\b/, negStart: /^(pas|sans|peu|aucun|aucune|jamais)(?=\s|$)/, stop: "un une des le la les et ou mais avec pour de du sur mes qui très" },
	tr: { but: /,|;|(?:^|\s)ama(?=\s|$)/, negStart: /^(az|hiç)(?=\s|$)/, negEnd: /(^|\s)(değil|yok)$/, stop: "bir ve veya ama ile için hakkında çok" },
}
const nativeClauses = (request: string, lang: string) => {
	const l = LANG[lang]
	const stop = new Set(l.stop.split(" "))
	return request.toLocaleLowerCase(lang).split(l.but).map((c) => c.trim())
		.filter((c) => c && !l.negStart.test(c) && !(l.negEnd && l.negEnd.test(c)))
		.map((c) => c.split(/[^\p{L}\p{N}'-]+/u).map((w) => w.replace(/^[dl]'/, "")).filter((w) => w.length > 2 && !stop.has(w)))
}
const nativeWords = (request: string, lang: string) => [...new Set(nativeClauses(request, lang).flat())].slice(0, 12)
const nativeCandidates = (request: string, lang: string) => {
	const out: string[] = []
	for (const words of nativeClauses(request, lang)) words.forEach((w, i) => { out.push(w); if (i + 1 < words.length) out.push(`${w} ${words[i + 1]}`) })
	return [...new Set(out)].slice(0, 20)
}

// --- Test set -----------------------------------------------------------------------------------
const REQUESTS: Record<string, string>[] = [
	{ en: "tense but not bleak", de: "spannend, aber nicht düster", es: "tenso pero no sombrío", fr: "tendu mais pas sinistre", tr: "gergin ama kasvetli değil" },
	{ en: "clever dialogue, little action", de: "kluge Dialoge, wenig Action", es: "diálogos ingeniosos, poca acción", fr: "dialogues intelligents, peu d'action", tr: "zekice diyaloglar, az aksiyon" },
	{ en: "super tense high octane car chases", de: "super spannende, rasante Verfolgungsjagden mit Autos", es: "persecuciones de coches súper tensas y a toda velocidad", fr: "courses-poursuites en voiture ultra tendues et à cent à l'heure", tr: "süper gergin, yüksek tempolu araba kovalamacaları" },
	{ en: "dark comedy about rich people", de: "schwarze Komödie über reiche Leute", es: "comedia negra sobre gente rica", fr: "comédie noire sur des gens riches", tr: "zengin insanlar hakkında kara komedi" },
	{ en: "cozy mystery for a rainy sunday with my parents", de: "gemütlicher Krimi für einen verregneten Sonntag mit meinen Eltern", es: "misterio acogedor para un domingo lluvioso con mis padres", fr: "enquête policière douillette pour un dimanche pluvieux avec mes parents", tr: "annemle babamla yağmurlu bir pazar günü için sıcacık bir polisiye" },
	{ en: "no anime, no animation, gritty crime show", de: "kein Anime, keine Animation, düstere Krimiserie", es: "nada de anime, nada de animación, serie policíaca cruda", fr: "pas d'anime, pas d'animation, série policière sombre et réaliste", tr: "anime yok, animasyon yok, sert bir suç dizisi" },
	{ en: "unreliable narrator", de: "unzuverlässiger Erzähler", es: "narrador poco fiable", fr: "narrateur peu fiable", tr: "güvenilmez anlatıcı" },
	{ en: "heist that goes wrong", de: "ein Raubüberfall, der schiefgeht", es: "un atraco que sale mal", fr: "un casse qui tourne mal", tr: "ters giden bir soygun" },
]
const LANGS = ["en", "de", "es", "fr", "tr"]
const englishCandidates = REQUESTS.map((r) => phraseCandidatesEnglishCode(r.en))
const pooled = [...new Set(englishCandidates.flat())]

const out: any = { pooledCandidates: pooled, requests: [] }
for (const [i, r] of REQUESTS.entries()) {
	const entry: any = { english: r.en, englishCandidates: englishCandidates[i], runs: {} }
	const jobs = [...LANGS.map((l) => [l, l] as const), ["en2", "en"] as const]
	await Promise.all(jobs.map(async ([id, lang]) => {
		const request = r[lang]
		const words = lang === "en" ? [...new Set(tropeTermsEnglishCode(request))].slice(0, 12) : nativeWords(request, lang)
		const native = lang === "en" ? englishCandidates[i] : nativeCandidates(request, lang)
		const started = Date.now()
		// The two production calls run in parallel, as in the prototype
		const [dims, attrs] = await Promise.all([
			readWantAvoid(request),
			// production shape; the phrase Choice gets the hand-supplied English candidates (option a)
			readFlags(request, words, englishCandidates[i]),
		])
		const wallMs = Date.now() - started
		// extra phrase tests: native candidates, and one pooled English vocabulary of all 8 requests
		const extra = await jev({ request }, { ...(native.length > 1 ? { native: phraseQuestion(native) } : {}), pooled: phraseQuestion(pooled) })
		entry.runs[id] = {
			request, words, nativeCandidates: native, wallMs,
			englishCodeTerms: tropeTermsEnglishCode(request), englishCodeCandidates: phraseCandidatesEnglishCode(request),
			dims, attrs,
			phraseNative: extra.answers.native ? { choice: extra.answers.native.choice, confidence: extra.answers.native.confidence } : null,
			phrasePooled: { choice: extra.answers.pooled.choice, confidence: extra.answers.pooled.confidence, top: Object.entries(extra.answers.pooled.probabilities as Record<string, number>).sort((a, b) => b[1] - a[1]).slice(0, 3) },
			extraTokens: extra.tokens,
		}
	}))
	out.requests.push(entry)
	console.error(`done ${i + 1}/8, tokens so far ${totalTokens}, $${(totalTokens * USD).toFixed(4)}`)
}
out.totalTokens = totalTokens
out.usd = totalTokens * USD
writeFileSync(new URL("./results.json", import.meta.url), JSON.stringify(out, null, 1))
