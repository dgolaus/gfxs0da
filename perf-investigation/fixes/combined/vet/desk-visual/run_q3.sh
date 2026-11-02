#!/bin/bash
cd /home/user/gfxs0da/perf-investigation/fixes/combined/vet/desk-visual
r() { local log=$1; shift; echo "START $log $(date +%T)" >> logs/queue.log; timeout 2400 "$@" > logs/$log.log 2>&1; echo "END $log rc=$? $(date +%T)" >> logs/queue.log; }
r lenis2_1440x900 node lenisscroll2.js 1440x900 combined
r rep2_dpr2_4500 env DPR=2 node repeat2.js dpr2_4500 1440x900 4500 4 baseline combined stab1440
r rep_viewwork_1280 node repeat.js viewwork_1280 1280x720 0 260,470,160,50 5 baseline combined prad
r hover_1440x900_root node hover.js 1440x900 / combined
r tab_1440x900_root node tabwalk.js 1440x900 / 150 combined
r rep2_dpr2_3600 env DPR=2 node repeat2.js dpr2_3600 1440x900 3600 4 baseline combined stab1440
r rep_viewwork_1920 node repeat.js viewwork_1920 1920x1080 0 600,650,160,100 5 baseline combined prad
echo done > logs/q3.done
