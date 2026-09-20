// THROWAWAY: one blended list over the accepted D4+ search, with atomic result replacement.
import { json, type LoaderFunctionArgs } from "@remix-run/node"
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
const examples = ["Heat", "Drive", "Her", "like Game of Thrones, but sci-fi", "Tom Hanks", "Incepton", "Game of Th", "tense but not bleak"]
const words = (s: string): string[] => s.toLocaleLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []
const normalized = (s: string) => words(s).join(" ")
type Policy = "balanced" | "title" | "discovery"
type Row = {key: string; title: string; original?: string; type: string; year: string; poster: string | null; knownFor?: string; popularity: number; discovery?: Description["results"][number]; lexical: number; match: string; score: number}
function titleMatch(title: string, query: string) {
  const name = normalized(title), request = normalized(query)
  if (!name || !request) return {lexical:0,match:""}
  if (name === request) return {lexical:2,match:"Exact title"}
  const target = words(title), wanted = words(query)
  const hits = [...new Set(wanted)].filter(w=>target.includes(w)).length
  const coverage = hits / new Set(wanted).size
  if (` ${name} `.includes(` ${request} `)) return {lexical:1.05,match:"Exact phrase in title"}
  if (coverage === 1) return {lexical:.9,match:"All search words in title"}
  if (hits) return {lexical:.65*coverage,match:"Words in title"}
  if (wanted.length && target.some(w=>w.startsWith(wanted[wanted.length-1])) && wanted[wanted.length-1].length>=2)
    return {lexical:.15,match:"Partial word in title"}
  return {lexical:0,match:"Catalog suggestion"}
}
function blend(titles: Title[], description: Description | null, q: string, policy: Policy) {
  const rows = new Map<string,Row>()
  for (const t of titles) {
    const type = t.type === "tv" ? "show" : t.type
    const key = `${type}:${t.id}`
    rows.set(key,{key,title:t.title,original:t.original,type,year:t.year,poster:t.poster,knownFor:t.knownFor,popularity:t.popularity,...titleMatch(t.title,q),score:0})
  }
  for (const d of description?.results ?? []) {
    const key = `${d.media_type}:${d.tmdb_id}`
    const row = rows.get(key) ?? {key,title:d.title,type:d.media_type,year:String(d.release_year),poster:d.poster_path,popularity:0,...titleMatch(d.title,q),score:0}
    row.discovery=d;rows.set(key,row)
  }
  for (const row of rows.values()) {
    const original = titleMatch(row.original ?? "",q)
    if (original.lexical>row.lexical) {row.lexical=original.lexical;row.match=`${original.match} (original name)`}
    // Rank fusion avoids pretending that text relevance and fingerprint scores share a scale.
    const fingerprint = row.discovery ? 10/(9+row.discovery.rank) : 0
    const titleWeight = policy === "title" ? 1.4 : policy === "discovery" ? .75 : 1
    const discoveryWeight = policy === "discovery" ? 1.1 : .9
    row.score = row.lexical===2 ? 3 + .1*fingerprint : Math.max(row.lexical*titleWeight, fingerprint*discoveryWeight) + Math.min(row.lexical, fingerprint)*.15
  }
  return [...rows.values()].sort((a,b)=>b.score-a.score || b.popularity-a.popularity || a.key.localeCompare(b.key)).slice(0,20)
}
async function get<T>(q: string, kind: string, signal: AbortSignal): Promise<T> {
  const p = new URLSearchParams({q,kind})
  const response = await fetch(`/prototype/combined-search?${p}&_data=routes%2Fprototype.combined-search`, {signal})
  const body = await response.json()
  if (!response.ok || body.error) throw new Error(body.error ?? "Search failed")
  return body
}
function Highlight({text,query}: {text:string;query:string}) {
  const terms = new Set(words(query))
  const last = words(query).at(-1) ?? ""
  return <>{text.split(/([\p{L}\p{N}]+)/gu).map((part,i)=>{
    const lower=part.toLocaleLowerCase()
    if (terms.has(lower)) return <mark key={i} className="rounded bg-amber-300/20 text-amber-200 px-0.5">{part}</mark>
    if (last.length>=2 && lower.startsWith(last)) return <span key={i}><mark className="rounded bg-amber-300/20 text-amber-200">{part.slice(0,last.length)}</mark>{part.slice(last.length)}</span>
    return <span key={i}>{part}</span>
  })}</>
}
function Poster({path}: {path: string | null}) {
  return path ? <img className="w-12 h-16 shrink-0 rounded object-cover" width={48} height={64} src={`https://image.tmdb.org/t/p/w92${path}`} alt=""/> : <div className="w-12 h-16 rounded bg-slate-700 shrink-0"/>
}
type Batch = {q:string;titles:Title[];description:Description|null;errors:string[]}
export default function CombinedSearchPrototype() {
  const [input,setInput] = useState("")
  const [debounced,setDebounced] = useState("")
  const [snapshot,setSnapshot] = useState<Batch|null>(null)
  const [policy,setPolicy] = useState<Policy>("balanced")
  useEffect(() => {const id=setTimeout(()=>setDebounced(input.trim()),1000);return ()=>clearTimeout(id)},[input])
  const search = useQuery({queryKey:["prototype-combined-batch",debounced],enabled:debounced.length>=2,
    queryFn:async ({signal}):Promise<Batch>=>{
      const [titles,description]=await Promise.allSettled([
        get<{results:Title[];ms:number}>(debounced,"titles",signal),get<Description>(debounced,"description",signal),
      ])
      if (signal.aborted) throw new DOMException("Canceled","AbortError")
      if(titles.status==="rejected" && description.status==="rejected") throw new Error("Search unavailable. Your previous results are still shown.")
      return {q:debounced,titles:titles.status==="fulfilled"?titles.value.results:[],description:description.status==="fulfilled"?description.value:null,
        errors:[...(titles.status==="rejected"?["Title lookup unavailable"]:[]),...(description.status==="rejected"?["Description search unavailable"]:[])]}
    },retry:false,refetchOnWindowFocus:false,refetchOnReconnect:false})
  useEffect(()=>{if(search.data && search.data.q===input.trim())setSnapshot(search.data)},[search.data,input])
  const waiting=input.trim()!==debounced
  const loading=input.trim().length>=2 && (waiting || search.isFetching)
  const rows=snapshot?blend(snapshot.titles,snapshot.description,snapshot.q,policy):[]
  const status=loading ? snapshot ? `Updating results for “${input.trim()}”… Showing “${snapshot.q}” until ready.` : `Searching for “${input.trim()}”…`
    : search.error && input.trim()===debounced ? search.error.message
    : input.trim().length<2 ? "Type at least two characters to search."
    : snapshot ? `${rows.length} results for “${snapshot.q}”${snapshot.errors.length?` · ${snapshot.errors.join("; ")}`:""}` : "Search by title, person, or description."
  return <main className="max-w-4xl mx-auto p-6 pb-16 text-slate-100">
    <p className="text-xs uppercase tracking-widest text-amber-400">Combined search prototype</p>
    <h1 className="text-3xl font-semibold mt-3">Find your next watch</h1>
    <p className="text-slate-400 mt-2 mb-6">A title, a person, or what you feel like watching.</p>
    <form onSubmit={e=>{e.preventDefault();setDebounced(input.trim())}} className="flex gap-3">
      <input aria-label="Search titles, people, or descriptions" value={input} onChange={e=>setInput(e.target.value)} className="min-w-0 w-full bg-slate-900 rounded-lg border border-slate-600 px-4 py-3" placeholder="A title, a name, or a story…"/>
      <button className="bg-sky-700 rounded-lg px-5" disabled={input.trim().length<2}>Search</button>
    </form>
    <div className="flex flex-wrap gap-2 my-4">{examples.map(q=><button key={q} className="text-sm border border-slate-600 rounded-full px-3 py-1" onClick={()=>setInput(q)}>{q}</button>)}</div>
    <div role="status" aria-live="polite" className="min-h-16 flex items-start gap-3 py-2 text-sm text-slate-400">
      <span className={`mt-0.5 h-4 w-4 shrink-0 rounded-full border-2 ${loading?"animate-spin border-sky-400 border-t-transparent":"border-transparent"}`} aria-hidden="true"/>
      <span>{status}</span>
    </div>
    <section aria-label="Search results" aria-busy={loading} className="min-h-[600px] rounded-xl border border-slate-700 overflow-hidden">
      {!snapshot && loading && <div aria-hidden="true" className="divide-y divide-slate-800">{Array.from({length:6},(_,i)=><div key={i} className="p-4 flex gap-4 h-28 animate-pulse"><div className="w-12 h-16 bg-slate-800 rounded"/><div className="flex-1 space-y-3"><div className="w-1/2 h-4 rounded bg-slate-800"/><div className="w-1/3 h-3 rounded bg-slate-800"/></div></div>)}</div>}
      <ul className="divide-y divide-slate-800">{rows.map(r=><li key={r.key} className="p-4 flex gap-4 min-h-28" data-result-key={r.key}>
        <Poster path={r.poster}/><div className="min-w-0"><strong className="text-lg"><Highlight text={r.title} query={snapshot?.q??""}/></strong>
        <div className="text-sm text-slate-400">{r.year} · {r.type}</div>
        {r.match.includes("original name") && <p className="text-sm text-slate-300">Original: <Highlight text={r.original??""} query={snapshot?.q??""}/></p>}
        <div className="flex flex-wrap gap-2 mt-2">
          {r.lexical>0 && <span className="text-xs rounded bg-amber-300/10 text-amber-200 px-2 py-1">{r.match}</span>}
          {r.discovery?.reasons.filter(reason=>reason.kind!=="mismatch").slice(0,3).map(reason=><span key={reason.text} className="text-xs rounded bg-sky-400/10 text-sky-200 px-2 py-1">{reason.text}</span>)}
          {r.discovery && !r.discovery.reasons.some(reason=>reason.kind!=="mismatch") && <span className="text-xs text-sky-200">Description match</span>}
        </div>
        {r.type==="person" && <p className="text-sm mt-2 text-slate-400">Known for: {r.knownFor||"No credits returned"}</p>}
      </div></li>)}</ul>
      {!rows.length && !loading && <p className="p-6 text-slate-400">{snapshot?"No matches. Try another title or description.":"Your results will appear here."}</p>}
    </section>
    <details className="mt-8 border-t border-slate-700 pt-4"><summary>Prototype ranking comparison</summary>
      <label className="block mt-4">Ranking idea <select aria-label="Ranking idea" value={policy} onChange={e=>setPolicy(e.target.value as Policy)} className="ml-2 bg-slate-900 border border-slate-600 rounded p-2"><option value="balanced">Balanced blend</option><option value="title">Stronger title phrases</option><option value="discovery">Stronger fingerprint results</option></select></label>
      <p className="text-sm text-slate-400 my-3">Exact full titles always lead. Whole phrases and complete word matches rank above weak partial matches; top fingerprint results mix in using their D4+ rank. A small bonus rewards results found by both. Movie/show IDs are deduplicated. These are provisional ranking ideas, not calibrated relevance probabilities. Switching ideas reuses the same results without more Jev calls.</p>
      <p className="text-sm text-slate-400">Both sources run after one second without typing. Enter searches immediately. Results are replaced together after both sources settle; a failed source leaves a usable partial list. Existing results remain during loading, with highlights tied to the displayed query.</p>
      {snapshot?.description && <p className="text-sm mt-3">Description: {snapshot.description.ms} ms · {snapshot.description.tokens} tokens · ${snapshot.description.usd.toFixed(6)}</p>}
    </details>
  </main>
}
