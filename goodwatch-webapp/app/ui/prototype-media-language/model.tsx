// PROTOTYPE - throwaway. The state of /prototype/media-language: who is visiting, what is saved, what is only being
// looked at, and a save that can be made to fail. Everything lives in this React tree; nothing reaches a server,
// localStorage or a cookie. The three variants read and write through this one store, so the state panel shows the
// same facts under each of them.
import {
	type ReactNode,
	createContext,
	useCallback,
	useContext,
	useMemo,
	useRef,
	useState,
} from "react"
import {
	type Country,
	LANGS,
	LANG_NAME,
	type Lang,
	PERSONAS,
	type Persona,
	SUGGESTED_LANGS,
	type TitleFixture,
	type TitleId,
	countryName,
	titleOf,
} from "./fixtures"

export type VariantKey = "A" | "B" | "C" | "D" | "E" | "F" | "G"
/** Round one (A to C) is kept for reference; round two (D to G) puts the controls in the title bar. */
export const ROUNDS: Record<1 | 2, VariantKey[]> = {
	1: ["A", "B", "C"],
	2: ["D", "E", "F", "G"],
}
export const roundOf = (v: VariantKey): 1 | 2 => (ROUNDS[1].includes(v) ? 1 : 2)
export type Surface = "title" | "settings"
/** How long a look lasts in variant B: until the visitor leaves the title, or until they reset it. */
export type LookScope = "title" | "visit"
export type LangChoice = Lang | "browser"
/** Where a title without a name in the selected language comes from. Not a decision: see `resolve`. */
export type TitlePolicy = "english" | "original"

export interface Saved {
	country: Country | null
	lang: Lang | null
}
export interface Look {
	country?: Country
	lang?: Lang
}
export interface Change {
	country?: Country
	lang?: LangChoice
}

/** The first language of the browser's list that GoodWatch offers, else English. */
export function negotiate(browser: string[]): {
	lang: Lang
	matched: string | null
} {
	for (const tag of browser) {
		const base = tag.toLowerCase().split("-")[0]
		if ((LANGS as readonly string[]).includes(base))
			return { lang: base as Lang, matched: tag }
	}
	return { lang: "en", matched: null }
}

export interface Effective {
	country: Country
	countrySource: "look" | "saved" | "guess"
	lang: Lang
	langSource: "look" | "saved" | "browser"
}

export function effectiveOf(
	persona: Persona,
	saved: Saved,
	look: Look,
): Effective {
	return {
		country: look.country ?? saved.country ?? persona.guessedCountry,
		countrySource: look.country ? "look" : saved.country ? "saved" : "guess",
		lang: look.lang ?? saved.lang ?? negotiate(persona.browser).lang,
		langSource: look.lang ? "look" : saved.lang ? "saved" : "browser",
	}
}

export interface Field {
	value: string
	/** The language the text really is in. */
	lang: Lang
	/** True when the selected language has no value and another language stands in. */
	fallback: boolean
}
export interface Shown {
	title: Field
	tagline: Field
	overview: Field
	poster: Field
	generated: Field
	episodes: { number: number; name: Field; overview: Field }[]
	/** The fields that are not in the selected language, by their names in the interface. */
	missing: string[]
}

// The fallback order of this prototype. It is a placeholder, NOT an approved policy:
// - text (tagline, description, episode text, generated answers): the selected language, then English
// - poster: the selected language, then the original language's, then English
// - title: the selected language, then English ("english") or the original title and then English ("original").
//   Which of the two an empty translated title should use is undecided, so the state panel has a switch for it.
// Text and poster may end in different languages.
export function resolve(
	title: TitleFixture,
	lang: Lang,
	titlePolicy: TitlePolicy = "english",
): Shown {
	const pick = (
		get: (l: Lang) => string | null,
		viaOriginal: boolean,
	): Field => {
		const order: Lang[] = viaOriginal
			? [lang, title.originalLang, "en"]
			: [lang, "en"]
		for (const l of order) {
			const value = get(l)
			if (value) return { value, lang: l, fallback: l !== lang }
		}
		return { value: "", lang: "en", fallback: true }
	}
	const shown = {
		title: pick((l) => title.text[l].title, titlePolicy === "original"),
		tagline: pick((l) => title.text[l].tagline, false),
		overview: pick((l) => title.text[l].overview, false),
		poster: pick((l) => title.text[l].poster, true),
		generated: pick((l) => title.text[l].generated, false),
		episodes: title.episodes.map((e) => ({
			number: e.number,
			name: pick((l) => e.text[l].name, false),
			overview: pick((l) => e.text[l].overview, false),
		})),
	}
	const missing = [
		shown.title.fallback && "title",
		shown.poster.fallback && "poster",
		shown.tagline.fallback && "tagline",
		shown.overview.fallback && "description",
		shown.episodes.some((e) => e.overview.fallback) && "episode descriptions",
		shown.generated.fallback && "answers",
	].filter(Boolean) as string[]
	return { ...shown, missing }
}

