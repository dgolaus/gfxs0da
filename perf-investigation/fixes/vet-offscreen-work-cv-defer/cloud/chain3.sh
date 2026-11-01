#!/bin/bash
# all runs with the fixed harness (Lenis + Google Fonts served locally, desktop hover/pointer media)
cd /home/user/gfxs0da/perf-investigation/fixes/vet-offscreen-work-cv-defer/cloud
w() { until curl -s -o /dev/null http://localhost:5173/; do sleep 5; done; }
w; VARS=baseline,cvd,cvw,cvd_gh,cvw_gh node fragprobe.js L/frag_pricing_1440.json 1440x900 pricing 6 > L/frag_pricing_1440.log 2>&1
w; VARS=baseline,cvd,cvw,cvd_gh,cvw_gh node anchors.js L/anchors_1440.json 1440x900 work,about,process,trust,pricing,contact 1 > L/anchors_1440.log 2>&1
w; VARS=baseline,cvd_gh,cvw_gh node anchors.js L/anchors_gh.json 1440x900,1366x768,1920x1080,1280x720,390x844m about,process,trust,pricing,contact 2 > L/anchors_gh.log 2>&1
w; VARS=baseline,base_i,cvd,cvd_gh,cvw_gh node fontprobe.js L/fontprobe_top.json 1440x900 > L/fontprobe_top.log 2>&1
w; VARS=baseline,cvd,cvd_gh,cvw_gh node fontprobe.js L/fontprobe_pricing.json 1440x900 pricing > L/fontprobe_pricing.log 2>&1
w; node endwheel.js L/endwheel_early.json 1920x1080,1366x768,1280x720,1024x768,768x1024,390x844m,360x740m 1500 baseline,cvd_gh,cvw_gh > L/endwheel_early.log 2>&1
w; node endwheel.js L/endwheel_late.json 1366x768,1024x768 10000 baseline,cvw_gh > L/endwheel_late.log 2>&1
w; VARS=baseline,cvd,cvd_gh,cvw_gh node navgrad.js L/navgrad_desk.json 1440x900,1366x768 '#trust,#process,#about' 4000 1 > L/navgrad_desk.log 2>&1
w; VARS=baseline,cvd,cvd_gh,cvw_gh node navgrad.js L/navgrad_mob.json 390x844m '#process,#trust,#work' 4000 1 > L/navgrad_mob.log 2>&1
echo done > L/chain3.done
