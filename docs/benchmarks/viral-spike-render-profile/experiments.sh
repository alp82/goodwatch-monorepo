#!/bin/bash
# experiments.sh: each candidate fix alone on the warm movie page, the tickets' switches, then the page set with all fixes.
# Images: bench2 is the measurement build (commit 28a5c510 plus measurement-build.patch), bench3 is the same plus the
# router patch. The switches: GW_ENTRY=fix (fix 1), GW_FIX=userdata (fix 2), ratings (fix 3), nostreaming (fix 4),
# GW_UI=onepanel (only the selected related panel), GW_UI=norelated (no related section).
cd /opt/gw-render-profile/work
M=/movie/603-the-matrix
export IMAGE=gw-render-profile:bench2
./variant.sh x-movie-base $M GW_ENTRY=default
./variant.sh x-movie-entry $M GW_ENTRY=fix
./variant.sh x-movie-userdata $M GW_ENTRY=default GW_FIX=userdata
./variant.sh x-movie-ratings $M GW_ENTRY=default GW_FIX=ratings
./variant.sh x-movie-onepanel $M GW_ENTRY=default GW_UI=onepanel
./variant.sh x-movie-norelated $M GW_ENTRY=default GW_UI=norelated
AE=identity ./variant.sh x-movie-identity $M GW_ENTRY=default
export IMAGE=gw-render-profile:bench3
./variant.sh x-movie-router $M GW_ENTRY=default
./variant.sh x-home-router / GW_ENTRY=default
./suite.sh fixed GW_ENTRY=fix GW_FIX=userdata,ratings,nostreaming
./variant.sh x-movie-fixed-onepanel $M GW_ENTRY=fix GW_FIX=userdata,ratings,nostreaming GW_UI=onepanel
echo ALLDONE
