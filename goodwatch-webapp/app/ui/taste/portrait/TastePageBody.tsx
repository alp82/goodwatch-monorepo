// A member's own taste page body: the portrait once their taste is ready, else the taste groups view with the start or
// the notice; a guest's taste groups from their browser. /taste and the owner's Taste profile tab (/u/:handle) draw it.
import { type ShouldRevalidateFunction, useSearchParams } from "@remix-run/react"
import { useCallback, useEffect } from "react"
import type {
	TastePageData,
	TastePortraitData,
} from "~/server/taste-portrait/page.server"
import type { SidesView } from "~/server/taste-portrait/view"
import {
	onlySideChanged,
	openingSide,
	requestedSide,
	withSide,
} from "~/ui/taste/side-address"
import { SidesOfYou } from "~/ui/taste/tabs/SidesOfYou"
import { TasteTabFrame } from "~/ui/taste/tabs/TasteTabFrame"
import { TastePortrait } from "./TastePortrait"

// The side on show is the address's (`?side=`): a change of it alone keeps the page's data.
export const sideShouldRevalidate: ShouldRevalidateFunction = ({
	currentUrl,
	nextUrl,
	formMethod,
	defaultShouldRevalidate,
}) =>
	!formMethod && onlySideChanged(currentUrl, nextUrl)
		? false
		: defaultShouldRevalidate

export function TastePageBody({ data }: { data: TastePageData }) {
	if (data.kind === "portrait") return <Portrait data={data} />
	return <StartOrGroups view={data.view} />
}

/**
 * A member's one page, opened on the taste group the address asks for (`?side=`): the groups section scrolls to it.
 * An address that names no group of the member's is the page as without one, and loses the parameter.
 */
function Portrait({ data }: { data: TastePortraitData }) {
	const [params, setParams] = useSearchParams()
	const requested = requestedSide(params)
	const known =
		requested !== null &&
		data.taste.sides.list.some((side) => side.id === requested)
	const unknown = requested !== null && !known
	useEffect(() => {
		if (unknown)
			setParams((now) => withSide(now, null), {
				replace: true,
				preventScrollReset: true,
			})
	}, [unknown, setParams])
	return <TastePortrait data={data} side={known ? requested : null} />
}

/**
 * A guest's taste groups (their taste lives in their browser), or a member's start while they begin their taste and
 * the notice while it is prepared.
 */
function StartOrGroups({ view: memberView }: { view: SidesView | null }) {
	const [params, setParams] = useSearchParams()
	// The side on show takes the address's place, without a history entry: Back leaves the page in one step.
	const onAddress = useCallback(
		(id: string | null) =>
			setParams((now) => withSide(now, id), {
				replace: true,
				preventScrollReset: true,
			}),
		[setParams],
	)

	return (
		<TasteTabFrame tab="sides" memberView={memberView}>
			{(view) => (
				<Sides
					view={view}
					requested={requestedSide(params)}
					onAddress={onAddress}
				/>
			)}
		</TasteTabFrame>
	)
}

/**
 * The taste groups (CONTEXT.md), opened on the side the address asks for (`?side=`, ui/taste/side-address.ts). An
 * address that names no side of the person's is the page as without one, and loses the parameter.
 */
function Sides({
	view,
	requested,
	onAddress,
}: {
	view: SidesView
	requested: string | null
	onAddress: (id: string | null) => void
}) {
	const unknown =
		requested !== null && !view.sides.some((side) => side.id === requested)
	useEffect(() => {
		if (unknown) onAddress(null)
	}, [unknown, onAddress])
	return (
		<SidesOfYou
			view={view}
			opening={openingSide(view.sides, requested, view.openFirst)}
			onOpen={onAddress}
		/>
	)
}
