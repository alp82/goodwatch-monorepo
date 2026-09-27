#!/bin/bash
cd "$(dirname "$0")"
./fixfinal.sh $1-lock.png $1-s1.tsv $1-s1 > $1-s1.log 2>&1
./fixfinal.sh $1-s1.png $1-s2.tsv $1-s2 > $1-s2.log 2>&1
echo "done $1" > $1-stage.done
