# Curate the start lab's mood and prompt fixtures from captured Discover browse pages.
import json, glob, os, re
B = "/home/alp/.cache/start-lab/fixtures/browse"
G = "/home/alp/.cache/start-lab/fixtures/guest.json"
CONTENT = "/home/alp/dev/projects/goodwatch/start-lab-prototype/goodwatch-webapp/app/server/living-room/intro/content.json"
pages = {os.path.basename(f)[:-5]: json.load(open(f))["cards"] for f in glob.glob(B + "/*.json")}
by_title = {}
for cards in pages.values():
    for c in cards:
        by_title.setdefault(c["title"], c)
votes = lambda c: c.get("goodwatch_overall_score_voting_count") or 0
BLOCK = re.compile(r"Tonight Show|Late Show|Late Late|Good Mythical|Running Man|Wrestl|Top Gear|RuPaul|Match Game|NOVA|Frontline|American Experience|Ancient Aliens|PAW Patrol|My Little Pony|Ninjago|Miraculous|Doraemon|Pokémon|Beyblade|Teenage Mutant|Ace of the Diamond|Moesha|The Bill$|Perry Mason|Combat!|Andy Griffith|Little House|Chihayafuru|Love Between Lines|Chicago Typewriter|Wakfu|Mayday|Kuruluş")
DROP = {
  "crime": {"Project Hail Mary","Zootopia 2","Zootopia","Harry Potter and the Prisoner of Azkaban","The Matrix","Blade Runner 2049","Blade Runner","Backrooms","The End of Oak Street","The Imitation Game","Weapons","Supernatural","Desperate Housewives","House","FROM","Stranger Things","Shameless","The X-Files","The Apothecary Diaries"},
  "funny": {"Pulp Fiction","North by Northwest","Kill Bill: Vol. 2","Django Unchained","Good Will Hunting","Iron Man","Tulsa King","Lupin","The West Wing","The Blacklist","Doctor Who","Desperate Housewives","The Apothecary Diaries","Castle","JoJo's Bizarre Adventure"},
  "feelgood": {"Top Gun: Maverick","Doctor Who","Star Trek: The Next Generation","Star Trek: Voyager"},
  "heavy": {"Toy Story 5","Avengers: Endgame","Avengers: Infinity War","Spider-Man: No Way Home","Top Gun: Maverick","Harry Potter and the Deathly Hallows: Part 2","The Batman","Inside Out","Guardians of the Galaxy Vol. 3","The Lord of the Rings: The Fellowship of the Ring","The Lord of the Rings: The Return of the King","Doctor Who","Naruto","Naruto Shippūden","Scrubs","Doom Patrol","Mushoku Tensei: Jobless Reincarnation","Re:ZERO -Starting Life in Another World-","Cyberpunk: Edgerunners","Vikings"},
  "history": {"The Conjuring","The Prestige","Westworld","Game of Thrones","House of the Dragon","The Apothecary Diaries"},
  "mind": {"Coco","The Nightmare Before Christmas","Coyote vs. Acme","Corpse Bride","Howl's Moving Castle","Spider-Man: Across the Spider-Verse","Spider-Man: Into the Spider-Verse","Pulp Fiction","Oppenheimer","The West Wing","Phineas and Ferb","Regular Show","Scrubs","This Is Us","Mad Men","Vikings","Adventure Time","Doctor Who","Breaking Bad","The Sopranos","Better Call Saul"},
  "romance": {"The Nightmare Before Christmas","Spider-Man","Blade Runner","Harry Potter and the Half-Blood Prince","Pirates of the Caribbean: The Curse of the Black Pearl","Spider-Man: Far From Home","Corpse Bride","Avatar","Game of Thrones","Smallville","Detective Conan","Regular Show","Scrubs","Westworld","Mushoku Tensei: Jobless Reincarnation","Re:ZERO -Starting Life in Another World-","Bones","Monogatari"},
  "scary": {"The Lord of the Rings: The Return of the King","Harry Potter and the Deathly Hallows: Part 2","Harry Potter and the Deathly Hallows: Part 1","Terminator 2: Judgment Day","The Terminator","Fauda","Berserk"},
  "growing": {"Spider-Man: No Way Home","The Batman","Léon: The Professional","The Lord of the Rings: The Fellowship of the Ring","Harry Potter and the Deathly Hallows: Part 2","Cyberpunk: Edgerunners","FROM","Vikings","Bleach","Naruto","Detective Conan","Mushoku Tensei: Jobless Reincarnation","Dragon Ball Z","Shameless","Smallville"},
  "action": {"ER","Lost","Rick and Morty","Stranger Things"},
  "worlds": {"Obsession","Coco","Supernatural","Smallville","Grimm"},
}
def ok(c, mood):
    if BLOCK.search(c["title"]) or c["title"] in DROP.get(mood, set()): return False
    if not c.get("poster_path"): return False
    if c["media_type"] == "movie": return votes(c) >= 100_000
    return votes(c) >= 50_000 and (c.get("release_year") or 0) >= 1995
