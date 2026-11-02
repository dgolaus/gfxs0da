#!/bin/bash
cd /home/user/gfxs0da/perf-investigation/fixes/combined/vet/desk-visual
until [ -f logs/walks.done ]; do sleep 3; done
r() { local log=$1; shift; echo "START $log $(date +%T)" >> logs/queue.log; timeout 1800 "$@" > logs/$log.log 2>&1; echo "END $log rc=$? $(date +%T)" >> logs/queue.log; }
r lenis_1440x900 node lenisscroll.js 1440x900 combined
r pricing_1440x900 node pricing.js 1440x900 combined
r intro_glob_1440x900 node intro.js 1440x900 glob combined
r hover_1440x900_root node hover.js 1440x900 / combined
r tab_1440x900_root node tabwalk.js 1440x900 / 150 combined
echo done > logs/q1.done