export const langLabel = (lang: Lang) => LANG_NAME[lang].name

/** The languages a country suggests that are not the language already shown. */
export function companionsOf(country: Country, current: Lang): Lang[] {
	return SUGGESTED_LANGS[country].filter((l) => l !== current)
}

export type SaveResult = "saved" | "failed"

export interface Toast {
	id: number
	text: string
	undo?: () => void
	tone: "ok" | "error"
}

export interface Store {
	variant: VariantKey
	persona: Persona
	surface: Surface
	titleId: TitleId
	title: TitleFixture
	saved: Saved
	look: Look
	/** What the page shows: a look or a try over what is saved. */
	effective: Effective
	/** What the page returns to without a look or a try: the saved values, else the guess and the browser. */
	base: Effective
	shown: Shown
	browserLang: Lang
	saving: boolean
	failNext: boolean
	lookScope: LookScope
	titlePolicy: TitlePolicy
	log: string[]
	toast: Toast | null
	/** What a variant holds as an unsaved draft, as one line for the state panel. */
	draft: string | null
	setDraft: (line: string | null) => void
	/** Where a save goes, in the words of the interface. */
	place: string
	/** A title in a language, under the fallback order the state panel is set to. */
	resolve: (title: TitleFixture, lang: Lang) => Shown
	setVariant: (v: VariantKey) => void
	setPersona: (key: string) => void
	setSurface: (s: Surface) => void
	openTitle: (id: TitleId) => void
	setFailNext: (fail: boolean) => void
	setLookScope: (scope: LookScope) => void
	setTitlePolicy: (policy: TitlePolicy) => void
	setLook: (look: Look) => void
	clearLook: (why?: string) => void
	/**
	 * Simulates one write of the whole change: both values land, or neither does. A country equal to the guess is a
	 * real change: it turns the guess into a saved choice. `toast` is the line shown with Undo once it has landed.
	 */
	save: (change: Change, opts?: { toast?: string }) => Promise<SaveResult>
	/** Takes back the last save only (one write), to the values saved before it. It does not bring back a look. */
	undo: () => void
	canUndo: boolean
	say: (
		text: string,
		opts?: { undo?: () => void; tone?: Toast["tone"] },
	) => void
	dismissToast: () => void
	note: (line: string) => void
	reset: () => void
}

const Ctx = createContext<Store | null>(null)
export const useStore = () => {
	const store = useContext(Ctx)
	if (!store) throw new Error("No media language store")
	return store
}

const SAVE_MS = 650

export interface Initial {
	variant: VariantKey
	persona: string
	surface: Surface
	titleId: TitleId
	failNext: boolean
	lookScope: LookScope
	titlePolicy: TitlePolicy
}

const personaOf = (key: string) =>
	PERSONAS.find((p) => p.key === key) ?? PERSONAS[0]
// A link that carries a country arrives as a look. Variant A has no temporary country, so the link's country is
// dropped there.
const arrivalLook = (persona: Persona, variant: VariantKey): Look =>
	persona.incomingLook && variant !== "A" && roundOf(variant) === 1
		? { country: persona.incomingLook }
		: {}

