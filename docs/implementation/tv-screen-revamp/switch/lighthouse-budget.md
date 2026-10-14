### home: /, the new TV (this branch, a production build without services)

Pass: median of 3, observed FCP 498 ms, CPU benchmark 1,362, CPU slowdown 2.7.

| Line | Measured | Budget | Target | Gap to target | Result |
| --- | --- | --- | --- | --- | --- |
| HTML, compressed | 17.6 KB | max 20.0 KB |  |  | Pass |
| Site and static host requests | 24 | max 37 |  |  | Pass |
| Requests to the webapp host | 24 |  |  |  | Info |
| Requests to the static hostname | 0 |  |  |  | Info |
| Scripts | 11 | max 16 |  |  | Pass |
| Script bytes | 195.3 KB | max 256.0 KB |  |  | Pass |
| Images before scrolling | 7 | max 32 |  |  | Pass |
| Image bytes before scrolling | 91.4 KB | max 370.0 KB |  |  | Pass |
| Font requests | 1 | max 2 |  |  | Pass |
| Render-blocking requests | 2 | max 2 |  |  | Pass |
| Third-party origins | 0 | max 1 |  |  | Pass |
| Total bytes | 379.2 KB | max 750.0 KB |  |  | Pass |
| LCP | 3,308 ms | max 6,050 ms | 2,500 ms | 808 ms | Pass |
| TBT | 18 ms | max 150 ms | 200 ms | met | Pass |
| CLS | 0.000 | max 0.010 | 0.100 | met | Pass |
| Performance score | 88 | min 63 | 90 | 2 | Pass |
| LCP element | 3 of 3 runs | <img> with "/assets/room-phone-" or "/assets/hand-" |  |  | Pass |

Budget: pass

### home: /, the old TV (origin/main at 8cf806a1, the same build settings and machine)

Fail: median of 3, observed FCP 365 ms, CPU benchmark 1,820, CPU slowdown 2.7.

| Line | Measured | Budget | Target | Gap to target | Result |
| --- | --- | --- | --- | --- | --- |
| HTML, compressed | 17.1 KB | max 20.0 KB |  |  | Pass |
| Site and static host requests | 41 | max 37 |  |  | Fail |
| Requests to the webapp host | 41 |  |  |  | Info |
| Requests to the static hostname | 0 |  |  |  | Info |
| Scripts | 24 | max 16 |  |  | Fail |
| Script bytes | 617.8 KB | max 256.0 KB |  |  | Fail |
| Images before scrolling | 7 | max 32 |  |  | Pass |
| Image bytes before scrolling | 145.2 KB | max 370.0 KB |  |  | Pass |
| Font requests | 1 | max 2 |  |  | Pass |
| Render-blocking requests | 2 | max 2 |  |  | Pass |
| Third-party origins | 1 | max 1 |  |  | Pass |
| Total bytes | 854.0 KB | max 750.0 KB |  |  | Fail |
| LCP | 3,982 ms | max 6,050 ms | 2,500 ms | 1,482 ms | Pass |
| TBT | 255 ms | max 150 ms | 200 ms | 55 ms | Fail |
| CLS | 0.000 | max 0.010 | 0.100 | met | Pass |
| Performance score | 78 | min 63 | 90 | 12 | Pass |
| LCP element | 3 of 3 runs | <img> with "/assets/room-phone-" or "/assets/hand-" |  |  | Pass |

Budget: FAIL (home)
