#!/bin/bash
cd /home/user/gfxs0da/perf-investigation/fixes/combined/vet/behaviour
while [ ! -f logs/EXTRA2.done ]; do sleep 20; done
echo "=== tdirect $(date +%T)"; timeout 2400 node beh.js tdirect > logs/tdirect.log 2>&1; echo "exit $? $(date +%T)"
touch logs/EXTRA3.done
