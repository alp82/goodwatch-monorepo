#!/bin/bash
cd "$(dirname "$0")"
./fixfinal.sh base.png s1.tsv st1a > st1a.log 2>&1
K_OVERRIDE="Preserve exactly everything else: framing, perspective, lighting, colors, fine texture detail, and all other objects, so this crop can be pasted back seamlessly into the full photo. Photorealistic, sharp, no blur. Any bright green area stays flat pure #00FF00 green." ./fixfinal.sh st1a.png s1-br.tsv st1 > st1.log 2>&1
K_OVERRIDE="Preserve exactly everything else: framing, perspective, lighting, colors, fine texture detail, and all other objects, so this crop can be pasted back seamlessly into the full photo. Photorealistic, sharp, no blur. Any bright green area stays flat pure #00FF00 green." ./fixfinal.sh st1.png s2.tsv st2 > st2.log 2>&1
K_OVERRIDE="Preserve exactly everything else: framing, perspective, lighting, colors, fine texture detail, and all other objects, so this crop can be pasted back seamlessly into the full photo. Photorealistic, sharp, no blur. Any bright green area stays flat pure #00FF00 green." ./fixfinal.sh st2.png s3.tsv st3 > st3.log 2>&1
echo done > go.done
