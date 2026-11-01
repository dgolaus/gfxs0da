#!/bin/bash
cd /home/user/gfxs0da/perf-investigation/fixes/vet-offscreen-work-cv-defer/cloud
until [ -f L/chain12.done ]; do sleep 5; done
w() { until curl -s -o /dev/null http://localhost:5173/; do sleep 5; done; }
w; VARS=baseline,cvd_gh3,cvw_gh3,cvw_stay node fling.js L_endA 1440x900 end 0 > L/end_a.log 2>&1
w; VARS=baseline,cvd_gh3,cvw_gh3,cvw_stay node fling.js L_endB 1440x900 end 0 4 > L/end_b_t4.log 2>&1
w; EXTRA=10000 VARS=baseline,cvd_gh3,cvw_gh3,cvw_stay node fling.js L_endC 1440x900 end 0 > L/end_c_late.log 2>&1
w; EXTRA=10000 VARS=baseline,cvw_stay node fling.js L_endD 1440x900 end 0 4 > L/end_d_late_t4.log 2>&1
echo done > L/chain13.done
