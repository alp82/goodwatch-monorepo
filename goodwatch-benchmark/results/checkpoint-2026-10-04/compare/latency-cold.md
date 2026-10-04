# Comparison: 20261004T032925Z-load-baseline-latency-cold vs 20261004T212523Z-load-checkpoint-latency-cold

Deltas are B minus A. Error rates are fractions.

## Load totals

| Metric | A | B | Delta | Delta % |
| --- | --- | --- | --- | --- |
| duration_s | 150.005 | 150.003 | -0.002 | -0.002 |
| requests | 299 | 299 | 0 | 0 |
| rps | 1.993 | 1.993 | 0 | 0.002 |
| error_rate | 0 | 0 | 0 | n/a |
| latency_ms.p50 | 160.23 | 11.379 | -148.851 | -92.898 |
| latency_ms.p95 | 783.268 | 131.625 | -651.643 | -83.195 |
| latency_ms.p99 | 1191.743 | 236.389 | -955.354 | -80.164 |
| ttfb_ms.p95 | 236.579 | 130.415 | -106.163 | -44.874 |
| dropped_iterations | 0 | 0 | 0 | n/a |

## Route: discover

| Metric | A | B | Delta | Delta % |
| --- | --- | --- | --- | --- |
| rps | 0.273 | 0.273 | 0 | 0.002 |
| error_rate | 0 | 0 | 0 | n/a |
| latency_ms.p50 | 225.67 | 5.952 | -219.717 | -97.362 |
| latency_ms.p95 | 686.57 | 184.49 | -502.08 | -73.129 |
| latency_ms.p99 | 793.044 | 202.385 | -590.659 | -74.48 |
| ttfb_ms.p95 | 267.043 | 183.311 | -83.732 | -31.355 |

## Route: home

| Metric | A | B | Delta | Delta % |
| --- | --- | --- | --- | --- |
| rps | 0.247 | 0.247 | 0 | 0.002 |
| error_rate | 0 | 0 | 0 | n/a |
| latency_ms.p50 | 82.535 | 6.649 | -75.886 | -91.944 |
| latency_ms.p95 | 264.898 | 60.027 | -204.871 | -77.34 |
| latency_ms.p99 | 331.05 | 77.787 | -253.263 | -76.503 |
| ttfb_ms.p95 | 92.618 | 53.408 | -39.21 | -42.335 |

## Route: og_share_list

| Metric | A | B | Delta | Delta % |
| --- | --- | --- | --- | --- |
| rps | 0.18 | 0.22 | 0.04 | 22.224 |
| error_rate | 0 | 0 | 0 | n/a |
| latency_ms.p50 | 39.337 | 11.004 | -28.333 | -72.027 |
| latency_ms.p95 | 122.365 | 21.273 | -101.092 | -82.615 |
| latency_ms.p99 | 191.125 | 32.774 | -158.351 | -82.852 |
| ttfb_ms.p95 | 118.604 | 14.088 | -104.515 | -88.122 |

## Route: og_title

| Metric | A | B | Delta | Delta % |
| --- | --- | --- | --- | --- |
| rps | 0.287 | 0.227 | -0.06 | -20.929 |
| error_rate | 0 | 0 | 0 | n/a |
| latency_ms.p50 | 21.2 | 11.055 | -10.145 | -47.855 |
| latency_ms.p95 | 74.187 | 27.434 | -46.753 | -63.021 |
| latency_ms.p99 | 88.375 | 36.062 | -52.313 | -59.195 |
| ttfb_ms.p95 | 59.039 | 24.993 | -34.045 | -57.666 |

## Route: person

| Metric | A | B | Delta | Delta % |
| --- | --- | --- | --- | --- |
| rps | 0.273 | 0.247 | -0.027 | -9.755 |
| error_rate | 0 | 0 | 0 | n/a |
| latency_ms.p50 | 156.943 | 9.961 | -146.982 | -93.653 |
| latency_ms.p95 | 457.957 | 60.671 | -397.287 | -86.752 |
| latency_ms.p99 | 974.408 | 66.167 | -908.241 | -93.21 |
| ttfb_ms.p95 | 113.165 | 59.466 | -53.7 | -47.452 |

## Route: share_list

| Metric | A | B | Delta | Delta % |
| --- | --- | --- | --- | --- |
| rps | 0.267 | 0.253 | -0.013 | -4.998 |
| error_rate | 0 | 0 | 0 | n/a |
| latency_ms.p50 | 183.081 | 33.749 | -149.332 | -81.566 |
| latency_ms.p95 | 591.938 | 93.933 | -498.005 | -84.131 |
| latency_ms.p99 | 656.499 | 107.223 | -549.276 | -83.667 |
| ttfb_ms.p95 | 218.074 | 87.784 | -130.29 | -59.746 |

## Route: title_movie

