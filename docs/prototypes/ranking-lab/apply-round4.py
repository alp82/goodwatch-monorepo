"""PROTOTYPE - one-off: re-apply the round-4 and judge edits on top of the round-3 template, and the scifi alias."""
import pathlib
ROOT = pathlib.Path(__file__).resolve().parents[3]

# 1. scifi alias on the branch
p = ROOT / 'goodwatch-webapp/app/server/combined-search/d4.server.ts'; s = p.read_text()
old = """// No stemming in the index: search the word with and without a plural ending
const wordForms = (word: string) =>
	[
		...new Set([
			word,"""
new = """// PROTOTYPE (branch only): spellings the texts use for a request word
const WORD_ALIASES: Record<string, string[]> = {
	scifi: ["sci-fi", "science fiction"],
	"sci-fi": ["scifi", "science fiction"],
};
// No stemming in the index: search the word with and without a plural ending
const wordForms = (word: string) =>
	[
		...new Set([
			word,
			...(WORD_ALIASES[word] ?? []),"""
if 'WORD_ALIASES' not in s:
    assert old in s; p.write_text(s.replace(old, new))

# 2. template: round-3 base -> round-4 edits -> judge edits
p = pathlib.Path(__file__).parent / 'template.html'; s = p.read_text()
def rep(a, b):
    global s
    assert a in s, a[:80]; s = s.replace(a, b)
rep('''    <label>Keyword + trope evidence weight <input type="range" id="wider" min="0" max="1" step="0.1"><b id="widerV"></b></label>
    <label>Popularity tiebreak (units) <input type="range" id="pop" min="0" max="1" step="0.05"><b id="popV"></b></label>''',
'''    <label>Exact keyword (units) <input type="range" id="kwx" min="0" max="2" step="0.1"><b id="kwxV"></b></label>
    <label>Keyword containing the word (units) <input type="range" id="kws" min="0" max="2" step="0.1"><b id="kwsV"></b></label>
    <label>Trope names, rarity-weighted (units) <input type="range" id="trp" min="0" max="2" step="0.1"><b id="trpV"></b></label>
    <label>Genre hint from request words (units) <input type="range" id="gen" min="0" max="2" step="0.1"><b id="genV"></b></label>
    <label>Popularity tiebreak (units) <input type="range" id="pop" min="0" max="1" step="0.05"><b id="popV"></b></label>
    <label>Jev fit judgment (units per fit level 0..4) <input type="range" id="jdg" min="0" max="3" step="0.25"><b id="jdgV"></b></label>''')
rep('"evw","evwc","textcap","evcap","evcapc","cands","wider","pop","rows"];',
    '"evw","evwc","textcap","evcap","evcapc","cands","kwx","kws","trp","gen","pop","jdg","rows"];')
rep('const DATA = /*DATA*/;', 'const DATA = /*DATA*/;\nconst JUDGE = /*JUDGE*/;')
rep('const PRESETS = [', '''const GENRE_WORDS = { fantasy: "Fantasy", scifi: "Science Fiction", "sci-fi": "Science Fiction", horror: "Horror", comedy: "Comedy", funny: "Comedy", thriller: "Thriller", crime: "Crime", heist: "Crime", romance: "Romance", romantic: "Romance", mystery: "Mystery", animated: "Animation", animation: "Animation", anime: "Animation", documentary: "Documentary", western: "Western", war: "War", family: "Family", drama: "Drama", action: "Action", adventure: "Adventure", history: "History", historical: "History", musical: "Music", music: "Music" };
const GENRE_MATCH = { "Science Fiction": ["Science Fiction", "Sci-Fi & Fantasy"], Fantasy: ["Fantasy", "Sci-Fi & Fantasy"], Action: ["Action", "Action & Adventure"], Adventure: ["Adventure", "Action & Adventure"], War: ["War", "War & Politics"] };
const genreHints = (cap) => [...new Set(cap.query.toLowerCase().split(/[^a-z-]+/).map((w) => GENRE_WORDS[w]).filter(Boolean))];
const PRESETS = [''')
rep('''  const txt = new Map(cap.textPool.filter((r) => cfg.wider > 0 || !r.wider).map((r) => [r.key, { ...r, text: r.text + cfg.wider * (r.textWide - r.text), cosine: null, inV: false, inT: true }]));''',
'''  // Evidence beyond the essence text: exact keyword, keyword containing the word, trope names weighted by rarity (300 / titles carrying the trope, at most 1 each, sum at most 1)
  const extra = (r) => (r.kwExact.length ? cfg.kwx : 0) + (r.kwSub.length ? cfg.kws : 0) + cfg.trp * Math.min(1, r.tropes.reduce((s, t) => s + Math.min(1, 300 / Math.max(t.df, 1)), 0));
  const txt = new Map(cap.textPool.map((r) => ({ ...r, extra: extra(r) })).filter((r) => r.text > 0 || r.extra > 0).map((r) => [r.key, { ...r, cosine: null, inV: false, inT: true, wider: r.text === 0 }]));''')
