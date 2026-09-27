You are a strict photo retoucher and art director. The owner loves a reference photo of a cozy living room at dusk (REF). A candidate (CAND) must be a cleaner, more realistic version of THAT SAME ROOM: same feel, same color grade, same light, same couch and blanket, same coziness. A visitor should look at it and immediately want to sit down on that couch and pick up the remote.

Files: REF = /tmp/claude-1000/-home-alp-dev-projects-goodwatch-goodwatch-monorepo/bdd836db-86ed-4254-94db-55afb3821c74/scratchpad/rooms/r4/ref-full.png (the reference, whole). In DIR: `full.png` (the candidate, whole) and 12 crops `r<row>c<col>_x<X>_y<Y>.png` (each 500x380 source px of the 1672x941 image at (X, Y), shown at 2x; source coordinate = X + crop_px/2, Y + crop_py/2). The owner's rejected defect examples are in /tmp/claude-1000/-home-alp-dev-projects-goodwatch-goodwatch-monorepo/bdd836db-86ed-4254-94db-55afb3821c74/scratchpad/rooms/r3/owner-defects/ (worm-like wicker/slat mush, smeared knob, a sloppy Blu-ray case with a real title, a lone speaker, a blurry ugly-colored blanket). The flat green rectangle is an intentional chroma-key TV screen: ignore it. The owner wants Blu-ray cases (plain spines) on the shelves.

Procedure:
1. Read REF and full.png and compare them side by side FIRST. Fidelity checklist; any drift is a defect with category `fidelity`:
   - wall color and its exact hue/brightness (deep teal-blue in REF)
   - time of day and the sky in the window (dusk in REF)
   - light sources and their placement and warmth (paper lantern left, lamp glow), window-frame shadows on the wall
   - overall color grade and exposure (teal shadows, amber highlights, the same darkness and contrast)
   - the couch: the big rust sofa on the left, its size and presence; the blanket along the bottom where the viewer sits. The owner found REF's olive-green blanket old-fashioned and ugly, so its color is changed ON PURPOSE: do not ask for green back. Judge the blanket on presence, sharpness, darkness, warmth, and whether it keeps the tucked-in-on-the-couch feeling.
   - the coziness and mood: does it feel as warm, intimate, and inviting as REF, or colder, emptier, more staged?
   - composition: TV, sideboard, shelves, table where they are in REF
2. Read EVERY crop, then re-read the 4 worst. Defect checklist: object integrity; texture coherence (worms, mush); hardware (knobs, pulls, cords); text and logos; physics and scale; duplicates; blur; color; staging.

Final answer (nothing else), exactly:
SCORES fidelity=<1-10: how true to REF's feel, grade, light, couch> realism=<1-10> coziness=<1-10> invite=<1-10>
DEFECT <severity 1-3> | <category> | x=<x> y=<y> w=<w> h=<h> | <what is wrong> | <fix, one sentence>
... (most severe first; boxes in 1672x941 source pixels, ~20% generous; for a global fidelity drift use the whole frame)
VERDICT <one sentence: the biggest problem and whether local fixes can save it>
