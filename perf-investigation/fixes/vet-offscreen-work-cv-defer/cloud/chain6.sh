#!/bin/bash
cd /home/user/gfxs0da/perf-investigation/fixes/vet-offscreen-work-cv-defer/cloud
until [ -f L/chain5.done ]; do sleep 5; done
w() { until curl -s -o /dev/null http://localhost:5173/; do sleep 5; done; }
w; (node width.js 390x844m; node width.js 360x740m; node width.js 414x896m; node width.js 768x1024m; node width.js 1440x900) > L/width.log 2>&1
w; node endwheel.js L/endwheel_gh3.json 1280x720,1024x768,1536x864,360x740m 1500 baseline,cvd_gh2,cvd_gh3,cvw_gh3 > L/endwheel_gh3.log 2>&1
echo done > L/chain6.done
