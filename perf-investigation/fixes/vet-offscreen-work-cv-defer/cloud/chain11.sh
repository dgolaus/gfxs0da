#!/bin/bash
cd /home/user/gfxs0da/perf-investigation/fixes/vet-offscreen-work-cv-defer/cloud
w() { until curl -s -o /dev/null http://localhost:5173/; do sleep 5; done; }
w; node fling.js L_dr390_60 390x844m drag 60 > L/fling_390_drag60.log 2>&1
w; node fling.js L_dr390_120 390x844m drag 120 > L/fling_390_drag120.log 2>&1
w; node fling.js L_dr390_up 390x844m dragup 90 > L/fling_390_dragup.log 2>&1
w; node fling.js L_end1440 1440x900 end 0 > L/fling_end1440.log 2>&1
w; node fling.js L_dr390_60_t4 390x844m drag 60 4 > L/fling_390_drag60_t4.log 2>&1
echo done > L/chain11a.done
w; node contain.js L2_c1366 1366x768 cvd_gh3 > L/contain2_1366.log 2>&1
w; node contain.js L2_c1280 1280x720 cvd_gh3 > L/contain2_1280.log 2>&1
echo done > L/chain11.done
