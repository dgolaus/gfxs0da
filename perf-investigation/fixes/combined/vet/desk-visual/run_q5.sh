#!/bin/bash
cd /home/user/gfxs0da/perf-investigation/fixes/combined/vet/desk-visual
until [ -f logs/q4.done ]; do sleep 3; done
r() { local log=$1; shift; echo "START $log $(date +%T)" >> logs/queue.log; timeout 2400 "$@" > logs/$log.log 2>&1; echo "END $log rc=$? $(date +%T)" >> logs/queue.log; }
r intro_bench_1440x900 node intro.js 1440x900 bench combined
r walk2_1920x1080 node walk.js walk2_1920x1080 1920x1080 / "" combined
r walk_tos_1440x900 node walk.js walk_tos_1440x900 1440x900 /tos/ "" combined
r hover_1440x900_slots node hover.js 1440x900 /slots/ combined
r hover_1440x900_404 node hover.js 1440x900 /404.html combined
echo done > logs/q5.done
