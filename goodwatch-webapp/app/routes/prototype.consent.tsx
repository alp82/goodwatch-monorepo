// PROTOTYPE - throwaway (#545). Per-vendor consent with click-to-load embeds: four ways to ask, on one
// "Talked about now" row with real YouTube, TikTok and Bluesky embeds behind the facades. ?variant=A|B|C|D.
// A: the current CookieConsent banner with per-vendor toggles; B: vanilla-cookieconsent v3 + iframemanager;
// C: the facade is the consent (no banner); D: one question in the row's header (no banner).
// Sample data in memory (ui/prototype-consent/data.ts); consent is stored in this browser only, per variant.
import type { LinksFunction } from "@remix-run/node"
import { useSearchParams } from "@remix-run/react"
import ccCss from "vanilla-cookieconsent/dist/cookieconsent.css?url"
import imCss from "@orestbida/iframemanager/dist/iframemanager.css?url"
import protoCss from "~/ui/prototype-consent/consent.css?url"
import { VariantA } from "~/ui/prototype-consent/VariantA"
import { VariantB } from "~/ui/prototype-consent/VariantB"
import { VariantC } from "~/ui/prototype-consent/VariantC"
import { VariantD } from "~/ui/prototype-consent/VariantD"
import { PrototypeSwitcher } from "~/ui/prototype/PrototypeSwitcher"

export const links: LinksFunction = () => [
	{ rel: "stylesheet", href: ccCss },
	{ rel: "stylesheet", href: imCss },
	{ rel: "stylesheet", href: protoCss },
]

export async function loader() {
	if (process.env.NODE_ENV === "production") throw new Response("Not found", { status: 404 })
	return null
}

export const meta = () => [
	{ title: "Per-vendor consent prototype · GoodWatch" },
	{ name: "robots", content: "noindex, nofollow" },
]

const VARIANTS = {
	A: { name: "Extend CookieConsent", Component: VariantA },
	B: { name: "cookieconsent + iframemanager", Component: VariantB },
	C: { name: "Facade only", Component: VariantC },
	D: { name: "Ask in the row", Component: VariantD },
}

export default function ConsentPrototype() {
	const [params] = useSearchParams()
	const key = (params.get("variant") ?? "A") as keyof typeof VARIANTS
	const { Component } = VARIANTS[key] ?? VARIANTS.A
	return (
		<div className="min-h-screen pt-14 pb-40">
			{/* The query devtools' button sits over a phone banner's buttons. */}
			<style>{".tsqd-open-btn-container{display:none!important}"}</style>
			{/* key: each variant mounts fresh, so B's libraries start and stop with it. */}
			<Component key={key} />
			<PrototypeSwitcher
				variants={Object.fromEntries(Object.entries(VARIANTS).map(([k, v]) => [k, v.name]))}
				position="top-[4.75rem] left-1/2 -translate-x-1/2"
			/>
		</div>
	)
}
