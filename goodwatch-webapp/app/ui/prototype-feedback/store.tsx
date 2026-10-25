// PROTOTYPE - throwaway. The prototype's in-memory state: who is viewing, the open report, and the corrections sent so
// far. A live correction changes the fixture the page renders; undo takes it back. No request leaves the page.
import { useSearchParams } from "@remix-run/react"
import {
	type ReactNode,
	createContext,
	useContext,
	useMemo,
	useState,
} from "react"
import type { MovieResult, ShowResult } from "~/server/types/details-types"
import person from "~/ui/prototype-feedback/fixture-person.json"
import fixture from "~/ui/prototype-feedback/fixture-title.json"
import {
	type Area,
	CAST,
	type Correction,
	type Draft,
	FIRST_AIRED,
	OTHER_SERVICES,
	SCORE_SOURCES,
	type Screen,
	type Variant,
	type Viewer,
	episodeOf,
	outcomeOfDraft,
} from "~/ui/prototype-feedback/model"

type Media = ShowResult
const BASE = fixture.media as unknown as Media

export function serviceName(id?: number) {
	const all = [
		...(BASE.streaming_services as { tmdb_id: number; name: string }[]),
		...OTHER_SERVICES,
	]
	return all.find((s) => s.tmdb_id === id)?.name ?? "a service"
}

const OFFER = { flatrate: "Stream", rent: "Rent", buy: "Buy" } as const

/** What the page shows now for the report's subject, filled in for the member. */
export function currentValue(d: Draft): string {
	const p = d.problem?.id
	switch (d.area) {
		case "watch":
			if (p === "missing")
				return d.provider
					? `Not listed: ${serviceName(d.provider)}`
					: "Not listed"
			return d.provider
				? `${serviceName(d.provider)} · Stream · ${d.country}`
				: "Disney+, Hulu, YouTube TV · Stream"
		case "episodes": {
			const e = episodeOf(d.season, d.episode)
			if (!e) return `S${d.season} E${d.episode} · not listed`
			if (p === "ep-score")
				return `S${d.season} E${d.episode} · IMDb ${e.score ?? "–"}`
			if (p === "ep-date") return `S${d.season} E${d.episode} · June 23, 2022`
			return `S${d.season} E${d.episode} · “${e.title}”`
		}
		case "cast": {
			const c = CAST.find((x) => x.id === d.person)
			if (p === "missing-person") return `${CAST.length} people listed`
			return c ? `${c.name} as ${c.character || "—"}` : "Pick a person"
		}
		case "details":
			if (p === "date") return `First aired ${FIRST_AIRED}`
			if (p === "seasons") return "46 episodes in 5 seasons"
			return "Carmy, a young fine-dining chef, comes home to Chicago…"
		case "scores": {
			const s = SCORE_SOURCES.find((x) => x.id === d.source)
			return s ? `${s.label}: ${s.value}` : "Pick a score"
		}
		case "analysis":
			return "A nerve-racking, moving comedy series"
		case "credits": {
			const c = person.knownFor.find((x) => x.key === d.credit)
			if (p === "missing-credit")
				return `${person.profile.stats.titles} titles listed`
			return c
				? `${c.title} (${c.release_year}) · ${c.characters[0] ?? c.roles[0]}`
				: "Pick a title"
		}
		case "person":
			if (p === "career")
				return `${person.profile.stats.firstYear}–${person.profile.stats.lastYear}`
			if (p === "photo") return "Current photo"
			return person.profile.known_for_department
	}
}

export function suggestedValue(d: Draft): string {
	const p = d.problem?.id
	if (p === "not-there") return `Not on ${serviceName(d.provider)}`
	if (p === "not-in-it" || p === "not-theirs") return "Remove"
	if (p === "missing")
		return `${serviceName(d.provider)} · ${OFFER[d.offer]} · ${d.country}`
	return d.suggested || "—"
}