| Metric | A | B | Delta | Delta % |
| --- | --- | --- | --- | --- |
| rps | 0.233 | 0.26 | 0.027 | 11.43 |
| error_rate | 0 | 0 | 0 | n/a |
| latency_ms.p50 | 312.965 | 8.505 | -304.46 | -97.282 |
| latency_ms.p95 | 806.088 | 201.507 | -604.582 | -75.002 |
| latency_ms.p99 | 1044.023 | 278.016 | -766.006 | -73.371 |
| ttfb_ms.p95 | 253.059 | 199.607 | -53.452 | -21.122 |

## Route: title_show

| Metric | A | B | Delta | Delta % |
| --- | --- | --- | --- | --- |
| rps | 0.233 | 0.267 | 0.033 | 14.288 |
| error_rate | 0 | 0 | 0 | n/a |
| latency_ms.p50 | 561.127 | 8.373 | -552.754 | -98.508 |
| latency_ms.p95 | 1215.611 | 236.45 | -979.161 | -80.549 |
| latency_ms.p99 | 1480.014 | 242.928 | -1237.086 | -83.586 |
| ttfb_ms.p95 | 278.33 | 234.854 | -43.477 | -15.62 |

## Host: abusive

| Metric | A | B | Delta | Delta % |
| --- | --- | --- | --- | --- |
| cpu_busy_pct.avg | 36.404 | 14.55 | -21.855 | -60.033 |
| cpu_busy_pct.max | 45.152 | 23.473 | -21.679 | -48.013 |
| load1.avg | 2.876 | 1.094 | -1.782 | -61.955 |
| load1.max | 3.43 | 1.57 | -1.86 | -54.227 |
| mem_used_pct.avg | 34.254 | 34.494 | 0.24 | 0.7 |
| mem_used_pct.max | 34.496 | 35.046 | 0.551 | 1.596 |

## Container: abusive/coolify-proxy

| Metric | A | B | Delta | Delta % |
| --- | --- | --- | --- | --- |
| cpu_pct.avg | 114.424 | 32.543 | -81.881 | -71.559 |
| cpu_pct.max | 190.7 | 51.22 | -139.48 | -73.141 |
| mem_mb.avg | 249.183 | 93.661 | -155.522 | -62.413 |
| mem_mb.max | 254.6 | 95.4 | -159.2 | -62.529 |

## Container: abusive/gk4owk8-012330965771

| Metric | A | B | Delta | Delta % |
| --- | --- | --- | --- | --- |
| cpu_pct.avg | 113.491 | n/a | n/a | n/a |
| cpu_pct.max | 202.58 | n/a | n/a | n/a |
| mem_mb.avg | 2660.74 | n/a | n/a | n/a |
| mem_mb.max | 2668.544 | n/a | n/a | n/a |

## Container: abusive/gk4owk8-181009560892

| Metric | A | B | Delta | Delta % |
| --- | --- | --- | --- | --- |
| cpu_pct.avg | n/a | 23.907 | n/a | n/a |
| cpu_pct.max | n/a | 44.75 | n/a | n/a |
| mem_mb.avg | n/a | 2271.369 | n/a | n/a |
| mem_mb.max | n/a | 2305.024 | n/a | n/a |

## Host: gw-cache1

| Metric | A | B | Delta | Delta % |
| --- | --- | --- | --- | --- |
| cpu_busy_pct.avg | 9.304 | 10.183 | 0.879 | 9.445 |
| cpu_busy_pct.max | 26.096 | 24.528 | -1.568 | -6.009 |
| load1.avg | 0.61 | 0.641 | 0.031 | 5.027 |
| load1.max | 1.12 | 0.98 | -0.14 | -12.5 |
| mem_used_pct.avg | 37.455 | 35.494 | -1.961 | -5.236 |
| mem_used_pct.max | 38.532 | 36.786 | -1.745 | -4.529 |

## Host: gw-cache2

| Metric | A | B | Delta | Delta % |
| --- | --- | --- | --- | --- |
| cpu_busy_pct.avg | 4.317 | 4.611 | 0.294 | 6.815 |
| cpu_busy_pct.max | 18.748 | 18.739 | -0.009 | -0.048 |
| load1.avg | 0.208 | 0.24 | 0.032 | 15.57 |
| load1.max | 0.4 | 0.58 | 0.18 | 45 |
| mem_used_pct.avg | 35.61 | 33.558 | -2.052 | -5.762 |
| mem_used_pct.max | 35.799 | 33.992 | -1.806 | -5.046 |

## Host: gw-cache3

| Metric | A | B | Delta | Delta % |
| --- | --- | --- | --- | --- |
| cpu_busy_pct.avg | 2.437 | 2.028 | -0.409 | -16.782 |
| cpu_busy_pct.max | 6.595 | 5.655 | -0.94 | -14.253 |
| load1.avg | 0.321 | 0.266 | -0.055 | -17.198 |
| load1.max | 0.45 | 0.5 | 0.05 | 11.111 |
| mem_used_pct.avg | 35.423 | 33.803 | -1.62 | -4.574 |
| mem_used_pct.max | 35.625 | 34.019 | -1.607 | -4.51 |

