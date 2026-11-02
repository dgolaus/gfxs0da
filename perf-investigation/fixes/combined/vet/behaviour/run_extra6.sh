#!/bin/bash
cd /home/user/gfxs0da/perf-investigation/fixes/combined/vet/behaviour
while [ ! -f logs/EXTRA5.done ]; do sleep 20; done
echo "=== walk tos $(date +%T)"
timeout 1800 node walk.js tos1440 1440x900 /tos/ "" combined > logs/walk_tos1440.log 2>&1; echo "exit $? $(date +%T)"
timeout 1800 node walk.js tos1920 1920x1080 /tos/ "" combined > logs/walk_tos1920.log 2>&1; echo "exit $? $(date +%T)"
touch logs/EXTRA6.done
