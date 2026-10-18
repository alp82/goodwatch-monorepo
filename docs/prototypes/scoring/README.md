# Scoring design decision — 2026-10-18

The user approved the shared responsive dialog (2), inline Taste quiz (3a), and living-room rating screen (3b), with selection treatment A: white numeral, dark score-colored fill, bright colored inset rim. The yellow TV focus border was rejected; production uses a restrained white focus outline, distinct from the colored selected rim.

`preview.html` and `selection.html` are throwaway, in-memory design artifacts. Open them directly or serve this directory with `python -m http.server 8776`. The images are snapshots, not interactive controls. The implementation is rewritten in the application's shared scoring components.
