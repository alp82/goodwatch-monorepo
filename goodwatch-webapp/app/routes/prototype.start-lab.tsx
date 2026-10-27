// PROTOTYPE (start page lab, 2026-10-27): the start page redesign lab. One variant per section, picked in the URL
// and the bar at the bottom: /prototype/start-lab?as=guest&layout=a&hero=a&scene=sofa-shelves&shelf=a&tv=a...
// The loader reads fixture JSON only (server/prototype-start-lab.server.ts); run it with prototype-start-lab.sh.
import { type LoaderFunctionArgs, json } from "@remix-run/node"
import { type MetaFunction, type ShouldRevalidateFunction, useLoaderData } from "@remix-run/react"
import { LabPage } from "~/ui/prototype-start-lab/lab/LabPage"

export const meta: MetaFunction = () => [
	{ title: "Start page lab · GoodWatch prototype" },
	{ name: "robots", content: "noindex, nofollow" },
]

export async function loader(_: LoaderFunctionArgs) {
	if (process.env.NODE_ENV === "production") throw new Response("Not found", { status: 404 })
	const { loadStartLab } = await import("~/server/prototype-start-lab.server")
	return json(loadStartLab())
}

// Switching variants changes only the search params: the fixtures stay.
export const shouldRevalidate: ShouldRevalidateFunction = ({ currentUrl, nextUrl, defaultShouldRevalidate }) =>
	currentUrl.pathname === nextUrl.pathname ? false : defaultShouldRevalidate

export default function StartLab() {
	const data = useLoaderData<typeof loader>()
	return <LabPage data={data as never} />
}