/** The fixture with every live, not undone correction applied. */
function applyLive(corrections: Correction[]): Media {
	const live = corrections.filter((c) => c.outcome === "live" && !c.undone)
	if (!live.length) return BASE
	const m: Media = structuredClone(BASE)
	for (const c of live) {
		const d = c.draft
		if (c.problem.id === "not-there" && d.provider)
			m.streaming_availabilities = m.streaming_availabilities.filter(
				(a) => a.streaming_service_id !== d.provider,
			)
		if (c.problem.id === "missing" && d.provider) {
			const svc = OTHER_SERVICES.find((s) => s.tmdb_id === d.provider)
			if (svc && !m.streaming_services.some((s) => s.tmdb_id === svc.tmdb_id))
				m.streaming_services = [
					...m.streaming_services,
					svc,
				] as Media["streaming_services"]
			m.streaming_availabilities = [
				...m.streaming_availabilities,
				{
					streaming_service_id: d.provider,
					streaming_type: d.offer,
					stream_url: "#",
				},
			] as Media["streaming_availabilities"]
		}
		if (c.problem.id === "character" && d.person && d.suggested)
			m.cast = m.cast.map((x) =>
				x.id === d.person ? { ...x, characters: [d.suggested] } : x,
			)
		if (c.problem.id === "not-in-it" && d.person)
			m.cast = m.cast.filter((x) => x.id !== d.person)
		if (c.problem.id === "date" && /\d{4}/.test(d.suggested))
			m.details = {
				...m.details,
				release_year: d.suggested.match(/\d{4}/)?.[0],
			} as Media["details"]
	}
	return m
}

type Store = {
	variant: Variant
	screen: Screen
	viewer: Viewer
	media: Media
	corrections: Correction[]
	/** The open report sheet's area; null when closed. */
	open: Area | "pick" | null
	setOpen: (a: Area | "pick" | null) => void
	submit: (d: Draft) => Correction
	undo: (id: number) => void
	/** Live corrections in an area that the page marks. */
	marks: (area: Area) => Correction[]
	/** Fix mode (variant C). */
	fixMode: boolean
	setFixMode: (on: boolean) => void
	/** The block under the pointer or focus, on the page or in the panel's list; both sides light it up. */
	hot: Area | null
	setHot: (a: Area | null) => void
	/** A part of a block a chip points at ("provider:15", "person:1234"): hovered, or else the picked answer. */
	spot: string | null
	setSpot: (s: string | null) => void
	pinned: string | null
	setPinned: (s: string | null) => void
}

const Ctx = createContext<Store | null>(null)

export function useFeedback() {
	const s = useContext(Ctx)
	if (!s) throw new Error("FeedbackProvider missing")
	return s
}

export function FeedbackProvider({ children }: { children: ReactNode }) {
	const [params] = useSearchParams()
	const variant = (
		["A", "B", "C"].includes(params.get("variant") ?? "")
			? params.get("variant")
			: "C"
	) as Variant
	const screen = (params.get("screen") ?? "title") as Screen
	const viewer = (
		["guest", "member", "trusted"].includes(params.get("as") ?? "")
			? params.get("as")
			: "member"
	) as Viewer
	const [corrections, setCorrections] = useState<Correction[]>([])
	const [open, setOpen] = useState<Area | "pick" | null>(null)
	const [fixMode, setFixMode] = useState(false)
	const [hot, setHot] = useState<Area | null>(null)
	const [spot, setSpot] = useState<string | null>(null)
	const [pinned, setPinned] = useState<string | null>(null)
	const media = useMemo(() => applyLive(corrections), [corrections])
	const store: Store = {
		variant,
		screen,
		viewer,
		media,
		corrections,
		open,
		setOpen,
		fixMode,
		setFixMode,
		hot,
		setHot,
		spot,
		setSpot,
		pinned,
		setPinned,
		submit: (d) => {
			const problem = d.problem
			if (!problem) throw new Error("no problem picked")
			const c: Correction = {
				id: Date.now(),
				area: d.area,
				problem,
				draft: d,
				outcome: outcomeOfDraft(d, viewer) ?? "flag",
				before: currentValue(d),
				after:
					problem.flag || problem.id === "other"
						? d.note || "Flagged"
						: suggestedValue(d),
			}
			setCorrections((all) => [...all, c])
			return c
		},
		undo: (id) =>
			setCorrections((all) =>
				all.map((c) => (c.id === id ? { ...c, undone: true } : c)),
			),
		marks: (area) =>
			corrections.filter(
				(c) => c.area === area && c.outcome === "live" && !c.undone,
			),
	}
	return <Ctx.Provider value={store}>{children}</Ctx.Provider>
}
