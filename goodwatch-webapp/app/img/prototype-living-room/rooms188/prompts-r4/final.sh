#!/bin/bash
cd "$(dirname "$0")"
./fixfinal.sh $1-bl.png rugs1.tsv $1-r1 > $1-r1.log 2>&1
./fixfinal.sh $1-r1.png rugs2.tsv $1-r2 > $1-r2.log 2>&1
echo done > $1-final.done
