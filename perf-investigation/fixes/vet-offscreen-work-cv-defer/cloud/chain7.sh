#!/bin/bash
cd /home/user/gfxs0da/perf-investigation/fixes/vet-offscreen-work-cv-defer/cloud
until [ -f L/chain6.done ]; do sleep 5; done
w() { until curl -s -o /dev/null http://localhost:5173/; do sleep 5; done; }
w; (node navprobe.js 390x844m; VARS=baseline,base_i node navprobe.js 390x844m) > L/navprobe.log 2>&1
w; VARS=baseline,cvd_gh3,cvw_gh3 node behave.js L/behave_1440_gh3.json 1440x900 > L/behave_1440_gh3.log 2>&1
w; VARS=baseline,cvd_gh3,cvw_gh3 node anchors.js L/anchors_gh3.json 1440x900,390x844m process,pricing 2 > L/anchors_gh3.log 2>&1
w; (cd /home/user/gfxs0da/perf-investigation && node -r /tmp/claude-0/-home-user-gfxs0da/0364eb59-08fc-5b06-a692-a06b7bdc7a68/scratchpad/pp-hook.js fixes/vet-offscreen-work-cv-defer/cloud/benchcopy/bench.js visual fixes/vet-offscreen-work-cv-defer/cloud/bench_variants.json) > L/bench_visual.log 2>&1
ls benchcopy/vis_*.png | wc -l > L/bench_vis_count.txt
echo done > L/chain7.done
