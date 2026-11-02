#!/bin/bash
cd /home/user/gfxs0da/perf-investigation/fixes/combined/vet/desk-visual
until [ -f logs/q3.done ]; do sleep 3; done
r() { local log=$1; shift; echo "START $log $(date +%T)" >> logs/queue.log; timeout 2400 "$@" > logs/$log.log 2>&1; echo "END $log rc=$? $(date +%T)" >> logs/queue.log; }
r walkrep_dpr2 env DPR=2 node walkrep.js dpr2 1440x900 3 3150,3600,4050,4500,4950 baseline combined
r lenis2_1920x1080 node lenisscroll2.js 1920x1080 combined
r intro_glob_1920x1080 node intro.js 1920x1080 glob combined
r pricing_1920x1080 node pricing.js 1920x1080 combined
r pricing_2560x1440 node pricing.js 2560x1440 combined
r pricing_1600x900 node pricing.js 1600x900 combined
r hover_1440x900_root_v2 node hover.js 1440x900 / combined
r hover_1920x1080_root node hover.js 1920x1080 / combined
r tab_1920x1080_root node tabwalk.js 1920x1080 / 150 combined
echo done > logs/q4.done
