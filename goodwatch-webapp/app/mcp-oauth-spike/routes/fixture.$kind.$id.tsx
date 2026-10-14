import { json, type LoaderFunctionArgs } from "@remix-run/node"
import { useLoaderData } from "@remix-run/react"
import { titles } from "../fixtures.server"
export function loader({ params }: LoaderFunctionArgs) {
	const title = titles.find(
		(title) => title.id === `${params.kind}:${params.id}`,
	)
	if (!title) throw new Response("Fixture title not found", { status: 404 })
	return json({ title })
}
export default function FixtureTitle() {
	const { title } = useLoaderData<typeof loader>()
	return (
		<main>
			<h1>
				{title.name} ({title.year})
			</h1>
			<p>
				Fictional MCP fixture; this ID does not identify a production catalog
				entry.
			</p>
			<p>
				{title.id} · {title.kind}
			</p>
			<p>{title.synopsis}</p>
			<p>Genres: {title.genres.join(", ")}</p>
			<a href="/">Spike home</a>
		</main>
	)
}
