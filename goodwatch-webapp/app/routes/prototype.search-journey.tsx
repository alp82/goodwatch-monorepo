// THROWAWAY: three header/results/detail journeys in the existing shell.
// Sample metadata and simulated search/taste actions; no ranking or account mutations.
import { json } from "@remix-run/node"
import { useSearchParams } from "@remix-run/react"
import { useEffect, useRef, useState } from "react"

export function loader() {
  if (process.env.NODE_ENV === "production") throw new Response("Not found", {status:404})
  return json({})
}
export const meta = () => [{title:"Search journey prototype · GoodWatch"},{name:"robots",content:"noindex, nofollow"}]
export const shouldRevalidate = () => false

type Film = {id:string;title:string;year:number;type:string;genre:string;votes:number;adult?:boolean;provider:string;country:string;reason:string;story:string;poster:string}
const films:Film[] = [
  {id:"movie:949",title:"Heat",year:1995,type:"movie",genre:"Crime",votes:700000,provider:"Netflix",country:"DE",reason:"Tense · moral conflict",story:"A meticulous thief and a driven detective approach a collision that neither can walk away from.",poster:"/umSVjVdbVwtx5ryCA2QXL44Durm.jpg"},
  {id:"movie:64690",title:"Drive",year:2011,type:"movie",genre:"Crime",votes:600000,provider:"Prime Video",country:"DE",reason:"Stylish · quiet tension",story:"A stunt driver becomes entangled in a dangerous getaway while trying to help a neighbor.",poster:"/602vevIURmpDfzbnv5Ubi6wIkQm.jpg"},
  {id:"movie:2649",title:"The Game",year:1997,type:"movie",genre:"Thriller",votes:400000,provider:"Netflix",country:"US",reason:"Wealth · paranoia",story:"A wealthy banker receives an unusual birthday gift that dissolves the boundaries of his carefully ordered life.",poster:""},
  {id:"show:76331",title:"Succession",year:2018,type:"show",genre:"Drama",votes:300000,provider:"Max",country:"US",reason:"Wealth · family rivalry",story:"The family behind a global media empire fights over power and the future of the company.",poster:"/7HW47XbkNQ5fiwQFYGWdw9gs144.jpg"},
  {id:"movie:152601",title:"Her",year:2013,type:"movie",genre:"Romance",votes:500000,provider:"Netflix",country:"DE",reason:"Intimate · bittersweet",story:"A lonely writer develops a relationship with an operating system designed to meet his needs.",poster:"/eCOtqtfvn7mxGl6nfmq4b1exJRc.jpg"},
  {id:"movie:157336",title:"Interstellar",year:2014,type:"movie",genre:"Science fiction",votes:2000000,provider:"Prime Video",country:"DE",reason:"Hopeful · high stakes",story:"A team travels beyond the solar system in search of a future for humanity.",poster:""},
  {id:"movie:329865",title:"Arrival",year:2016,type:"movie",genre:"Science fiction",votes:700000,provider:"Netflix",country:"US",reason:"Thoughtful · emotional",story:"A linguist searches for a way to communicate with visitors whose language could change her understanding of time.",poster:"/x2FJsf1ElAgr63Y3PNPtJrcmpoe.jpg"},
  {id:"show:1402",title:"The Walking Dead",year:2010,type:"show",genre:"Drama",votes:500000,provider:"Netflix",country:"DE",reason:"Survival · ensemble",story:"Survivors search for safety and connection after the world they knew disappears.",poster:"/n7PVu0hSz2sAsVekpOIoCnkWlbn.jpg"},
  {id:"movie:demo-small",title:"The Quiet Signal",year:2024,type:"movie",genre:"Science fiction",votes:180,provider:"",country:"",reason:"Unfamiliar discovery",story:"Fictional eligibility fixture: a lesser-known film with unknown availability and unknown adult classification.",poster:""},
  {id:"movie:demo-adult",title:"Adult-flagged sample",year:2020,type:"movie",genre:"Drama",votes:4500,adult:true,provider:"",country:"",reason:"Eligibility example",story:"Fictional non-explicit fixture for checking the include-adult control.",poster:""},
]
const names = {A:"Quick search",B:"Search workspace",C:"Browse beside details"}
type Variant = keyof typeof names
const control = "rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300 disabled:opacity-35"
const chip = "rounded-full border border-slate-600 px-3 py-1.5 text-xs"
const filterKeys = ["type","genre","year","availability","country","provider","lesser","adult"]
function Highlight({text,q}:{text:string;q:string}) {
  const terms = [...new Set(q.match(/[\p{L}\p{N}]+/gu)??[])].sort((a,b)=>b.length-a.length)
  return <>{terms.length ? text.split(new RegExp(`(${terms.join("|")})`,"giu")).map((s,i)=>i%2?<mark key={i} className="bg-amber-300/20 text-amber-200 rounded">{s}</mark>:s) : text}</>
}
export default function SearchJourney() {
  const [params,setParams] = useSearchParams()
  const variant:Variant = params.get("variant")==="B" ? "B" : params.get("variant")==="C" ? "C" : "A"
  const query=params.get("q")??"tense but not bleak"
  const [draft,setDraft]=useState(query)
  const [open,setOpen]=useState(false)
  const [batch,setBatch]=useState({q:query,rows:films.slice(0,8)})
  const [loading,setLoading]=useState(false)
  const [scenario,setScenario]=useState("normal")
  const [retry,setRetry]=useState(0)
  const [actions,setActions]=useState<Record<string,string>>({})
  const [overrides,setOverrides]=useState(false)
  const [tone,setTone]=useState("Tense")
  const [filterOpen,setFilterOpen]=useState(false)
  const [focused,setFocused]=useState(-1)
  const input=useRef<HTMLInputElement>(null)
  const panel=useRef<HTMLDivElement>(null)
  const scrolls=useRef<Record<string,number>>({})
  const lastDetail=useRef("")
  const id=params.get("title")??""
  const detail=films.find(f=>f.id===id)
  const direct=params.get("direct")==="1"
  const p=(key:string,fallback="")=>params.get(key)??fallback
  function update(changes:Record<string,string|null>,replace=false) {
    const next=new URLSearchParams(params)
    for(const [k,v] of Object.entries(changes)) if(v===null || v==="") next.delete(k); else next.set(k,v)
    setParams(next,{replace,preventScrollReset:true})
  }
  const resultKey=Array.from(params).filter(([k])=>k!=="title"&&k!=="direct").map(x=>x.join("=")).join("&")
  useEffect(()=>{
    const show=()=>{if(variant==="B"){back();setTimeout(()=>input.current?.focus(),30)}else setOpen(true)}
    window.addEventListener("prototype-search-open",show)
    return ()=>window.removeEventListener("prototype-search-open",show)
  },[params])
  useEffect(()=>{setDraft(query)},[query])
  useEffect(()=>{
    if(draft.trim()===query) return
    setLoading(true)
    const timer=setTimeout(()=>update({q:draft.trim(),title:null,direct:null}),1000)
    return ()=>clearTimeout(timer)
  },[draft,query])
  useEffect(()=>{
    setLoading(true)
    const timer=setTimeout(()=>{
      if(scenario!=="failure") {
        const all=[...films].sort((a,b)=>Number(b.title.toLowerCase()===query.toLowerCase())-Number(a.title.toLowerCase()===query.toLowerCase()))
        setBatch({q:query,rows:!query || scenario==="empty" ? [] : scenario==="weak" ? all.slice(6,8) : scenario==="partial" ? all.filter(f=>f.title.toLowerCase().includes(query.toLowerCase())).slice(0,5) : all})
      }
      setLoading(false)
    },scenario==="slow"?4000:450)
    return ()=>clearTimeout(timer)
  },[query,scenario,retry])
  useEffect(()=>{
    if(open) {setFocused(-1);setTimeout(()=>input.current?.focus(),0)}
  },[open])
  useEffect(()=>{
    if(lastDetail.current && !id) requestAnimationFrame(()=>window.scrollTo({top:scrolls.current[resultKey]??0,behavior:"instant"}))
    else if(id!==lastDetail.current && id) window.scrollTo({top:0,behavior:"instant"})
    lastDetail.current=id
  },[id,resultKey])
  function close() {setOpen(false);requestAnimationFrame(()=>document.getElementById("prototype-search-header")?.focus())}
  function switchVariant(step:number) {
    update({variant:(["A","B","C"] as Variant[])[(["A","B","C"].indexOf(variant)+step+3)%3]},true)
  }
  useEffect(()=>{
    const listener=(event:KeyboardEvent)=>{
      if(event.key==="Escape" && open) {event.preventDefault();close();return}
      const target=event.target as HTMLElement
      if(target.closest('input, textarea, select, button, [contenteditable="true"]'))return
      if(event.key==="ArrowLeft" || event.key==="ArrowRight") {event.preventDefault();switchVariant(event.key==="ArrowLeft"?-1:1)}
    }
    window.addEventListener("keydown",listener)
    return ()=>window.removeEventListener("keydown",listener)
  },[params,open])
  const rows=batch.rows.filter(f=>
    (p("type","all")==="all" || f.type===p("type")) && (!p("genre") || f.genre===p("genre")) &&
    (!p("year") || f.year>=Number(p("year"))) && (p("adult")==="1" || f.adult!==true) &&
    (p("lesser")==="1" || f.votes>=2000 || f.title.toLowerCase()===batch.q.toLowerCase()) &&
    (p("availability","all")!=="only" || (f.country===p("country","DE") && f.provider===p("provider","Netflix")))
  ).sort((a,b)=>p("availability")==="prefer" ? Number(b.country===p("country","DE")&&b.provider===p("provider","Netflix"))-Number(a.country===p("country","DE")&&a.provider===p("provider","Netflix")) : 0)
  const index=rows.findIndex(f=>f.id===id)
  function select(f:Film) {
    if(!detail)scrolls.current[resultKey]=window.scrollY
    update({title:f.id,direct:null});setOpen(false)
  }
  function back() {update({title:null,direct:null});setOpen(false)}
  const status=loading ? `Updating “${draft}”… ${batch.rows.length?`Keeping results for “${batch.q}”.`:""}`
    : scenario==="failure" ? `Search is unavailable. Keeping results for “${batch.q}”.`
    : scenario==="partial" ? "Description search is unavailable. Showing title matches only."
    : scenario==="weak" ? "A few nearby ideas; none is a strong match."
    : `${rows.length} suggestions for “${batch.q}”`
  function searchForm() {
    return <form className="flex gap-2" onSubmit={e=>{e.preventDefault();update({q:draft.trim(),title:null,direct:null});setRetry(x=>x+1)}}>
      <input ref={input} aria-label="Search titles or describe a story" placeholder="A title, a person, or a story…" className={`${control} flex-1 min-w-0 text-base`} value={draft} onChange={e=>setDraft(e.target.value)} onKeyDown={e=>{
        if(e.key==="ArrowDown" || e.key==="ArrowUp") {e.preventDefault();const n=Math.min(rows.length,variant==="A"?4:8);setFocused(x=>n?(x+(e.key==="ArrowDown"?1:-1)+n)%n:-1)}
        if(e.key==="Enter" && focused>=0 && rows[focused]) {e.preventDefault();select(rows[focused])}
      }}/><button className={`${control} bg-amber-700`}>Search</button>
    </form>
  }
  function filters() {
    const selectControl=(label:string,key:string,options:[string,string][],fallback="")=><label className="flex flex-col gap-1 text-xs text-slate-400">{label}<select aria-label={label} className={control} value={p(key,fallback)} onChange={e=>update({[key]:e.target.value})}>{options.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label>
    return <div className="space-y-4" data-filters>
      <div className="flex items-center justify-between gap-2"><h2 className="font-semibold">Your filters</h2><button className="text-xs text-cyan-300" onClick={()=>update(Object.fromEntries(filterKeys.map(k=>[k,null])))}>Reset filters</button></div>
      <div className="grid grid-cols-2 gap-3">
        {selectControl("Titles","type",[["all","Movies & shows"],["movie","Movies"],["show","Shows"]],"all")}
        {selectControl("Genre","genre",[["","Any genre"],...["Crime","Thriller","Drama","Romance","Science fiction"].map(x=>[x,x] as [string,string])])}
        {selectControl("Released since","year",[["","Any year"],["2000","2000"],["2010","2010"],["2020","2020"]])}
        {selectControl("Country","country",[["DE","Germany"],["US","United States"]],"DE")}
      </div>
      {selectControl("Streaming service","provider",[["Netflix","Netflix"],["Prime Video","Prime Video"],["Max","Max"]],"Netflix")}
      {selectControl("Availability","availability",[["all","Explore everything"],["prefer","Prefer my service"],["only","Only on my service"]],"all")}
      <p className="text-xs text-slate-400">{p("availability","all")==="all"?"Availability does not restrict discovery. Check where to watch after choosing a title.":p("availability")==="prefer"?"Matching offers move up; other and unknown offers stay in the list.":"Only matching country and service offers stay. Unknown availability is excluded."}</p>
      <label className="flex gap-2 text-sm"><input type="checkbox" checked={p("lesser")==="1"} onChange={e=>update({lesser:e.target.checked?"1":null})}/>Include lesser-known titles</label>
      <p className="text-xs text-slate-400">Removes the 2,000-vote discovery minimum. Title lookup has no minimum.</p>
      <label className="flex gap-2 text-sm"><input type="checkbox" checked={p("adult")==="1"} onChange={e=>update({adult:e.target.checked?"1":null})}/>Include adult-flagged titles</label>
      <p className="text-xs text-slate-400">Unknown classification stays eligible.</p>
      <div className="border-t border-slate-700 pt-3"><p className="text-xs uppercase tracking-wider text-cyan-400">Interpreted from your request · sample</p><div className="flex flex-wrap gap-2 mt-2"><span className={chip}>{tone}</span><span className={chip}>Avoid bleak</span></div>
        <button className="mt-3 text-xs text-cyan-300" onClick={()=>setOverrides(x=>!x)}>{overrides?"Keep interpretation read-only":"Try editing interpretation"}</button>
        {overrides && <label className="mt-2 flex flex-col gap-1 text-xs">Preferred tone<select className={control} value={tone} onChange={e=>setTone(e.target.value)}><option>Tense</option><option>Gentle</option><option>Any tone</option></select><span className="text-amber-200">Interaction preview only; this does not re-rank the sample.</span></label>}
      </div>
    </div>
  }
  function resultList(compact=false) {
    return <section aria-label={compact?"Quick suggestions":"Search results"} aria-busy={loading} className="min-h-64">
      <p role="status" className="min-h-14 py-3 text-sm text-slate-400">{status}{(scenario==="failure"||scenario==="partial")&&<button className="ml-2 underline text-cyan-300" onClick={()=>{setScenario("normal");setRetry(x=>x+1)}}>Retry</button>}</p>
      {!rows.length && !loading && <div className="rounded-xl border border-slate-700 p-8"><h3 className="text-xl">No matching titles</h3><p className="text-slate-400 my-3">Try a broader request or remove a filter.</p><button className={control} onClick={()=>update(Object.fromEntries(filterKeys.map(k=>[k,null])))}>Clear filters</button></div>}
      <ul className="divide-y divide-slate-700/70">{rows.slice(0,compact?4:undefined).map((f,i)=><li key={f.id}>
        <button data-result={f.id} onClick={()=>select(f)} className={`w-full flex text-left gap-4 px-3 py-4 rounded-lg hover:bg-slate-800 focus-visible:outline-cyan-300 ${id===f.id||focused===i?"bg-slate-800 ring-1 ring-cyan-500/40":""}`}>
          {f.poster?<img src={`/prototype-search-posters${f.poster}`} alt="" width={60} height={90} className={`${compact?"w-10 h-16":"w-16 h-24"} object-cover rounded bg-slate-800 shrink-0`}/>:<div className="w-16 h-24 bg-slate-800 rounded shrink-0"/>}
          <div className="min-w-0"><h3 className={`${compact?"text-base":"text-lg"} font-semibold`}><Highlight text={f.title} q={batch.q}/></h3><p className="text-xs text-slate-400 mt-1">{f.year} · {f.type==="show"?"Series":"Film"} · {f.genre}</p><p className="text-xs text-cyan-200 mt-2">{f.reason}</p>{!compact&&<p className="text-xs text-slate-400 mt-2">{f.country===p("country","DE")?`Sample offer: ${f.provider}`:"Availability unknown in selected country"}</p>}</div>
        </button>
      </li>)}</ul>
    </section>
  }
  function navigation() {
    return <nav aria-label="Search result navigation" className="flex flex-wrap items-center justify-between gap-3 border border-cyan-900 rounded-xl p-3 bg-cyan-950/30 text-sm">
      <button onClick={back} className="text-cyan-200">← Results for “{batch.q}”</button><div className="flex items-center gap-3"><button className={control} disabled={index<=0} onClick={()=>select(rows[index-1])}>Previous</button><span>{index<0?"Outside filters":`${index+1} / ${rows.length}`}</span><button className={control} disabled={index<0||index>=rows.length-1} onClick={()=>select(rows[index+1])}>Next</button></div>
      {index<0&&<p className="w-full text-xs text-slate-400">This title stays open, but no longer matches your filters. Return to results to choose another.</p>}
    </nav>
  }
  function details() {
    if(!detail)return null
    return <article aria-label="Title detail preview" className="min-w-0 space-y-5">
      {!direct&&variant!=="B"&&navigation()}
      <div className="rounded-2xl border border-slate-700 bg-gradient-to-br from-slate-800 to-slate-950 p-6 sm:p-9">
        <p className="text-xs uppercase tracking-widest text-amber-400">Title detail preview</p><div className="flex gap-5 mt-5">{detail.poster&&<img src={`/prototype-search-posters${detail.poster}`} alt="" className="w-24 sm:w-32 rounded-lg object-cover self-start"/>}<div className="min-w-0"><p className="text-sm text-slate-400">{detail.year} · {detail.genre}</p><h1 className="text-3xl sm:text-4xl font-semibold mt-2">{detail.title}</h1><p className="mt-4 text-sm leading-relaxed text-slate-300">{detail.story}</p></div></div>
        <div className="mt-6 flex flex-wrap gap-2">{detail.reason.split(" · ").map(x=><span className={chip} key={x}>{x}</span>)}</div>
      </div>
      <section aria-label="Taste bar" className="rounded-xl border border-slate-700 p-4 bg-slate-900 space-y-4">
        {!direct&&variant==="B"&&navigation()}
        <div className="flex flex-wrap items-center gap-2"><strong className="mr-2 text-sm">Your taste</strong>{["Want to See","Skip","Rate"].map(action=><button key={action} className={`${control} ${actions[detail.id]===action?"border-amber-400 text-amber-300":""}`} onClick={()=>setActions(x=>({...x,[detail.id]:action}))}>{action}</button>)}</div>
        {actions[detail.id]==="Rate"&&<div className="flex flex-wrap gap-2">{[1,2,3,4,5,6,7,8,9,10].map(n=><button key={n} className={control} aria-label={`Rate ${n}`} onClick={()=>setActions(x=>({...x,[detail.id]:`${n}/10`}))}>{n}</button>)}</div>}
        <p role="status" className="text-xs text-slate-400">{actions[detail.id]?`Demo action: ${actions[detail.id]}. `:""}Taste actions are simulated and independent of Previous/Next.</p>
      </section>
      <section className="rounded-xl border border-slate-700 p-6"><h2 className="text-xl">Where to watch</h2><p className="mt-3 text-slate-300">{detail.country===p("country","DE")?`Sample offer on ${detail.provider}.`:"Availability unknown for the selected country."}</p><p className="text-xs text-slate-500 mt-3">Offers are fixtures for comparing the interaction, not current availability.</p></section>
      {direct&&<p className="text-sm text-slate-400">Direct visit: no search sequence. Taste actions remain available.</p>}
      <details className="border border-slate-700 rounded-xl p-4"><summary>Refine search while keeping this title open</summary><div className="mt-4">{filters()}</div></details>
    </article>
  }
  const overlay=open&&variant!=="B"
  return <div className="mx-auto max-w-7xl px-4 pt-6 pb-44 text-slate-100">

    <div className="mb-6 flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs uppercase tracking-widest text-amber-400">Interaction prototype · {variant}</p><p className="text-sm text-slate-400 mt-1">Sample results & offers. No live search or library changes.</p></div><label className="text-xs">Result state <select aria-label="Result state" className={`${control} ml-2`} value={scenario} onChange={e=>setScenario(e.target.value)}>{["normal","slow","empty","weak","partial","failure"].map(s=><option key={s}>{s}</option>)}</select></label></div>
    {!detail&&<div className="mb-6"><h1 className="text-3xl font-semibold">{variant==="A"?"Find your next watch":variant==="B"?"Make room for a good story":"Follow your curiosity"}</h1><p className="text-slate-400 mt-2">{variant==="A"?"Start in the header. Take a quick suggestion or explore the full list.":variant==="B"?"One place for your request, filters, and every matching title.":"Keep the results beside you as you explore a title."}</p></div>}
    {variant==="A"? detail?details():<>
      <div className="flex gap-2 mb-4"><button className={`${control} bg-amber-800`} onClick={()=>setOpen(true)}>Search from header</button><button className={control} onClick={()=>setFilterOpen(x=>!x)}>Filters {filterOpen?"−":"+"}</button></div>
      {filterOpen&&<div className="border border-slate-700 rounded-xl p-5 mb-4 max-w-xl">{filters()}</div>}{resultList()}
    </>:variant==="B"?<>
      {!detail&&<div className="mb-6">{searchForm()}</div>}
      <div className="grid gap-8 lg:grid-cols-[260px_minmax(0,1fr)]"><aside className="rounded-xl border border-slate-700 p-5 self-start"><details open className="lg:block"><summary className="mb-4 lg:hidden">Filters</summary>{filters()}</details></aside><div className="min-w-0">{detail?details():resultList()}</div></div>
    </>:<>
      <div className="mb-5 flex flex-wrap gap-3"><button className={`${control} bg-amber-800`} onClick={()=>setOpen(true)}>Edit search · {query}</button><button className={control} onClick={()=>setFilterOpen(x=>!x)}>Refine results</button></div>
      {filterOpen&&<div className="max-w-xl p-5 border border-slate-700 rounded-xl mb-5">{filters()}</div>}
      <div className={`grid gap-6 ${detail?"lg:grid-cols-[minmax(270px,0.8fr)_minmax(0,1.5fr)]":""}`}><div className={`${detail?"hidden lg:block":""} min-w-0`}>{resultList()}</div>{detail?details():<p className="text-slate-400 text-sm">Choose a title to open it beside the list. On mobile, return to the same place with Results.</p>}</div>
    </>}
    {overlay&&<div className="fixed inset-0 z-[1100] bg-black/60" onMouseDown={e=>{if(e.target===e.currentTarget)close()}}>
      <div ref={panel} role="dialog" aria-modal="true" aria-label="Search" onKeyDown={e=>{
        if(e.key!=="Tab")return
        const nodes=Array.from(panel.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input,select,[tabindex="0"]')??[])
        const first=nodes[0],last=nodes[nodes.length-1]
        if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus()}
        if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus()}
      }} className={`absolute top-2 left-2 right-2 mx-auto max-h-[calc(100dvh-16px)] overflow-y-auto rounded-xl border border-slate-600 bg-slate-950 p-4 sm:p-6 shadow-2xl ${variant==="A"?"max-w-2xl":"max-w-6xl"}`}>
        <div className="flex items-center justify-between mb-4"><h2 className="font-semibold">A title, a person, or a story</h2><button className={control} onClick={close}>Close</button></div>{searchForm()}
        {variant==="A"?<>{resultList(true)}<button className={`${control} mt-3 w-full`} onClick={()=>{back();setFilterOpen(true);close()}}>View all {rows.length} results & filters</button></>:<div className="grid gap-6 mt-5 md:grid-cols-[240px_minmax(0,1fr)]"><aside><button className={`${control} md:hidden mb-3`} onClick={()=>setFilterOpen(x=>!x)}>Filters {filterOpen?"−":"+"}</button><div className={filterOpen?"":"hidden md:block"}>{filters()}</div></aside><div>{resultList()}</div></div>}
      </div>
    </div>}
    <details className="mt-10 rounded-xl border border-dashed border-slate-600 p-4 text-xs text-slate-400"><summary>Prototype controls & current state</summary><div className="flex flex-wrap gap-2 my-4"><button className={control} onClick={()=>update({title:"movie:949",direct:"1"})}>Try a direct title visit</button><button className={control} onClick={()=>update({q:"The Quiet Signal",title:null,direct:null})}>Try a low-vote title lookup</button></div><pre className="whitespace-pre-wrap break-all">{JSON.stringify({variant,query:query,displayedQuery:batch.q,filters:Object.fromEntries(filterKeys.map(k=>[k,p(k)])),resultOrder:rows.map(x=>x.id),currentTitle:id||null,source:direct?"direct":"search",actions,interpretation:{editable:overrides,tone},scenario},null,2)}</pre><p className="mt-3">URL owns committed request, explicit filters, variant, and selected title. Memory owns displayed results, scroll positions and demo taste actions; reload resets those. Editing the query starts a new sequence. Filter edits keep the current title open. Interpretation editing is a UI comparison, not a proposed D4+ change.</p></details>
    {import.meta.env.DEV&&<nav aria-label="Prototype variants" className="fixed bottom-20 sm:bottom-6 left-1/2 -translate-x-1/2 z-[1050] flex items-center gap-3 rounded-full border border-amber-300 bg-slate-950 px-3 py-2 shadow-xl whitespace-nowrap text-sm"><button aria-label="Previous variant" onClick={()=>switchVariant(-1)} className="px-2 py-2">←</button><span>{variant} · {names[variant]}</span><button aria-label="Next variant" onClick={()=>switchVariant(1)} className="px-2 py-2">→</button></nav>}
  </div>
}
