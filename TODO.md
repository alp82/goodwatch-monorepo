# TODO's

```

---

mobile rating easier
    use swipescorer for details as well
    easier to find rating button
    modal needs to close automatically after saving

---

For You
    Landing page with examples
    Personal Recommendations by main Fingerprint categories
    bg color changes with scroll: https://fable.co/

---

user profile
    show all scores
    grouped by tier
    shareable link
        https://discord.com/channels/1183008154573881384/1183008156696182847/1326508243056590848
    links to other profiles: MAL, ...
    
watched/ratings page:
    rating stats (1-10 distribution)
    search & filter
    easy rating more
        personalized?

favorites page
    search & filter
    easy adding more

want to watch
    not logged in handling
    split into two sections:
        watch now
        rest
    search & filter
    easy adding more
    
    remove separate wishlist page?

---

better og images
    dynamic with text?
    https://gemini.google.com/app/8f9832dc2c62d13a
    https://tailwind-generator.com/og-image-generator/generator

---

priority queue
    priority.ts
    postgres -> crate
    windmill script updates

---

tv seasons:
    name, overview, air date, poster path
    get episodes: overview, images, videos, translations, air date, crew, guest stars
    get ratings for seasons and episodes: tmdb, imdb, metacritic, rt
    show in details
    when last season/episode was released
    score matrix
        https://tvcharts.co/show/arcane-tt11126994
    recaps
    
---

details more data:
    show tropes
    show images
    box office (e.g. Google)
    awards (grab from API)

movie details
    * show number of votes
    * check if too much data (cast, crew)

movies that aren't movies
    https://goodwatch.app/movie/1412450-stranger-things
    https://goodwatch.app/movie/1412549-wednesday

---

scraper solutions
    https://scrapoxy.io/
    https://evomi.com/pricing
    https://dataimpulse.com/
    https://www.firecrawl.dev/
    https://docs.firecrawl.dev/features/agent
    https://github.com/autoscrape-labs/pydoll

---

discover
    sort by similarity
    sort by own score
    sort by last watched
    sort by last wishlisted

discover order
    highest score
    most controversial (critics vs. audience)
    trending

---   

where to watch VPN
    show available in other countries
    
---

explore: internal links
    action -> superhero
    if you like X, check out these Y

---

feedback form on website
    discord link

---

wrong rating links:
    crawler reads release year and checks if it is correct
    https://goodwatch.app/movie/1151272-sirt?country=DE
    https://goodwatch.app/movie/616027-the-circus
    how to identify all wrong rating links?

score inconsistencies:
    lists show different goodwatch score than details

---

start page
    what's the vibe needs to exclude user titles
    make movietvlist compatible with swiper
    pick best 10 page data categories to display
    stats: number of movies and shows
    https://moviewiser.com/
    https://www.reactbits.dev/components/card-swap
    https://www.reactbits.dev/backgrounds/light-rays
    
---

seo:
    better buildMeta and JsonLD
    fingerprint pages
    popular keyword pages

seo tester
    https://website.grader.com/tests/goodwatch.app
    https://seositecheckup.com/

seo checklist:
    Is the content actually unique, or does it overlap with other page?
    Would you bookmark it if you found it via search?
    Any thin, empty, or templated pages that should just be merged or noindexed?
    Does it answer a real search intent, or is just there because it could be?
    No rogue noindex or canonical tags pointing somewhere weird?
    Rendering fine when you test it live in GSC (no JS hiccups hiding content)?
    Any 4xx/5xx errors?
    Canonicals all pointing where they should?
    Are these pages linked from other meaningful pages - or are they buried 5 clicks deep?
    Is your sitemap fresh and submitted?
    Are the most valuable pages getting enough internal “votes”?
    Any backlinks at all to these pages (internal or external)?
    Are they getting actual clicks or impressions?
    Titles, meta, and headings - do they clearly tell Google what this page is for?
    Any structured data helping Google understand the content type?

SEO analysis
    http://guidetodatamining.com/ngramAnalyzer/index.php
    
SEO optimization + marketing
    https://www.jacobparis.com/content/remix-og
    https://www.reddit.com/r/SaaS/comments/1ho4hbu/best_free_seo_tools/
    https://app.ahrefs.com/site-audit/7410991/overview?current=19-12-2024T034232
    https://trends.google.com/trends/explore?date=today%201-m&q=movies&hl=en-GB
    https://answerthepublic.com/de/apasuq/reports/544e887a-c441-40ab-91b6-1e06c8fc68b9/edit?recently_searched=true
    https://sparktoro.com/blog/new-research-we-analyzed-332-million-queries-over-21-months-to-uncover-never-before-published-data-on-how-people-use-google/

---    

onboarding
    https://kinu-app.com/
    https://veboli.com/
    
onboarding
    better instructions for step 2
    card titles above poster (better for long titles)
    Search slow and bad at long ones like "orange is the new black"
    
    remove gladiator 1992 as first movie
    switch order based on last rating
    user settings cache + invalidation
    
    better mobile support
        Drag rating not working
        Smaller text above
        Button sticky
        search not focused (only on mobile?) 
        Double skip button at the bottom
    
    Success notification for milestones


---

button design
    https://x.com/jh3yy/status/2000730558674903415
    https://x.com/jh3yy/status/1992003440579662211

---

Fingerprint improvements
    https://chatgpt.com/g/g-p-675ffbf7167881919f049695a263ca6c-goodwatch/c/68717e7e-d1bc-8001-87d9-c55fdc42078d
    fingerprint by genre
    Genre boxes with 4 most suitable scores
    https://codepen.io/Ideepak_29aug/pen/OJdWWaW

fingerprint v2
    https://chatgpt.com/g/g-p-675ffbf7167881919f049695a263ca6c-goodwatch/c/6915e2c6-ec54-8325-aa6d-047ba31f9431
    mainstream vs niche
        arthouse
        hollywood
        blockbuster
        dull / predictable experience
        franchise fatigue
        ...
    seasons
        decline over time
        repetitive
        lost interest
        always something new
    pirates
    time travel
        distant future
        distant past
        looping
    more subgenres
        musical
        multiverse
    more music genres
        metal
    ambigious ending + clear resolution ending
        ending_closure: number;   // 0 = very open, 1 = very closed
        ending_twistiness: number; // 0 = straightforward, 1 = multiple twists/reframes
        export type EndingType =
            | 'closed_happy'
            | 'closed_tragic'
            | 'bittersweet'
            | 'open_to_interpretation'
            | 'cliffhanger'
            | 'cyclical';
    https://claude.ai/chat/0fc0178c-3693-4853-91a8-b2922afc7fc3
    https://chatgpt.com/g/g-p-675ffbf7167881919f049695a263ca6c-goodwatch/c/691ad2b7-b6f0-8331-92d1-bf5a57ad040d

---

subgenre descriptions
    https://www.studiobinder.com/blog/movie-genres-list/

new themes:
    magic?
    fantastic
    survival adventure (hunger games)
    hacker
    robot / ai
    ancient rome
    viking
    desert
    ocean
    cult classics
    dance
    ice hockey
    tennis
    golf

franchise:
    best disney [type]
    best star wars [type]
    best studio ghibli [type]
    best marvel [type]
    best james bond [type]
    best pixar [type]
    best godzilla [type]
    best stephen king [type]

streaming:
    [type] to stream (right now)
    new [type] to stream
    best [type] to stream
    best streaming [type] (right now)
    best [type] on netflix
    best [type] on amazon prime
    best [type] on hulu
    best [type] on disney plus
    best [type] on hbo
    best [type] on [streamer] free
    best new [type] on [streamer]
    best free [type] on [streamer]
    ...

release:
    best [type] of all time
    best [type] (of) [year]
    best 80s [type]
    best 90s [type]
    best [type] of the 2000s
    best [type] since [year]
    best classic [type]
    best old [type]

season/holiday:
    best halloween [type]
    best christmas [type]
    best thanksgiving [type]
    best fall [type]
    best eve [type]

audience:
    best family [type]
    best kids [type]
    best teen [type]
    best [audience] [type]
    best [type] to watch with [audience]

language:
    best korean [type]
    best malayalam [type]
    best english [type]
    best hindi [type]
    best telugu [type]
    best tamil [type]
    best japanese [type]
    best french [type]
    best chinese [type]
    best [lang] [type]

actor:
    best adam sandler [type]
    best ma dong-seok [type]
    best jackie chan [type]
    best jason statham [type]
    best jake gyllenhaal [type]
    best leonardo dicaprio [type]
    best denzel washington [type]

director:
    best quentin tarantino [type]
    best steven spielberg [type]

quality
    best 4k [type]
    best hd [type]

genre + streaming:
    best [genre] [type] on [streamer]

genre + release:
    best [genre] [type] of all time
    best [genre] [type] [year]

streaming + release:
    best [type] of [streamer] [year]

holiday + audience:
    best christmas [type] for [audience]

---

taste engine settings
    simple scale vs 1-10
    genre preselection?

---

The Wolf of Wall Street
    * description does not make any sense

---

your match
    score prediction
    or 3-color coded badge

---

windmill
    mongo connect retry strategy
    https://windmill.goodwatch.app/run/019a5379-1ec2-eb48-b49c-9bd345438183?workspace=goodwatch
    
---

number effects
    https://animate-ui.com/docs/primitives/texts/counting-number
    https://www.reactbits.dev/text-animations/count-up
    https://www.reactbits.dev/components/counter

text effects
    https://ui.paceui.com/docs/components/reveal-text
    https://magicui.design/docs/components/morphing-text

highlight effets
    https://www.reactbits.dev/animations/electric-border
    https://www.reactbits.dev/animations/target-cursor
    https://magicui.design/docs/components/border-beam
    https://magicui.design/docs/components/shine-border
    https://magicui.design/docs/components/flickering-grid
    https://magicui.design/docs/components/light-rays
    https://www.reactbits.dev/animations/glare-hover
    https://www.reactbits.dev/backgrounds/orb

reveal effects
    https://ui.aceternity.com/components/link-preview
    https://ui.aceternity.com/components/animated-tooltip
    https://ui.aceternity.com/components/text-reveal-card
    https://ui.aceternity.com/components/compare
    https://www.reactbits.dev/animations/gradual-blur

loading effects
    https://kokonutui.com/docs/components/loader

grid effects
    https://skiper-ui.com/v1/skiper73
    https://ui.aceternity.com/components/3d-marquee
    https://www.reactbits.dev/components/card-swap

connect effects
    https://magicui.design/docs/components/animated-beam

genre effects
    sci-fi: https://magicui.design/docs/components/particles
    sci-fi: https://www.reactbits.dev/backgrounds/particles
    sci-fi: https://www.reactbits.dev/backgrounds/galaxy
    magic: https://ui.aceternity.com/components/vortex
    hacker: https://www.reactbits.dev/text-animations/glitch-text
    hacker: https://www.reactbits.dev/backgrounds/letter-glitch
    simulation: https://www.reactbits.dev/backgrounds/ripple-grid
    nostalgic: https://www.reactbits.dev/animations/noise
    mystery: https://www.reactbits.dev/backgrounds/light-pillar
    scary: https://www.reactbits.dev/backgrounds/beams
    violence: https://www.reactbits.dev/backgrounds/dither
    colorful: https://www.reactbits.dev/backgrounds/prismatic-burst
    colorful: https://www.reactbits.dev/backgrounds/iridescence

---

category pages v2
    with slider that changes background poster
    very light-hearted ------> extremely dark

---

mobile design
    blank border on right side (Salavis feedback)

---

details
    https://gemini.google.com/app/56774c86a7137a25
    if useQuery calls are cached, include them in server response
    eliminate async loading and layout shift if related titles can be fetched quickly

---

batch recommendations
    https://qdrant.tech/documentation/concepts/explore/#batch-recommendation-api

---

https://discord.com/channels/1183008154573881384/1321048456608878593/1428810901720662037
    fingerprint/discover/onboarding with crew

---   

remove milvus

---   

long actor names overlap on mobile

---   https://cal.com/will-ness/30min

update windmill scripts in git

---   

strategy + lead generation
    https://chatgpt.com/g/g-p-675ffbf7167881919f049695a263ca6c-goodwatch/c/68f93e39-5e48-832f-9273-38f38514426a

---

remove postgres db

---

discord bot
    title details (personalized)
    my taste profile
    search
    recommend

---

robots with sitemap link
    https://www.instagram.com/robots.txt
    
gsc not indexed
    https://x.com/junqueror/status/1910287123183251758?t=h4qDtOoliAFYi2xypdaU5Q&s=03
    https://www.indexnow.org/

---

streaming backend
    https://v2.remix.run/docs/guides/streaming

---

landing page inspiration
    https://www.greptile.com
    https://oxide.computer
    https://waku.gg/
    https://www.firewatchgame.com/
    https://www.screenspace.io/

landing page redesign
    https://x.com/boringmarketer/status/1994415536088723471?t=o25e4HC9faZml8jZyKaKfA&s=03
    hibba: https://www.figma.com/design/Kv0ESmxOOFYuW8OVq6od9i/Goodwatch?node-id=0-1&p=f&t=z7iZzVGPfgqjznOf-0
    https://replit.com/@alp82/StreamSense
    https://www.landingly.co/
    https://onepagelove.com/ 
    https://handyarrows.com/
    scroll words
        https://x.com/jh3yy/status/1863858454751789400
        https://codepen.io/pxel/pen/EaYVZBO
        https://codepen.io/jh3y/pen/MYgaaem

tagline
    https://www.reddit.com/r/SaaS/comments/1hoth2s/i_analyzed_100_saas_headlines_and_realized_were/?share_id=ql5uTUQ151unOg4PvX-N8&utm_medium=android_app&utm_name=androidcss&utm_source=share&utm_term=10

ai
    https://www.freepik.com/pikaso/ai-video-generator
    
---   

elasticsearch for full text search

---   

subtiles
    capcut
    davinci resolve
    descript
    riverside

---   

ARR suite
    https://github.com/Ravencentric/awesome-arr
    https://wiki.servarr.com/

---   

handling of outdated streaming availability

---   

upcoming titles
    future release_date
    https://developer.themoviedb.org/reference/tv-series-latest-id
 
---    

discover:
    show only active filters
    add filter button
    clear all filters
    sort by
    https://replit.com/@alp82/MediaMatchr

---    

details
    Sparkle for hover state
        Trailer button

    better SEO
        https://gemini.google.com/app/14b23291fcb31f3a

    DNA redesign
        https://replit.com/@alp82/EntertainmentDNA
        https://replit.com/@alp82/MediaMosaic

    swiper optimizations
        for image/video gallery?
        https://www.reactbits.dev/components/card-swap
    
    header with icons: [calendar] year [clock] duration [globe] countries
    
    content advisory: alert style box in red
        https://bolt.new/~/sb1-pgwb5iqc

    streaming section
        mark/reorder available countries
        
    guess country
    show title in current language
    
    about section
        infobox: https://www.joshwcomeau.com/blog/how-i-built-my-blog-v2/#the-details-9

    age restriction by country
    streaming section favors user selected providers
    web links section
    sequels section
    
    images section
    images and videos as gallery
    https://www.figma.com/design/1sIRD12ImqTbC6lI396gWA/IMDb-Redesign-(Community)?node-id=0-1&t=DM0lDYiEkBYUsMZY-0

    empty sections:
        http://localhost:3003/movie/46388-a-ghost-of-a-chantz
        http://localhost:3003/movie/1261489-betrayal
        http://localhost:3003/movie/974995-identity 
    mobile: user action buttons below poster directly
    https://imdb.shyakadavis.me/title#overview

    fragment for scroll position (auto update)
    
    json-ld movie/tv
        image preview generated with background + ratings + streaming
    
    score prediction
        92% Match

movie card
    popout design
    overlay: show movie or tv icon 

remove obsolete code
    updateUrlParams.tsx

---    

search
    search results page
    LLM search
    https://typesense.org/

resources
    https://github.com/quickwit-oss/tantivy
    https://openpipe.ai/blog/pii-redact

---

additional datasets
    https://www.kaggle.com/datasets?search=movie

---

browser extension to embed DNA into netflix, etc.
    tags link to goodwatch for exploration

---

security audit
    https://auditvps.com/
    https://chatgpt.com/c/6771847c-c2fc-8001-83f1-8ea8cc5161b9
    
penetration test
    evan | scraping & automations
    jared | infracharm

---

details streaming
    action button in header row to select streaming services (mobile: drawer)

---

taste matching (logged in users only - or a teaser)
    you both like ABC

recommendation engine
    https://gemini.google.com/app/1729ce5f88ada2ef
    https://keras.io/
    tiktok: https://github.com/bytedance/monolith

---

email marketing
    inspiration: Josh Comeau
    https://x.com/StewartSwayze/status/1876116900364861613
        kit: https://kit.com/pricing
        ghost
        substack
    https://react.email/
    nodemailer (vs https://resend.com/)
    
---

donations / pay what you want
    https://polar.sh
    TrustMRR listing

---

similar filter
    multiple similar titles
    fix similarity order

---

YT Channel
    https://gemini.google.com/app/a89965a683889ed8

   
---

tropes
    add to details
    add discover filter

---    

RAG refinement
    https://www.reddit.com/r/SaaS/comments/1oc01qb/everyones_trying_to_get_rich_with_tiny_saas/

---    

redis stability
    https://chatgpt.com/g/g-p-675ffbf7167881919f049695a263ca6c-goodwatch/c/67ea276c-4af8-8001-b6d0-fa89c4fb4058

---    

mongo stability
    https://gemini.google.com/app/257a0ae729c06ae1

---    

postgres stability
    WAL max size
    disk space monitoring
    new setup? https://autobase.tech/docs/overview/requirements

---

DNA + Similar subpage
    similar movies
        https://letterboxd.com/film/dune-part-two/themes/
 
---

Sequels wrong
    http://localhost:3003/movie/550-fight-club

---

Cast / Crew pages
    DNA overview (e.g. most common DNA tags for "Henry Cavill")

---

page speed insights
    https://pagespeed.web.dev/analysis/https-goodwatch-app/ltmtcc644r?hl=en_GB&form_factor=mobile

---

documentation
    explain folders
    explain webapp
    https://github.com/daccotta-org/daccotta

---

caching improvements
    https://x.com/harshsinghsv/status/1981692830545236078

---

dna cleanup:
    "Fantastical world with diverse environments (e.g."

---

dna time categories:
    https://chatgpt.com/g/g-p-675ffbf7167881919f049695a263ca6c-goodwatch/c/676920c6-3828-8001-8b03-966adf5d0d80

---

additional filters (pick 1 or 2)

release:
    of all time
    2024
    2023
    2000s
    90s
    80s
    classic

order by
    popularity
    score
    most recent

---

animated icons
    https://www.itshover.com/icons

---

https://www.tvmaze.com/api

---

cards with user actions
    user score
    want to watch
    favorite

---

mobile navigation
    search icon
    https://x.com/GavelCoding/status/1873665453907947904?t=AxOFmmxNmydAgK1m6t50_Q&s=03
    https://codesandbox.io/p/sandbox/immutable-waterfall-jkn774?file=%2Fsrc%2FNavBar.tsx%3A13%2C1&workspaceId=ws_EQdCWeEK7JFjpJCiMqbbSK

---

goodwatch tiktok channel
    https://anotepad.com/notes/8phwbhcq
    https://clideo.com/de/account/projects

---

discover
    save discover filters in db
    filter suggestions at the bottom?
    preview count for selections in edited sections (100+)
    bottom note after results
        streaming: Some of the content is hidden based on your location and streaming preferences
        for want to watch: show note that some are hidden due to filters


---    

tv: watched vs currently watching (finished show)

---    

combined collection score
    franchise and collection pages

---    

streaming: show flatrate countries in rating block and streaming tab

---    

text effects
     https://motion-primitives.com/docs

---

analytics
    https://plausible.io/
    https://umami.is/
    https://clarity.microsoft.com/

---    

DNA addition
    sentence for each category -> vectorize
    Franchise
    place & time: scale to determine if only one location or multiple

    old chats:
        https://chatgpt.com/c/68259c99-b648-8001-96c9-01462af1d857 (final)
        https://gemini.google.com/app/e69c32fe84ae931d (examples)
        https://gemini.google.com/app/f6eb0c336b5ed218 (v2)
        ---
        https://gemini.google.com/app/bc0eda7592525891 (okay)
        https://gemini.google.com/app/be7d58cc7d4b0380 (bad)
        https://gemini.google.com/app/939d66e003582351 (missing tags)
        https://gemini.google.com/app/38fd8b42c3385597 (missing scales)
        
---

ai flow
    https://www.langflow.org/

---

donations
    ko-fi
    https://boosty.to/

---

plot similarity combined with tvtropes

---

home page categories:
    top 5 ____
    ____ vs ____
    
---

caption analysis
    open captions
    undersand content

---

twitter gw
    top lists, "if you like X then Y"
    https://typefully.com/

---

strategy / promotion
    https://www.reddit.com/r/SaaS/comments/1hfe8k9/i_grew_my_startup_to_67_users_in_10_days_without/
    https://x.com/natiakourdadze/status/1866538738198655002
    https://x.com/dswharshit/status/1849690811442614706
    
lead generation
    https://x.com/N3sOnline/status/1957549107440214262
    https://docs.google.com/document/d/16xfExVbm8fJFej-yEmrRjl95mOe0u6D-oX_qkCIoPXU/edit?tab=t.0#heading=h.v6oi4o3qitsc
    https://www.redditscout.com/
    https://www.subredditsignals.com/

---

swiper
    edgeSwipeDetection?
    mousewheel
    freemode: sticky?
    lazyPreloadPrevNext?
    navigation: https://swiperjs.com/swiper-api#navigation
    cardsEffect?

similar headings as explore for start page (trending, moods, themes, etc.)
    each section as swipable

delete explore page and BE

---

invite link
    badge

---

incubator/accelerator
    https://docs.google.com/spreadsheets/d/1G6UGICGe4AZSUvyBgB06gQhylOIWaojPVlzVjs5X1F0/edit?gid=0#gid=0
    ycombinator
    Antler
    TechStars

---

save main searches
save filter searches
save outbound links to data source websites

---

new dna filters:
    spoken languages
    dubbed languages
    
new sorting:
    user score
    critics score
    release date
    last air date

---

user feedback
    https://www.msgmorph.com
    https://userjot.com/
    https://astuto.io/
    https://github.com/clearflask/clearflask#self-hosting
    https://fider.io/

---

windsurf global rules
    https://gist.github.com/muratkeremozcan/2fa569c9ba5a2a6459217aa01e42bcef

---

add caching for user settings
    invalidate cache in setter

add caching for user data
    invalidate cache in all setters
    possible with onboarding?

---

move caddy proxy from db1 to vector

---

crawling scores:
    parse release year to catch wrong urls
    e.g. https://goodwatch.app/movie/1399125-singin-in-the-rain

---

header glass
    https://www.joshwcomeau.com/css/backdrop-filter/

---

investor
    https://www.basecase.sh/

---

Posthog
    UTM

---

command palette
    CTRL + K

---

streaming links missing
    inside out 2

---

login flicker from index to redirected page

optimistic ui for user settings
    api-action.ts

---

discover page title based on filters

---

start page word carousel
    DNA categories

---

better URL and  query params management
    https://nuqs.47ng.com/

---

roadmap + todo organization
    https://flowbite.com/docs/components/timeline/

---    

DNA clusters only over same category?
    good for some, bad for others

---

clips
    https://ensembledata.com/pricing
    tiktok
    youtube shorts
    reels

---

user settings
    oval together: profile picture -> profile icon

---

slow network emulation
    skeleton loading
    useQuery

---

Upgrade Remix to RR7
    https://reactrouter.com/upgrading/remix

---

discover sidebar
    sort by column
    facets as scroll preview minimap (e.g. release year)
    
discover release
    filter by month
    add index

---

remmove prefetch component

---

header
    subnav row with search and default filters
        https://flowbite.com/blocks/application/navbar/#double-navigation-bar-with-search-input
    
---

home screen
    swiping with acceleration
    user: trending, watch next, etc.
    stagger animation for rating progress bars

---

sound section
    soundtrack info
    sound bites / board

---

famous quotes section

---

postgres cluster config in repo
    https://github.com/vitabaks/postgresql_cluster
    
---

remove weaviate

---

discover
    dna: select category?
    similarity: threshold?

Randomize button
    all: add bar right edge
    DNA: random selection

---

watch filter
    only what I scored / didn't score
    only favs / not favs

---

trailer full screen issues
    vertical scroll on wide screen

---

data flows ignore list:
    no release_year
    no poster_path
    no title

---

knowledge graph
    https://github.com/getzep/graphiti

graph db
    https://age.apache.org/

---

error boundaries
    add for each page
    better error display

---

discover categories
    age ratings
    search text

loading animation with skeletons

filter inspiration:
    https://www.yidio.com/movies
    https://movielens.org/explore?people=brad%20pitt&minYear=2000&hasRated=no&sortBy=popularity

---

Thanks page
    tools & libraries
    content creators
        josh w. cameau
    beta tester shoutouts
    community shoutouts
        Lost Design
        Mohit UX audit
        hibba design
        Harrie SEO strategy
    credits for design inspiration
        https://www.figma.com/design/1sIRD12ImqTbC6lI396gWA/IMDb-Redesign-(Community)?node-id=0-1&node-type=canvas&t=HNeQ9QDw29BnwYEl-0
        https://imdb.shyakadavis.me/title#technical-specs

---

Fingerprint infobox with Discord link

---

use connection pooling properly
    postgres
    redis

---

redesigned footer
    community blocks
    https://flowbite.com/blocks/marketing/footer/
    https://www.screenspace.io/

---

mongodb backups
    daily to hetzner storage

---

new page: started this week on your streaming services

---

secret handling
    https://www.reddit.com/r/selfhosted/comments/1goj5yi/self_hosted_secrets_manager/
project documentation

---

wide cards
    two images next o each other, big title in center
    inspiration: letterboxd

---

age ratings
    example with icons: https://www.igdb.com/games/hollow-knight-silksong
    https://en.wikipedia.org/wiki/Motion_picture_content_rating_system
    https://www.movielabs.com/md/ratings/
    https://www.movielabs.com/md/ratings/v2.4.9/html/Summary.html

---

details: releases
    show dates for each country with age ratings

---

discord growth:
    https://medium.com/@jeremiahnorthcutt/the-ultimate-list-of-discord-listing-websites-to-gain-members-a5a80cbb1841

---

user actions
    new for shows: watching / completed

---

letterboxd ratings

---

db redesign
    * streaming availability: history + changes + upcoming
    * scores: history + by season + by episode

DB research
    https://gemini.google.com/u/0/app/5767cc373c28c472?pli=1
    https://arangodb.com/
    https://www.tigergraph.com/
    https://aerospike.com/

DB optimization
    separate vector db?
    https://qdrant.tech/benchmarks/#filtered-results

---

country usage
    new hook with user setting, guess and locale
    details
    explore
    discover
    trending

---

meta tags
    better descriptions
    based on params

---

local storage optimizations
    https://usehooks.com/uselocalstorage

---

analyze slow indexes

SELECT 
  *
FROM 
  pg_stat_statements 
WHERE 
  query LIKE '%vectors_media%'
LIMIT 20;
  
---

referrer paths
    https://chatgpt.com/c/66f241ee-6c20-8001-8b0f-aefbcaefc2bc

---

init scripts only insert new and ignore existing ids
    copy/combine scripts only copy diffs to postgres


---

translated titles in current language
    all cards
    onboarding ratings
    details with alternative titles block
    search, discover and explore

---

offline support

---

dna
    political undertone (famas)

---

achievements
    user level + xp
    rating count: 10, 20 etc.

---

testing
    https://testcontainers.com/

---

postgres cluster health check
    SELECT 1 FROM pg_replication_slots WHERE active = 'true' AND slot_name = 'pgnode01';

---

explore tag alternatives:
    SELECT 
        value_text, 
        COUNT(*) AS value_count
    FROM (
        SELECT jsonb_array_elements_text(dna->'Place') AS value_text
        FROM movies
        WHERE dna->'Place' IS NOT NULL
    ) AS subquery
    GROUP BY value_text
    ORDER BY value_count DESC
    LIMIT 200;

---

streaming providers from tmdb api with all country ranks
    remove old scripts and schedules
    
streaming_provider_rank
    rename to streaming_provider_countries
    
---

guides (discover dna shortcuts)
    by genre
    by mood
    etc.
    
guide of the day

---

reviews

---

gamification
    top 5 engaged users (e.g. IndieVoice)

---

feature voting
    https://fider.io/docs/hosting-instance

---

movie site/app directory
    https://www.youtube.com/watch?v=hPveUtta0Es

---

stats
    # of movies
    # of tv shows
    # of ratings per site
    # of streaming links
    # of tropes
    avg rating per provider
    oldest fetch date
        date distribution

---

what do they have in common?
    multi-select titles and see DNA intersections
    "reverse discover"

---

reddit sentiment analysis
    https://www.reddit.com/r/BuyItForLife/comments/1h17xry/i_analyzed_the_25_most_recommended_vacuum/

---

all titles from a-z (search page?)
    difference between search, explore, discover, watch next, etc.?
    
---

container management
    https://www.nomadproject.io/
    k8s

---

import watchlist / ratings
    imdb
    rotten
    metacritic
    netflix
    prime
    ...

---

anti spoiler mode
    hide images and thumbnails
    hide overview and description
    hide all DNA tags
    hide episode titles

---

fix high memory windmill scripts
    f/tvtropes_web/tvtropes_init_tags/main
    check db

---

json-ld
    https://schema.org/Movie
    https://remix.run/docs/fr/main/route/meta

---

domain provider check
    cloudflare

---

drizzle
    remix server scripts with sql builder

---

tvtropes number to string conversion
    https://chatgpt.com/g/g-FZtypBX5c-goodwatch-ai/c/9871cbb0-ca78-46a6-8cd1-732519e36f6e

---

social media scheduling
    https://postiz.com/

---

error monitoring
    https://glitchtip.com/
    sentry self hosted

---

launch strategy
    https://www.notion.so/ScreenSpace-2-0-Launch-Support-1831647101ea80858e7ce3ee766ba7e6

---

reddit

**Startup & Entrepreneurship**

* r/startup
* r/Entrepreneur
* r/advancedentrepreneur
* r/EntrepreneurRideAlong
* r/sweatystartup
* r/SmallBusiness
* r/IndieBiz
* r/SideProject
* r/SaaS

**Growth, Marketing & Analytics**

* r/GrowthHacking
* r/AskMarketing
* r/Content_marketing
* r/SocialMediaMarketing
* r/SEO
* r/Linkbuilding
* r/Advertising
* r/PPC
* r/Analytics

**Promotion, Feedback & Launch**

* r/RoastMyStartup
* r/AlphaandBetausers
* r/PlugYourProduct
* r/startups_promotion
* r/Freepromote
* r/PromoteReddit
* r/IMadeThis
* r/InternetIsBeautiful

**Product, Design & PM**

* r/ProductMgt
* r/design_critiques
* r/Webdesign

**Dev & Web**

* r/programming
* r/WebDev

**Productivity & Lifestyle**

* r/productivity
* r/LifeProTips
* r/lifehacks
* r/DigitalNomad
* r/LadyBusiness
* r/WantToLearn

**General Interest & Reach**

* r/ExplainLikeImFive
* r/TodayILearned
* r/AskReddit

**Deals**

* r/Coupons

---

launch / promo
    alternativeto
    BetaList
    devhunt
    Fazier
    hackernews
    indiehackers
    microlaunch
    https://www.tinylaun.ch/
    ProductHunt
    similarsites
    slant
    Uneed
    Peerlist
    https://before1k.com
    https://www.listingcat.com/app/websites/launch-platforms
    https://solopush.com/
    https://www.justgotfound.com/
    https://open-launch.com/
    https://www.tinystartups.com/
    https://thehiveindex.com/
    https://indexbug.com/articles/directoriesdb
    https://listd.in/
    https://docs.google.com/spreadsheets/u/0/d/1XNBDtreaotmXJRD3JOVdcAgRD9rO1GZjbjbrr1fHLMM/htmlview?pli=1 
    https://growstartup.co/directory-list/
    https://www.effortlessbacklinks.com/
    https://www.getmorebacklinks.org/
    https://x.com/dams9ix/status/1985677073294229530?t=8FXIJdsv8YsuE0vZDulaTQ&s=03

---

sales/outreach
    https://stripe.com/en-de/guides/atlas/starting-sales

---

cold emails
   https://www.mailead.io/
   https://www.plusvibe.ai/
   https://www.smartlead.ai/

---

open source events
    https://gssoc.girlscript.tech/
    https://hacktoberfest.com/
    https://buildspace.so/s5/welcome
    https://solvearn.net/

---

light and dark mode switch
    https://admin.forem.com/

---
    
posthog custom events
    https://posthog.com/tutorials/remix-analytics#capturing-custom-events

error handling: http://localhost:3003/tv/252146-who-killed-him
    fallback?
    priority?
    https://www.themoviedb.org/tv/252146-quien-lo-mato

DNA tag user weights
    click on most loved/hated aspects for recommendations

user notes/comments
    use for LLM input for recommendations

cast with images from time of their role
    also images from their character

playwright tests

anime
    https://anidb.net/
    https://anibrain.ai/
    https://www.anisearch.de/
    https://www.anime-planet.com/
    
other sites / inspiration
    https://thefilmaholic.com/film/dune-part-two-2024
    https://www.taste.io/
    https://www.matched-app.com/
    https://simkl.com/
    https://tastedive.com/
    https://www.streamplus.app/
    https://moviechat.org/
    https://app.moveme.tv/
    https://filmfinder.ai/
    https://agoodmovietowatch.com/
    https://www.betterkritic.com/
    https://fable.co/
    headline: https://hamvocke.com/blog/a-guide-to-customizing-your-tmux-conf/
    
other api's
    https://mdblist.com/
    https://mdblist.docs.apiary.io/#reference/0/media-info/get-media-info
    https://www.thetvdb.com/
    https://letterboxd.com/film/beetlejuice-beetlejuice/nanogenres/
    https://nanocrowd.com/
    https://app.nanocrowd.com/

redistribute weight for gw score

more lightweight user data

batch user actions
    add all to want to watch
    add all to watched
    add all to favorites
    
audit log per user
    revert own actions

detailed watchlists
    https://docs.simkl.org/how-to-use-simkl/basic-features/watchlists-and-custom-lists#how-are-notifications-handled-for-each-watchlist

refresh data request
    show oldest last refreshed date
    badge with counter
    email once finished

notification when streaming is available (country + streaming)
alerts for new search results

fix all linting errors

user favs: actors, directors, writers

ratings: show last updated time

date of first streaming link / new to stream

trending load more

show titles on map (production countries + places in film)
    where to show space and fantasy places?
    https://x.com/dams9ix/status/1985677073294229530?t=8FXIJdsv8YsuE0vZDulaTQ&s=03

populate trending score 1-500
save trending scores per day
trending yesterday
trending difference

styling goodies:
    view transitions: https://www.joshwcomeau.com/blog/how-i-built-my-blog-v2/#view-transitions-12
    search delete animation: https://www.joshwcomeau.com/blog/how-i-built-my-blog-v2/#search-13
    rem based breakpoints: https://www.joshwcomeau.com/blog/how-i-built-my-blog-v2/#accessibility-15
    animated svg icons: https://www.joshwcomeau.com/blog/how-i-built-my-blog-v2/#modern-outline-icons-14

explore graphs
    https://reactflow.dev/

invalidate redis caches after update
    https://github.com/redis/node-redis
    https://yunpengn.github.io/blog/2019/05/04/consistent-redis-sql/

coolify caching
    invalidate coolify caches after update

report missing/wrong ratings
report missing/wrong streaming providers
report missing/wrong DNA

decide together
    watch party / watch together / swipe and watch
    https://www.matched-app.com/

reduce costs: show best streaming bundles for my likings

similarity
    display percentage
    
recommendation directory
    https://www.reddit.com/r/MovieSuggestions/wiki/frequently_requested/?utm_medium=android_app&utm_source=share

explore button for media titles (prefilled discover, map feature)

random full screen: album cover (good roulette)

international / indie guides

stuck scripts monitoring
rate limit monitoring

do not refetch stale data
    streaming links
    tv tropes
    
live rating events
    chatbox
    countdown

telegram bot
    
wrong tropes: the little mermaid (tmdb_id = 10144)
streaming missing: https://www.themoviedb.org/movie/872585-oppenheimer/watch
rotten ratings missing: http://localhost:3003/movie/1022964-candy-cane-lane
rotten score not up to date: http://localhost:3003/movie/961268-ballerina?tab=streaming
    wrong link: https://www.rottentomatoes.com/m/ballerina_2023
fury 2014, wrong rotten link: http://localhost:3003/movie/228150-fury
avengers, wrong rotten link: http://localhost:3003/movie/24428-the-avengers
my fault, 0 rotten critics score but should be null? http://localhost:3003/movie/1010581-my-fault
fringe, missing streaming: https://goodwatch.app/tv/1705-fringe
extra link for multiple in same year: https://www.rottentomatoes.com/m/nowhere_2023_2

rotten wrong urls:
    https://www.rottentomatoes.com/m/cars_2006
 -> https://www.rottentomatoes.com/m/cars
 => try different variants and compare years!
 
 metacritic false positive:
    http://localhost:3003/tv/121-doctor-who
 -> should be empty
 => compare years!
 
 tvtropes wrong years:
    https://tvtropes.org/pmwiki/pmwiki.php/Film/HitMan2023
-> searches for 2024 instead of 2023
 
identify title duplicates and run scraping again

zombie processes:
    alternate approach: MAX_WAIT_FOR_SIGINT=1
    https://github.com/windmill-labs/windmill/issues/4198

score explanations
streaming explanations

llm orchestration
    https://flowiseai.com/

android app
iphone app

data source: existing crawlers use existing url instead of guessing
data-source: letterboxd scores
data-source: filmstarts scores
data-source: filmstarts scores
data source: allmovie sub-genres, moods, themes, attributes, flags (https://www.allmovie.com/movie/fargo-vm422651)
data source: allmovie tones (https://www.allmovie.com/advanced-search)
data source: seasons ratings and details (flickvibe-webapp/app/routes/api/ratings/tv-seasons.tsx)
data source: imdb plotsummary + keywords
data source: user reviews (all above, flickfilosopher) 
data source: tmdb people api
data source: moviespoiler + moviepooper
data source: memes (knowyourmeme, urbandictionary, etc.9
data source: social media content (tiktok, ig, yt shorts, reddit, twitter, etc.)
data source: based on / adapted from (books, comics, ...)

Blog Posts Page
    https://flowbite.com/docs/components/jumbotron/#jumbotron-with-cards

GoodWatch API

socket.io updates

fix certification longer than 50 chars
    12 éven aluliak számára a megtekintése nagykorú felügyelete mellett ajánlott

issue: breaking bad streaming missing -> justwatch streaming data
issue: videos not available or not a real trailer (ip man: kung fu master, plane 2023)

analyze subtitles

other media
    games
    music
    podcasts
    books
    audio books
    shopping
    restaurants
    events
    news
    
mini apps
    quiz to recommendations (select x titles to get more)
    "the opposite movie"
    swipe to decide what to watch together
    
```

