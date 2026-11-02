#!/bin/bash
cd /home/user/gfxs0da/perf-investigation/fixes/combined/vet/desk-visual
until [ -f logs/q4.done ]; do sleep 3; done
r() { local log=$1; shift; echo "START $log $(date +%T)" >> logs/queue.log; timeout 2400 "$@" > logs/$log.log 2>&1; echo "END $log rc=$? $(date +%T)" >> logs/queue.log; }
r leaverep_2560 node leaverep.js 2560 2560x1440 3 0,0.02,0.05,0.15,0.3 baseline combined stab1440 base
r leaverep_1600 node leaverep.js 1600 1600x900 3 0,0.02,0.05,0.15 baseline combined stab1440
r walkrep_dpr2_bisect env DPR=2 LATE=4000 node walkrep.js dpr2_bisect 1440x900 3 3600,4050,4500 baseline combined stab1440 base prad
r cstyle_1440 node cstyle.js 1440x900 combined
r rep_viewwork_1920_b node repeat.js viewwork_1920_b 1920x1080 0 600,650,160,100 8 baseline combined base stab1440
echo done > logs/q5.done
