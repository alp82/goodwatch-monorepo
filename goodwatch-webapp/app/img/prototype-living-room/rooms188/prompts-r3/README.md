# Room defect loop (#188, round 3)

1. Generate: `base2.txt` plus a mood block and a table block (see the round 3 route header), reference image = round 2 `fixed`.
2. Review: `crops.py` cuts 12 zoomed crops; a vision agent follows `critic.md` and returns scored defects with boxes.
3. Fix objects: `fixall.sh <master> <tsv> <tag>` edits each defect as a 16:9 crop of the untouched master and pastes it back feathered and color-matched (`fix.py`), then runs the detail pass.
4. Detail pass: `detail.sh` re-renders 9 overlapping tiles at 2.6x and stitches them (`detail.py`); this clears rug/fabric mush and foreground blur.
5. Final review at 1:1 on the 2560 px encode (`critic-final.md`), then `fixfinal.sh` for what is left (`*b.tsv`, `*c.tsv`).
6. Encode: `process3.py` paints the green screen black, sharpens lightly, writes 2560 px WebP and the TV rect.

Pitfall: anything run inside `while read` must get `< /dev/null`, or codex swallows the rest of the list.
