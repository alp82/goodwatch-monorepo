// THROWAWAY: three routing policies over the accepted D4+ search. No production route changes.
import { json, type LoaderFunctionArgs } from "@remix-run/node"
import { useSearchParams } from "@remix-run/react"
import { useQuery } from "@tanstack/react-query"
import { useEffect, useState } from "react"
import { runCombinedDescription } from "~/server/prototype-combined-d4.server"

export async function loader({request}: LoaderFunctionArgs) {
  if (process.env.NODE_ENV === "production") throw new Response("Not found", {status: 404})
  const p = new URL(request.url).searchParams
  const q = (p.get("q") ?? "").trim().slice(0, 500)
  const kind = p.get("kind")
  if (!q || !kind) return json({})
  try {
    if (kind === "description") return json(await runCombinedDescription(q, p.get("routing") === "true"))
    const started = Date.now()
    const url = new URL("https://api.themoviedb.org/3/search/multi")
    url.search = new URLSearchParams({api_key: process.env.TMDB_API_KEY ?? "", query: q, language: "en-US", include_adult: "false"}).toString()
    const response = await fetch(url, {signal: AbortSignal.timeout(8000)})
    if (!response.ok) throw new Error(`Catalog lookup failed (${response.status})`)
    const data = await response.json()
    return json({results: (data.results ?? []).slice(0, 12).map((r: any) => ({
      id: r.id, title: r.title ?? r.name, original: r.original_title ?? r.original_name,
      type: r.media_type, year: (r.release_date ?? r.first_air_date ?? "").slice(0,4),
      poster: r.poster_path ?? r.profile_path, popularity: r.popularity,
      knownFor: (r.known_for ?? []).map((t: any) => t.title ?? t.name).join(", "),
    })), ms: Date.now() - started})
  } catch (error) { return json({error: String(error)}, {status: 502}) }
}

