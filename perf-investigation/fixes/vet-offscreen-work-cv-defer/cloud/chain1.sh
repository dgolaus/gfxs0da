#!/bin/bash
cd /home/user/gfxs0da/perf-investigation/fixes/vet-offscreen-work-cv-defer/cloud
until [ -f anchors_gh4.json ] && ! pgrep -f "node anchors.js" >/dev/null; do sleep 5; done
waitsrv() { until curl -s -o /dev/null http://localhost:5173/; do sleep 5; done; }
waitsrv; node endwheel.js endwheel_early.json 1920x1080,1366x768,1280x720,1024x768,768x1024,390x844m,360x740m 1500 baseline,cvd_gh,cvw_gh > endwheel_early.log 2>&1
waitsrv; node endwheel.js endwheel_late.json 1366x768,1024x768 10000 baseline,cvw_gh > endwheel_late.log 2>&1
waitsrv; VARS=baseline,cvd,cvd_g,cvw,cvw_g node navgrad.js navgrad_desk.json 1440x900,1366x768 '#trust,#process,#about' 4000 1 > navgrad_desk.log 2>&1
waitsrv; VARS=baseline,cvd,cvd_g,cvw_g node navgrad.js navgrad_mob.json 390x844m '#process,#trust,#work' 4000 1 > navgrad_mob.log 2>&1
waitsrv; VARS=baseline,base_i,cvd,cvd_gh,cvw_gh node fontprobe.js fontprobe_top.json 1440x900 > fontprobe_top.log 2>&1
echo CHAIN1 DONE > chain1.done