export function StoreProvider({
	initial,
	children,
}: { initial: Initial; children: ReactNode }) {
	const [variant, setVariantState] = useState(initial.variant)
	const [persona, setPersonaState] = useState(() => personaOf(initial.persona))
	const [surface, setSurface] = useState<Surface>(initial.surface)
	const [titleId, setTitleId] = useState(initial.titleId)
	const [saved, setSaved] = useState<Saved>(() => ({
		country: personaOf(initial.persona).savedCountry,
		lang: personaOf(initial.persona).savedLang,
	}))
	const [look, setLookState] = useState<Look>(() =>
		arrivalLook(personaOf(initial.persona), initial.variant),
	)
	const [saving, setSaving] = useState(false)
	const [failNext, setFailNext] = useState(initial.failNext)
	const [lookScope, setLookScope] = useState<LookScope>(initial.lookScope)
	const [titlePolicy, setTitlePolicy] = useState<TitlePolicy>(
		initial.titlePolicy,
	)
	const [log, setLog] = useState<string[]>([])
	const [toast, setToast] = useState<Toast | null>(null)
	const [before, setBefore] = useState<Saved | null>(null)
	const [draft, setDraft] = useState<string | null>(null)
	const toastId = useRef(0)
	// The latest values, for callbacks that outlive a render (the save's timer).
	const live = useRef({ saved, failNext, persona })
	live.current = { saved, failNext, persona }

	const note = useCallback(
		(line: string) => setLog((l) => [line, ...l].slice(0, 12)),
		[],
	)
	const say = useCallback<Store["say"]>((text, opts) => {
		toastId.current += 1
		setToast({
			id: toastId.current,
			text,
			undo: opts?.undo,
			tone: opts?.tone ?? "ok",
		})
	}, [])

	const store = useMemo<Store>(() => {
		const effective = effectiveOf(persona, saved, look)
		const title = titleOf(titleId)
		const place = persona.viewer === "member" ? "your account" : "this device"
		const pairText = (s: Saved) =>
			`country ${s.country ?? "not saved"}, language ${s.lang ?? "browser default"}`
		const undoTo = (previous: Saved) => {
			setSaved(previous)
			setBefore(null)
			setToast(null)
			note(`undo: saved is ${pairText(previous)} again`)
		}
		return {
			variant,
			persona,
			surface,
			titleId,
			title,
			saved,
			look,
			effective,
			base: effectiveOf(persona, saved, {}),
			shown: resolve(title, effective.lang, titlePolicy),
			browserLang: negotiate(persona.browser).lang,
			saving,
			failNext,
			lookScope,
			titlePolicy,
			log,
			toast,
			draft,
			setDraft,
			place,
			resolve: (t, lang) => resolve(t, lang, titlePolicy),
			setVariant: (v) => {
				setVariantState(v)
				setLookState(arrivalLook(persona, v))
				setToast(null)
				note(`variant ${v}: looks and drafts dropped, saved values kept`)
			},
			setPersona: (key) => {
				const p = personaOf(key)
				setPersonaState(p)
				setSaved({ country: p.savedCountry, lang: p.savedLang })
				setLookState(arrivalLook(p, variant))
				setBefore(null)
				setToast(null)
				if (p.viewer === "guest") setSurface("title")
				setLog([`visitor: ${p.label}`])
			},
			setSurface: (s) => {
				setSurface(s)
				note(`surface: ${s}`)
			},
			openTitle: (id) => {
				setTitleId(id)
				if (variant === "B" && lookScope === "title" && look.country) {
					setLookState({})
					note(`opened ${id}: the look ended with the title`)
				} else note(`opened ${id}`)
			},
			setFailNext,
			setLookScope,
			setTitlePolicy: (policy) => {
				setTitlePolicy(policy)
				note(
					`placeholder rule: a missing title falls back to ${policy === "english" ? "English" : "the original title"}`,
				)
			},
			setLook: (next) => {
				setLookState(next)
				note(
					`look: ${next.country ?? "-"} / ${next.lang ?? "-"} (nothing saved)`,
				)
			},
			clearLook: (why = "look ended") => {
				if (!look.country && !look.lang) return
				setLookState({})
				note(why)
			},
			save: (change, opts) => {
				const next: Saved = {
					country: change.country ?? live.current.saved.country,
					lang:
						change.lang === undefined
							? live.current.saved.lang
							: change.lang === "browser"
								? null
								: change.lang,
				}
				setSaving(true)
				// A line about an earlier save would contradict the answer to this one.
				setToast(null)
				note(`save requested: ${pairText(next)}`)
				return new Promise<SaveResult>((done) => {
					setTimeout(() => {
						setSaving(false)
						if (live.current.failNext) {
							note("save failed: nothing changed")
							done("failed")
							return
						}
						const previous = live.current.saved
						setBefore(previous)
						setSaved(next)
						setLookState({})
						note(
							`saved to ${live.current.persona.viewer === "member" ? "account" : "device"} (mock): ${pairText(next)}`,
						)
						if (opts?.toast) {
							toastId.current += 1
							setToast({
								id: toastId.current,
								text: opts.toast,
								tone: "ok",
								undo: () => undoTo(previous),
							})
						}
						done("saved")
					}, SAVE_MS)
				})
			},
			undo: () => {
				if (before) undoTo(before)
			},
			canUndo: before !== null,
			say,
			dismissToast: () => setToast(null),
			note,
			reset: () => {
				setSaved({ country: persona.savedCountry, lang: persona.savedLang })
				setLookState(arrivalLook(persona, variant))
				setBefore(null)
				setToast(null)
				setLog(["reset to the visitor's start"])
			},
		}
	}, [
		variant,
		persona,
		surface,
		titleId,
		saved,
		look,
		saving,
		failNext,
		lookScope,
		titlePolicy,
		log,
		toast,
		draft,
		before,
		note,
		say,
	])

	return <Ctx.Provider value={store}>{children}</Ctx.Provider>
}

/** How the page got a value, in the interface's words. */
export function sourceWords(e: Effective, place: string) {
	return {
		country:
			e.countrySource === "look"
				? "not saved"
				: e.countrySource === "saved"
					? `saved to ${place}`
					: "our guess, not saved",
		lang:
			e.langSource === "look"
				? "this visit only"
				: e.langSource === "saved"
					? `your choice, saved to ${place}`
					: "browser default",
	}
}

/** "Germany (our guess) · German (browser default)": a pair with where each value comes from, for a sentence. */
export function pairWords(e: Effective) {
	return `${countryName(e.country)}${e.countrySource === "guess" ? " (our guess)" : ""} · ${langLabel(e.lang)}${e.langSource === "browser" ? " (browser default)" : ""}`
}
