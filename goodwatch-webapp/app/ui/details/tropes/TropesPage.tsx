// The Tropes sub-page's content (without its head: the sub-page frame gives it the title page's head, bar and rail).
// Its loader puts the index into the page (tropesPageState), so the server's HTML holds every trope. The other
// write-ups load once the page is used (a pointer over it, a focus, a find, an opened trope). It tells the rail what
// it shows (tropesBridge) and lets find in title open a trope (landing.ts bridges.trope).
import { useLocation, useNavigate, useSearchParams } from "@remix-run/react"
import { useCallback, useEffect, useState } from "react"
import { bridges } from "~/ui/details/find/landing"
import { tropesBridge } from "~/ui/details/rail/rail-model"
import type { TitleInfo } from "~/ui/details/sub-page/paths"
import { TropesReader, jumpToLetter } from "./TropesReader"
import { letterOf, useAllTropes, useTropesPage } from "./model"
import { Loading } from "./parts"
import { reducedMotion } from "./reading"
import { TROPE_PARAM, withTrope } from "./selection"

export function TropesPage({ t }: { t: TitleInfo }) {
	const [wantTexts, setWantTexts] = useState(false)
	const data = useAllTropes(t.type, t.id, true, wantTexts)
	const [params] = useSearchParams()
	const navigate = useNavigate()
	const { state } = useLocation()
	const setOpen = useCallback(
		(id: string | null) => {
			// Find can update hl directly on the current history entry.
			const { pathname, search, hash } = window.location
			const current = pathname + search + hash
			const next = withTrope(current, id)
			if (next !== current) navigate(next, { replace: true, preventScrollReset: true, state })
		},
		[navigate, state],
	)
	const s = useTropesPage(data.data, params.get(TROPE_PARAM), setOpen)
	const openId = s.open?.id
	const openName = s.open?.name
	useEffect(() => {
		if (openId || s.q.trim()) setWantTexts(true)
	}, [openId, s.q])

	// What the rail shows of this page and does to it.
	const firstId = s.rows[0]?.id ?? null
	const letterKey = [...new Set(s.rows.map((r) => letterOf(r.name)))].join("")
	useEffect(() => {
		tropesBridge.set({
			signature: s.signature.length,
			total: s.total,
			open: openId && openName ? { id: openId, name: openName } : null,
			letters: new Set(letterKey),
			showSignature: () => {
				setOpen(null)
				window.scrollTo({
					top: 0,
					behavior: reducedMotion() ? "auto" : "smooth",
				})
			},
			openFirst: () => firstId && setOpen(firstId),
			jumpLetter: jumpToLetter,
		})
	}, [s.signature.length, s.total, openId, openName, letterKey, firstId, setOpen])
	useEffect(() => () => tropesBridge.set(null), [])

	// Find in title opens a trope, the list's filters cleared so it is there.
	const loaded = !!data.data
	useEffect(() => {
		bridges.trope = (id) => {
			if (!loaded) return false
			s.clear()
			s.setOpen(id)
			return true
		}
		return () => {
			bridges.trope = null
		}
	})

	if (data.isPending) return <Loading />
	if (data.isError)
		return <p className="text-sm text-gray-400">The tropes couldn't load. Try again in a moment.</p>
	return (
		<div onPointerOver={() => setWantTexts(true)} onFocusCapture={() => setWantTexts(true)}>
			<TropesReader key={`${t.type}-${t.id}`} s={s} info={t} />
		</div>
	)
}

/** How many tropes the title has, once the index is there (the sub-page's subtitle). */
export function useTropesTotal(t: Pick<TitleInfo, "type" | "id">) {
	return useAllTropes(t.type, t.id, true, false).data?.total ?? null
}
