#!/bin/bash
cd /home/user/gfxs0da/perf-investigation/fixes/vet-offscreen-work-cv-defer/cloud
until [ -f L/chain13.done ]; do sleep 5; done
w() { until curl -s -o /dev/null http://localhost:5173/; do sleep 5; done; }
w; node walk.js L_j1366b 1366x768 / jump cvd_gh3 cvw_gh3 > L/walk_j1366b.log 2>&1
w; node walk.js L_w1280 1280x720 / '' cvd_gh3 cvw_stay > L/walk_w1280.log 2>&1
echo done > L/chain14.done
