#!/bin/bash
cd /home/user/gfxs0da/perf-investigation/fixes/combined/vet/desk-visual
until [ -f logs/q8.done ]; do sleep 3; done
r() { local log=$1; shift; echo "START $log $(date +%T)" >> logs/queue.log; timeout 2400 "$@" > logs/$log.log 2>&1; echo "END $log rc=$? $(date +%T)" >> logs/queue.log; }
r rep2_1440_4824 node repeat2.js 1440_4824 1440x900 4824 4 baseline combined stab1440 base
r rep2_1920_pricing node repeat2.js 1920_5400 1920x1080 5400 3 baseline combined stab1440
echo done > logs/q9.done
