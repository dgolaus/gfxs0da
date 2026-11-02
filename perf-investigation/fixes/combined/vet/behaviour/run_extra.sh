#!/bin/bash
cd /home/user/gfxs0da/perf-investigation/fixes/combined/vet/behaviour
while [ ! -f logs/ALL.done ]; do sleep 20; done
for t in pseudo; do echo "=== $t $(date +%T)"; timeout 2400 node beh.js $t > logs/$t.log 2>&1; echo "exit $? $(date +%T)"; done
touch logs/EXTRA.done
