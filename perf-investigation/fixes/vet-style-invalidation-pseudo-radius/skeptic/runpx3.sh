#!/bin/bash
cd "$(dirname "$0")"
while pgrep -f runpx2.sh >/dev/null || pgrep -f runprobe2.sh >/dev/null; do sleep 20; done
PXDIR=px3 node px.js 1920x1080 - / pradf baseline pradf > px3_1920_index.log 2>&1
echo DONE > px3.done
