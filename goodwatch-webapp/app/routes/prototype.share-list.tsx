// PROTOTYPE - throwaway. Question: what should sharing your taste on social media look like?
// Editor layouts that put the card first (?variant=<layout>) and many card designs (?design=<key>).
// The list lives in the URL (t, l, n, theme, p), so every state is shareable and reload-stable.
import { json, type LinksFunction, type LoaderFunctionArgs } from "@remix-run/node"
import { useLoaderData, useSearchParams } from "@remix-run/react"
import { useEffect, useState } from "react"
import { getSuggestions, parseKeys, resolveItems } from "~/server/prototype-share-list.server"
import { PrototypeSwitcher } from "~/ui/prototype/PrototypeSwitcher"
import { designByKey } from "~/ui/prototype-share-list/designs"
import { listParams, useEditor, useList } from "~/ui/prototype-share-list/editor-kit"
import { LAYOUTS, type LayoutKey } from "~/ui/prototype-share-list/layouts"
import { CARD_FONTS, PROMPTS, THEMES, type ThemeKey } from "~/ui/prototype-share-list/model"

const DRAFT_KEY = "prototype-share-list-draft"

export async function loader({ request }: LoaderFunctionArgs) {
	if (process.env.NODE_ENV === "production") throw new Response("Not found", { status: 404 })
	const params = new URL(request.url).searchParams
	const suggestions = await getSuggestions()
	// A fresh visit starts from a filled demo list so the card looks finished right away.
	const demo = !params.has("l") && !params.has("t")
	const items = demo ? suggestions["all-time"].slice(0, 5) : await resolveItems(parseKeys(params.get("l")))
	const date = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
	return json({ items, suggestions, date })
}

export const links: LinksFunction = () => [{ rel: "stylesheet", href: CARD_FONTS }]

export const meta = () => [{ title: "Share your list prototype · GoodWatch" }, { name: "robots", content: "noindex, nofollow" }]
export const shouldRevalidate = () => false

export default function ShareListPrototype() {
	const { items, suggestions, date } = useLoaderData<typeof loader>()
	const [params, setParams] = useSearchParams()
	const design = designByKey(params.get("design"))
	const layout = (params.get("variant") ?? "flip") as LayoutKey
	const theme = params.get("theme") as ThemeKey
	const promptId = params.get("p") ?? ""
	const list = useList({
		title: params.get("t") ?? PROMPTS[0].title,
		items,
		name: params.get("n") ?? "",
		theme: theme in THEMES ? theme : "ember",
		promptId: PROMPTS.some((p) => p.id === promptId) ? promptId : "all-time",
	})

	// Mirror the list into the URL so a reload or a copied link restores it.
	const url = listParams(design.key, list)
	url.set("variant", layout in LAYOUTS ? layout : "flip")
	const next = url.toString()
	useEffect(() => {
		const id = setTimeout(() => {
			if (new URLSearchParams(window.location.search).toString() !== next) setParams(new URLSearchParams(next), { replace: true, preventScrollReset: true })
		}, 400)
		return () => clearTimeout(id)
	}, [next, setParams])

	// Autosave the draft in this browser. A visit without a list in the URL picks it back up.
	const [saved, setSaved] = useState(false)
	useEffect(() => {
		if (params.has("l") || params.has("t")) return
		try {
			const draft = JSON.parse(localStorage.getItem(DRAFT_KEY) ?? "null")
			if (!draft?.items?.length) return
			list.set({ title: draft.title, items: draft.items, name: draft.name, theme: draft.theme in THEMES ? draft.theme : "ember", promptId: draft.promptId })
			if (draft.design) setDesign(draft.design)
		} catch {}
	}, [])
	const draft = JSON.stringify({ design: design.key, title: list.title, items: list.items, name: list.name, theme: list.theme, promptId: list.promptId })
	useEffect(() => {
		setSaved(false)
		const id = setTimeout(() => {
			try {
				localStorage.setItem(DRAFT_KEY, draft)
				setSaved(true)
			} catch {}
		}, 500)
		return () => clearTimeout(id)
	}, [draft])

	function setDesign(key: string) {
		const p = new URLSearchParams(next)
		p.set("design", key)
		setParams(p, { replace: true, preventScrollReset: true })
	}
	const ed = { ...useEditor({ list, suggestions, date, design, setDesign }), saved }
	const { View } = LAYOUTS[layout] ?? LAYOUTS.flip
	return (
		<>
			<View ed={ed} />
			<PrototypeSwitcher variants={Object.fromEntries(Object.entries(LAYOUTS).map(([k, l]) => [k, l.name]))} position="bottom-4 left-4 scale-90 origin-bottom-left" />
		</>
	)
}
