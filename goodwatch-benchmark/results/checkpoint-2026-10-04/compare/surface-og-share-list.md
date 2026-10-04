# Comparison: 20261004T031849Z-load-baseline-surface-og-share-list vs 20261004T210313Z-load-checkpoint-surface-og-share-list

**Warning:** Runs differ in rate_plan; they are not directly comparable.

Deltas are B minus A. Error rates are fractions.

## Load totals

| Metric | A | B | Delta | Delta % |
| --- | --- | --- | --- | --- |
| duration_s | 415.074 | 865.073 | 449.998 | 108.414 |
| requests | 5937 | 77354 | 71417 | 1202.914 |
| rps | 14.303 | 89.419 | 75.116 | 525.157 |
| error_rate | 0 | 0 | 0 | n/a |
| latency_ms.p50 | 34.22 | 10.315 | -23.905 | -69.857 |
| latency_ms.p95 | 136.888 | 45.258 | -91.631 | -66.938 |
| latency_ms.p99 | 206.695 | 97.266 | -109.429 | -52.942 |
| ttfb_ms.p95 | 133.697 | 40.976 | -92.721 | -69.351 |
| dropped_iterations | 0 | 0 | 0 | n/a |

## Route: og_share_list

| Metric | A | B | Delta | Delta % |
| --- | --- | --- | --- | --- |
| rps | 14.303 | 89.419 | 75.116 | 525.157 |
| error_rate | 0 | 0 | 0 | n/a |
| latency_ms.p50 | 34.22 | 10.315 | -23.905 | -69.857 |
| latency_ms.p95 | 136.888 | 45.258 | -91.631 | -66.938 |
| latency_ms.p99 | 206.695 | 97.266 | -109.429 | -52.942 |
| ttfb_ms.p95 | 133.697 | 40.976 | -92.721 | -69.351 |

## Host: abusive

| Metric | A | B | Delta | Delta % |
| --- | --- | --- | --- | --- |
| cpu_busy_pct.avg | 35.648 | 20.557 | -15.091 | -42.333 |
| cpu_busy_pct.max | 47.221 | 46.687 | -0.534 | -1.131 |
| load1.avg | 3.305 | 1.74 | -1.566 | -47.37 |
| load1.max | 4.37 | 3.87 | -0.5 | -11.442 |
| mem_used_pct.avg | 34.219 | 34.222 | 0.003 | 0.009 |
| mem_used_pct.max | 34.719 | 34.812 | 0.093 | 0.267 |

## Container: abusive/coolify-proxy

| Metric | A | B | Delta | Delta % |
| --- | --- | --- | --- | --- |
| cpu_pct.avg | 119.483 | 71.251 | -48.232 | -40.367 |
| cpu_pct.max | 168 | 208.08 | 40.08 | 23.857 |
| mem_mb.avg | 258.824 | 133.786 | -125.038 | -48.31 |
| mem_mb.max | 265.3 | 163.1 | -102.2 | -38.522 |

## Container: abusive/gk4owk8-012330965771

| Metric | A | B | Delta | Delta % |
| --- | --- | --- | --- | --- |
| cpu_pct.avg | 104.234 | n/a | n/a | n/a |
| cpu_pct.max | 228.73 | n/a | n/a | n/a |
| mem_mb.avg | 2648.73 | n/a | n/a | n/a |
| mem_mb.max | 2654.208 | n/a | n/a | n/a |

## Container: abusive/gk4owk8-181009560892

| Metric | A | B | Delta | Delta % |
| --- | --- | --- | --- | --- |
| cpu_pct.avg | n/a | 40.324 | n/a | n/a |
| cpu_pct.max | n/a | 159.09 | n/a | n/a |
| mem_mb.avg | n/a | 2218.127 | n/a | n/a |
| mem_mb.max | n/a | 2241.536 | n/a | n/a |

## Host: gw-cache1

| Metric | A | B | Delta | Delta % |
| --- | --- | --- | --- | --- |
| cpu_busy_pct.avg | 3.637 | 3.291 | -0.346 | -9.525 |
| cpu_busy_pct.max | 16.568 | 18.607 | 2.039 | 12.307 |
| load1.avg | 0.281 | 0.243 | -0.038 | -13.607 |
| load1.max | 0.53 | 0.62 | 0.09 | 16.981 |
| mem_used_pct.avg | 35.766 | 34.228 | -1.538 | -4.299 |
| mem_used_pct.max | 36.019 | 34.804 | -1.216 | -3.375 |

## Host: gw-cache2

| Metric | A | B | Delta | Delta % |
| --- | --- | --- | --- | --- |
| cpu_busy_pct.avg | 3.178 | 3.277 | 0.099 | 3.113 |
| cpu_busy_pct.max | 14.272 | 18.307 | 4.035 | 28.272 |
| load1.avg | 0.219 | 0.219 | 0 | 0.01 |
| load1.max | 0.61 | 0.58 | -0.03 | -4.918 |
| mem_used_pct.avg | 35.709 | 33.665 | -2.044 | -5.724 |
| mem_used_pct.max | 36.041 | 34.167 | -1.873 | -5.198 |

## Host: gw-cache3

