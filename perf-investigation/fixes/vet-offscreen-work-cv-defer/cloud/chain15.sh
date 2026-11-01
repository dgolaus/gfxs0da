#!/bin/bash
cd /home/user/gfxs0da/perf-investigation/fixes/vet-offscreen-work-cv-defer/cloud
until [ -f L/chain14.done ]; do sleep 5; done
w() { until curl -s -o /dev/null http://localhost:5173/; do sleep 5; done; }
w; VARS=baseline,cvw_stay node anchors.js L/anchors_stay.json 1440x900,390x844m about,process,pricing,contact 2 > L/anchors_stay.log 2>&1
w; VARS=baseline,base_i,cvw_stay node precise.js L/precise_1280_stay.json 1280x720 40 250 > L/precise_1280_stay.log 2>&1
w; VARS=baseline,cvw_stay node behave.js L/behave_1440_stay.json 1440x900 > L/behave_1440_stay.log 2>&1
w; VARS=baseline,cvw_stay node warm.js L/warm_t4_stay.json 4 2 > L/warm_t4_stay.log 2>&1
w; VARS=baseline,cvw_stay node phase.js L/phase_stay.json 9000 > L/phase_stay.log 2>&1
w; (cd /home/user/gfxs0da/perf-investigation && node -r /tmp/claude-0/-home-user-gfxs0da/0364eb59-08fc-5b06-a692-a06b7bdc7a68/scratchpad/pp-hook.js fixes/vet-offscreen-work-cv-defer/cloud/benchcopy2/bench.js visual fixes/vet-offscreen-work-cv-defer/cloud/bench_variants2.json) > L/bench_visual_stay.log 2>&1
echo done > L/chain15.done
