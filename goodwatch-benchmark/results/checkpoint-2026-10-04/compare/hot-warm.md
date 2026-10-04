# Comparison: 20261004T024106Z-load-baseline-hot-warm vs 20261004T182537Z-load-checkpoint-hot-warm

**Warning:** Runs differ in rate_plan; they are not directly comparable.

Deltas are B minus A. Error rates are fractions.

## Load totals

| Metric | A | B | Delta | Delta % |
| --- | --- | --- | --- | --- |
| duration_s | 101.879 | 1010.428 | 908.549 | 891.796 |
| requests | 216 | 90475 | 90259 | 41786.574 |
| rps | 2.12 | 89.541 | 87.421 | 4123.305 |
| error_rate | 0 | 0 | 0 | n/a |
| latency_ms.p50 | 347.333 | 4.843 | -342.49 | -98.606 |
| latency_ms.p95 | 2790.754 | 17.561 | -2773.193 | -99.371 |
| latency_ms.p99 | 5048.88 | 38.107 | -5010.773 | -99.245 |
| ttfb_ms.p95 | 319.327 | 15.822 | -303.505 | -95.045 |
| dropped_iterations | 0 | 0 | 0 | n/a |

## Route: discover

| Metric | A | B | Delta | Delta % |
| --- | --- | --- | --- | --- |
| rps | 0.147 | 6.342 | 6.195 | 4207.337 |
| error_rate | 0 | 0 | 0 | n/a |
| latency_ms.p50 | 644.808 | 4.421 | -640.387 | -99.314 |
| latency_ms.p95 | 4464.735 | 16.078 | -4448.657 | -99.64 |
| latency_ms.p99 | 4858.756 | 37.566 | -4821.19 | -99.227 |
| ttfb_ms.p95 | 331.675 | 15.109 | -316.566 | -95.445 |

## Route: home

| Metric | A | B | Delta | Delta % |
| --- | --- | --- | --- | --- |
| rps | 0.147 | 4.47 | 4.323 | 2936.242 |
| error_rate | 0 | 0 | 0 | n/a |
| latency_ms.p50 | 469.697 | 4.25 | -465.447 | -99.095 |
| latency_ms.p95 | 2365.145 | 15.89 | -2349.254 | -99.328 |
| latency_ms.p99 | 2661.719 | 38.633 | -2623.087 | -98.549 |
| ttfb_ms.p95 | 378.778 | 15.103 | -363.675 | -96.013 |

## Route: og_person

| Metric | A | B | Delta | Delta % |
| --- | --- | --- | --- | --- |
| rps | 0.02 | 0.894 | 0.874 | 4452.347 |
| error_rate | 0 | 0 | 0 | n/a |
| latency_ms.p50 | 25.243 | 9.938 | -15.305 | -60.63 |
| latency_ms.p95 | 34.861 | 25.965 | -8.896 | -25.519 |
| latency_ms.p99 | 35.716 | 46.493 | 10.777 | 30.173 |
| ttfb_ms.p95 | 25.997 | 23.983 | -2.014 | -7.745 |

## Route: og_share_list

| Metric | A | B | Delta | Delta % |
| --- | --- | --- | --- | --- |
| rps | 0.02 | 0.891 | 0.871 | 4437.223 |
| error_rate | 0 | 0 | 0 | n/a |
| latency_ms.p50 | 45.187 | 10.817 | -34.37 | -76.061 |
| latency_ms.p95 | 56.815 | 33.781 | -23.034 | -40.543 |
| latency_ms.p99 | 57.849 | 60.989 | 3.14 | 5.428 |
| ttfb_ms.p95 | 53.133 | 30.553 | -22.579 | -42.496 |

## Route: og_title

| Metric | A | B | Delta | Delta % |
| --- | --- | --- | --- | --- |
| rps | 0.049 | 3.654 | 3.605 | 7345.078 |
| error_rate | 0 | 0 | 0 | n/a |
| latency_ms.p50 | 32.804 | 10.371 | -22.433 | -68.386 |
| latency_ms.p95 | 126.169 | 27.994 | -98.174 | -77.812 |
| latency_ms.p99 | 141.423 | 59.743 | -81.68 | -57.756 |
| ttfb_ms.p95 | 97.795 | 25.285 | -72.51 | -74.145 |

## Route: person

| Metric | A | B | Delta | Delta % |
| --- | --- | --- | --- | --- |
| rps | 0.079 | 4.549 | 4.47 | 5692.521 |
| error_rate | 0 | 0 | 0 | n/a |
| latency_ms.p50 | 182.927 | 4.422 | -178.505 | -97.582 |
| latency_ms.p95 | 857.767 | 15.377 | -842.39 | -98.207 |
| latency_ms.p99 | 1096.356 | 36.471 | -1059.885 | -96.673 |
| ttfb_ms.p95 | 164.103 | 14.301 | -149.803 | -91.286 |

## Route: share_list

