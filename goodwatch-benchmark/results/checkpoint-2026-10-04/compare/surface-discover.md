# Comparison: 20261004T030119Z-load-baseline-surface-discover vs 20261004T200433Z-load-checkpoint-surface-discover

**Warning:** Runs differ in rate_plan; they are not directly comparable.

Deltas are B minus A. Error rates are fractions.

## Load totals

| Metric | A | B | Delta | Delta % |
| --- | --- | --- | --- | --- |
| duration_s | 109.917 | 1010.04 | 900.123 | 818.912 |
| requests | 249 | 90475 | 90226 | 36235.341 |
| rps | 2.265 | 89.576 | 87.31 | 3854.169 |
| error_rate | 0 | 0 | 0 | n/a |
| latency_ms.p50 | 323.022 | 4.332 | -318.689 | -98.659 |
| latency_ms.p95 | 2169.659 | 18.162 | -2151.496 | -99.163 |
| latency_ms.p99 | 5445.298 | 40.554 | -5404.743 | -99.255 |
| ttfb_ms.p95 | 273.463 | 17 | -256.463 | -93.784 |
| dropped_iterations | 0 | 0 | 0 | n/a |

## Route: discover

| Metric | A | B | Delta | Delta % |
| --- | --- | --- | --- | --- |
| rps | 2.265 | 89.576 | 87.31 | 3854.169 |
| error_rate | 0 | 0 | 0 | n/a |
| latency_ms.p50 | 323.022 | 4.332 | -318.689 | -98.659 |
| latency_ms.p95 | 2169.659 | 18.162 | -2151.496 | -99.163 |
| latency_ms.p99 | 5445.298 | 40.554 | -5404.743 | -99.255 |
| ttfb_ms.p95 | 273.463 | 17 | -256.463 | -93.784 |

## Host: abusive

| Metric | A | B | Delta | Delta % |
| --- | --- | --- | --- | --- |
| cpu_busy_pct.avg | 38.775 | 18.102 | -20.673 | -53.314 |
| cpu_busy_pct.max | 52.078 | 41.65 | -10.428 | -20.024 |
| load1.avg | 3.402 | 1.438 | -1.964 | -57.727 |
| load1.max | 3.94 | 2.61 | -1.33 | -33.756 |
| mem_used_pct.avg | 33.851 | 34.171 | 0.32 | 0.946 |
| mem_used_pct.max | 34.124 | 36.673 | 2.549 | 7.469 |

## Container: abusive/coolify-proxy

| Metric | A | B | Delta | Delta % |
| --- | --- | --- | --- | --- |
| cpu_pct.avg | 119.009 | 54.696 | -64.313 | -54.04 |
| cpu_pct.max | 146.39 | 160.04 | 13.65 | 9.324 |
| mem_mb.avg | 248.714 | 138.363 | -110.351 | -44.369 |
| mem_mb.max | 257.3 | 164.9 | -92.4 | -35.911 |

## Container: abusive/gk4owk8-012330965771

| Metric | A | B | Delta | Delta % |
| --- | --- | --- | --- | --- |
| cpu_pct.avg | 140.315 | n/a | n/a | n/a |
| cpu_pct.max | 226.73 | n/a | n/a | n/a |
| mem_mb.avg | 2578.572 | n/a | n/a | n/a |
| mem_mb.max | 2605.056 | n/a | n/a | n/a |

## Container: abusive/gk4owk8-181009560892

| Metric | A | B | Delta | Delta % |
| --- | --- | --- | --- | --- |
| cpu_pct.avg | n/a | 31.699 | n/a | n/a |
| cpu_pct.max | n/a | 132.37 | n/a | n/a |
| mem_mb.avg | n/a | 2156.106 | n/a | n/a |
| mem_mb.max | n/a | 2275.328 | n/a | n/a |

## Host: gw-cache1

| Metric | A | B | Delta | Delta % |
| --- | --- | --- | --- | --- |
| cpu_busy_pct.avg | 3.072 | 5.314 | 2.242 | 72.99 |
| cpu_busy_pct.max | 7.25 | 25.532 | 18.282 | 252.166 |
| load1.avg | 0.328 | 0.453 | 0.124 | 37.907 |
| load1.max | 0.56 | 1.18 | 0.62 | 110.714 |
| mem_used_pct.avg | 35.769 | 35.221 | -0.548 | -1.533 |
| mem_used_pct.max | 36.193 | 37.822 | 1.629 | 4.501 |

## Host: gw-cache2

| Metric | A | B | Delta | Delta % |
| --- | --- | --- | --- | --- |
| cpu_busy_pct.avg | 1.647 | 3.084 | 1.437 | 87.286 |
| cpu_busy_pct.max | 4.871 | 20.98 | 16.109 | 330.712 |
| load1.avg | 0.096 | 0.271 | 0.175 | 182.142 |
| load1.max | 0.19 | 0.71 | 0.52 | 273.684 |
| mem_used_pct.avg | 35.885 | 34.175 | -1.71 | -4.764 |
| mem_used_pct.max | 35.918 | 35.035 | -0.882 | -2.457 |

## Host: gw-cache3

