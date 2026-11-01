#!/bin/bash
cd /home/user/gfxs0da/perf-investigation/fixes/vet-offscreen-work-cv-defer/cloud
until [ -f L/chain3.done ]; do sleep 5; done
w() { until curl -s -o /dev/null http://localhost:5173/; do sleep 5; done; }
w; VARS=baseline,cvd_gh,cvd_gh2,cvw_gh2 node anchors.js L/anchors_gh2.json 1920x1080,1440x900 about,process,trust,pricing,contact 3 > L/anchors_gh2.log 2>&1
w; VARS=baseline,base_i,cvd,cvd_gh2,cvw_gh2 node behave.js L/behave_1440.json 1440x900 > L/behave_1440.log 2>&1
w; VARS=baseline,cvd_gh2,cvw_gh2 node behave.js L/behave_390.json 390x844m > L/behave_390.log 2>&1
w; VARS=baseline,cvd_gh2 node behave.js L/behave_red.json 1440x900 reduced > L/behave_red.log 2>&1
w; VARS=baseline,base_i,cvd_gh2,cvw_gh2 node pages.js L_pages > L/pages.log 2>&1
w; VARS=baseline,cvd_gh2,cvw_gh2 node phase.js L/phase_6s.json 6000 > L/phase_6s.log 2>&1
w; VARS=baseline,cvd_gh2,cvw_gh2 node warm.js L/warm_t4.json 4 2 > L/warm_t4.log 2>&1
w; VARS=baseline,cvd_gh2,cvw_gh2 node warm.js L/warm_t1.json 1 1 > L/warm_t1.log 2>&1
w; node contain.js L_c1440 1440x900 cvd_gh2 > L/contain_1440.log 2>&1
w; node contain.js L_c1024 1024x768 cvd_gh2 > L/contain_1024.log 2>&1
w; node contain.js L_c390 390x844m cvd_gh2 > L/contain_390.log 2>&1
w; node walk.js L_j1366 1366x768 / jump cvd_gh2 > L/walk_j1366.log 2>&1
w; node walk.js L_j390 390x844 / mobile,jump cvd_gh2 > L/walk_j390.log 2>&1
echo done > L/chain4.done
