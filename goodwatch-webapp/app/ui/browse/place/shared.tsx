// What the mood page's parts share: the tuner that keeps the
// list's own controls and the steering, and small words.
import { useLocation, useNavigate } from "@remix-run/react"
import { useEffect, useMemo, useRef, useState } from "react"
import type { Address } from "~/domain/browse/address"
import type { PlaceRef } from "~/domain/browse/types"
import type { DialChange } from "~/ui/browse/dials/Dial"
import {
	type DialSpec,
	type Settings,
	isTuned,
	nearestStop,
	settingsWithFine,
	writeSettings,
} from "~/domain/browse/tune"
import type { Viewer } from "~/domain/browse/types"
import type { PlaceDisplayData } from "~/server/browse/place-display.server"

/** The link of an address on this site; `extra` sets or (with undefined) drops query parameters. */
export type To = (a: Address, extra?: Record<string, string | undefined>) => string

export interface Props {
	data: PlaceDisplayData
	address: Address
	viewer: Viewer
	to: To
}

export type HeadState = "folded" | "peek" | "open"

export const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
export const low = (s: string) => s.charAt(0).toLowerCase() + s.slice(1)

/** A place's name inside a sentence: "cozy movies", "comedy movies" (a country's name would keep its capital). */
export const said = (title: string, parts: PlaceRef[]) =>
	parts.some((p) => p.family === "country") ? title : low(title)

/** A single place as a word in a heading: "cozy", "comedy". */
export const asWord = (p: PlaceRef) => (p.label === "TV Movie" ? "TV movies" : low(p.label))

/** The dial parameters now in the address (all but the first, which is the address's own `level`). */
export const dialParams = (dials: DialSpec[]): Record<string, string | undefined> =>
	Object.fromEntries(
		dials.filter((d) => d.id !== "level").map((d) => [d.id, d.value ?? undefined] as const),
	)

/**
 * The dials' state, with one difference from the other pages' dials: turning a dial keeps the list's sort, because here
 * the dials rank the same titles the control row describes.
 */
export function useMoodTuner(dials: DialSpec[]) {
	const navigate = useNavigate()
	const { search } = useLocation()
	const server = useMemo(() => settingsWithFine(dials, search), [dials, search])
	const serverKey = JSON.stringify(server)
	const [settings, setSettings] = useState<Settings>(server)
	const latest = useRef(settings)
	latest.current = settings
	// oxlint-disable-next-line react-hooks/exhaustive-deps -- compared by content: the address changed, follow it
	useEffect(() => setSettings(server), [serverKey])

	const commit = (next: Settings) => {
		const u = new URL(window.location.href)
		writeSettings(u.searchParams, dials, next)
		u.searchParams.delete("page")
		u.searchParams.delete("at")
		navigate(`${u.pathname}${u.search}`, { replace: true, preventScrollReset: true })
	}
	const change = (spec: DialSpec, c: DialChange) => {
		const next = { ...latest.current, [spec.id]: c.at }
		setSettings(next)
		if (c.final) commit(next)
	}
	const rest = (spec: DialSpec) => change(spec, { at: null, final: true })
	const reset = () => {
		const next = Object.fromEntries(dials.map((d) => [d.id, null]))
		setSettings(next)
		commit(next)
	}
	return { settings, change, rest, reset, tuned: isTuned(settings) }
}

export type MoodTuner = ReturnType<typeof useMoodTuner>

/** What a set dial is called on its token: "Plenty heartwarming", "Darker", "Lighter or darker: in between". */
export function dialToken(d: DialSpec, at: number): string {
	const stop = nearestStop(d, at)
	if (d.kind === "much") {
		const word = d.question.replace(/^How /, "").replace(/\?$/, "")
		return stop.id === "full" ? `As ${word} as it gets` : `${stop.name} ${word}`
	}
	if (stop.name === "In between") return `${d.question.replace(/\?$/, "")}: in between`
	return stop.name
}

/** The list's address without a kind, a page or any dial: what "Clear" leads to. */
export const cleared = (address: Address): Address => ({
	...address,
	kind_: undefined,
	level: undefined,
	page: undefined,
})
