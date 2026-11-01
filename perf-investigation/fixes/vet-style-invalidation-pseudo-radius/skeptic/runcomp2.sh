#!/bin/bash
cd "$(dirname "$0")"
while pgrep -f runinv2.sh >/dev/null || pgrep -f runpx.sh >/dev/null || pgrep -f runcomp.sh >/dev/null; do sleep 20; done
for v in baseline:A baseline:B pradf:pradf; do node comp.js ${v%%:*} index_1920r_${v##*:} / 1920x1080 "" 2>&1 | cut -c1-120; done; node cmp.js index_1920r
for v in baseline:A baseline:B baseline:C baseline:D; do node comp.js ${v%%:*} index_1920n_${v##*:} / 1920x1080 "" 2>&1 | cut -c1-120; done
echo DONE