rep('''    r.ev = Math.min((ctx.concrete ? cfg.evwc : cfg.evw) * Math.min(r.text ?? 0, cfg.textcap), ctx.concrete ? cfg.evcapc : cfg.evcap);''',
'''    r.ev = Math.min((ctx.concrete ? cfg.evwc : cfg.evw) * Math.min(r.text ?? 0, cfg.textcap) + (r.extra ?? 0), ctx.concrete ? cfg.evcapc : cfg.evcap);
    const hints = genreHints(currentCap); const g = currentCap.titles[r.key]?.genres ?? [];
    r.genre = cfg.gen * hints.filter((h) => (GENRE_MATCH[h] ?? [h]).some((name) => g.includes(name))).length;
    const fit = JUDGE[currentCap.query]?.[r.key];
    r.fit = fit == null ? null : fit;''')
rep('''    r.base = primary + tie + r.pop;''',
    '''    r.base = primary + tie + r.pop + r.genre + (r.fit == null ? 0 : cfg.jdg * r.fit);''')
rep('''  for (const [k, r] of txt) { const e = all.get(k); if (e) { e.text = r.text; e.inT = true; e.evidence = r.evidence; } else all.set(k, { ...r }); }''',
    '''  for (const [k, r] of txt) { const e = all.get(k); if (e) { e.text = r.text; e.extra = r.extra; e.inT = true; e.wider = r.wider; } else all.set(k, { ...r }); }''')
rep('''  else if (cfg.combine === "intersect") { const rows = [...vec.values()].map((r) => ({ ...r, text: txt.get(r.key)?.text ?? 0, inT: txt.has(r.key) }));''',
    '''  else if (cfg.combine === "intersect") { const rows = [...vec.values()].map((r) => ({ ...r, text: txt.get(r.key)?.text ?? 0, extra: txt.get(r.key)?.extra ?? 0, inT: txt.has(r.key) }));''')
rep('''· cosine pool 2000 (${cap.vectorMs} ms), tiers ${cap.tiers} (${cap.tierMs} ms) · text pool ${cap.textPool.filter((r) => !r.wider).length} (${cap.textMs} ms), with keywords and tropes ${cap.textPool.length} (${cap.widerMs} ms) ·''',
    '''· genre hints: ${genreHints(cap).join(", ") || "none"} · cosine pool 2000 (${cap.vectorMs} ms), tiers ${cap.tiers} (${cap.tierMs} ms) · text pool ${cap.textPool.filter((r) => r.text > 0).length} (${cap.textMs} ms), keyword and trope rows ${cap.textPool.filter((r) => !r.text).length} (${cap.widerMs} ms) ·''')
rep('''<td class="num">${(r.text ?? 0).toFixed(2)}</td>''',
    '''<td class="num" title="${(r.kwExact ?? []).concat(r.kwSub ?? []).join(", ")} ${(r.tropes ?? []).map((t) => `${t.n} (${t.df})`).join(", ")}">${(r.text ?? 0).toFixed(1)}${r.extra ? "+" + r.extra.toFixed(1) : ""}${r.genre ? " g" : ""}${r.fit != null ? ` <b title="Jev fit 0..4">J${r.fit.toFixed(1)}</b>` : ""}</td>''')
rep('''  <table><thead><tr>''', '''  <pre id="dump" hidden></pre>
  <table><thead><tr>''')
rep('''  $("body").innerHTML = rows.slice(0, cfg.rows).map((r, i) => {''',
    '''  $("dump").textContent = JSON.stringify(rows.slice(0, 60).map((r) => r.key));
  $("body").innerHTML = rows.slice(0, cfg.rows).map((r, i) => {''')
