// PROTOTYPE - throwaway (#657). Dev-only JSON of one variant's sides per prototype member, for tuning the variants.
import { type LoaderFunctionArgs, json } from "@remix-run/node"
import { protoView } from "~/server/prototype-better-sides/index.server"
import { isVariant } from "~/ui/prototype-better-sides/model"

export async function loader({ request }: LoaderFunctionArgs) {
	if (process.env.NODE_ENV === "production") throw new Response("Not found", { status: 404 })
	const params = new URL(request.url).searchParams
	const variant = params.get("variant")
	const view = await protoView(request, isVariant(variant) ? variant : "tighter", params.get("as"))
	if (!view) return json({ error: "no snapshot yet" })
	const t = (k: number | null | undefined) => (k == null ? null : (view.titles[k]?.title ?? String(k)))
	const sides = view.production
		? view.production.sides.map((s) => ({ name: s.name, share: s.share, average: s.average, here: s.here.map(t), edges: s.edges.map((e) => ({ chip: e.name, line: `${e.lead} ${e.place}`, sugg: e.suggestions.slice(0, 4).map(t) })) }))
		: view.sides.map((s) => ({
				name: s.name || `[${t(s.anchor)}]`,
				line: s.line,
				share: s.share,
				count: s.count,
				lift: s.lift,
				shared: s.shared,
				here: s.here.map(t),
				more: s.moreOfThis.slice(0, 5).map(t),
				edges: s.edges.map((e) => ({ chip: e.chip, line: e.line, evidence: e.evidence, rated: e.rated.map(t), sugg: e.suggestions.slice(0, 4).map(t) })),
			}))
	return json({ member: view.member, notes: view.notes, loose: view.loose, ms: view.computedMs, po: view.personalOrder, sides })
}