## Host: gw-vector1

| Metric | A | B | Delta | Delta % |
| --- | --- | --- | --- | --- |
| cpu_busy_pct.avg | 8.258 | 10.466 | 2.208 | 26.731 |
| cpu_busy_pct.max | 13.096 | 15.674 | 2.578 | 19.685 |
| load1.avg | 1.286 | 1.347 | 0.062 | 4.796 |
| load1.max | 1.9 | 1.68 | -0.22 | -11.579 |
| mem_used_pct.avg | 39.838 | 49.121 | 9.283 | 23.302 |
| mem_used_pct.max | 40.25 | 49.29 | 9.04 | 22.459 |

## Container: gw-vector1/coolify-proxy

| Metric | A | B | Delta | Delta % |
| --- | --- | --- | --- | --- |
| cpu_pct.avg | n/a | 3.697 | n/a | n/a |
| cpu_pct.max | n/a | 8.27 | n/a | n/a |
| mem_mb.avg | n/a | 39.691 | n/a | n/a |
| mem_mb.max | n/a | 40.14 | n/a | n/a |

## Container: gw-vector1/gk4owk8-181159928589

| Metric | A | B | Delta | Delta % |
| --- | --- | --- | --- | --- |
| cpu_pct.avg | n/a | 42.447 | n/a | n/a |
| cpu_pct.max | n/a | 156.85 | n/a | n/a |
| mem_mb.avg | n/a | 2264.303 | n/a | n/a |
| mem_mb.max | n/a | 2269.184 | n/a | n/a |

## Container: gw-vector1/qdrant-main

| Metric | A | B | Delta | Delta % |
| --- | --- | --- | --- | --- |
| cpu_pct.avg | n/a | 36.654 | n/a | n/a |
| cpu_pct.max | n/a | 86.97 | n/a | n/a |
| mem_mb.avg | n/a | 4062.891 | n/a | n/a |
| mem_mb.max | n/a | 4072.448 | n/a | n/a |

## Host: gw-worker3

| Metric | A | B | Delta | Delta % |
| --- | --- | --- | --- | --- |
| cpu_busy_pct.avg | 8.482 | 4.626 | -3.856 | -45.465 |
| cpu_busy_pct.max | 16.809 | 13.7 | -3.109 | -18.496 |
| load1.avg | 0.453 | 0.275 | -0.178 | -39.294 |
| load1.max | 0.64 | 0.41 | -0.23 | -35.938 |
| mem_used_pct.avg | 15.967 | 19.365 | 3.398 | 21.284 |
| mem_used_pct.max | 16.79 | 19.855 | 3.065 | 18.257 |

## Host: pgnode01

| Metric | A | B | Delta | Delta % |
| --- | --- | --- | --- | --- |
| cpu_busy_pct.avg | 5.013 | 7.087 | 2.073 | 41.356 |
| cpu_busy_pct.max | 7.928 | 10.821 | 2.893 | 36.491 |
| load1.avg | 0.592 | 1.51 | 0.918 | 155.124 |
| load1.max | 0.78 | 2.18 | 1.4 | 179.487 |
| mem_used_pct.avg | 70.659 | 70.456 | -0.203 | -0.287 |
| mem_used_pct.max | 70.789 | 70.583 | -0.206 | -0.291 |

## Host: pgnode02

| Metric | A | B | Delta | Delta % |
| --- | --- | --- | --- | --- |
| cpu_busy_pct.avg | 4.648 | 7.158 | 2.509 | 53.981 |
| cpu_busy_pct.max | 8.079 | 11.814 | 3.735 | 46.231 |
| load1.avg | 0.956 | 0.879 | -0.077 | -8.089 |
| load1.max | 1.52 | 1.9 | 0.38 | 25 |
| mem_used_pct.avg | 72.395 | 71.575 | -0.821 | -1.133 |
| mem_used_pct.max | 72.512 | 71.601 | -0.911 | -1.257 |

## Host: pgnode03

| Metric | A | B | Delta | Delta % |
| --- | --- | --- | --- | --- |
| cpu_busy_pct.avg | 6.087 | 8.921 | 2.835 | 46.57 |
| cpu_busy_pct.max | 9.184 | 13.891 | 4.707 | 51.252 |
| load1.avg | 0.794 | 1.88 | 1.086 | 136.734 |
| load1.max | 1.98 | 2.54 | 0.56 | 28.283 |
| mem_used_pct.avg | 65.439 | 65.498 | 0.059 | 0.09 |
| mem_used_pct.max | 65.641 | 65.63 | -0.01 | -0.016 |

