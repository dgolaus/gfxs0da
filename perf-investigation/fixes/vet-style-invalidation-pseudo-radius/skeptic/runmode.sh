#!/bin/bash
cd "$(dirname "$0")"
for r in 1 2 3 4 5; do for v in baseline:A baseline:B pradf:P; do node compmode.js ${v%%:*} m${r}${v##*:} / 1920x1080 "" 2>&1 | cut -c1-300; done; done
for r in 6 7 8; do for v in pradf:P baseline:A baseline:B; do node compmode.js ${v%%:*} m${r}${v##*:} / 1440x900 "" 2>&1 | cut -c1-300; done; done
echo DONE
