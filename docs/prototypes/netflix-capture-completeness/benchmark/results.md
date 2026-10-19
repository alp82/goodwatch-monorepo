| Scenario | Route | Truth | Captured | Recall | Foreign | File says | Reason | Actions | Arrow clicks | Time (s) |
| --- | --- | ---: | ---: | ---: | ---: | --- | --- | ---: | ---: | ---: |
| S01 77 titles, de-DE, cards replaced | M0 | 77 | 77 | 100% | 0 | unknown | stopped | 17 | 13 | 20.5 |
| S01 77 titles, de-DE, cards replaced | M1 | 77 | 77 | 100% | 0 | complete | reached_total | 17 | 13 | 20.5 |
| S01 77 titles, de-DE, cards replaced | A | 77 | 77 | 100% | 0 | complete | reached_total | 3 | 12 | 27 |
| S02 40 titles, en label "My List" | M0 | 40 | 40 | 100% | 0 | unknown | stopped | 11 | 7 | 11.5 |
| S02 40 titles, en label "My List" | M1 | 40 | 40 | 100% | 0 | complete | reached_total | 11 | 7 | 11.5 |
| S02 40 titles, en label "My List" | A | 40 | 40 | 100% | 0 | complete | reached_total | 3 | 6 | 15 |
| S03 9 titles, all loaded at start | M0 | 9 | 9 | 100% | 0 | unknown | stopped | 6 | 2 | 4 |
| S03 9 titles, all loaded at start | M1 | 9 | 9 | 100% | 0 | complete | reached_total | 6 | 2 | 4 |
| S03 9 titles, all loaded at start | A | 9 | 9 | 100% | 0 | complete | reached_total | 3 | 1 | 3 |
| S04 77 titles, cards reused atomically | M0 | 77 | 77 | 100% | 0 | unknown | stopped | 17 | 13 | 20.5 |
| S04 77 titles, cards reused atomically | M1 | 77 | 77 | 100% | 0 | complete | reached_total | 17 | 13 | 20.5 |
| S04 77 titles, cards reused atomically | A | 77 | 77 | 100% | 0 | complete | reached_total | 3 | 12 | 27 |
| S05 77 titles, recycled link first, label 120 ms later | M0 | 77 | 10 | 13% | 0 | unknown | stopped | 17 | 13 | 20.5 |
| S05 77 titles, recycled link first, label 120 ms later | M1 | 77 | 77 | 100% | 0 | complete | reached_total | 17 | 13 | 20.5 |
| S05 77 titles, recycled link first, label 120 ms later | A | 77 | 77 | 100% | 0 | complete | reached_total | 3 | 12 | 27 |
| S06 77 titles, recycled label first, link 120 ms later | M0 | 77 | 10 | 13% | 0 | unknown | stopped | 17 | 13 | 20.5 |
| S06 77 titles, recycled label first, link 120 ms later | M1 | 77 | 77 | 100% | 0 | complete | reached_total | 17 | 13 | 20.5 |
| S06 77 titles, recycled label first, link 120 ms later | A | 77 | 77 | 100% | 0 | complete | reached_total | 3 | 12 | 27 |
| S07 77 titles, later pages load after 3 s | M0 | 77 | 67 | 87% | 0 | unknown | stopped | 17 | 13 | 20.5 |
| S07 77 titles, later pages load after 3 s | M1 | 77 | 77 | 100% | 0 | complete | reached_total | 31 | 26 | 41 |
| S07 77 titles, later pages load after 3 s | A | 77 | 77 | 100% | 0 | complete | reached_total | 3 | 12 | 37.5 |
| S08 Other rows share 3 My List IDs | M0 | 77 | 77 | 100% | 0 | unknown | stopped | 17 | 13 | 20.5 |
| S08 Other rows share 3 My List IDs | M1 | 77 | 77 | 100% | 0 | complete | reached_total | 17 | 13 | 20.5 |
| S08 Other rows share 3 My List IDs | A | 77 | 77 | 100% | 0 | complete | reached_total | 3 | 12 | 27 |
| S09 Two titles share a name, distinct IDs | M0 | 77 | 77 | 100% | 0 | unknown | stopped | 17 | 13 | 20.5 |
| S09 Two titles share a name, distinct IDs | M1 | 77 | 77 | 100% | 0 | complete | reached_total | 17 | 13 | 20.5 |
| S09 Two titles share a name, distinct IDs | A | 77 | 77 | 100% | 0 | complete | reached_total | 3 | 12 | 27 |
| S10 30 counted, 2 never rendered (unavailable) | M0 | 30 | 28 | 93.3% | 0 | unknown | stopped | 9 | 5 | 8.5 |
| S10 30 counted, 2 never rendered (unavailable) | M1 | 30 | 28 | 93.3% | 0 | partial | below_total | 15 | 10 | 17 |
| S10 30 counted, 2 never rendered (unavailable) | A | 30 | 28 | 93.3% | 0 | partial | below_total | 3 | 4 | 18 |
| S11 Title added elsewhere during capture | M0 | 77 | 78 | 100% | 1 | unknown | stopped | 17 | 13 | 20.5 |
| S11 Title added elsewhere during capture | M1 | 77 | 78 | 100% | 1 | partial | above_total | 17 | 13 | 20.5 |
| S11 Title added elsewhere during capture | A | 77 | 78 | 100% | 1 | partial | above_total | 3 | 13 | 28.5 |
| S12 Unseen title removed during capture | M0 | 77 | 76 | 98.7% | 0 | unknown | stopped | 17 | 13 | 20.5 |
| S12 Unseen title removed during capture | M1 | 77 | 76 | 98.7% | 0 | partial | below_total | 31 | 26 | 41 |
| S12 Unseen title removed during capture | A | 77 | 76 | 98.7% | 0 | partial | below_total | 3 | 12 | 34.5 |
| S13 Profile switched during capture | M0 | 77 | - | 0% | 0 | no file | terminated_profile | 17 | 13 | 20.5 |
| S13 Profile switched during capture | M1 | 77 | - | 0% | 0 | no file | ended_terminated_profile | 17 | 13 | 20.5 |
| S13 Profile switched during capture | A | 77 | - | 0% | 0 | no file | ended_terminated_profile | 3 | 3 | 6 |
| S14 Navigated away during capture | M0 | 77 | - | 0% | 0 | no file | terminated_navigation | 17 | 13 | 20.5 |
| S14 Navigated away during capture | M1 | 77 | - | 0% | 0 | no file | ended_terminated_navigation | 17 | 13 | 20.5 |
| S14 Navigated away during capture | A | 77 | - | 0% | 0 | no file | ended_terminated_navigation | 3 | 3 | 6 |
| S15 Netflix re-renders the whole row | M0 | 77 | 26 | 33.8% | 0 | partial | terminated_boundary | 17 | 13 | 20.5 |
| S15 Netflix re-renders the whole row | M1 | 77 | 77 | 100% | 0 | complete | reached_total | 17 | 13 | 20.5 |
| S15 Netflix re-renders the whole row | A | 77 | 77 | 100% | 0 | complete | reached_total | 3 | 12 | 27 |
| S16 Tab reloaded, member starts again | M0 | 77 | 77 | 100% | 0 | unknown | stopped | 23 | 17 | 27.5 |
| S16 Tab reloaded, member starts again | M1 | 77 | 77 | 100% | 0 | complete | reached_total | 23 | 17 | 27.5 |
| S16 Tab reloaded, member starts again | A | 77 | 77 | 100% | 0 | complete | reached_total | 5 | 14 | 33 |
| S17 Empty list, no My List row | M0 | 0 | - | n/a | 0 | no file | boundary_missing | 2 | 0 | 0 |
| S17 Empty list, no My List row | M1 | 0 | - | n/a | 0 | no file | not_read | 2 | 0 | 0 |
| S17 Empty list, no My List row | A | 0 | - | n/a | 0 | no file | not_read | 2 | 0 | 0 |
| S18 Empty list, page state reports 0 | M0 | 0 | - | n/a | 0 | no file | boundary_missing | 2 | 0 | 0 |
| S18 Empty list, page state reports 0 | M1 | 0 | 0 | 100% | 0 | complete | reported_empty | 2 | 0 | 0 |
| S18 Empty list, page state reports 0 | A | 0 | 0 | 100% | 0 | complete | reported_empty | 2 | 0 | 0 |
| S19 No page-state script | M0 | 77 | 77 | 100% | 0 | unknown | stopped | 17 | 13 | 20.5 |
| S19 No page-state script | M1 | 77 | 77 | 100% | 0 | unknown | reference_missing | 17 | 13 | 20.5 |
| S19 No page-state script | A | 77 | 77 | 100% | 0 | unknown | reference_missing | 18 | 13 | 20.5 |
| S20 Legacy grid layout | M0 | 25 | 25 | 100% | 0 | unknown | stopped | 4 | 0 | 5 |
| S20 Legacy grid layout | M1 | 25 | 25 | 100% | 0 | unknown | reference_grid_layout | 4 | 0 | 5 |
| S20 Legacy grid layout | A | 25 | 25 | 100% | 0 | unknown | reference_grid_layout | 5 | 0 | 5 |
| S21 Reported total lower than rendered (stale total) | M0 | 77 | 77 | 100% | 0 | unknown | stopped | 17 | 13 | 20.5 |
| S21 Reported total lower than rendered (stale total) | M1 | 77 | 77 | 100% | 0 | partial | above_total | 17 | 13 | 20.5 |
| S21 Reported total lower than rendered (stale total) | A | 77 | 77 | 100% | 0 | partial | above_total | 3 | 12 | 27 |
| S22 Foreign card inside the row | M0 | 77 | 78 | 100% | 1 | unknown | stopped | 17 | 13 | 20.5 |
| S22 Foreign card inside the row | M1 | 77 | 78 | 100% | 1 | partial | above_total | 17 | 13 | 20.5 |
| S22 Foreign card inside the row | A | 77 | 78 | 100% | 1 | partial | above_total | 3 | 12 | 27 |
| S23 Adversarial: foreign card plus one unavailable title | M0 | 77 | 77 | 98.7% | 1 | unknown | stopped | 17 | 13 | 20.5 |
| S23 Adversarial: foreign card plus one unavailable title | M1 | 77 | 77 | 98.7% | 1 | complete (FALSE) | reached_total | 17 | 13 | 20.5 |
| S23 Adversarial: foreign card plus one unavailable title | A | 77 | 77 | 98.7% | 1 | complete (FALSE) | reached_total | 3 | 12 | 27 |
| S24 300 titles, de-DE | M0 | 300 | 300 | 100% | 0 | unknown | stopped | 54 | 50 | 76 |
| S24 300 titles, de-DE | M1 | 300 | 300 | 100% | 0 | complete | reached_total | 54 | 50 | 76 |
| S24 300 titles, de-DE | A | 300 | 300 | 100% | 0 | complete | reached_total | 3 | 49 | 106.5 |
| S25 Adversarial: foreign card at position 3 plus one unavailable title | M0 | 77 | 77 | 98.7% | 1 | unknown | stopped | 17 | 13 | 20.5 |
| S25 Adversarial: foreign card at position 3 plus one unavailable title | M1 | 77 | 77 | 98.7% | 1 | partial | order_mismatch | 17 | 13 | 20.5 |
| S25 Adversarial: foreign card at position 3 plus one unavailable title | A | 77 | 77 | 98.7% | 1 | partial | order_mismatch | 3 | 12 | 27 |
| S26 Title added elsewhere; member stops when the count matches | M0 | 77 | 78 | 100% | 1 | unknown | stopped | 17 | 13 | 20.5 |
| S26 Title added elsewhere; member stops when the count matches | M1 | 77 | 78 | 100% | 1 | partial | above_total | 16 | 12 | 18 |
| S26 Title added elsewhere; member stops when the count matches | A | 77 | 78 | 100% | 1 | partial | above_total | 3 | 13 | 28.5 |
| S27 Netflix re-renders the row twice, assisted | M0 | 77 | 25 | 32.5% | 0 | partial | terminated_boundary | 17 | 13 | 20.5 |
| S27 Netflix re-renders the row twice, assisted | M1 | 77 | 77 | 100% | 0 | complete | reached_total | 17 | 13 | 20.5 |
| S27 Netflix re-renders the row twice, assisted | A | 77 | 77 | 100% | 0 | complete | reached_total | 3 | 12 | 27 |