| Metric | A | B | Delta | Delta % |
| --- | --- | --- | --- | --- |
| rps | 0.177 | 8.14 | 7.963 | 4507.242 |
| error_rate | 0 | 0 | 0 | n/a |
| latency_ms.p50 | 160.639 | 4.356 | -156.284 | -97.289 |
| latency_ms.p95 | 833.321 | 16.25 | -817.071 | -98.05 |
| latency_ms.p99 | 1511.311 | 34.554 | -1476.757 | -97.714 |
| ttfb_ms.p95 | 216.432 | 15.018 | -201.414 | -93.061 |

## Route: title_movie

| Metric | A | B | Delta | Delta % |
| --- | --- | --- | --- | --- |
| rps | 1.345 | 56.185 | 54.84 | 4078.146 |
| error_rate | 0 | 0 | 0 | n/a |
| latency_ms.p50 | 457.505 | 4.835 | -452.671 | -98.943 |
| latency_ms.p95 | 3002.76 | 16.933 | -2985.828 | -99.436 |
| latency_ms.p99 | 5322.461 | 36.523 | -5285.938 | -99.314 |
| ttfb_ms.p95 | 296.808 | 15.185 | -281.623 | -94.884 |

## Route: title_show

| Metric | A | B | Delta | Delta % |
| --- | --- | --- | --- | --- |
| rps | 0.137 | 4.417 | 4.28 | 3114.226 |
| error_rate | 0 | 0 | 0 | n/a |
| latency_ms.p50 | 443.15 | 4.857 | -438.293 | -98.904 |
| latency_ms.p95 | 886.084 | 15.876 | -870.208 | -98.208 |
| latency_ms.p99 | 1046.104 | 33.644 | -1012.459 | -96.784 |
| ttfb_ms.p95 | 195.62 | 14.25 | -181.37 | -92.716 |

## Host: abusive

| Metric | A | B | Delta | Delta % |
| --- | --- | --- | --- | --- |
| cpu_busy_pct.avg | 37.812 | 17.225 | -20.587 | -54.446 |
| cpu_busy_pct.max | 46.972 | 33.79 | -13.182 | -28.064 |
| load1.avg | 3.296 | 1.374 | -1.922 | -58.305 |
| load1.max | 3.97 | 2.94 | -1.03 | -25.945 |
| mem_used_pct.avg | 33.427 | 33.174 | -0.253 | -0.757 |
| mem_used_pct.max | 33.695 | 34.198 | 0.503 | 1.494 |

## Container: abusive/coolify-proxy

| Metric | A | B | Delta | Delta % |
| --- | --- | --- | --- | --- |
| cpu_pct.avg | 115.061 | 55.921 | -59.14 | -51.399 |
| cpu_pct.max | 139.27 | 170.91 | 31.64 | 22.718 |
| mem_mb.avg | 251.15 | 128.899 | -122.251 | -48.676 |
| mem_mb.max | 253.4 | 181.3 | -72.1 | -28.453 |

## Container: abusive/gk4owk8-012330965771

| Metric | A | B | Delta | Delta % |
| --- | --- | --- | --- | --- |
| cpu_pct.avg | 119.268 | n/a | n/a | n/a |
| cpu_pct.max | 209.35 | n/a | n/a | n/a |
| mem_mb.avg | 2483.046 | n/a | n/a | n/a |
| mem_mb.max | 2494.464 | n/a | n/a | n/a |

## Container: abusive/gk4owk8-181009560892

| Metric | A | B | Delta | Delta % |
| --- | --- | --- | --- | --- |
| cpu_pct.avg | n/a | 32.199 | n/a | n/a |
| cpu_pct.max | n/a | 131.93 | n/a | n/a |
| mem_mb.avg | n/a | 2083.534 | n/a | n/a |
| mem_mb.max | n/a | 2181.12 | n/a | n/a |

## Host: gw-cache1

| Metric | A | B | Delta | Delta % |
| --- | --- | --- | --- | --- |
| cpu_busy_pct.avg | 2.956 | 2.948 | -0.009 | -0.293 |
| cpu_busy_pct.max | 7.593 | 19.167 | 11.574 | 152.43 |
| load1.avg | 0.261 | 0.25 | -0.011 | -4.219 |
| load1.max | 0.34 | 0.58 | 0.24 | 70.588 |
| mem_used_pct.avg | 35.723 | 35.24 | -0.484 | -1.354 |
| mem_used_pct.max | 35.987 | 35.722 | -0.265 | -0.737 |

## Host: gw-cache2

| Metric | A | B | Delta | Delta % |
| --- | --- | --- | --- | --- |
| cpu_busy_pct.avg | 3.304 | 4.249 | 0.944 | 28.576 |
| cpu_busy_pct.max | 8.66 | 25.542 | 16.882 | 194.942 |
| load1.avg | 0.115 | 0.368 | 0.253 | 220.043 |
| load1.max | 0.17 | 1.23 | 1.06 | 623.529 |
| mem_used_pct.avg | 35.419 | 34.99 | -0.429 | -1.21 |
| mem_used_pct.max | 35.513 | 37.381 | 1.868 | 5.26 |

## Host: gw-cache3

