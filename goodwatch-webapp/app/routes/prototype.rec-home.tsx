// PROTOTYPE - throwaway. Question (#178): what should the start page be, for guests and members, so it's the
// best place to decide what to watch tonight? Six variants (?variant=), each for three audiences (?as=):
//   /prototype/rec-home?variant=hero|split|picks|guided|tonight|magazine&as=guest|new|me
// `guest` is a first visit (no ratings, no services), `new` a member with 5 ratings, three services and a
// 3-title Wishlist, `me` the signed-in member (the default when signed in; on localhost in development,
// ?as=<user uuid> reads that person). Built on the settled pieces: Watch next round 7 (Best match, moods,
// "On my services", start hero with Then), Discover's `badge` taste coin, the `slab` bottom bar, and the
// research's short this-or-that cold start. Read-only: every change stays in memory until reload.
import { json, type LinksFunction, type LoaderFunctionArgs } from "@remix-run/node"
import { type ShouldRevalidateFunction, useLoaderData, useSearchParams } from "@remix-run/react"
import { useState } from "react"
import { type HomeData, getHome } from "~/server/prototype-rec-home.server"
import { PrototypeSwitcher } from "~/ui/prototype/PrototypeSwitcher"
import type { WTitle } from "~/ui/prototype-rec-watch-next-2/model"
import { AudienceBar, PATCH_CSS, TitleSheet, Toasts } from "~/ui/prototype-rec-home/kit"
import { useHome } from "~/ui/prototype-rec-home/model"
import { CSS } from "~/ui/prototype-rec-home/styles"
import { VARIANTS, type Variant } from "~/ui/prototype-rec-home/variants"

export async function loader({ request }: LoaderFunctionArgs) {
	if (process.env.NODE_ENV === "production") throw new Response("Not found", { status: 404 })
	return json(await getHome(request))
}

export const links: LinksFunction = () => [{ rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Gabarito:wght@400..900&display=swap" }]
export const meta = () => [{ title: "Start page prototype · GoodWatch" }, { name: "robots", content: "noindex, nofollow" }]

export const shouldRevalidate: ShouldRevalidateFunction = ({ currentUrl, nextUrl }) => ["as", "country"].some((k) => currentUrl.searchParams.get(k) !== nextUrl.searchParams.get(k))

export default function RecHomePrototype() {
	const data = useLoaderData<typeof loader>() as unknown as HomeData
	const [params] = useSearchParams()
	const key = params.get("variant") ?? "hero"
	const variant = VARIANTS[key] ?? VARIANTS.hero
	return (
		<>
			<style dangerouslySetInnerHTML={{ __html: CSS + PATCH_CSS }} />
			{/* Remount on every switch so each variant and audience starts from the same state. */}
			<Page key={`${key}:${data.audience}:${data.who.label}`} data={data} variant={variant} />
			<PrototypeSwitcher
				variants={Object.fromEntries(Object.entries(VARIANTS).map(([k, v]) => [k, `${v.name} (${v.style})`]))}
				position="bottom-[13.5rem] right-2 scale-75 origin-bottom-right md:bottom-6 md:right-auto md:left-1/2 md:-translate-x-1/2 md:origin-bottom md:scale-90"
			/>
		</>
	)
}

function Page({ data, variant }: { data: HomeData; variant: Variant }) {
	const h = useHome(data)
	const [open, setOpen] = useState<string | null>(null)
	const onOpen = (t: WTitle) => setOpen(t.key)
	return (
		<div className="overflow-x-clip" data-audience-page={data.audience}>
			<variant.View h={h} onOpen={onOpen} />
			<TitleSheet h={h} t={open ? (h.T(open) ?? null) : null} onClose={() => setOpen(null)} />
			<Toasts h={h} />
			<AudienceBar h={h} />
		</div>
	)
}
