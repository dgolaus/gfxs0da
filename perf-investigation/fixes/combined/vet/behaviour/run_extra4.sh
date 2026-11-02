#!/bin/bash
cd /home/user/gfxs0da/perf-investigation/fixes/combined/vet/behaviour
while [ ! -f logs/EXTRA3.done ]; do sleep 20; done
echo "=== parallax2 $(date +%T)"; PWAIT=7000 NAME=parallax2 timeout 2400 node beh.js parallax > logs/parallax2.log 2>&1; echo "exit $? $(date +%T)"
touch logs/EXTRA4.done
