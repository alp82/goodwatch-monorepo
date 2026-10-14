import { resource } from "../auth.server"
import { json } from "@remix-run/node"
import { useLoaderData } from "@remix-run/react"

export const loader = () => json({ resource })
export default function Home() {
	const data = useLoaderData<typeof loader>()
	return (
		<main>
			<h1>GoodWatch MCP OAuth spike</h1>
			<p>Does Better Auth OAuth work end to end with real MCP clients?</p>
			<p>
				Throwaway: fictional titles and progress, one demo member, all state in
				memory.
			</p>
			<p>
				Connector URL: <code>{data.resource}</code>
			</p>
			<p>Tools: get_title, get_my_shows, search_titles.</p>
			<a href="/login">Demo sign-in</a>
		</main>
	)
}
