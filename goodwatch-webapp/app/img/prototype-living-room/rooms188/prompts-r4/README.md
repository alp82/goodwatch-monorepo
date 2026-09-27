# Room fidelity loop (#188, round 4)

Round 3's loop only checked defects, so its rooms drifted from the reference `fixed` (wall color, light, couch, coziness). This loop treats `fixed` as ground truth.

1. Candidates stay the reference room: (A) the nine-tile detail pass run on `fixed` itself, or (B) a one-pass "re-photograph this exact room" edit of `fixed` (`keep.txt`), never chained edits.
2. `fidelity.py` measures the Lab mean difference (Delta E) against `fixed` per region (wall, window, lantern, sofa, blanket, floor, right side). Under about 6 means the same grade.
3. `gradelock.py` locks low-frequency color and light to `fixed` (blurred Lab difference, blanket band and TV excluded) without touching detail.
4. Reviews (`critic4.md`, `critic4-final.md` for 1:1 crops at 2560 px) compare with `fixed` first: fidelity, then realism, coziness, invitation. The blanket's color changes on purpose (the owner disliked the olive green).
5. Local fixes through round 3's `fixfinal.sh`, in stages so overlapping fixes don't overwrite each other; a full-width fix must never share a stage with small fixes inside it.
6. Numeric finishing: `blanket.py` (warm dark caramel target), `finish.py` (mute spines, tone the case, smooth the wall, soften the detail-pass crunch).
7. `process4.py` paints the screen black and writes 2560 px WebP (about 250-270 KB).
