#!/bin/bash
cd "$(dirname "$0")"
while pgrep -f "runcomp.sh" >/dev/null || pgrep -f runinv.sh >/dev/null; do sleep 20; done
node px.js 768x1024 dpr2 / pradf 2>&1 > px_768d2_index.log
node px.js 1920x1080 - / pradf 2>&1 > px_1920_index.log
node px.js 320x640 mobile / pradf 2>&1 > px_320_index.log
node px.js 1024x768 dpr2 /404.html pradf 2>&1 > px_1024d2_404.log
node px.js 768x1024 dpr2 /slots/ pradf 2>&1 > px_768d2_slots.log
node px.js 1920x1080 - /tos/ pradf 2>&1 > px_1920_tos.log
echo DONE > px.done
