#!/bin/bash
cd /home/user/gfxs0da/perf-investigation/fixes/combined/vet/behaviour
while [ ! -f logs/EXTRA4.done ]; do sleep 20; done
echo "=== slots $(date +%T)"; timeout 2400 node beh.js slots > logs/slots.log 2>&1; echo "exit $? $(date +%T)"
echo "=== tosspy $(date +%T)"; timeout 2400 node beh.js tosspy > logs/tosspy.log 2>&1; echo "exit $? $(date +%T)"
touch logs/EXTRA5.done
