# Comparison: 20261004T025440Z-load-baseline-surface-title-show vs 20261004T192308Z-load-checkpoint-surface-title-show

**Warning:** Runs differ in rate_plan; they are not directly comparable.

Deltas are B minus A. Error rates are fractions.

## Load totals

| Metric | A | B | Delta | Delta % |
| --- | --- | --- | --- | --- |
| duration_s | 57.908 | 1010.035 | 952.127 | 1644.205 |
| requests | 80 | 90472 | 90392 | 112990 |
| rps | 1.382 | 89.573 | 88.192 | 6383.758 |
| error_rate | 0 | 0 | 0 | n/a |
| latency_ms.p50 | 902.164 | 4.807 | -897.357 | -99.467 |
| latency_ms.p95 | 3713.744 | 21.721 | -3692.023 | -99.415 |
| latency_ms.p99 | 4031.775 | 85.189 | -3946.586 | -97.887 |
| ttfb_ms.p95 | 342.166 | 19.858 | -322.308 | -94.196 |
| dropped_iterations | 0 | 0 | 0 | n/a |

## Route: title_show

| Metric | A | B | Delta | Delta % |
| --- | --- | --- | --- | --- |
| rps | 1.382 | 89.573 | 88.192 | 6383.758 |
| error_rate | 0 | 0 | 0 | n/a |
| latency_ms.p50 | 902.164 | 4.807 | -897.357 | -99.467 |
| latency_ms.p95 | 3713.744 | 21.721 | -3692.023 | -99.415 |
| latency_ms.p99 | 4031.775 | 85.189 | -3946.586 | -97.887 |
| ttfb_ms.p95 | 342.166 | 19.858 | -322.308 | -94.196 |

## Host: abusive

| Metric | A | B | Delta | Delta % |
| --- | --- | --- | --- | --- |
| cpu_busy_pct.avg | 38.963 | 19.371 | -19.592 | -50.283 |
| cpu_busy_pct.max | 44.324 | 40.864 | -3.46 | -7.806 |
| load1.avg | 2.927 | 1.569 | -1.359 | -46.413 |
| load1.max | 3.18 | 3.16 | -0.02 | -0.629 |
| mem_used_pct.avg | 34.126 | 33.791 | -0.334 | -0.98 |
| mem_used_pct.max | 34.281 | 36.085 | 1.804 | 5.263 |

## Container: abusive/coolify-proxy

| Metric | A | B | Delta | Delta % |
| --- | --- | --- | --- | --- |
| cpu_pct.avg | 115.805 | 59.498 | -56.307 | -48.622 |
| cpu_pct.max | 159.43 | 162.76 | 3.33 | 2.089 |
| mem_mb.avg | 246.092 | 139.38 | -106.712 | -43.363 |
| mem_mb.max | 249.6 | 246.9 | -2.7 | -1.082 |

## Container: abusive/gk4owk8-012330965771

| Metric | A | B | Delta | Delta % |
| --- | --- | --- | --- | --- |
| cpu_pct.avg | 129.632 | n/a | n/a | n/a |
| cpu_pct.max | 152.1 | n/a | n/a | n/a |
| mem_mb.avg | 2636.373 | n/a | n/a | n/a |
| mem_mb.max | 2640.896 | n/a | n/a | n/a |

## Container: abusive/gk4owk8-181009560892

| Metric | A | B | Delta | Delta % |
| --- | --- | --- | --- | --- |
| cpu_pct.avg | n/a | 36.75 | n/a | n/a |
| cpu_pct.max | n/a | 251.72 | n/a | n/a |
| mem_mb.avg | n/a | 2127.678 | n/a | n/a |
| mem_mb.max | n/a | 2203.648 | n/a | n/a |

## Host: gw-cache1

| Metric | A | B | Delta | Delta % |
| --- | --- | --- | --- | --- |
| cpu_busy_pct.avg | 3.902 | 3.506 | -0.396 | -10.16 |
| cpu_busy_pct.max | 14.715 | 18.383 | 3.668 | 24.927 |
| load1.avg | 0.192 | 0.235 | 0.043 | 22.492 |
| load1.max | 0.26 | 0.62 | 0.36 | 138.462 |
| mem_used_pct.avg | 35.771 | 34.902 | -0.869 | -2.428 |
| mem_used_pct.max | 35.993 | 35.483 | -0.509 | -1.415 |

## Host: gw-cache2

| Metric | A | B | Delta | Delta % |
| --- | --- | --- | --- | --- |
| cpu_busy_pct.avg | n/a | 3.673 | n/a | n/a |
| cpu_busy_pct.max | n/a | 20.089 | n/a | n/a |
| load1.avg | n/a | 0.269 | n/a | n/a |
| load1.max | n/a | 0.82 | n/a | n/a |
| mem_used_pct.avg | n/a | 34.395 | n/a | n/a |
| mem_used_pct.max | n/a | 35.031 | n/a | n/a |

## Host: gw-cache3

| Metric | A | B | Delta | Delta % |
| --- | --- | --- | --- | --- |
| cpu_busy_pct.avg | 7.001 | 3.682 | -3.318 | -47.399 |
| cpu_busy_pct.max | 20.382 | 19.501 | -0.881 | -4.322 |
| load1.avg | 0.518 | 0.279 | -0.24 | -46.251 |
| load1.max | 0.68 | 0.88 | 0.2 | 29.412 |
| mem_used_pct.avg | 35.503 | 34.51 | -0.994 | -2.798 |
| mem_used_pct.max | 35.826 | 35.081 | -0.744 | -2.077 |

