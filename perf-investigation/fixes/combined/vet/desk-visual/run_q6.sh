#!/bin/bash
cd /home/user/gfxs0da/perf-investigation/fixes/combined/vet/desk-visual
until [ -f logs/q5.done ]; do sleep 3; done
r() { local log=$1; shift; echo "START $log $(date +%T)" >> logs/queue.log; timeout 2400 "$@" > logs/$log.log 2>&1; echo "END $log rc=$? $(date +%T)" >> logs/queue.log; }
r hover_1440x900_root_v3 env TAG=_v3 node hover.js 1440x900 / combined
r pricing_v2_1440x900 env TAG=_v2 node pricing.js 1440x900 combined
r pricing_v2_2560x1440 env TAG=_v2 node pricing.js 2560x1440 combined
r pricing_v2_1600x900 env TAG=_v2 node pricing.js 1600x900 combined
r pricing_v2_1920x1080 env TAG=_v2 node pricing.js 1920x1080 combined
r leaverep_1920 node leaverep.js 1920 1920x1080 3 0,0.02,0.05,0.15 baseline combined
r leaverep_1440 node leaverep.js 1440 1440x900 3 0,0.02,0.05,0.15 baseline combined
r intro_bench_1440x900 node intro.js 1440x900 bench combined
r walk2_1920x1080 node walk.js walk2_1920x1080 1920x1080 / "" combined
r walk_tos_1440x900 node walk.js walk_tos_1440x900 1440x900 /tos/ "" combined
r hover_1440x900_slots node hover.js 1440x900 /slots/ combined
r hover_1440x900_404 node hover.js 1440x900 /404.html combined
r hover_1920x1080_root_v3 env TAG=_v3 node hover.js 1920x1080 / combined
r cstyle_1920 node cstyle.js 1920x1080 combined
echo done > logs/q6.done
