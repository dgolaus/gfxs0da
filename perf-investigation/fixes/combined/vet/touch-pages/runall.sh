#!/bin/bash
# serial: one browser at a time
cd /home/user/gfxs0da/perf-investigation/fixes/combined/vet/touch-pages
run() { echo "### $*"; timeout 1200 node walk.js "$@" 2>&1 | grep -v '^$'; }
run m390 390x844 / mobile combined
run m360 360x780 / mobile combined
run t768 768x1024 / mobile combined
run d1024 1024x768 / '' combined
run d1100 1100x800 / '' combined
run tos1440 1440x900 /tos/ '' combined
run tos390 390x844 /tos/ mobile combined
run slots1440 1440x900 /slots/ '' combined
run slots390 390x844 /slots/ mobile combined
run nf1440 1440x900 /this-page-does-not-exist '' combined
run nf390 390x844 /this-page-does-not-exist mobile combined
run rm1440 1440x900 / reduced combined
run rm390 390x844 / mobile,reduced combined