| Gate | Result | Detail |
| --- | --- | --- |
| G1 False complete | Fail | 2 of 54 version 0.0.6 runs falsely complete: M1/S23, A/S23 |
| G2 Recall when complete | Fail | 28 of 30 complete runs exact |
| G3 Truthful partial | Pass | 24 non-complete runs, each with a reason |
| G4 Duplicates | Pass | Wrap-around counted once; same-name distinct IDs kept (S01, S09) |
| G5 Other rows | Pass | 0 other-row IDs captured across 54 runs |
| G6 Recycled cards | Pass | S04 M0 100%, M1 100%, A 100%; S05 M0 13%, M1 100%, A 100%; S06 M0 13%, M1 100%, A 100% |
| G7 Lazy loading | Pass | S07 assisted: complete, 37.5 s |
| G8 Interruption | Pass | S14 discards; S16 restart reaches complete with no resume claim |
| G9 Profile change | Pass | S13 discarded in both version 0.0.6 routes |
| G10 Unavailable titles | Pass | S10: M1 partial 28/30, A partial 28/30 |
| G11 Empty list | Pass | S17 unknown (no row); S18 empty complete from reported 0 |
| G12 Bounded traversal | Pass | 23 of 23 assisted runs within ceil(total / visible) + 3 + 3; longest traversal 106.05 s of 180 s |
| G13 Effort | Pass | S01 assisted 3 actions, 27 s; manual M1 17 actions, 20.5 s |