## Host: gw-vector1

| Metric | A | B | Delta | Delta % |
| --- | --- | --- | --- | --- |
| cpu_busy_pct.avg | 6.79 | 21.182 | 14.392 | 211.97 |
| cpu_busy_pct.max | 8.91 | 81.399 | 72.489 | 813.569 |
| load1.avg | 1.118 | 3.34 | 2.222 | 198.69 |
| load1.max | 1.29 | 12.42 | 11.13 | 862.791 |
| mem_used_pct.avg | 39.701 | 49.657 | 9.956 | 25.077 |
| mem_used_pct.max | 39.937 | 52.884 | 12.946 | 32.417 |

## Container: gw-vector1/coolify-proxy

| Metric | A | B | Delta | Delta % |
| --- | --- | --- | --- | --- |
| cpu_pct.avg | n/a | 10.299 | n/a | n/a |
| cpu_pct.max | n/a | 48.88 | n/a | n/a |
| mem_mb.avg | n/a | 37.629 | n/a | n/a |
| mem_mb.max | n/a | 88.61 | n/a | n/a |

## Container: gw-vector1/gk4owk8-181159928589

| Metric | A | B | Delta | Delta % |
| --- | --- | --- | --- | --- |
| cpu_pct.avg | n/a | 26.648 | n/a | n/a |
| cpu_pct.max | n/a | 150.68 | n/a | n/a |
| mem_mb.avg | n/a | 2173.825 | n/a | n/a |
| mem_mb.max | n/a | 2286.592 | n/a | n/a |

## Container: gw-vector1/qdrant-main

| Metric | A | B | Delta | Delta % |
| --- | --- | --- | --- | --- |
| cpu_pct.avg | n/a | 217.901 | n/a | n/a |
| cpu_pct.max | n/a | 1241.79 | n/a | n/a |
| mem_mb.avg | n/a | 4687.495 | n/a | n/a |
| mem_mb.max | n/a | 5687.296 | n/a | n/a |

## Host: gw-worker3

| Metric | A | B | Delta | Delta % |
| --- | --- | --- | --- | --- |
| cpu_busy_pct.avg | 8.686 | 10.522 | 1.836 | 21.138 |
| cpu_busy_pct.max | 18.938 | 36.462 | 17.524 | 92.534 |
| load1.avg | 0.351 | 0.429 | 0.078 | 22.269 |
| load1.max | 0.42 | 1.14 | 0.72 | 171.429 |
| mem_used_pct.avg | 16.509 | 25.859 | 9.35 | 56.636 |
| mem_used_pct.max | 16.871 | 27.382 | 10.511 | 62.305 |

## Host: host-5

| Metric | A | B | Delta | Delta % |
| --- | --- | --- | --- | --- |
| cpu_busy_pct.avg | n/a | n/a | n/a | n/a |
| cpu_busy_pct.max | n/a | n/a | n/a | n/a |
| load1.avg | n/a | n/a | n/a | n/a |
| load1.max | n/a | n/a | n/a | n/a |
| mem_used_pct.avg | n/a | n/a | n/a | n/a |
| mem_used_pct.max | n/a | n/a | n/a | n/a |

## Host: pgnode01

| Metric | A | B | Delta | Delta % |
| --- | --- | --- | --- | --- |
| cpu_busy_pct.avg | 5.045 | 7.361 | 2.317 | 45.92 |
| cpu_busy_pct.max | 10.239 | 15.46 | 5.221 | 50.991 |
| load1.avg | 0.612 | 1.802 | 1.19 | 194.538 |
| load1.max | 0.89 | 6.2 | 5.31 | 596.629 |
| mem_used_pct.avg | 70.797 | 70.445 | -0.353 | -0.498 |
| mem_used_pct.max | 71.3 | 70.573 | -0.727 | -1.02 |

## Host: pgnode02

| Metric | A | B | Delta | Delta % |
| --- | --- | --- | --- | --- |
| cpu_busy_pct.avg | 5.503 | 8.197 | 2.693 | 48.938 |
| cpu_busy_pct.max | 7.626 | 20.837 | 13.211 | 173.236 |
| load1.avg | 0.55 | 1.886 | 1.336 | 242.994 |
| load1.max | 0.6 | 4.54 | 3.94 | 656.667 |
| mem_used_pct.avg | 71.503 | 71.624 | 0.121 | 0.17 |
| mem_used_pct.max | 71.528 | 72.781 | 1.253 | 1.752 |

## Host: pgnode03

| Metric | A | B | Delta | Delta % |
| --- | --- | --- | --- | --- |
| cpu_busy_pct.avg | 6.382 | 8.786 | 2.403 | 37.657 |
| cpu_busy_pct.max | 9.663 | 19.153 | 9.49 | 98.21 |
| load1.avg | 0.653 | 1.215 | 0.562 | 86.031 |
| load1.max | 0.84 | 3.1 | 2.26 | 269.048 |
| mem_used_pct.avg | 65.456 | 65.432 | -0.024 | -0.037 |
| mem_used_pct.max | 65.579 | 65.63 | 0.052 | 0.079 |

