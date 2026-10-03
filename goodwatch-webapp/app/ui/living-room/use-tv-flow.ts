// Binds the TV flow to the router: the screen and focus come from the URL, power and the menu from React
// state, and the in-app history depth from the history entry's state. Both TV editions use this hook.
import { useLocation, useNavigate, useSearchParams } from "@remix-run/react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
	MENU_ITEMS,
	type TvAction,
	type TvContext,
	type TvEffect,
	type TvPower,
	type TvState,
	focusedItem,
	readTvState,
	transition,
	tvItems,
	writeTvParams,
} from "./tv-flow"

export const TV_BOOT_MS = 1700

type HistoryEntryState = { tvDepth?: number } | null

export function useTvFlow(
	ctx: TvContext,
	onEffect: (effect: TvEffect) => void,
) {
	const [params] = useSearchParams()
	const location = useLocation()
	const navigate = useNavigate()
	const [power, setPower] = useState<TvPower>("on")
	const [menuOpen, setMenuOpen] = useState(false)
	const [menuFocus, setMenuFocus] = useState<string | null>(null)
	const depth = (location.state as HistoryEntryState)?.tvDepth ?? 0

	const state: TvState = useMemo(
		() => ({ ...readTvState(params, depth), power, menuOpen, menuFocus }),
		[params, depth, power, menuOpen, menuFocus],
	)
	const latest = useRef({ state, ctx, onEffect })
	latest.current = { state, ctx, onEffect }

	const dispatch = useCallback(
		(action: TvAction) => {
			const { state: current, ctx: context, onEffect: effect } = latest.current
			const next = transition(current, action, context)
			setPower(next.state.power)
			setMenuOpen(next.state.menuOpen)
			setMenuFocus(next.state.menuFocus)
			if (next.history === "back") navigate(-1)
			else if (next.history !== "none") {
				const search = writeTvParams(next.state, params).toString()
				navigate(
					{ search: search ? `?${search}` : "" },
					{
						replace: next.history === "replace",
						preventScrollReset: true,
						state: { tvDepth: next.state.depth },
					},
				)
			}
			for (const e of next.effects) effect(e)
		},
		[navigate, params],
	)

	useEffect(() => {
		if (power !== "booting") return
		const timer = setTimeout(() => dispatch({ type: "boot-done" }), TV_BOOT_MS)
		return () => clearTimeout(timer)
	}, [power, dispatch])

	return {
		state,
		screen: state.screen,
		items: state.menuOpen ? MENU_ITEMS : tvItems(state.screen, ctx),
		focused: focusedItem(state, ctx),
		dispatch,
	}
}

export type TvFlow = ReturnType<typeof useTvFlow>
