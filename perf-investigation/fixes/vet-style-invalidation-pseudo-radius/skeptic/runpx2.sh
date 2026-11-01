#!/bin/bash
cd "$(dirname "$0")"
while pgrep -f runprobe.sh >/dev/null || pgrep -f runinv2.sh >/dev/null || pgrep -f runcomp2.sh >/dev/null; do sleep 20; done
node px.js 768x1024 dpr2 / pradf > px_768d2_index.log 2>&1
node px.js 1920x1080 - / pradf > px_1920_index.log 2>&1
node px.js 320x640 mobile / pradf > px_320_index.log 2>&1
node px.js 1024x768 dpr2 /404.html pradf > px_1024d2_404.log 2>&1
node px.js 768x1024 dpr2 /slots/ pradf > px_768d2_slots.log 2>&1
echo DONE > px.done
