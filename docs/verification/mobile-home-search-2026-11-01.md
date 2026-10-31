# Mobile Home navigation and start search parity

The mobile dock now reads Home, Watch, the centered G menu, Explore, Profile. The four links have equal columns; Profile uses its compact avatar and label. Home links directly to `/`.

Start text searches previously narrowed the ranking to saved services, then required either those services (`services=mine`) or any current local streaming offer (`services=any`) when filtering results. Discover defaults to `services=all`, including seen titles. The start search now shares Discover's default state for ranking eligibility and results filtering. Its mood/theme/style picks still accompany the query. The mood-only browsing behavior stays scoped as before. Search result counts say titles instead of claiming all results are on saved services.

Validation:

- 44 focused tests pass, covering start search, Discover request transport, and mood counts. The regression compares parsed start-search filters and sorting with its See all destination for viewers with and without saved services and with mood/theme/style picks.
- Production build passes.
- Playwright against the local production build at a 390px viewport verifies link order, equal 66px widths, and Home navigating from Discover to `/`. Screenshot: `/tmp/gw-home-mobile.png` (local artifact).
- Full typecheck reports 178 errors outside the changed files; none refer to the changed modules.
- Required `./bench.sh budget --where local --runs 1` ran against the unchanged production site, run `20261031T230057Z-lighthouse-mobile-home-search`. It fails the existing limits on home, movie, show, person, and share list; Discover passes. This is a production baseline, not a performance measurement of this change. No limits were raised.
