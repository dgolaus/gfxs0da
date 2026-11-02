#!/bin/bash
cd /home/user/gfxs0da/perf-investigation/fixes/combined/vet/behaviour
while [ ! -f logs/EXTRA.done ]; do sleep 20; done
echo "=== walkvars2 $(date +%T)"; STEP=120 WAIT=700 NAME=walkvars2 timeout 2400 node beh.js walkvars > logs/walkvars2.log 2>&1; echo "exit $? $(date +%T)"
touch logs/EXTRA2.done
