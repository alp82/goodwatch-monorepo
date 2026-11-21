// The dials' state on a Browse page: the stops in the address, and on top of them whatever a knob is doing right now.
// While a knob is dragged the page re-ranks its titles in the browser; on release the address takes the stop, so every
// tuned page is a link.
import { useLocation, useNavigate } from "@remix-run/react"
import { useEffect, useMemo, useRef, useState } from "react"
import type { DialChange } from "./Dial"
import { type DialSpec, type Settings, isTuned, settingsWithFine, writeSettings } from "./tune"

/** The dials' state: the address's stops, and on top of them whatever a knob is doing right now. */
export function useTuner(dials: DialSpec[]) {
	const navigate = useNavigate()
	const { search } = useLocation()
	const server = useMemo(() => settingsWithFine(dials, search), [dials, search])
	const serverKey = JSON.stringify(server)
	const [settings, setSettings] = useState<Settings>(server)
	const latest = useRef(settings)
	latest.current = settings
	// oxlint-disable-next-line react-hooks/exhaustive-deps -- the address changed: follow it (by value, not identity)
	useEffect(() => setSettings(server), [serverKey])

	const commit = (next: Settings) => {
		const u = new URL(window.location.href)
		writeSettings(u.searchParams, dials, next)
		u.searchParams.delete("page")
		u.searchParams.delete("sort")
		navigate(`${u.pathname}${u.search}`, { replace: true, preventScrollReset: true })
	}
	const change = (spec: DialSpec, c: DialChange) => {
		const next = { ...latest.current, [spec.id]: c.at }
		setSettings(next)
		if (c.final) commit(next)
	}
	const reset = () => {
		const next = Object.fromEntries(dials.map((d) => [d.id, null]))
		setSettings(next)
		commit(next)
	}
	return { settings, change, reset, tuned: isTuned(settings) }
}

export type Tuner = ReturnType<typeof useTuner>
