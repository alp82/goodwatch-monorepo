#!/bin/bash
# usage: fixfinal.sh <final.png> <fixes.tsv> <tag>  (tsv: x y w h factor instruction; coords in 1672 space) -> <tag>.png
cd "$(dirname "$0")"
M="$1"; F="$2"; T="$3"
K0="Preserve exactly everything else: framing, perspective, lighting, colors, fine texture detail, and all other objects, so this crop can be pasted back seamlessly into the full photo. Photorealistic, sharp, no blur. Any bright green area stays flat pure #00FF00 green. No text or logos anywhere."
K="${K_OVERRIDE:-$K0}"
n=0
while IFS=$'\t' read -r x y w h f msg; do
  [ -z "$x" ] && continue
  python3 fix.py cut "$M" $x $y $w $h "$T-f$n" $f >/dev/null
  ./run.sh "$T-f$n-in.png" "$T-f$n-out.png" "Use your image generation tool. Edit this photograph (a crop of a larger photo). Change ONLY this: $msg $K" < /dev/null &
  n=$((n+1))
done < "$F"
wait
cp "$M" "$T.png"
for i in $(seq 0 $((n-1))); do [ -f "$T-f$i-out.png" ] && python3 fix.py paste "$T.png" "$T-f$i" "$T.png" >/dev/null || echo "fix $i missing"; done
echo done "$T"