type Title = {id: number; title: string; original?: string; type: string; year: string; poster: string | null; popularity: number; knownFor: string}
type Description = Awaited<ReturnType<typeof runCombinedDescription>>
const variants = ["A", "B", "C"] as const
const names = {A: "Code chooses the lead", B: "Jev chooses the group", C: "Both groups stay visible"}
const examples = ["Heat", "Drive", "Her", "like Game of Thrones, but sci-fi", "Tom Hanks", "Incepton", "Game of Th", "tense but not bleak"]
const normalized = (s: string) => s.toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim()
async function get<T>(q: string, kind: string, routing: boolean, signal: AbortSignal): Promise<T> {
  const p = new URLSearchParams({q,kind,routing:String(routing)})
  const response = await fetch(`/prototype/combined-search?${p}&_data=routes%2Fprototype.combined-search`, {signal})
  const body = await response.json()
  if (!response.ok || body.error) throw new Error(body.error ?? "Search failed")
  return body
}
function Poster({path}: {path: string | null}) {
  return path ? <img className="w-12 h-16 rounded object-cover" src={`https://image.tmdb.org/t/p/w92${path}`} alt=""/> : <div className="w-12 h-16 rounded bg-slate-700 shrink-0"/>
}
export default function CombinedSearchPrototype() {
  const [params,setParams] = useSearchParams()
  const variant = variants.includes(params.get("variant") as any) ? params.get("variant") as typeof variants[number] : "C"
  const [input,setInput] = useState("")
  const [debounced,setDebounced] = useState("")
  const [submitted,setSubmitted] = useState("")
  const [alternate,setAlternate] = useState(false)
  useEffect(() => { const id = setTimeout(() => setDebounced(input.trim()), 300); return () => clearTimeout(id) }, [input])
  const cycle = (direction: number) => {setParams({variant: variants[(variants.indexOf(variant)+direction+3)%3]}, {preventScrollReset:true});setAlternate(false)}
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest("input,textarea,[contenteditable]")) return
      if (e.key === "ArrowLeft" || e.key === "ArrowRight") {e.preventDefault();cycle(e.key === "ArrowLeft" ? -1 : 1)}
    }
    window.addEventListener("keydown",key);return () => window.removeEventListener("keydown",key)
  }, [variant])
  const titles = useQuery({queryKey:["prototype-combined-title",debounced],enabled:debounced.length>=2,
    queryFn:({signal})=>get<{results:Title[];ms:number}>(debounced,"titles",false,signal), retry:false})
  const description = useQuery({queryKey:["prototype-combined-description",submitted,variant === "B"],enabled:!!submitted && submitted === input.trim(),
    queryFn:({signal})=>get<Description>(submitted,"description",variant === "B",signal), retry:false})
  const current = submitted !== "" && submitted === input.trim()
  const found = debounced === input.trim() ? titles.data?.results ?? [] : []
  const exact = (t:Title) => [t.title,t.original ?? ""].some(n=>normalized(n)===normalized(input))
  const ordered = [...found].sort((a,b)=>Number(exact(b))-Number(exact(a)) || b.popularity-a.popularity)
  const codeLead = ordered.some(exact) ? "titles" : "description"
  const route = current ? description.data?.routing : null
  const lead = variant === "B" && route && route.confidence >= .65 && route.choice !== "uncertain"
    ? route.choice === "lookup" ? "titles" : "description" : codeLead
  const showBoth = variant === "C" || alternate || (variant === "B" && (!route || route.choice === "uncertain" || route.confidence < .65))
  const titleGroup = <section className="rounded-xl border border-slate-700 p-5" key="titles">
    <h2 className="text-xl font-semibold mb-4">Titles & people</h2>
    {titles.isFetching && <p role="status">Looking up names…</p>}
    {titles.error && <p role="alert">Title lookup unavailable. {titles.error.message}</p>}
    {!titles.isFetching && found.length===0 && input.trim().length>=2 && <p>No matching names found. Try a different spelling.</p>}
    <ul className="space-y-4">{ordered.map(t=><li key={`${t.type}:${t.id}`} className="flex gap-3">
      <Poster path={t.poster}/><div><strong>{t.title}</strong><div className="text-sm text-slate-400">{t.year} · {t.type}{exact(t) ? " · Exact name" : ""}</div>
      {t.type === "person" && <p className="text-sm">Known for: {t.knownFor || "No credits returned"}</p>}</div>
    </li>)}</ul>
  </section>
  const descriptionGroup = <section className="rounded-xl border border-slate-700 p-5" key="description">
    <h2 className="text-xl font-semibold mb-4">Matches your description</h2>
    {!current && <p className="text-slate-400">Press Enter to find something matching your description.</p>}
    {current && description.isFetching && <p role="status">Finding matches…</p>}
    {current && description.error && <p role="alert">Description search unavailable. {description.error.message}</p>}
    {current && description.data && <><p className="mb-4 text-sm text-slate-400">Results for “{submitted}”</p>
    <ul className="space-y-4">{description.data.results.slice(0,10).map(r=><li key={`${r.media_type}:${r.tmdb_id}`} className="flex gap-3">
      <Poster path={r.poster_path}/><div><strong>{r.title}</strong><div className="text-sm text-slate-400">{r.release_year} · {r.media_type}</div>
      <p className="text-sm text-sky-300">{r.reasons.filter(r=>r.kind!=="mismatch").slice(0,3).map(r=>r.text).join(" · ")}</p>
    </div></li>)}</ul>{!description.data.results.length && <p>No description matches found.</p>}</>}
  </section>
  return <main className="max-w-6xl mx-auto p-6 pb-28 text-slate-100">
    <p className="text-xs uppercase tracking-widest text-amber-400">Throwaway prototype · live catalog + D4+ (corrected)</p>
    <h1 className="text-3xl font-semibold mt-3">Find your next watch</h1>
    <p className="text-slate-400 mt-2 mb-6">One box for a title, a person, or what you feel like watching.</p>
    <form onSubmit={e=>{e.preventDefault();setSubmitted(input.trim());setAlternate(false)}} className="flex gap-3">
      <input aria-label="Search titles, people, or descriptions" value={input} onChange={e=>{setInput(e.target.value);setSubmitted("");setAlternate(false)}} className="w-full bg-slate-900 rounded-lg border border-slate-600 px-4 py-3" placeholder="A title, a name, or a story you’re in the mood for…"/>
      <button className="bg-sky-700 rounded-lg px-5" disabled={!input.trim()}>Search</button>
    </form>
    <div className="flex flex-wrap gap-2 my-4">{examples.map(q=><button key={q} className="text-sm border border-slate-600 rounded-full px-3 py-1" onClick={()=>{setInput(q);setSubmitted("");setAlternate(false)}}>{q}</button>)}</div>
    <div className={`grid gap-5 ${showBoth && current ? "lg:grid-cols-2" : ""}`}>
      {!current ? titleGroup : showBoth ? lead === "titles" ? [titleGroup,descriptionGroup] : [descriptionGroup,titleGroup] : lead === "titles" ? titleGroup : descriptionGroup}
    </div>
    {current && !showBoth && <button className="mt-4 underline text-sky-300" onClick={()=>setAlternate(true)}>Also show {lead === "titles" ? "description matches" : "titles & people"}</button>}
    <details className="mt-8 border-t border-slate-700 pt-4"><summary>Prototype observations & current state</summary>
      <p className="my-3 text-sm">Question: should code or Jev pick a group, or should both stay visible? All variants use the same ranking. A runs both on submission and leads with exact catalog names. B adds one routing Choice to the attribute request and uses a provisional 0.65 confidence threshold; uncertainty shows both. C always shows both after submission. Name suggestions run after a 300 ms pause; descriptions run on Enter. No person filmography expansion or reference-title understanding is added.</p>
      <dl className="grid grid-cols-2 gap-2 text-sm"><dt>Input</dt><dd>{input || "Empty"}</dd><dt>Submitted</dt><dd>{submitted || "Not submitted"}</dd><dt>Lead group</dt><dd>{current ? lead : "Names while typing"}</dd><dt>Title lookup</dt><dd>{titles.data?.ms ?? "—"} ms</dd><dt>Description</dt><dd>{current && description.data ? `${description.data.ms} ms; ${description.data.tokens} input tokens; $${description.data.usd.toFixed(6)}` : "Not available"}</dd><dt>Routing</dt><dd>{route ? `${route.choice}; confidence ${route.confidence}` : "No Jev route judgment"}</dd></dl>
      {route && <pre className="text-xs mt-3">{JSON.stringify(route.probabilities,null,2)}</pre>}
      <p className="text-sm mt-3">Typing clears submitted results; canceled requests may already have incurred provider cost. Reference-title requests are passed unchanged to D4+: routing does not supply missing title knowledge. Typo behavior depends on catalog lookup.</p>
    </details>
    <div className="fixed z-50 bottom-5 left-1/2 -translate-x-1/2 bg-white text-slate-950 shadow-xl rounded-full flex items-center gap-3 px-4 py-3 whitespace-nowrap">
      <button aria-label="Previous variant" onClick={()=>cycle(-1)}>←</button><span className="text-sm">{variant}: {names[variant]}</span><button aria-label="Next variant" onClick={()=>cycle(1)}>→</button>
    </div>
  </main>
}
