// PROTOTYPE - throwaway. One title action set on every title surface: Score, Want to see, Seen it, Not interested.
//   /prototype/title-actions?variant=quick|peek|menu|footer-bolder
// The sections are copies of the real surfaces (the Discover card grid, the Explorer popup, the title page hero's
// action area, Watch next's finish dialog) plus a new Hidden titles list. Every action stays in memory, in one store
// the sections share; nothing is written. The loader reads 18 title cards, read-only.
import { type LinksFunction, type LoaderFunctionArgs, json } from "@remix-run/node"
import { type ShouldRevalidateFunction, useLoaderData, useSearchParams } from "@remix-run/react"
import { NO_TASTE } from "~/server/taste/taste.server"
import { type TitleCard, getTitleCards } from "~/server/title-cards.server"
import { getViewerContext } from "~/server/viewer.server"
import explorerCss from "~/ui/explorer/explorer.css?url"
import { PrototypeSwitcher } from "~/ui/prototype/PrototypeSwitcher"
import { CardGrid } from "~/ui/prototype-title-actions/cards"
import { ExplorerSection, FinishSection, HeroSection, HiddenList, Section, StatePanel, Toast } from "~/ui/prototype-title-actions/sections"
import { StoreProvider, type UndoStyle, type VariantKey } from "~/ui/prototype-title-actions/store"
import { titleKey } from "~/utils/title-key"

const MOVIES = [157336, 27205, 496243, 872585, 244786, 680, 155, 603, 13, 19995, 550, 129]
const SHOWS = [1396, 1399, 66732, 100088, 60059, 76479]

export async function loader({ request }: LoaderFunctionArgs) {
	if (process.env.NODE_ENV === "production") throw new Response("Not found", { status: 404 })
	const keys = [...MOVIES.map((id) => titleKey("movie", id)), ...SHOWS.map((id) => titleKey("show", id))]
	const cards = await getTitleCards(keys, await getViewerContext(request), NO_TASTE)
	return json({ cards })
}

export const links: LinksFunction = () => [{ rel: "stylesheet", href: explorerCss }]
export const meta = () => [{ title: "Title actions prototype · GoodWatch" }, { name: "robots", content: "noindex, nofollow" }]
export const shouldRevalidate: ShouldRevalidateFunction = () => false

const VARIANTS: Record<VariantKey, string> = {
	quick: "Hover row on cards, hold on phones",
	peek: "Card opens one shared popup",
	menu: "More button and compact menu",
	"footer-bolder": "Actions always under the poster",
}
const DEFAULT_UNDO: Record<VariantKey, UndoStyle> = { quick: "toast", peek: "toast", menu: "tile", "footer-bolder": "tile" }

const CARD_NOTE: Record<VariantKey, string> = {
	quick: "Desktop: hover a card for a row of four (score, Want to see, Seen it, Not interested); the star opens the compact score control. Phones: press and hold a card for a sheet with the full set. A plain click still opens the title page.",
	peek: "A click or tap on a card opens the shared title popup (the Explorer's card) with the full set and Open the title page. Cards carry no controls of their own.",
	menu: "Each card has a more button. Its menu (a sheet on phones) lists Rate, Want to see, Seen it, Not interested; Rate expands the 1-10 strip in place.",
	"footer-bolder": "Bolder: every card carries the four actions in a footer under the poster, the same on phones and desktop. The star opens the score control (a sheet on phones).",
}
const POPUP_NOTE: Record<VariantKey, string> = {
	quick: "Compact score control, Want to see and Seen it as today, Not interested as a third, smaller button.",
	peek: "The same popup the cards open. Not interested is a link beside Open the title page, so the card grows only by the score control.",
	menu: "One row of four; Score expands the compact control in place. Not interested is the icon at the end of the row.",
	"footer-bolder": "Compact score control, Want to see and Seen it as today, Not interested as a third, smaller button.",
}
const HERO_NOTE: Record<VariantKey, string> = {
	quick: "The full score control sits in the box, in place of Rate this and its picker. Not interested joins Want to see and Seen it.",
	peek: "The full score control sits in the box, in place of Rate this and its picker. Not interested joins Want to see and Seen it.",
	menu: "Rate this stays a button and expands the full score control in place, instead of opening the bar picker. Not interested joins the list buttons.",
	"footer-bolder": "The full score control sits in the box, in place of Rate this and its picker. Not interested joins Want to see and Seen it.",
}

export default function TitleActionsPrototype() {
	const { cards } = useLoaderData<typeof loader>() as unknown as { cards: TitleCard[] }
	const [params] = useSearchParams()
	const key = (params.get("variant") ?? "quick") as VariantKey
	const variant: VariantKey = key in VARIANTS ? key : "quick"
	if (cards.length < 3) return <p className="p-8 text-gray-300">The loader returned fewer than three title cards.</p>
	return (
		<StoreProvider cards={cards} variant={variant} defaultUndo={DEFAULT_UNDO[variant]}>
			<div className="mx-auto max-w-7xl overflow-x-clip px-4 pb-48 pt-6 text-white sm:px-6 lg:px-8" data-variant={variant}>
				<h1 className="text-2xl font-bold">Title actions: {variant}</h1>
				<p className="mt-1 max-w-3xl text-sm text-gray-400">
					Prototype. One action set on every surface: Score, Want to see, Seen it, Not interested. Changes stay on this page until you reload. Use the arrows
					(or the arrow keys) to switch variants.
				</p>
				<div className="mt-4 lg:fixed lg:bottom-3 lg:right-3 lg:z-[60] lg:mt-0 lg:w-[26rem]">
					<StatePanel />
				</div>

				<Section n={1} title="Poster cards (Discover, For you)" note={CARD_NOTE[variant]}>
					<CardGrid />
				</Section>
				<Section n={2} title="Explorer popup" note={POPUP_NOTE[variant]}>
					<ExplorerSection card={cards[0]} />
				</Section>
				<Section n={3} title="Title page hero" note={HERO_NOTE[variant]}>
					<HeroSection card={cards[1]} />
				</Section>
				<Section
					n={4}
					title="Watch next: finish dialog"
					note={`The dialog after "I watched it", with the ${variant === "menu" || variant === "footer-bolder" ? "compact" : "full"} score control in place of the bar picker.`}
				>
					<FinishSection card={cards[2]} />
				</Section>
				<Section n={5} title="Settings: Hidden titles" note="A settings page section. It lists what Not interested hid, on any surface, with Unhide.">
					<HiddenList />
				</Section>
			</div>
			<Toast />
			<PrototypeSwitcher variants={VARIANTS} position="top-[4.5rem] right-2 scale-75 origin-top-right md:top-auto md:right-auto md:scale-100 md:bottom-6 md:left-1/2 md:-translate-x-1/2" />
		</StoreProvider>
	)
}