g = json.load(open(G))
for m in g["moods"]:
    k = m["key"]
    movies = [c for c in pages[f"mood-{k}-movie"] if ok(c, k)][:10]
    shows = [c for c in pages[f"mood-{k}-show"] if ok(c, k)][:8]
    mixed = []
    for i in range(max(len(movies), len(shows))):
        if i < len(movies): mixed.append(movies[i])
        if i < len(shows): mixed.append(shows[i])
    m["titles"] = mixed[:18]
    m["params"] = {"source": "POST /api/discover/results (guest, US)", "movie": f"moods={k}&type=movie&score=70&sort=popular", "show": f"moods={k}&type=show&score=75&sort=popular"}
    m["note"] = "curated 2026-10-27: movies >= 100k votes, shows >= 50k votes and 1995+, talk/kids/off-mood titles removed by hand"
    print(k, len(movies), len(shows), "|", ", ".join(c["title"] for c in m["titles"]))
PICK = {
  "a cozy mystery for a rainy Sunday": ["Wake Up Dead Man: A Knives Out Mystery","Monk","Psych","Murdoch Mysteries","Only Murders in the Building","Elementary","Murder, She Wrote","Father Brown","Gravity Falls","Castle","White Collar","High Potential","Lupin","Brooklyn Nine-Nine","Elsbeth","The Apothecary Diaries","Private Eyes"],
  "something like Severance but funnier": ["The Chair Company","Murderbot","The Residence","What We Do in the Shadows","Doom Patrol","Loki","The Truman Show","Mrs. Davis","The Office","Parks and Recreation","People of Earth","Mickey 17","Problemista","Incredible But True","The Phoenician Scheme","Wake Up Dead Man: A Knives Out Mystery"],
  "a mind-bending sci-fi movie under two hours": ["Arrival","Eternal Sunshine of the Spotless Mind","Predestination","Ghost in the Shell","The Truman Show","Annihilation","Dark City","Paprika","Timecrimes","Bugonia","Under the Skin","The Platform","Back to the Future","Blade Runner","eXistenZ","They Live"],
  "a feel-good show to binge with my partner": ["Ted Lasso","Modern Family","Parks and Recreation","The Office","Friends","Frasier","Gilmore Girls","How I Met Your Mother","Brooklyn Nine-Nine","Seinfeld","What We Do in the Shadows","Psych","Scrubs","Jane the Virgin","Strong Girl Bong-soon","The Middle","Suits"],
  "a dark thriller with a twist ending": ["Shutter Island","Prisoners","The Usual Suspects","Memento","The Prestige","Oldboy","Get Out","Mr. Robot","The Handmaiden","Donnie Darko","True Detective","Mulholland Drive","Death Note","Hereditary","Inside Man","Monster","Inception"],
  "an animated movie adults will love": ["Spirited Away","Your Name.","Spider-Man: Across the Spider-Verse","Inside Out","Ratatouille","Coco","The Wild Robot","Howl's Moving Castle","Coraline","Spider-Man: Into the Spider-Verse","Paprika","Toy Story","The Nightmare Before Christmas","Zootopia","Ghost in the Shell","Corpse Bride","Shrek"],
}
for p in g["prompts"]:
    names = PICK.get(p["q"])
    if not names: continue
    missing = [n for n in names if n not in by_title]
    p["titles"] = [by_title[n] for n in names if n in by_title]
    p["titles_source"] = "approximation"
    p["approximation"] = {"how": "hand-picked 2026-10-27 from Discover browse captures (themes/moods/styles/similar filters); the six ranked searches couldn't run (daily quota)", "missing": missing}
    print("PROMPT", p["q"], len(p["titles"]), "missing:", missing)
# The intro's one real search, with its real reading.
c = json.load(open(CONTENT))
space = c["feel"]["searches"]["space"]
def from_intro(t):
    k = int(t["key"]); show = k >= 2_000_000_000_000
    return {"key": k, "media_type": "show" if show else "movie", "tmdb_id": k - (2_000_000_000_000 if show else 1_000_000_000_000), "title": t["title"], "release_year": t.get("year"), "poster_path": t.get("poster"), "goodwatch_overall_score_normalized_percent": t.get("score"), "goodwatch_overall_score_voting_count": t.get("votes")}
if not any(p["q"] == space["q"] for p in g["prompts"]):
    g["prompts"].append({"q": space["q"], "reading": space["reading"], "titles": [from_intro(t) for t in space["titles"]], "titles_source": "real search, captured 2026-10-17 for the intro (content.json)"})
json.dump(g, open(G, "w"), indent=1, ensure_ascii=False)
print("prompts", len(g["prompts"]))
