# Frameworks and runtimes that hydrate less on title pages

Findings for the ticket "Research: frameworks and runtimes that hydrate less on title pages". They feed
"Decide how title pages hydrate less" and belong to the map "Serve a viral traffic spike".

Researched on October 6, 2026. Versions and dates come from the npm registry and the projects' own release pages on
that day. Each claim names its source. Claims marked **(from memory)** or **(inferred)** have no primary source
behind them in this document.

## Answer

- **No framework or runtime change beats the current stack by enough to justify a move before the baseline is
  measured.** React 18.3 already has the two mechanisms that matter: hydration that yields inside `Suspense`
  boundaries, and boundaries that stay unhydrated until their code or data is ready. Neither is in use on title
  pages today.
- **Two options are worth a prototype benchmark:** the baseline with deferred sections (the control and the likely
  winner on cost), and an Astro page with React islands (the upper bound for what a framework shift can save).
- **React Router 8 with React 19.3 is a maintenance upgrade, not a hydration fix.** Its server component mode would
  reduce hydration work for static sections, but it's experimental.
- **Bun changes nothing in the browser.** It's a server runtime. The browser receives the same HTML and the same
  scripts and hydrates them the same way.
- **No vendor publishes a controlled hydration benchmark for a page like this one.** The only cross-framework
  numbers are field data from HTTP Archive, which compare different sites, not the same page. That's why the
  recommendation is a benchmark and not a decision.

## The page today

| Fact | Value | Source |
| --- | --- | --- |
| Stack | Remix 2.17 with Vite 6.3, React 18.3.1, TanStack Query 5, Swiper 11, framer-motion 11, Node 24 | `goodwatch-webapp/package.json`, `goodwatch-webapp/Dockerfile` |
| Hydration | One tree: `startTransition(() => hydrateRoot(document, ...))` | `goodwatch-webapp/app/entry.client.tsx` |
| Server data | One dehydrated TanStack Query state in the root loader, passed to one `HydrationBoundary` | `goodwatch-webapp/app/root.tsx` |
| `Suspense` in the title page tree | One, around the lazy YouTube player | `goodwatch-webapp/app/ui/details/YoutubePlayer.tsx` |
| Below-fold sections | Skip style and layout with `content-visibility: auto`. They still hydrate | `goodwatch-webapp/app/ui/details/below-fold.tsx` |
| TBT, mobile, 4x CPU | 586 ms (movie), 637 ms (show), one run in three can double | [The render path budget](../benchmarks/viral-spike-render-path-budget.md) |
| Migration surface | 174 route files, 229 files that import Remix APIs, 61 files with TanStack Query hooks, 134 files with framer-motion, 8 with Swiper | Counted in `goodwatch-webapp/app` on this date |

The page cache ([ADR 0007](../adr/0007-in-process-page-cache.md)) stores the rendered anonymous HTML, so the server
render is paid once per title and instance. The browser pays hydration on every visit.

## What "less hydration" can mean

The options differ in which of these four costs they remove. The table uses these names.

| Cost | What it is |
| --- | --- |
| Blocking | Hydration runs in long tasks. TBT counts the part of each task over 50 ms, and a tap waits for the task to end |
| Work before use | Sections hydrate at load although the visitor hasn't reached them |
| Work for static sections | Components that never change still run in the browser, and their code is downloaded and parsed |
| Runtime | The framework's own script: download, parse, and start |

## Deferred hydration: practice, native support, search, and INP

### It's an established practice

web.dev's rendering guide describes progressive hydration (sections boot over time) and partial hydration, and
recommends to "mostly ship HTML with minimal JavaScript". It also says partial hydration "has proven difficult to
implement" ([Rendering on the web](https://web.dev/articles/rendering-on-the-web), last updated January 5, 2026).

Frameworks that ship it natively:

