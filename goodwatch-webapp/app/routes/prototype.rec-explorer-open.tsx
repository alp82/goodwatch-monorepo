// PROTOTYPE - throwaway. The Explorer's title card and its way to the title page: today a small underlined link under
// the actions, easy to miss. The real Explorer with the card forked (ui/prototype-rec-explorer-open), in variants
// (?variant=hero|current). Needs REC_EXPLORER on. Open a card: zoom into an island and tap a poster.
import explorerCss from "~/ui/explorer/explorer.css?url"
import { ExplorerMap } from "~/ui/explorer/ExplorerMap"
import {
	OPEN_CSS,
	OPEN_VARIANTS,
	OpenCard,
} from "~/ui/prototype-rec-explorer-open/OpenCard"
import { PrototypeSwitcher } from "~/ui/prototype/PrototypeSwitcher"
import { assetUrl } from "~/utils/asset-url"

export async function loader() {
	if (process.env.NODE_ENV === "production")
		throw new Response("Not found", { status: 404 })
	return null
}

export const meta = () => [
	{ title: "Explorer prototype: the way to the title page · GoodWatch" },
	{ name: "robots", content: "noindex, nofollow" },
]
export const links = () => [{ rel: "stylesheet", href: assetUrl(explorerCss) }]
export const shouldRevalidate = () => false

export default function RecExplorerOpenPrototype() {
	return (
		<>
			{/* biome-ignore lint/security/noDangerouslySetInnerHtml: the prototype's own stylesheet, a constant. */}
			<style dangerouslySetInnerHTML={{ __html: OPEN_CSS }} />
			<ExplorerMap initialWorld={null} Card={OpenCard} />
			<PrototypeSwitcher
				variants={OPEN_VARIANTS}
				position="bottom-[5.75rem] left-2 right-2 justify-between lg:bottom-3 lg:left-1/2 lg:right-auto lg:-translate-x-1/2 lg:justify-start scale-90 origin-bottom"
			/>
		</>
	)
}
