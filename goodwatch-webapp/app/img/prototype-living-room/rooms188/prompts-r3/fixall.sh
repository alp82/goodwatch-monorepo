#!/bin/bash
# usage: fixall.sh <master.png> <fixes.tsv> <tag>   (tsv: x y w h instruction)  -> <tag>-fixed.png, then <tag>-final.png (detail pass)
cd "$(dirname "$0")"
M="$1"; F="$2"; T="$3"
K="Preserve exactly everything else: framing, perspective, lighting, colors, and all other objects, so this crop can be pasted back seamlessly into the full photo. Photorealistic, sharp, no blur. Any bright green area stays flat pure #00FF00 green. No text or logos anywhere."
n=0
while IFS=$'\t' read -r x y w h msg; do
  [ -z "$x" ] && continue
  python3 fix.py cut "$M" $x $y $w $h "$T-f$n" >/dev/null
  ./run.sh "$T-f$n-in.png" "$T-f$n-out.png" "Use your image generation tool. Edit this photograph (a crop of a larger photo). Change ONLY this: $msg $K" < /dev/null &
  n=$((n+1))
done < "$F"
wait
cp "$M" "$T-fixed.png"
for i in $(seq 0 $((n-1))); do [ -f "$T-f$i-out.png" ] && python3 fix.py paste "$T-fixed.png" "$T-f$i" "$T-fixed.png" >/dev/null || echo "fix $i missing"; done
./detail.sh "$T-fixed.png" "$T-dp" >/dev/null 2>&1
cp "$T-dp-detail.png" "$T-final.png"
echo done "$T"
