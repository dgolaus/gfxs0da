#!/bin/bash
cd /home/user/gfxs0da/perf-investigation/fixes/vet-offscreen-work-cv-defer/cloud
until [ -f L/chain4.done ]; do sleep 5; done
w() { until curl -s -o /dev/null http://localhost:5173/; do sleep 5; done; }
w; (node remember.js 390x844m 400 60; node remember.js 390x844m 100 120; node remember.js 1280x720 400 60; node remember.js 1280x720 100 120) > L/remember.log 2>&1
w; FONT_DELAY=300 VARS=baseline,cvd_gh3,cvw_gh3 node fout.js L/fout_d300_w1500.json 1440x900 1500 120 > L/fout_d300_w1500.log 2>&1
w; FONT_DELAY=300 VARS=baseline,cvd_gh3,cvw_gh3 node fout.js L/fout_d300_w6000.json 1440x900 6000 120 > L/fout_d300_w6000.log 2>&1
w; FONT_DELAY=100 VARS=baseline,cvd_gh3,cvw_gh3 node fout.js L/fout_d100_w6000.json 1440x900 6000 120 > L/fout_d100_w6000.log 2>&1
echo done > L/chain5.done
