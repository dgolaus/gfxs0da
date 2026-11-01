#!/bin/bash
cd /home/user/gfxs0da/perf-investigation/fixes/vet-offscreen-work-cv-defer/cloud
until [ -f L/chain9.done ]; do sleep 5; done
w() { until curl -s -o /dev/null http://localhost:5173/; do sleep 5; done; }
w; node contain.js L2_c1440 1440x900 cvd_gh3 > L/contain2_1440.log 2>&1
w; node contain.js L2_c1024 1024x768 cvd_gh3 > L/contain2_1024.log 2>&1
w; node contain.js L2_c390 390x844m cvd_gh3 > L/contain2_390.log 2>&1
echo done > L/chain10.done
