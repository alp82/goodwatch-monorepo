### home: /home-preview, the new TV

Fail: median of 3, observed FCP 658 ms, CPU benchmark 1,207, CPU slowdown 2.7.

| Line | Measured | Budget | Target | Gap to target | Result |
| --- | --- | --- | --- | --- | --- |
| HTML, compressed | 16.9 KB | max 20.0 KB |  |  | Pass |
| Site and static host requests | 27 | max 37 |  |  | Pass |
| Requests to the webapp host | 27 |  |  |  | Info |
| Requests to the static hostname | 0 |  |  |  | Info |
| Scripts | 13 | max 16 |  |  | Pass |
| Script bytes | 201.4 KB | max 256.0 KB |  |  | Pass |
| Images before scrolling | 7 | max 32 |  |  | Pass |
| Image bytes before scrolling | 91.4 KB | max 370.0 KB |  |  | Pass |
| Font requests | 1 | max 2 |  |  | Pass |
| Render-blocking requests | 3 | max 2 |  |  | Fail |
| Third-party origins | 0 | max 1 |  |  | Pass |
| Total bytes | 386.8 KB | max 750.0 KB |  |  | Pass |
| LCP | 3,382 ms | max 6,050 ms | 2,500 ms | 882 ms | Pass |
| TBT | 47 ms | max 150 ms | 200 ms | met | Pass |
| CLS | 0.000 | max 0.010 | 0.100 | met | Pass |
| Performance score | 87 | min 63 | 90 | 3 | Pass |
| LCP element | 0 of 3 runs, found <img> from http://localhost:3196 | <img> with "/assets/room-phone-" |  |  | Fail |

### old: /, today's TV, the same build and machine

Fail: median of 3, observed FCP 606 ms, CPU benchmark 1,245, CPU slowdown 2.7.

| Line | Measured | Budget | Target | Gap to target | Result |
| --- | --- | --- | --- | --- | --- |
| HTML, compressed | 17.1 KB | max 20.0 KB |  |  | Pass |
| Site and static host requests | 43 | max 37 |  |  | Fail |
| Requests to the webapp host | 43 |  |  |  | Info |
| Requests to the static hostname | 0 |  |  |  | Info |
| Scripts | 26 | max 16 |  |  | Fail |
| Script bytes | 622.3 KB | max 256.0 KB |  |  | Fail |
| Images before scrolling | 7 | max 32 |  |  | Pass |
| Image bytes before scrolling | 145.2 KB | max 370.0 KB |  |  | Pass |
| Font requests | 1 | max 2 |  |  | Pass |
| Render-blocking requests | 2 | max 2 |  |  | Pass |
| Third-party origins | 1 | max 1 |  |  | Pass |
| Total bytes | 859.0 KB | max 750.0 KB |  |  | Fail |
| LCP | 4,068 ms | max 6,050 ms | 2,500 ms | 1,568 ms | Pass |
| TBT | 462 ms | max 150 ms | 200 ms | 262 ms | Fail |
| CLS | 0.000 | max 0.010 | 0.100 | met | Pass |
| Performance score | 70 | min 63 | 90 | 20 | Pass |
| LCP element | 3 of 3 runs | <img> with "/assets/room-phone-" |  |  | Pass |

Budget: FAIL (home, old)
