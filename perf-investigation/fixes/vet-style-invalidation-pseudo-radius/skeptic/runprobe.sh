#!/bin/bash
cd "$(dirname "$0")"
while pgrep -f runcomp2.sh >/dev/null || pgrep -f runinv2.sh >/dev/null || pgrep -f runpx.sh >/dev/null; do sleep 20; done
node probe.js 1920x1080 - 6 baseline pradf > probe1920.log 2>&1
node probe.js 1440x900 dpr2 5 baseline pradf > probe1440d2.log 2>&1
echo DONE > probe.done