| Metric | A | B | Delta | Delta % |
| --- | --- | --- | --- | --- |
| cpu_busy_pct.avg | 3.313 | 3.606 | 0.292 | 8.826 |
| cpu_busy_pct.max | 16.596 | 18.5 | 1.904 | 11.473 |
| load1.avg | 0.297 | 0.283 | -0.014 | -4.714 |
| load1.max | 0.53 | 0.63 | 0.1 | 18.868 |
| mem_used_pct.avg | 35.46 | 33.971 | -1.489 | -4.2 |
| mem_used_pct.max | 35.702 | 34.477 | -1.225 | -3.432 |

## Host: gw-vector1

| Metric | A | B | Delta | Delta % |
| --- | --- | --- | --- | --- |
| cpu_busy_pct.avg | 6.377 | 12.88 | 6.502 | 101.958 |
| cpu_busy_pct.max | 11.638 | 29.185 | 17.547 | 150.773 |
| load1.avg | 1.285 | 2.305 | 1.02 | 79.334 |
| load1.max | 1.68 | 4.82 | 3.14 | 186.905 |
| mem_used_pct.avg | 39.749 | 49.076 | 9.326 | 23.463 |
| mem_used_pct.max | 40.022 | 50.168 | 10.146 | 25.352 |

## Container: gw-vector1/coolify-proxy

| Metric | A | B | Delta | Delta % |
| --- | --- | --- | --- | --- |
| cpu_pct.avg | n/a | 12.18 | n/a | n/a |
| cpu_pct.max | n/a | 54.73 | n/a | n/a |
| mem_mb.avg | n/a | 41.383 | n/a | n/a |
| mem_mb.max | n/a | 68.13 | n/a | n/a |

## Container: gw-vector1/gk4owk8-181159928589

| Metric | A | B | Delta | Delta % |
| --- | --- | --- | --- | --- |
| cpu_pct.avg | n/a | 42.026 | n/a | n/a |
| cpu_pct.max | n/a | 176.25 | n/a | n/a |
| mem_mb.avg | n/a | 2247.245 | n/a | n/a |
| mem_mb.max | n/a | 2323.456 | n/a | n/a |

## Container: gw-vector1/qdrant-main

| Metric | A | B | Delta | Delta % |
| --- | --- | --- | --- | --- |
| cpu_pct.avg | n/a | 32.557 | n/a | n/a |
| cpu_pct.max | n/a | 142.83 | n/a | n/a |
| mem_mb.avg | n/a | 4054.885 | n/a | n/a |
| mem_mb.max | n/a | 4173.824 | n/a | n/a |

## Host: gw-worker3

| Metric | A | B | Delta | Delta % |
| --- | --- | --- | --- | --- |
| cpu_busy_pct.avg | 7.245 | 12.074 | 4.829 | 66.646 |
| cpu_busy_pct.max | 18.168 | 43.239 | 25.071 | 137.995 |
| load1.avg | 0.317 | 0.393 | 0.076 | 23.968 |
| load1.max | 0.69 | 1.49 | 0.8 | 115.942 |
| mem_used_pct.avg | 16.132 | 26.027 | 9.895 | 61.34 |
| mem_used_pct.max | 17.053 | 27.484 | 10.431 | 61.171 |

## Host: pgnode01

| Metric | A | B | Delta | Delta % |
| --- | --- | --- | --- | --- |
| cpu_busy_pct.avg | 5.118 | 6.382 | 1.265 | 24.71 |
| cpu_busy_pct.max | 9.723 | 10.715 | 0.992 | 10.203 |
| load1.avg | 0.602 | 1.118 | 0.516 | 85.685 |
| load1.max | 1.19 | 4.19 | 3 | 252.101 |
| mem_used_pct.avg | 70.663 | 70.467 | -0.196 | -0.277 |
| mem_used_pct.max | 70.932 | 70.591 | -0.34 | -0.48 |

## Host: pgnode02

| Metric | A | B | Delta | Delta % |
| --- | --- | --- | --- | --- |
| cpu_busy_pct.avg | 5.166 | 6.346 | 1.18 | 22.84 |
| cpu_busy_pct.max | 14.086 | 13.152 | -0.934 | -6.631 |
| load1.avg | 0.926 | 1.197 | 0.271 | 29.243 |
| load1.max | 2.95 | 3.25 | 0.3 | 10.169 |
| mem_used_pct.avg | 72.367 | 71.569 | -0.798 | -1.102 |
| mem_used_pct.max | 72.476 | 71.627 | -0.85 | -1.172 |

## Host: pgnode03

| Metric | A | B | Delta | Delta % |
| --- | --- | --- | --- | --- |
| cpu_busy_pct.avg | 5.742 | 7.98 | 2.238 | 38.969 |
| cpu_busy_pct.max | 15.618 | 13.333 | -2.285 | -14.631 |
| load1.avg | 1.333 | 1.932 | 0.599 | 44.921 |
| load1.max | 3.57 | 5.13 | 1.56 | 43.697 |
| mem_used_pct.avg | 65.458 | 65.479 | 0.021 | 0.032 |
| mem_used_pct.max | 65.564 | 65.615 | 0.051 | 0.078 |

