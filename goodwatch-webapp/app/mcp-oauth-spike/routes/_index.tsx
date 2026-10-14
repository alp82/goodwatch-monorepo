import { resource } from "../auth.server"
import { json } from "@remix-run/node"
import { useLoaderData } from "@remix-run/react"

export const loader = () => json({ resource })
export default function Home() {
	const data = useLoaderData<typeof loader>()
	return (
		<main>
			<h1>GoodWatch MCP OAuth spike</h1>
			<p>How should the MCP tools feel in a real conversation?</p>
			<p>
				Throwaway: fictional titles and progress, one demo member, all state in
				memory.
			</p>
			<p>
				Connector URL: <code>{data.resource}</code>
			</p>
			<p>
				14 proposed tools on mutable fixtures; get_taste is hidden for the demo
				member by default.
			</p>
			<p>
				Orbit Garden starts at S1E3; rating Lighthouse has no recorded date.
				Restarting resets every fixture and grant.
			</p>
			<a href="/fixture/movie/603">Lighthouse fixture</a> ·{" "}
			<a href="/fixture/show/1399">Orbit Garden fixture</a>
			<p>
				<a href="/login">Demo sign-in</a>
			</p>
		</main>
	)
}
