// PROTOTYPE - throwaway. "Talked about now" on a real title page, every social source side by side (ticket 542).
//   /prototype/title-section?variant=rail|grouped|featured|lab
//   &sources=youtube,short,... (or &only=<source>) picks sources; &panel=0 and &switcher=0 hide the prototype chrome.
// The page is Resident Evil (2026) as goodwatch.app served it on 14 Oct 2026 (its loader data, saved in
// ui/prototype-title-section/title-page.json), so it runs without Crate or Valkey. Nothing is written anywhere.
import { json } from "@remix-run/node"
import { type ShouldRevalidateFunction, useLoaderData } from "@remix-run/react"
import type { MovieQueryResult } from "~/server/types/details-types"
import { TitleSectionPage } from "~/ui/prototype-title-section/page"
import titlePage from "~/ui/prototype-title-section/title-page.json"

export async function loader() {
	if (process.env.NODE_ENV === "production") throw new Response("Not found", { status: 404 })
	return json(titlePage)
}

export const meta = () => [{ title: "Talked about now: title section prototype · GoodWatch" }, { name: "robots", content: "noindex, nofollow" }]
export const shouldRevalidate: ShouldRevalidateFunction = () => false

export default function TitleSectionPrototype() {
	const data = useLoaderData<typeof loader>() as unknown as { media: MovieQueryResult; params: { country: string } }
	return <TitleSectionPage media={data.media} country={data.params.country} />
}
