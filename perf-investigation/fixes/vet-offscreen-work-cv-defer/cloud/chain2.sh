#!/bin/bash
cd /home/user/gfxs0da/perf-investigation/fixes/vet-offscreen-work-cv-defer/cloud
until [ -f chain1.done ]; do sleep 5; done
waitsrv() { until curl -s -o /dev/null http://localhost:5173/; do sleep 5; done; }
waitsrv; VARS=baseline,base_i,cvd,cvd_gh,cvw_gh node behave.js behave_1440.json 1440x900 > behave_1440.log 2>&1
waitsrv; VARS=baseline,cvd_gh,cvw_gh node behave.js behave_390.json 390x844m > behave_390.log 2>&1
waitsrv; VARS=baseline,cvd_gh node behave.js behave_red.json 1440x900 reduced > behave_red.log 2>&1
waitsrv; VARS=baseline,base_i,cvd_gh,cvw_gh node pages.js vetcvd_pages > pages.log 2>&1
waitsrv; VARS=baseline,cvd_gh,cvw_gh node phase.js phase_6s.json 6000 > phase_6s.log 2>&1
waitsrv; VARS=baseline,cvd_gh,cvw_gh node warm.js warm_t4.json 4 2 > warm_t4.log 2>&1
waitsrv; VARS=baseline,cvd_gh,cvw_gh node warm.js warm_t1.json 1 1 > warm_t1.log 2>&1
waitsrv; node contain.js vetcvd_c1440 1440x900 cvd_gh > contain_1440.log 2>&1
waitsrv; node contain.js vetcvd_c1024 1024x768 cvd_gh > contain_1024.log 2>&1
waitsrv; node contain.js vetcvd_c390 390x844m cvd_gh > contain_390.log 2>&1
echo CHAIN2 DONE > chain2.done
