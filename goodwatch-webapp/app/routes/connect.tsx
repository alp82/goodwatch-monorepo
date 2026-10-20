import type { MetaFunction } from "@remix-run/node"
import { isEnabled } from "~/server/features.server"
import { ConnectorHelp } from "~/ui/connector/ConnectorHelp"
import { type PageMeta, buildMeta } from "~/utils/meta"

export { pageHeaders as headers } from "~/utils/headers"

// How to add GoodWatch to Claude, Claude Code and ChatGPT, behind REC_CONNECTOR (not found while it's off).

export function loader() {
	if (!isEnabled("connector")) throw new Response("Not found", { status: 404 })
	return null
}

export const meta: MetaFunction = () => {
	const pageMeta: PageMeta = {
		title: "Use GoodWatch in Claude and ChatGPT | GoodWatch",
		description:
			"Add GoodWatch to Claude, Claude Code or ChatGPT. Ask what to watch next, log what you watched and rate titles by chatting.",
		url: "https://goodwatch.app/connect",
		image: "https://goodwatch.app/images/heroes/hero-movies.png",
		alt: "Use GoodWatch in Claude and ChatGPT",
	}

	return buildMeta({ pageMeta, items: [] })
}

export default function Connect() {
	return <ConnectorHelp />
}