start = s.index('const PRESETS = ['); end = s.index('\n];', start) + 3
base = 'strong: 6, weak: 4, near: 0, primary: "count", tie: "sum", span: 0.25, scale: "possible", combine: "textfirst", evw: 0.5, evwc: 1, textcap: 4, evcap: 1, evcapc: 3'
presets = '''const PRESETS = [
  { id: "prod", name: "Production (main)", cfg: { strong: 6, weak: 4, near: 0, primary: "sum", tie: "cosine", span: 0.01, scale: "possible", combine: "textfirst", evw: 0.5, evwc: 0.5, textcap: 4, evcap: 3, evcapc: 3, cands: "cosine", kwx: 0, kws: 0, trp: 0, gen: 0, pop: 0, jdg: 0 },
    note: "<b>What main does today.</b> Cosine prefetch of 2000, text pool first, normalized weighted sum plus uncapped essence-text evidence. Keyword and trope evidence only when the text pool is thin (not modelled: those rows appear with zero weight)." },
  { id: "count", name: "Range count 6/4 (branch)", cfg: { strong: 6, weak: 4, near: 0, primary: "count", tie: "sum", span: 0.25, scale: "possible", combine: "textfirst", evw: 0.5, evwc: 0.5, textcap: 4, evcap: 1, evcapc: 1, cands: "cosine", kwx: 0, kws: 0, trp: 0, gen: 0, pop: 0, jdg: 0 },
    note: "<b>The prototype branch.</b> Same pools as production, range count first, flat one-unit evidence cap." },
  { id: "leads", name: "Concrete phrase leads", cfg: { BASE, cands: "cosine", kwx: 0, kws: 0, trp: 0, gen: 0, pop: 0, jdg: 0 },
    note: "<b>Round 2 winner on today's pools.</b> Mood evidence capped at one unit, concrete evidence one unit per text hit up to three." },
  { id: "recall", name: "Leads + tiers + keywords + tropes", cfg: { BASE, cands: "both", kwx: 1, kws: 0.5, trp: 0.5, gen: 0, pop: 0, jdg: 0 },
    note: "<b>Round 3 direction with structured evidence.</b> Tiers of 2000. An exact keyword is worth one unit, a keyword containing the word half, trope names half a unit weighted by rarity (a trope on 2500 titles counts a tenth of one on 300)." },
  { id: "recallgenre", name: "Recall + genre hint", cfg: { BASE, cands: "both", kwx: 1, kws: 0.5, trp: 0.5, gen: 0.5, pop: 0, jdg: 0 },
    note: "<b>Same, plus half a unit when a request word names a TMDB genre the title carries.</b> fantasy → Fantasy, scifi → Science Fiction, heist → Crime. Zero cost." },
  { id: "judge", name: "Recall + genre + Jev judge", cfg: { BASE, cands: "both", kwx: 1, kws: 0.5, trp: 0.5, gen: 0.5, pop: 0, jdg: 1 },
    note: "<b>Jev reads the essence text of the top 40 of production and of recall + genre and scores fit 0..4; one unit per fit level.</b> Titles outside those lists are unjudged and keep their score, which mirrors a production step that judges only the head. About 10 requests per query, in parallel." },
  { id: "judgeonly", name: "Jev judge decides (fit first)", cfg: { BASE, cands: "both", kwx: 1, kws: 0.5, trp: 0.5, gen: 0.5, pop: 0, jdg: 3 },
    note: "<b>Three units per fit level: the judgment dominates and the retrieval score breaks ties.</b> The old prototype's rule." },
];'''.replace('BASE', base)
s = s[:start] + presets + s[end:]
p.write_text(s)

b = pathlib.Path(__file__).parent / 'build.py'; t = b.read_text()
if '/*JUDGE*/' not in t:
    t = t.replace('''(here / "index.html").write_text((here / "template.html").read_text().replace("/*DATA*/", compact))''',
'''judge = json.dumps(json.load(open(here / "judge.json")) if (here / "judge.json").exists() else {}, separators=(",", ":"))
(here / "index.html").write_text((here / "template.html").read_text().replace("/*DATA*/", compact).replace("/*JUDGE*/", judge))''')
    b.write_text(t)
print("applied")