| Metric | A | B | Delta | Delta % |
| --- | --- | --- | --- | --- |
| cpu_busy_pct.avg | 3.151 | 3.228 | 0.077 | 2.451 |
| cpu_busy_pct.max | 7.878 | 17.596 | 9.718 | 123.356 |
| load1.avg | 0.288 | 0.322 | 0.035 | 12.1 |
| load1.max | 0.41 | 0.67 | 0.26 | 63.415 |
| mem_used_pct.avg | 35.376 | 34.898 | -0.479 | -1.354 |
| mem_used_pct.max | 35.622 | 35.625 | 0.003 | 0.009 |

## Host: gw-vector1

| Metric | A | B | Delta | Delta % |
| --- | --- | --- | --- | --- |
| cpu_busy_pct.avg | 6.165 | 9.412 | 3.247 | 52.663 |
| cpu_busy_pct.max | 11.261 | 22.186 | 10.925 | 97.016 |
| load1.avg | 0.652 | 1.773 | 1.121 | 171.917 |
| load1.max | 0.87 | 3.78 | 2.91 | 334.483 |
| mem_used_pct.avg | 39.644 | 48.137 | 8.493 | 21.423 |
| mem_used_pct.max | 39.89 | 48.419 | 8.528 | 21.379 |

## Container: gw-vector1/coolify-proxy

| Metric | A | B | Delta | Delta % |
| --- | --- | --- | --- | --- |
| cpu_pct.avg | n/a | 11.196 | n/a | n/a |
| cpu_pct.max | n/a | 49.97 | n/a | n/a |
| mem_mb.avg | n/a | 34.179 | n/a | n/a |
| mem_mb.max | n/a | 45.59 | n/a | n/a |

## Container: gw-vector1/gk4owk8-181159928589

| Metric | A | B | Delta | Delta % |
| --- | --- | --- | --- | --- |
| cpu_pct.avg | n/a | 30.417 | n/a | n/a |
| cpu_pct.max | n/a | 180.25 | n/a | n/a |
| mem_mb.avg | n/a | 2070.538 | n/a | n/a |
| mem_mb.max | n/a | 2084.864 | n/a | n/a |

## Container: gw-vector1/qdrant-main

| Metric | A | B | Delta | Delta % |
| --- | --- | --- | --- | --- |
| cpu_pct.avg | n/a | 28.392 | n/a | n/a |
| cpu_pct.max | n/a | 112.87 | n/a | n/a |
| mem_mb.avg | n/a | 4039.512 | n/a | n/a |
| mem_mb.max | n/a | 4051.968 | n/a | n/a |

## Host: gw-worker3

| Metric | A | B | Delta | Delta % |
| --- | --- | --- | --- | --- |
| cpu_busy_pct.avg | 8.257 | 10.502 | 2.244 | 27.181 |
| cpu_busy_pct.max | 21.371 | 43.924 | 22.553 | 105.531 |
| load1.avg | 0.22 | 0.396 | 0.177 | 80.487 |
| load1.max | 0.33 | 1.3 | 0.97 | 293.939 |
| mem_used_pct.avg | 16.569 | 27.031 | 10.462 | 63.143 |
| mem_used_pct.max | 16.852 | 28.359 | 11.507 | 68.283 |

## Host: pgnode01

| Metric | A | B | Delta | Delta % |
| --- | --- | --- | --- | --- |
| cpu_busy_pct.avg | 4.975 | 7.042 | 2.067 | 41.554 |
| cpu_busy_pct.max | 7.928 | 20.252 | 12.324 | 155.449 |
| load1.avg | 0.997 | 1.194 | 0.196 | 19.667 |
| load1.max | 1.28 | 3.62 | 2.34 | 182.812 |
| mem_used_pct.avg | 70.674 | 70.608 | -0.066 | -0.093 |
| mem_used_pct.max | 70.765 | 71.733 | 0.968 | 1.368 |

## Host: pgnode02

| Metric | A | B | Delta | Delta % |
| --- | --- | --- | --- | --- |
| cpu_busy_pct.avg | 4.435 | 6.735 | 2.299 | 51.84 |
| cpu_busy_pct.max | 6.729 | 14.54 | 7.811 | 116.08 |
| load1.avg | 0.644 | 0.971 | 0.327 | 50.774 |
| load1.max | 0.75 | 2.66 | 1.91 | 254.667 |
| mem_used_pct.avg | 71.502 | 71.549 | 0.048 | 0.067 |
| mem_used_pct.max | 71.619 | 71.718 | 0.099 | 0.138 |

## Host: pgnode03

| Metric | A | B | Delta | Delta % |
| --- | --- | --- | --- | --- |
| cpu_busy_pct.avg | 10.449 | 7.569 | -2.879 | -27.558 |
| cpu_busy_pct.max | 17.395 | 15.287 | -2.108 | -12.118 |
| load1.avg | 1.439 | 1.3 | -0.139 | -9.687 |
| load1.max | 1.98 | 4.4 | 2.42 | 122.222 |
| mem_used_pct.avg | 66.611 | 65.434 | -1.177 | -1.767 |
| mem_used_pct.max | 66.641 | 65.652 | -0.989 | -1.484 |

