#!/bin/bash
cd "$(dirname "$0")"
while pgrep -f runpx2.sh >/dev/null || pgrep -f runprobe.sh >/dev/null; do sleep 20; done
node probe2.js 1440x900 10 baseline pradf > probe2_1440.log 2>&1
echo DONE > probe2.done