| Metric | A | B | Delta | Delta % |
| --- | --- | --- | --- | --- |
| cpu_busy_pct.avg | 2.952 | 2.135 | -0.817 | -27.68 |
| cpu_busy_pct.max | 6.733 | 16.469 | 9.736 | 144.601 |
| load1.avg | 0.29 | 0.174 | -0.116 | -40.015 |
| load1.max | 0.39 | 0.61 | 0.22 | 56.41 |
| mem_used_pct.avg | 35.472 | 34.795 | -0.677 | -1.908 |
| mem_used_pct.max | 35.578 | 35.278 | -0.3 | -0.844 |

## Host: gw-vector1

| Metric | A | B | Delta | Delta % |
| --- | --- | --- | --- | --- |
| cpu_busy_pct.avg | 6.476 | 37.742 | 31.265 | 482.755 |
| cpu_busy_pct.max | 10.543 | 77.136 | 66.593 | 631.632 |
| load1.avg | 1.219 | 6.827 | 5.608 | 459.988 |
| load1.max | 1.55 | 11.68 | 10.13 | 653.548 |
| mem_used_pct.avg | 39.708 | 50.936 | 11.228 | 28.276 |
| mem_used_pct.max | 39.884 | 53.613 | 13.729 | 34.423 |

## Container: gw-vector1/coolify-proxy

| Metric | A | B | Delta | Delta % |
| --- | --- | --- | --- | --- |
| cpu_pct.avg | n/a | 9.883 | n/a | n/a |
| cpu_pct.max | n/a | 42.33 | n/a | n/a |
| mem_mb.avg | n/a | 40.418 | n/a | n/a |
| mem_mb.max | n/a | 52.35 | n/a | n/a |

## Container: gw-vector1/gk4owk8-181159928589

| Metric | A | B | Delta | Delta % |
| --- | --- | --- | --- | --- |
| cpu_pct.avg | n/a | 31.235 | n/a | n/a |
| cpu_pct.max | n/a | 171.07 | n/a | n/a |
| mem_mb.avg | n/a | 2162.785 | n/a | n/a |
| mem_mb.max | n/a | 2189.312 | n/a | n/a |

## Container: gw-vector1/qdrant-main

| Metric | A | B | Delta | Delta % |
| --- | --- | --- | --- | --- |
| cpu_pct.avg | n/a | 469.621 | n/a | n/a |
| cpu_pct.max | n/a | 1186.03 | n/a | n/a |
| mem_mb.avg | n/a | 4782.432 | n/a | n/a |
| mem_mb.max | n/a | 5283.84 | n/a | n/a |

## Host: gw-worker3

| Metric | A | B | Delta | Delta % |
| --- | --- | --- | --- | --- |
| cpu_busy_pct.avg | 7.709 | 9.613 | 1.904 | 24.697 |
| cpu_busy_pct.max | 14.006 | 34.838 | 20.832 | 148.736 |
| load1.avg | 0.339 | 0.407 | 0.068 | 20.134 |
| load1.max | 0.45 | 1.52 | 1.07 | 237.778 |
| mem_used_pct.avg | 16.424 | 25.893 | 9.469 | 57.653 |
| mem_used_pct.max | 17.129 | 27.332 | 10.202 | 59.561 |

## Host: pgnode01

| Metric | A | B | Delta | Delta % |
| --- | --- | --- | --- | --- |
| cpu_busy_pct.avg | 4.958 | 15.707 | 10.749 | 216.807 |
| cpu_busy_pct.max | 9.917 | 66.398 | 56.481 | 569.537 |
| load1.avg | 0.955 | 2.563 | 1.607 | 168.211 |
| load1.max | 1.61 | 4.69 | 3.08 | 191.304 |
| mem_used_pct.avg | 70.707 | 70.535 | -0.172 | -0.244 |
| mem_used_pct.max | 70.852 | 71.52 | 0.668 | 0.943 |

## Host: pgnode02

| Metric | A | B | Delta | Delta % |
| --- | --- | --- | --- | --- |
| cpu_busy_pct.avg | 4.16 | 18.084 | 13.924 | 334.73 |
| cpu_busy_pct.max | 6.865 | 70.677 | 63.812 | 929.527 |
| load1.avg | 0.485 | 2.865 | 2.38 | 491.183 |
| load1.max | 0.7 | 5.26 | 4.56 | 651.429 |
| mem_used_pct.avg | 72.336 | 71.48 | -0.856 | -1.183 |
| mem_used_pct.max | 72.427 | 72.779 | 0.352 | 0.487 |

## Host: pgnode03

| Metric | A | B | Delta | Delta % |
| --- | --- | --- | --- | --- |
| cpu_busy_pct.avg | 7.391 | 15.43 | 8.039 | 108.76 |
| cpu_busy_pct.max | 19.271 | 44.706 | 25.435 | 131.986 |
| load1.avg | 1.068 | 2.606 | 1.538 | 143.98 |
| load1.max | 1.56 | 4.4 | 2.84 | 182.051 |
| mem_used_pct.avg | 66.41 | 65.418 | -0.992 | -1.494 |
| mem_used_pct.max | 66.646 | 66.325 | -0.321 | -0.481 |

