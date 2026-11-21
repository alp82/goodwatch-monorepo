// PROTOTYPE - throwaway (prototype/explore-r5). The lab at runtime: the picks of this request as a context, a hook to
// read and change them, and `<Part>` to render a part slot's picked variant.
import { useLocation, useNavigate, useRevalidator } from "@remix-run/react"
import {
	type ComponentType,
	type ReactNode,
	createContext,
	useCallback,
	useContext,
	useMemo,
} from "react"
import type { Lab } from "./contract"
import { LAB_COOKIE, LAB_PARAM, cookiePicks, formatPicks, parsePicks } from "./picks"
import { labOf, variantOf, variantsOf } from "./registry"

interface LabContext extends Lab {
	/** Data of the part slots whose picked variant has a loader, by slot id. */
	parts: Record<string, unknown>
}

const Context = createContext<LabContext>({ picks: {}, pick: () => "r4", parts: {} })

export function LabProvider({
	picks,
	parts,
	children,
}: {
	picks: Record<string, string>
	parts: Record<string, unknown>
	children: ReactNode
}) {
	const value = useMemo(() => ({ ...labOf(picks), parts }), [picks, parts])
	return <Context.Provider value={value}>{children}</Context.Provider>
}

/**
 * Changes a pick: writes the cookie and reloads the page's data in place (no full reload, scroll stays). A pick that
 * the address carries in `?lab=` is taken out of the address, so the cookie decides again.
 */
export function useSetPick() {
	const navigate = useNavigate()
	const revalidator = useRevalidator()
	const location = useLocation()
	return useCallback(
		(slot: string, variant: string) => {
			const stored = cookiePicks(document.cookie)
			stored[slot] = variant
			document.cookie = `${LAB_COOKIE}=${encodeURIComponent(formatPicks(stored))}; path=/; max-age=31536000; samesite=lax`
			const params = new URLSearchParams(location.search)
			const over = parsePicks(params.get(LAB_PARAM))
			if (slot in over) {
				delete over[slot]
				if (Object.keys(over).length) params.set(LAB_PARAM, formatPicks(over))
				else params.delete(LAB_PARAM)
				const search = params.toString()
				navigate(`${location.pathname}${search ? `?${search}` : ""}${location.hash}`, {
					replace: true,
					preventScrollReset: true,
				})
			} else revalidator.revalidate()
		},
		[navigate, revalidator, location],
	)
}

/**
 * Sets every pick at once (the panel's "Recommended" and "All round 4"): writes the cookie (an empty set clears it,
 * so every slot shows its fallback), drops `?lab=` from the address and reloads the page's data in place.
 */
export function useResetPicks() {
	const navigate = useNavigate()
	const revalidator = useRevalidator()
	const location = useLocation()
	return useCallback(
		(picks: Record<string, string>) => {
			const text = formatPicks(picks)
			document.cookie = text
				? `${LAB_COOKIE}=${encodeURIComponent(text)}; path=/; max-age=31536000; samesite=lax`
				: `${LAB_COOKIE}=; path=/; max-age=0; samesite=lax`
			const params = new URLSearchParams(location.search)
			if (params.has(LAB_PARAM)) {
				params.delete(LAB_PARAM)
				const search = params.toString()
				navigate(`${location.pathname}${search ? `?${search}` : ""}${location.hash}`, {
					replace: true,
					preventScrollReset: true,
				})
			} else revalidator.revalidate()
		},
		[navigate, revalidator, location],
	)
}

/**
 * The lab inside a page: `pick("mood-head")` is the picked variant's id of any slot (a sub-slot too), `set` changes a
 * pick, `variantsOf` lists a slot's variants, `partData` is what a part slot's picked variant loaded.
 */
export function useLab() {
	const lab = useContext(Context)
	const set = useSetPick()
	return {
		picks: lab.picks,
		pick: lab.pick,
		set,
		variantsOf,
		partData: <D,>(slot: string) => lab.parts[slot] as D | undefined,
	}
}

/**
 * A part slot's picked variant: `<Part slot="card" place={...} href={...} ... />`. The props are the slot's own
 * contract (see its slot.ts). A variant with a loader finds its data in `data`.
 */
export function Part<P extends object>({ slot, ...props }: { slot: string } & P) {
	const lab = useContext(Context)
	const View = variantOf(slot, lab.pick(slot))?.View as
		| ComponentType<P & { data?: unknown }>
		| undefined
	if (!View) return null
	return <View {...(props as P)} data={lab.parts[slot]} />
}
