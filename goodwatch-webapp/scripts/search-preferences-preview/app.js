const $ = selector => document.querySelector(selector)
const form = $("#search-form"), submit = $("#search"), status = $("#status")
const cards = new Map()
let answer, busy = false, renderVersion = 0
const displayed = { baseline: 20, v7: 20 }
const number = value => Number(value).toLocaleString()
function message(text, error = false) { status.textContent = text; status.classList.toggle("error", error) }
async function request(path, data) {
  const response = await fetch(path, data === undefined ? undefined : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) })
  const body = await response.json()
  if (!response.ok) throw Error(body.error || "Request failed.")
  return body
}
function manual() {
  const p = new URLSearchParams($("#other").value)
  for (const name of ["type", "minYear", "maxYear", "maxRuntime"]) if ($("#" + name).value) p.set(name, $("#" + name).value)
  if ($("#genre").value) p.set("genres", $("#genre").value)
  if ($("#theme").value) p.set("themes", $("#theme").value)
  return p.toString()
}
function chip(parent, text, preference = false) {
  const span = document.createElement("span")
  span.className = "chip" + (preference ? " preference" : "")
  span.textContent = text
  parent.append(span)
}
function describeParams(raw, node) {
  node.replaceChildren()
  const params = new URLSearchParams(raw)
  const names = { type: "Type", genres: "Genre", themes: "About", moods: "Mood", styles: "Style", minYear: "From", maxYear: "To", maxRuntime: "Max. minutes" }
  for (const [key, value] of params) if (value && !["services", "unseen", "page", "sort"].includes(key)) chip(node, (names[key] || key) + ": " + value)
}
function policy(key) { return answer[key] || answer.policies?.find(p => p.policy === key) }
function keys(key) { return policy(key)?.[$("#sort").value]?.keys || [] }
async function loadCards(selected) {
  const missing = [...new Set(selected)].filter(k => !cards.has(k))
  for (let i = 0; i < missing.length; i += 100) {
    const data = await request("/api/cards", { keys: missing.slice(i, i + 100) })
    for (const card of data.cards) cards.set(card.key, card)
  }
}
async function render() {
  const version = ++renderVersion
  const selected = ["baseline", "v7"].flatMap(key => keys(key).slice(0, displayed[key]))
  await loadCards(selected)
  if (version !== renderVersion) return
  for (const key of ["baseline", "v7"]) {
    const p = policy(key), column = $("#" + key), list = column.querySelector(".results")
    const ordered = keys(key), opposite = new Set(keys(key === "v7" ? "baseline" : "v7"))
    column.querySelector(".count").textContent = number(p?.total ?? p?.[$("#sort").value]?.total ?? 0)
    const error = column.querySelector(".policy-error")
    error.hidden = !p?.error
    error.textContent = p?.error ? "The existing search returned a retrieval error for this interpretation." : ""
    describeParams(p?.params || answer.params?.[key] || "", column.querySelector(".chips"))
    if (key === "v7") for (const preference of answer.prefs || []) chip(column.querySelector(".chips"), "Prefer " + (preference.label || preference.value), true)
    list.replaceChildren()
    if (!ordered.length) {
      const empty = document.createElement("p"); empty.className = "empty"; empty.textContent = "No results for this search."; list.append(empty)
    }
    ordered.slice(0, displayed[key]).forEach((titleKey, index) => {
      const c = cards.get(titleKey) || { title: "Title unavailable", key: titleKey }, item = $("#card-template").content.cloneNode(true)
      item.querySelector(".rank").textContent = index + 1
      item.querySelector(".card-title").textContent = c.title
      for (const a of item.querySelectorAll("a")) a.href = c.url || "https://goodwatch.app"
      if (c.poster) item.querySelector("img").src = c.poster
      item.querySelector("img").alt = c.title + " poster"
      item.querySelector("img").addEventListener("error", event => event.target.removeAttribute("src"))
      item.querySelector(".score").textContent = c.score == null ? "" : Math.round(c.score) + "/100"
      item.querySelector(".meta").textContent = [c.year, c.type === "show" ? "TV show" : "Movie"].filter(Boolean).join(" · ")
      item.querySelector(".genres").textContent = (c.genres || []).join(" · ")
      item.querySelector(".synopsis").textContent = c.synopsis || ""
      item.querySelector(".overlap").textContent = !opposite.has(titleKey) && key === "v7" ? "Broader match" : ""
      list.append(item)
    })
    column.querySelector(".more").hidden = ordered.length <= displayed[key]
  }
}
async function search() {
  if (busy) return
  busy = true; submit.disabled = true; submit.textContent = "Searching…"
  message("Interpreting your search and comparing results…")
  try {
    const query = $("#query").value.trim()
    answer = await request("/api/search", { query, existing: manual() })
    displayed.baseline = displayed.v7 = 20
    $("#result-controls").hidden = $("#comparison").hidden = false
    $("#result-query").textContent = query
    const labels = (answer.prefs || []).map(p => p.label || p.value)
    const branch = answer.branch
    $("#interpretation").textContent = branch === "negative-baseline" ? "Explicit exclusions retain the current search behavior." : branch === "title-guard" ? "Exact title recognized. Manual filters still apply." : labels.length ? "Preferred automatically: " + labels.join(", ") + ". Manual filters remain required." : "Manual filters remain required."
    const pinned = manual()
    $("#filter-summary").textContent = pinned ? new URLSearchParams(pinned).toString().replaceAll("&", " · ") : "Any type · Any year · Any length"
    await render()
    const count = policy("v7")?.total ?? 0, current = policy("baseline")?.total ?? 0
    message(number(count) + " updated results · " + number(current) + " current results")
    const url = new URL(location.href); url.searchParams.set("q", query)
    if (pinned) url.searchParams.set("filters", pinned); else url.searchParams.delete("filters")
    history.replaceState(null, "", url)
  } catch (error) {
    message(error.message, true)
  } finally {
    busy = false; submit.disabled = false; submit.textContent = "Search"
  }
}
form.addEventListener("submit", event => { event.preventDefault(); search() })
$("#sort").addEventListener("change", () => { if (answer) { displayed.baseline = displayed.v7 = 20; render().catch(error => message(error.message, true)) } })
for (const key of ["baseline", "v7"]) $("#" + key + " .more").addEventListener("click", async () => {
  const button = $("#" + key + " .more"); button.disabled = true
  displayed[key] += 20
  try { await render() } catch (error) { message(error.message, true) } finally { button.disabled = false }
})
async function initialize() {
  try {
    const config = await request("/api/config")
    if (config.error) throw Error(config.error)
    if (!config.ready) { setTimeout(initialize, 1500); return }
    for (const example of config.examples || []) {
      const button = document.createElement("button"); button.type = "button"; button.textContent = example.label
      button.addEventListener("click", () => { if (!busy) { $("#query").value = example.query; search() } })
      $("#examples").append(button)
    }
    const url = new URL(location.href)
    if (url.searchParams.has("q")) $("#query").value = url.searchParams.get("q")
    if (url.searchParams.has("filters")) {
      const params = new URLSearchParams(url.searchParams.get("filters"))
      for (const name of ["type", "minYear", "maxYear", "maxRuntime"]) if (params.has(name)) { $("#" + name).value = params.get(name); params.delete(name) }
      if (params.has("genres")) { $("#genre").value = params.get("genres"); if ($("#genre").value) params.delete("genres") }
      if (params.has("themes")) { $("#theme").value = params.get("themes"); if ($("#theme").value) params.delete("themes") }
      $("#other").value = params.toString()
    }
    submit.disabled = false; submit.textContent = "Search"
    await search()
  } catch (error) { message(error.message, true); submit.textContent = "Unavailable" }
}
initialize()