# Blog
```
seo
from vercel to coolify
    too many open files
    transparency concerns: hidden costs
hydration errors
    https://github.com/facebook/react/issues/24519#issuecomment-1122780621
    https://stackoverflow.com/questions/71706064/react-18-hydration-failed-because-the-initial-ui-does-not-match-what-was-render
dna journey
    https://huggingface.co/models?pipeline_tag=sentence-similarity&sort=trending&search=negat
    https://huggingface.co/czesty/ea-setfit-v1-classifier
    https://colab.research.google.com/drive/12mOUgSiy7eY_py3T66tlas8h4lgY8jKV#scrollTo=vad6_Ay41hMg
    https://colab.research.google.com/drive/12EtiQRXZGsxCu3kA6T6mlekMq2j-XGBn#scrollTo=vad6_Ay41hMg
dna clustering
    https://windmill.goodwatch.app/run/0194257e-7845-8b5b-a6b0-1b2d307de565?workspace=flickvibe
        Processing item 331000/331073 - Clusters: 66,807 - Largest cluster: 5711 (Elapsed: 523.11m)
        Clustering complete in 523.37 minutes.
        Total clusters formed: 66,819
        Largest cluster size: 5714
        Largest cluster representative label: Forbidden Resurrection
        Largest cluster labels (up to 10): ['Forbidden Resurrection', 'Legacy Of Evil', 'Underdog Against Authority', 'Reluctant Mentorship', 'Unholy Resurrection', 'Misguided Justice', 'Insignificant Protagonist', 'Naive Inventor', 'Clueless Parent', 'Misunderstood Outcasts']
windmill & playwright: zombie processes
    windmill -> chrome (playwright)
    "can't start new thread"
    "IO error: Resource temporarily unavailable (os error 11)"
    kill windmill every 24 hours
authentication
    https://www.dusanstam.com/posts/remix-supabase-authentication
    from supabase cloud to better auth
monorepo design
db architecture: performance and scalability
    index optimizations
    fast queries
caching strategy
    redis
remix: keep it simple with tailwind
    linting with biomejs
    component example: rating
server architecture
    deployment with docker compose
    ansible for worker upgrades
    security audit & hardening
    monitoring with uptime kuma + ?
recommendation engine
monthly costs
```

https://www.writebots.com/discord-text-formatting/