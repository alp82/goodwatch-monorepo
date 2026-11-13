# Traefik dynamic configurations

The files here are pasted into Coolify (Servers > *server* > Proxy > Dynamic Configurations). Each file's header says
where it goes, how it works, and how to test it. `test-local.sh` and `test-search-local.sh` run them against
throwaway containers.

## Limits on goodwatch.app (owner Q49, 2026-11-13)

`goodwatch-balance.yaml` on abio carries two limits:

- **In-flight cap.** `gw-webapp-in-flight` (`inFlightReq`, 120) is on the anonymous router `gw-webapp-https` and on
  the crawler router. Each router counts its own open requests, for all clients together, and answers 429 above
  120. The member router has no proxy limit; the page instances' overload shedder covers it.
- **Crawler rate.** `gw-webapp-crawler-https` matches named crawlers by `User-Agent` (`HeadersRegexp`, case
  insensitive) at priority 1050: above the member router (1001), below the search router (1100). Its
  `gw-webapp-crawler-rate` (`rateLimit`) allows 60 requests a minute with bursts of 30 per User-Agent string, then
  429. Traefik's `rateLimit` can't match a header itself, so the separate router does the matching.
  - Limited: AI crawlers (GPTBot, OAI-SearchBot, ClaudeBot, Claude-SearchBot, CCBot, PerplexityBot, Bytespider,
    Amazonbot, meta-externalagent, Diffbot, cohere, AI2Bot and others), Epochal-Search, SEO scrapers (AhrefsBot,
    SemrushBot, MJ12bot, DotBot, BLEXBot, DataForSeoBot, PetalBot and others), Scrapy.
  - Never limited: Googlebot and Google's other agents, Bingbot, Applebot, DuckDuckBot, link previews
    (facebookexternalhit, Twitterbot, Slackbot, Discordbot), and user-triggered AI fetches (ChatGPT-User,
    Claude-User, Perplexity-User), because one shared bucket would throttle every user of that assistant.
  - To add a name, extend the alternation in the rule. Keep it free of backslashes (Coolify rewrites them) and check
    that no Googlebot or Bingbot string contains it; `test-local.sh` section 2c checks both lists.

## yepwatch.com hold (owner Q48, 2026-11-13)

`yepwatch-front.yaml` on abio sends yepwatch.com through the hold in `../Caddyfile` (`:8480` on pgnode01), which keeps
requests waiting while a YepWatch deploy has no front running; fallback straight to the front. Design and state:
`docs/yepwatch-zero-downtime-front.md`. `test-yepwatch-front.sh` tests it locally; `verify-yepwatch-front-deploy.sh`
checks a real deploy once the file is active. Add the file only after a YepWatch deploy published `10.0.0.21:18480`.
