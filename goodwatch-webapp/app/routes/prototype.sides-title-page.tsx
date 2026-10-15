// PROTOTYPE - throwaway (#661, map #652). Sides of you on the title page: titles to try the variants on, picked at
// runtime from a prototype member's sides (on a side, just past one, between two, fitting none). Each link opens the
// real title page with ?variant=, ?as= and ?names= carried along. Read-only.
import { type LoaderFunctionArgs, json } from "@remix-run/node"
import { Link, useLoaderData, useSearchParams } from "@remix-run/react"
import { sidesTitleSamples } from "~/server/prototype-sides-title/index.server"
import { posterUrl, titleHref } from "~/ui/taste/tabs/parts"
import { VARIANTS, isVariant, type SamplesView } from "~/ui/prototype-sides-title/model"

export async function loader({ request }: LoaderFunctionArgs) {
	if (process.env.NODE_ENV === "production") throw new Response("Not found", { status: 404 })
	const params = new URL(request.url).searchParams
	const view = await sidesTitleSamples(request, params.get("as"))
	return json({ view }, { headers: { "Cache-Control": "private, no-store" } })
}

export const meta = () => [
	{ title: "Sides of you on the title page, prototype · GoodWatch" },
	{ name: "robots", content: "noindex, nofollow" },
]

const KIND = { on: "On a side", edge: "Just past a side", none: "Fits no side" } as const

export default function SidesTitlePagePrototype() {
	const { view } = useLoaderData<typeof loader>() as { view: SamplesView | null }
	const [params, setParams] = useSearchParams()
	const variant = isVariant(params.get("variant")) ? (params.get("variant") as string) : "line"
	const names = params.get("names") === "1"
	if (!view) return <p className="mx-auto max-w-7xl px-4 py-16 text-gray-300 md:px-8">The title snapshot is still loading on this dev server. Reload in a minute.</p>
	const set = (k: string, v: string | null) => {
		const p = new URLSearchParams(params)
		if (v === null) p.delete(k)
		else p.set(k, v)
		setParams(p, { preventScrollReset: true })
	}
	const carry = new URLSearchParams({ variant, as: view.member.slot, ...(names ? { names: "1" } : {}) }).toString()
	const sideLabel = (id: string) => {
		const i = view.sides.findIndex((s) => s.id === id)
		const s = view.sides[i]
		if (!s) return id === "none" ? "Fits no side" : id === "rated" ? "Rated low" : "Loved, no side"
		return `Side ${i + 1}${names ? `: ${s.name}` : ""} · ${s.count} loved, ${Math.round(s.share * 100)}%`
	}
	const total = view.spread.on + view.spread.edge + view.spread.none
	return (
		<div className="mx-auto max-w-7xl px-4 pb-24 pt-10 text-white md:px-8">
			<h1 className="text-3xl font-bold md:text-4xl">Sides of you on the title page</h1>
			<p className="mt-2 max-w-3xl text-gray-400">
				Prototype for #661. Open any title below: the real title page shows the chosen variant for the chosen member. Arrow keys switch variants on the title page; the choice stays on while you browse in this tab.
			</p>
			<div className="mt-6 flex flex-wrap items-center gap-2 text-sm">
				<span className="font-semibold text-fuchsia-300">Member:</span>
				{view.members.map((m) => (
					<button key={m.slot} type="button" onClick={() => set("as", m.slot)} aria-pressed={m.slot === view.member.slot} className={`cursor-pointer rounded-full border px-2.5 py-0.5 font-semibold ${m.slot === view.member.slot ? "border-fuchsia-400 bg-fuchsia-900/60" : "border-white/15 text-gray-300"}`}>
						{m.label} {m.ratings > 0 && <span className="text-gray-400">{m.ratings}</span>}
					</button>
				))}
			</div>
			<div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
				<span className="font-semibold text-fuchsia-300">Variant:</span>
				{Object.entries(VARIANTS).map(([k, v]) => (
					<button key={k} type="button" onClick={() => set("variant", k)} aria-pressed={k === variant} className={`cursor-pointer rounded-full border px-2.5 py-0.5 font-semibold ${k === variant ? "border-fuchsia-400 bg-fuchsia-900/60" : "border-white/15 text-gray-300"}`}>
						{v.name}
					</button>
				))}
				<label className="ml-2 inline-flex cursor-pointer items-center gap-1.5 font-semibold">
					<input type="checkbox" checked={names} onChange={(e) => set("names", e.target.checked ? "1" : null)} className="accent-fuchsia-500" />
					Side names (words gate)
				</label>
			</div>
			<p className="mt-4 text-sm text-gray-400">
				{view.member.loved} loved titles, {view.member.loose} fit no side, {view.sides.length} sides. Of the {total} most-voted titles this member hasn't seen, {view.spread.on} sit on a side, {view.spread.edge} just past one, and {view.spread.none} fit none (the page shows nothing). {view.computedMs} ms.
			</p>
			<div className="mt-8 space-y-6">
				{[...new Set(view.rows.map((r) => r.group))].map((group) => (
					<section key={group}>
						<h2 className="text-lg font-bold">{sideLabel(group)}</h2>
						<div className="mt-2 space-y-3">
							{view.rows
								.filter((r) => r.group === group)
								.map((row) => (
									<div key={row.note} className="flex flex-wrap items-center gap-3">
										<span className={`w-72 shrink-0 text-sm ${row.kind === "on" ? "text-amber-300" : row.kind === "edge" ? "text-sky-300" : "text-gray-400"}`}>
											{KIND[row.kind]}: {row.note}
										</span>
										{row.keys.map((key) => {
											const t = view.titles[key]
											if (!t) return null
											return (
												<Link key={key} to={`${titleHref(t)}?${carry}`} className="flex w-56 items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] p-1.5 pr-3 text-sm hover:border-fuchsia-400/60">
													{t.poster && <img src={posterUrl(t, "w185")} alt="" className="w-8 rounded" />}
													<span className="min-w-0 truncate">
														{t.title} {t.year && <span className="text-gray-500">{t.year}</span>}
													</span>
												</Link>
											)
										})}
									</div>
								))}
						</div>
					</section>
				))}
			</div>
		</div>
	)
}
