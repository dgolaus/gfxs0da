#!/bin/bash
cd "$(dirname "$0")"
while pgrep -f runpx3.sh >/dev/null; do sleep 20; done
node probe3.js 1920x1080 12 baseline pradf > probe3_1920.log 2>&1
echo DONE > probe3.done
