#!/bin/bash
# usage: detail.sh <master.png> <tag>  -> <tag>-detail.png
cd "$(dirname "$0")"
python3 detail.py cut "$1" "$2"
P="Use your image generation tool. This is a crop of a photograph. Re-render exactly this crop as a sharp, high-detail photograph: keep every object, edge, position, perspective, color, and light exactly where it is so it can be stitched back into the full photo; do not add, remove, move, or restyle anything and do not change the framing. Give every surface real, coherent fine detail: an even woven rug pile, smooth fabric upholstery with a fine regular weave, cleanly knitted blanket stitches, wood grain, leaf veins, crisp ceramic glazes. Everything in sharp focus, no blur. Keep any plain spines and covers free of text. Any bright green area stays flat pure #00FF00 green."
for i in 0 1 2 3 4 5 6 7 8; do ./run.sh "$2-t$i-in.png" "$2-t$i-out.png" "$P" & done; wait
python3 detail.py stitch "$2" "$2-detail.png"
