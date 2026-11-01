#!/bin/bash
cd /home/user/gfxs0da/perf-investigation/fixes/vet-offscreen-work-cv-defer/cloud
until [ -f L/chain8.done ]; do sleep 5; done
w() { until curl -s -o /dev/null http://localhost:5173/; do sleep 5; done; }
w; VARS=baseline,cvd,cvd_gh3,cvw_gh3 node blankframe.js L_blank_end 1440x900 end > L/blank_end.log 2>&1
w; VARS=baseline,cvd,cvd_gh3 node blankframe.js L_blank_pr 1440x900 pricing > L/blank_pricing.log 2>&1
echo done > L/chain9.done
