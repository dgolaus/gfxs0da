#!/bin/bash
cd /home/user/gfxs0da/perf-investigation/fixes/combined/vet/desk-visual
for vp in 1440x900 1920x1080 1366x768 1280x720; do
  timeout 900 node walk.js walk_$vp $vp / "" combined > logs/walk_$vp.log 2>&1
done
DPR=2 timeout 1200 node walk.js walk_1440x900_dpr2 1440x900 / "" combined > logs/walk_1440x900_dpr2.log 2>&1
echo done > logs/walks.done
