#!/bin/bash
cd /home/user/gfxs0da/perf-investigation/fixes/vet-offscreen-work-cv-defer/cloud
until [ -f L/chain10.done ]; do sleep 5; done
w() { until curl -s -o /dev/null http://localhost:5173/; do sleep 5; done; }
w; node fling.js L_fl390_3000 390x844m fling 3000 > L/fling_390_3000.log 2>&1
w; node fling.js L_fl390_8000 390x844m fling 8000 > L/fling_390_8000.log 2>&1
w; node fling.js L_fl390_up 390x844m flingup 6000 > L/fling_390_up.log 2>&1
w; node fling.js L_end1440 1440x900 end 0 > L/fling_end1440.log 2>&1
w; node fling.js L_fl390_3000_t4 390x844m fling 3000 4 > L/fling_390_3000_t4.log 2>&1
echo done > L/chain11a.done
w; node contain.js L2_c1366 1366x768 cvd_gh3 > L/contain2_1366.log 2>&1
w; node contain.js L2_c1280 1280x720 cvd_gh3 > L/contain2_1280.log 2>&1
echo done > L/chain11.done