| Framework | Triggers | Events before hydration | Source |
| --- | --- | --- | --- |
| Astro 7 | `client:load`, `client:idle` (with `timeout`), `client:visible` (with `rootMargin`), `client:media` | Not documented on the directives page | [Template directives reference](https://docs.astro.build/en/reference/directives-reference/) |
| Angular 22 | `hydrate on idle`, `viewport`, `interaction`, `hover`, `immediate`, `timer`, `hydrate when`, `hydrate never` | Queued and replayed after hydration | [Incremental hydration](https://angular.dev/guide/incremental-hydration) |
| Vue 3.5 and later | `hydrateOnIdle`, `hydrateOnVisible`, `hydrateOnMediaQuery`, `hydrateOnInteraction` | The triggering event is replayed | [Async components](https://vuejs.org/guide/components/async.html) |
| Nuxt 4 | `hydrate-on-visible`, `-idle`, `-interaction`, `-media-query`, `hydrate-after`, `hydrate-when`, `hydrate-never` | Not checked | [Components](https://nuxt.com/docs/4.x/directory-structure/app/components) |
| Qwik | No hydration. Listeners are serialized into the HTML and their code loads on the event | One global listener loads and runs the handler | [Resumable](https://qwik.dev/docs/concepts/resumable/) |

Nuxt's documentation adds the rule that matters here: "Avoid delayed hydration for critical, above-the-fold
content."

React has no trigger API. It has the building block: a server-rendered `Suspense` boundary whose content isn't
ready stays as server HTML, and React hydrates the rest of the page around it
([New Suspense SSR Architecture in React 18](https://github.com/reactwg/react-18/discussions/37)). React 19.2 added
`Activity` boundaries, which take part in selective hydration even when they're always visible
([`Activity` reference](https://react.dev/reference/react/Activity)). A "hydrate when visible" wrapper in React is
therefore userland code: a boundary whose child suspends until an `IntersectionObserver` or an idle callback
resolves it.

### React 18's behavior on a tap before hydration

From the React 18 architecture post:

- "In React 18, hydrating content inside Suspense boundaries happens with tiny gaps in which the browser can handle
  events."
- On a click into a boundary that isn't hydrated yet, "React will synchronously hydrate the comments during the
  capture phase of the click event".
- React hydrates the parent boundaries of the target first and skips unrelated siblings.

The source of React 18.3.1 adds a limit that the post doesn't state. In
[`ReactDOMEventListener.js`](https://github.com/facebook/react/blob/v18.3.1/packages/react-dom/src/events/ReactDOMEventListener.js),
a discrete event such as `click` or `keydown` that targets an unhydrated boundary triggers
`attemptSynchronousHydration` in a loop. When the boundary is still blocked afterwards (its code isn't loaded, or
its child is still suspended), React calls `nativeEvent.stopPropagation()`: the handler doesn't run, and the event
isn't replayed. The flag that selects this path, `enableCapturePhaseSelectiveHydrationWithoutDiscreteEventReplay`,
is `true` in
[`ReactFeatureFlags.js` of 18.3.1](https://github.com/facebook/react/blob/v18.3.1/packages/shared/ReactFeatureFlags.js).
React 19.2 has the same structure in the same function. Only continuous events (`mouseover`, `focusin`,
`pointerover`, `dragenter`) are queued and replayed.

What follows for a deferred section on a title page **(inferred from the source, not measured)**:

- **A tap on a section whose code is loaded but not hydrated works**, and that tap pays the section's hydration
  before its handler runs. Small boundaries keep that cost low.
- **A tap on a section that is still suspended is lost for buttons.** A wrapper that waits for visibility must also
  resolve on the first `pointerdown` or `touchstart` in the section, or the first tap does nothing.
- **Links keep working.** `stopPropagation` doesn't cancel the browser's default action, so an `<a href>` in an
  unhydrated section navigates with a full document load instead of a client navigation.

### INP risks

INP is the 75th percentile of the slowest interactions of a visit, over the whole visit, and "good" is 200 ms or
less. Clicks, taps, and key presses count. Scrolling doesn't ([Interaction to Next Paint](https://web.dev/articles/inp)).
Long tasks from script evaluation at startup delay input
([Optimize Interaction to Next Paint](https://web.dev/articles/optimize-inp)).

- **Today's risk** is input delay: a tap during the hydration tasks waits for them.
- **Deferral moves the risk.** It removes the long tasks at load, and adds hydration work to the first tap on a
  deferred section and to the moment a section scrolls into view. A section that hydrates in the frame it becomes
  visible can stall the scroll, which INP doesn't count but a visitor feels.
- **Mitigations:** hydrate sections above the fold at load, give the visibility trigger a root margin so that
  hydration finishes before the section is on screen, add an idle trigger so that every section is hydrated a few
  seconds after load, and keep each boundary's hydration under 50 ms on the benchmark's CPU.

### Search engine drawbacks

None for server-rendered sections, as long as the content stays in the server HTML.

- Google renders with an evergreen Chromium, and "server-side or pre-rendering is still a great idea"
  ([JavaScript SEO basics](https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics)).
- Google finds links only as `<a>` elements with an `href`. Server-rendered links meet this before any script runs.
- Structured data in the server HTML doesn't depend on hydration. Google also accepts JSON-LD that a script injects.
- The lazy-loading guidance is about content that loads late, and its rule is that loading must not "rely on user
  actions, such as scrolling or clicking", because "Google Search does not interact with your page"
  ([Fix lazy-loaded content](https://developers.google.com/search/docs/crawling-indexing/javascript/lazy-loading)).
  A section that is in the HTML and only attaches its handlers late isn't lazy-loaded content in that sense
  **(inferred: Google's documentation doesn't mention hydration)**.

The drawback starts where deferral also removes content from the HTML: a tab panel, a carousel slide, or an episode
list that only renders after a tap or a scroll. Each deferred section needs a check that its text and links are in
the response body.

## Options

### Baseline: React 18.3 with a `Suspense` boundary per section

| | |
| --- | --- |
| Removes | Blocking (documented). Work before use, with a userland visibility or idle wrapper. Work for static sections, with a boundary that never resolves on a document load |
| Keeps | The runtime. The component code of static sections stays in the bundle unless each section is a lazy chunk |
| Proven by numbers | Nothing published for this shape of page. The mechanism is documented by the React team |
| Migration | `app/ui/details/` only: boundaries in `DetailsContent.tsx` and around the related titles, the cast carousel, the episode grid, and the media tabs. Routes, loaders, TanStack Query, Swiper, and auth stay |
| Unstable | Nothing. All APIs are stable in React 18 |

Open points to settle in the prototype:

- **The existing below-fold mechanism updates state after hydration.** `BelowFoldProvider` sets `skipping` through
  context. An update that reaches an unhydrated boundary makes React hydrate it at once or fall back to a client
  render of that boundary **(from memory: React's error "This Suspense boundary received an update before it
  finished hydrating")**. Context that changes after load must sit inside the boundaries or stay stable.
- **TanStack Query's `HydrationBoundary` sits above the tree**, so the dehydrated state is in the cache before any
  section hydrates. A late section reads the same cache. A query that refetched in the meantime gives the late
  section different data than the server HTML, which is a hydration mismatch for that boundary.
- **Whether today's root hydration already yields** isn't verified. The entry wraps `hydrateRoot` in
  `startTransition`, and the measured TBT says the work still lands in long tasks.

### React Router 8 with React 19.3

| | |
| --- | --- |
| Current state | React Router 8.4.0 (September 15, 2026). 8.0.0 (June 17, 2026) requires Node 22.22, React 19.2.7, and Vite 7, and is ESM only. React 19.3.0 (September 9, 2026) |
| Removes | Without server components: nothing by itself. `Activity` is a second boundary type for selective hydration. Route module splitting is on by default in 8 |
| Server components | "React Server Components support is experimental and subject to breaking changes in minor/patch releases." Every API is prefixed `unstable_`. Needs `@vitejs/plugin-rsc` (0.5.35) |
| With server components | Static sections (About, Crew, FAQ, footer, score ring) would run no component code in the browser and ship none. A route exports `ServerComponent`, and interactive parts move behind `"use client"` |
| Proven by numbers | Nothing published by the vendor on hydration time |
| Migration | Remix 2 future flags, a codemod for the package renames, `routes.ts`, a config file, renamed entry components, then 7 to 8. The official guide lists nine steps. The app has no future flags on, so the flags are the real work: single fetch changes how loaders serialize, and the app's `use-dehydrated-state` pattern reads loader data from route matches |
| Unstable | Server components. In that mode, `.server` and `.client` file names and `splitRouteModules` aren't supported |

Sources: [React Router changelog](https://reactrouter.com/changelog),
[Upgrading from Remix](https://reactrouter.com/upgrading/remix),
[React Server Components in React Router](https://reactrouter.com/how-to/react-server-components),
[React versions](https://react.dev/versions).

Two limits of server components apply to every framework in the next section too:

- **Server components don't make the browser skip their DOM.** The client receives the server components' output
  as a payload, and React uses it "to reconcile the Client and Server Component trees"
  ([Next.js: Server and Client Components](https://nextjs.org/docs/app/getting-started/server-and-client-components)).
  The saving is the component code and its execution, not the walk over 2,400 to 2,800 elements. How the remaining
  cost compares with today's isn't published **(the proportion is unverified)**.
- **The payload repeats the static content** next to the HTML, which adds to the 49 to 52 KB of compressed HTML.
- **The implementation APIs "do not follow semver and may break between minors in React 19.x"**
  ([Server Components reference](https://react.dev/reference/rsc/server-components)). The React team published a
  remote code execution vulnerability in server components on December 3, 2025, and two more on December 11, 2025
  ([React blog](https://react.dev/blog)).

Remix 2 itself is at 2.17.5 on npm. Remix 3 reached a release candidate on August 31, 2026
([Remix blog](https://remix.run/blog)) and is a different framework that isn't built on React **(the second half
is from memory)**. React Router is the upgrade path for this app.

### Server components elsewhere

| Framework | Current state | Fit |
| --- | --- | --- |
| Next.js 16.3 (August 3, 2026) | Server components are stable and the default. Cache Components and Partial Prerendering are opt-in with `cacheComponents: true`. For crawlers, Next.js skips the static shell and renders the whole page at request time | The only stable server component framework. A rewrite: 174 route files, loaders to async components, the page cache and cache identity to Next.js caching, `remix-serve` to the Next.js server |
| Waku | 1.0.0-rc.3, published October 6, 2026 | Not stable. No reason to prefer it over React Router for this app |
| TanStack Start 1.168 | "Release Candidate stage". "Server Components are experimental! The API may see refinements." Selective SSR skips the server render of a route. It doesn't reduce hydration | Fits TanStack Query, but a rewrite onto an experimental feature |

Sources: [Next.js blog](https://nextjs.org/blog),
[Next.js caching](https://nextjs.org/docs/app/getting-started/cache-components),
[TanStack Start overview](https://tanstack.com/start/latest/docs/framework/react/overview),
[TanStack Start server components](https://tanstack.com/start/latest/docs/framework/react/guide/server-components),
[TanStack Start selective SSR](https://tanstack.com/start/latest/docs/framework/react/guide/selective-ssr).

Partial Prerendering is a server and CDN feature: it decides what is prerendered. The page cache already serves
that purpose here, and it doesn't change the browser's work.

### Islands: Astro with React islands

| | |
| --- | --- |
| Current state | Astro 7.3.6 (October 6, 2026), `@astrojs/react` 7.0.1 |
| Removes | All four costs for static sections: "Astro will automatically render every UI component to just HTML & CSS, stripping out all client-side JavaScript". Work before use through `client:visible` and `client:idle`. Blocking, because islands "load in parallel and hydrate in isolation" |
| Keeps | The React runtime, once, as soon as the first island hydrates |
| Proven by numbers | Field data only: the highest share of origins with good mobile INP in the table below. No controlled benchmark |
| Unstable | Nothing in the island directives. Passing Astro children into a React island as React nodes is behind an experimental flag |

Migration in this app:

- **Routes and loaders:** each title route becomes an Astro page. Loader code moves to the page's server script.
  Client navigation between pages goes away, unless the page uses Astro's client router.
- **TanStack Query:** every island is its own React root, and context doesn't cross islands. Astro's documentation
  says so and recommends a store outside the framework
  ([Share state between islands](https://docs.astro.build/en/recipes/sharing-state-islands/)). The query client
  would be a module-level singleton that each island passes to its own provider, with the dehydrated state in one
  inline script **(inferred: islands on a page share module instances)**.
- **Swiper and framer-motion:** work inside an island as they do today.
- **Auth:** the header's member state becomes an island. The Supabase cookie handling moves to Astro middleware.
- **Server:** the page cache, the cache identity, and the telemetry loader have to be rebuilt for Astro, or the
  title pages run as a second service behind Traefik with their own cache.

A hybrid (Astro for title pages, the Remix app for the rest) turns every navigation between the two into a full
document load and doubles the layout code (header, footer, navigation).

Sources: [Islands architecture](https://docs.astro.build/en/concepts/islands/),
[Template directives reference](https://docs.astro.build/en/reference/directives-reference/),
[`@astrojs/react`](https://docs.astro.build/en/guides/integrations-guide/react/).

### Resumability: Qwik

| | |
| --- | --- |
| Current state | `@builder.io/qwik` 1.20.2 is the stable line. Qwik 2 is `@qwik.dev/core` 2.0.0-rc.2, published October 6, 2026 |
| Removes | All four costs at load: "it does not require hydration to resume an application on the client" |
| Proven by numbers | Field data only, from 1,334 origins. No controlled benchmark against React for a comparable page |
| Migration | A rewrite of every component. `qwikify$` wraps React components, but "Each instance of a qwikified react component becomes an independent React app. Fully isolated", and the documentation calls it a migration aid, "not a silver bullet". TanStack Query, Swiper's React components, and framer-motion would run only inside such wrappers, which brings React's hydration back for exactly the interactive sections |
| Unstable | The 2.0 line is a release candidate |

Sources: [Resumable](https://qwik.dev/docs/concepts/resumable/),
[Qwik React](https://qwik.dev/docs/integrations/react/).

### A lighter runtime: Preact

| | |
| --- | --- |
| Current state | Preact 11.0.0 (September 30, 2026). ESM only. "Hydration 2.0" lets a suspended boundary span zero or several DOM nodes and resume against streamed HTML |
| Removes | Part of the runtime cost: a smaller library and no synthetic event system ("Preact uses the browser's standard `addEventListener`") |
| Keeps | Work before use and work for static sections. The Preact 11 announcement and upgrade guide don't mention time-sliced or selective hydration, so the tree hydrates in one pass unless the app splits it itself **(the absence is unverified beyond those two pages)** |
| Proven by numbers | The Preact 11 announcement gives no performance or size numbers. No published hydration comparison with React 18 for a large tree |
| Migration | Alias `react` and `react-dom` to `preact/compat`. Remix and React Router don't document Preact as a supported renderer **(from memory)**. Each of TanStack Query, Swiper's React components, framer-motion, and the Supabase auth components would need a check |
| Unstable | Nothing in Preact. The risk is compatibility of the frameworks on top |

Preact could shorten a long task. It can't remove one, and it gives up the yielding that React's `Suspense`
hydration has. It's a candidate only inside islands, where each tree is small.

Sources: [Preact 11 announcement](https://preactjs.com/blog/preact-11),
[Upgrade guide](https://preactjs.com/guide/v11/upgrade-guide),
[Differences to React](https://preactjs.com/guide/v10/differences-to-react/).

### Bun as the server runtime

Bun is "a fast JavaScript runtime & toolkit": a runtime, a package manager, a test runner, and a bundler
([bun.com](https://bun.com/)). Version 1.4.2 is current.

| Bun can change | Bun can't change |
| --- | --- |
| How fast the server runs the React render, the loaders, and the HTTP layer | The HTML and the scripts the browser receives: Vite still builds them |
| Process start time and memory | The hydration work, TBT, and INP: the browser runs the same React and the same components |
| How static files are served, if the server code uses Bun's HTTP server | LCP, except through a faster uncached response |

- **The vendor's benchmark isn't about React rendering.** The home page shows an Express hello-world over HTTPS:
  48,243 requests per second on Bun 1.4 and 25,181 on Node.js 26.7. It says nothing about a React render of a title
  page.
- **The server render is already off the hot path.** The page cache answers repeat views of anonymous HTML, and
  [the render profile](../benchmarks/viral-spike-render-profile.md) puts React DOM at 13% of a render's CPU.
- **Compatibility risks:** `node:v8` lacks profilers, and `node:async_hooks` has `AsyncLocalStorage` but stubs for
  the hooks ([Node.js compatibility](https://bun.com/docs/runtime/nodejs-compat)). The app's runtime image carries
  `onnxruntime-node`, a native add-on, which wasn't tested on Bun. Bun's Remix guide describes Remix 3, not
  `remix-serve` of Remix 2.

Bun isn't an option for the question in this ticket. It could be evaluated for server throughput under its own
ticket, with the existing render profile as the method.

## Field data: Core Web Vitals by technology

HTTP Archive's technology report, mobile, all ranks and regions, August 2026. Share of origins that pass, from the
[report's API](https://cdn.httparchive.org/v1/cwv?technology=Astro,Next.js,Remix,Qwik,Preact,React,React%20Router,Nuxt.js,SvelteKit,Angular&geo=ALL&rank=ALL&start=latest),
computed as `good_number / tested`:

| Technology | Origins | Good INP | Good LCP | Good Core Web Vitals |
| --- | --- | --- | --- | --- |
| Astro | 43,850 | 86% | 81% | 71% |
| Preact | 378,313 | 83% | 70% | 56% |
| Qwik | 1,334 | 77% | 90% | 63% |
| Remix | 4,561 | 76% | 46% | 34% |
| SvelteKit | 9,682 | 75% | 67% | 51% |
| React | 1,283,232 | 70% | 59% | 45% |
| Nuxt.js | 94,069 | 65% | 47% | 29% |
| Next.js | 374,612 | 60% | 53% | 35% |
| Angular | 116,385 | 54% | 33% | 16% |
| React Router | 188,752 | 54% | 38% | 24% |

How to read it:

- **It's a correlation between detected technologies and origins, not a benchmark.** Astro sites are mostly content
  sites, and "React Router" includes single-page apps that only use the router. "Next.js" includes sites that don't
  use server components.
- **The architectures that ship less script at load lead on INP** (Astro, Preact, Qwik), which matches the
  mechanisms above.
- **Adopting a framework with stable server components doesn't produce good INP by itself:** Next.js origins pass
  INP less often than Remix origins.

## Ranking

By expected hydration saving against migration cost, for title pages.

| Rank | Option | Expected saving | Migration cost | Verdict |
| --- | --- | --- | --- | --- |
| 1 | React 18.3 with a boundary per section, deferred below-fold sections, and static sections that don't hydrate on a document load | High for blocking and work before use. Medium for static sections (their code still downloads unless split) | Low: `app/ui/details/` only | Prototype. This is the control |
| 2 | Astro with React islands for title pages | Highest that keeps the React components: static sections cost nothing in the browser | High: routes, loaders, cache, auth, and navigation for the title pages, or a second service | Prototype as the upper bound, with one page. Don't migrate before the numbers |
| 3 | React Router 8 with React 19.3, without server components | Low | Medium: future flags, codemod, Vite 7 | Do it as maintenance under its own ticket. Add it to the benchmark as a variant because the same code runs on it |
| 4 | Server components in React Router 8 | Medium: no component code for static sections, the DOM is still reconciled | Medium after rank 3, then per-section work | Wait. Experimental. Measure one route only if rank 1 misses the target |
| 5 | Preact | Low to medium, unproven. Gives up yielding | Medium, with compatibility risk across four libraries | No, except as a variant inside the Astro prototype |
| 6 | Next.js, TanStack Start, Waku | As rank 4 | Very high: a rewrite. Two of the three aren't stable | No |
| 7 | Qwik | Highest in theory | Very high: a rewrite of every component and library | No |
| 8 | Bun | None in the browser | Low to medium | No for this question |

## The prototype benchmark

One movie page and one show page with a full episode grid and 20 related titles, from the title snapshot that the
"Skip the layout of title page sections below the fold" run used, so that every variant renders the same data.

| Variant | What it is |
| --- | --- |
| V0 | `main` as it is |
| V1 | A `Suspense` boundary per section, nothing deferred. Isolates the effect of yielding |
| V2 | V1 plus: interactive sections below the fold hydrate when near the viewport, on the first pointer event, or on idle. About, Crew, FAQ, and the footer don't hydrate on a document load |
| V3 | V2 on React Router 8 and React 19.3. Optional, only if the upgrade is at hand |
| V4 | The same two pages as Astro pages, with the header, streaming offers, title actions, and fingerprint switcher as `client:load` or `client:idle` islands and the cast carousel, related titles, episode grid, and media tabs as `client:visible` islands. Built from the existing components. No cache, no auth: it measures the browser only |

Measurements, with the existing setup (`goodwatch-benchmark`, Lighthouse on worker3, mobile, 4x CPU, behind the TLS
proxy with Brotli), median of at least 5 runs because one TBT run in three can double:

- **Load:** TBT, the count and the longest of the long tasks, total script time on the main thread, script bytes
  and requests, and LCP. `./bench.sh budget` already reports most of these.
- **Early tap:** a scripted tap on a title action 500 ms after the first paint. Record the interaction's duration
  from the Event Timing API and whether the handler ran.
- **Late tap:** scroll to the related titles and to the episode grid, tap a card and a cell at once. Record the
  duration and whether the tap was lost. This is the test that the Lighthouse number doesn't cover.
- **Scroll:** long tasks during a scripted scroll from top to bottom.
- **Server HTML:** the text of every section, every link's `href`, and the JSON-LD block are in the response body
  of each variant, compared against V0.

Decision rule: take the cheapest variant that reaches TBT under 300 ms with no lost tap and no tap slower than in
V0. If V2 reaches it, the framework question is closed. If only V4 reaches it, the gap between V2 and V4 is the
price tag to weigh against Astro's migration cost.

## What isn't verified

- Every saving in the ranking is an estimate from documented mechanisms. No source measures them for this page.
- Whether `startTransition` around `hydrateRoot` makes today's root hydration yield, and why the work still lands
  in long tasks.
- React's behavior when a context update reaches an unhydrated boundary (from memory), which decides how
  `BelowFoldProvider` has to change.
- The lost-tap behavior is read from React's source at the 18.3.1 and 19.2.0 tags, not reproduced in a browser.
- How much of today's 2.5 s is component execution, DOM reconciliation, effects, or script evaluation. Without that
  split, the saving from server components can't be estimated.
- That Remix 2 or React Router run on `preact/compat`, and that Preact 11 has no time-sliced hydration: the first is
  from memory, the second rests on two documentation pages that don't mention it.
- That Remix 3 isn't built on React (from memory).
- That islands on one Astro page share module instances, which the TanStack Query plan depends on.
- The viewport that Googlebot renders with, and how long it waits for late content. Google's pages that were read
  don't state either.
- `onnxruntime-node` and the app's profiling preload on Bun.
- Vendor benchmarks for Astro, Qwik, and Preact weren't found on the pages read. Older vendor reports exist and
  weren't used.
- The HTTP Archive numbers were read from the report's API once, for August 2026. Technology detection errors
  weren't assessed.
