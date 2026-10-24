# iPhone feedback update — build 9

- Native launch screen and a short YepWatch wordmark reveal follow the GoodWatch TV boot animation. Reduced Motion uses a fade. The animation runs once per launch, independently of network loading.
- Back closes the current panel, returns from matches to voting, or goes home. It never submits Leave. Home remembers the most recent unexpired room; Return restores membership, including an explicit rejoin after Leave.
- Country selection precedes providers. The complete provider grid scrolls inside the panel, in catalog country popularity order. Search is optional; selecting a provider does not reorder the list.
- The room has a constant dark amber gradient. Poster changes no longer change or load a full-screen background.

## Montenegro diagnosis

The old YepWatch metadata adapter ignored its country argument and returned the global list (964 services in the live reproduction). GoodWatch's Montenegro endpoint returned 21 country services. The adapter now filters the catalog's `order_by_country` map before grouping brand aliases and sorts by country rank. A rank of zero is valid. Unsupported countries produce an empty list, not worldwide fallback. No provider records or other database data were changed.

## Checks

Focused checks cover country filtering/rank/aliases, 65 scrollable provider choices, country changes, Back without Leave, saved-room return across reload, explicit rejoin, a stable background, and compact/landscape layouts. Native launch behavior requires the rebuilt binary; an older TestFlight installation does not acquire the native splash configuration from a website deployment.
