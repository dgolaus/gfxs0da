#!/bin/bash
cd /home/user/gfxs0da/perf-investigation/fixes/vet-offscreen-work-cv-defer/cloud
until [ -f L/chain7.done ]; do sleep 5; done
w() { until curl -s -o /dev/null http://localhost:5173/; do sleep 5; done; }
w; node navwalk.js > L/navwalk.log 2>&1
w; node precise.js L/precise_1440.json 1440x900 40 250 > L/precise_1440.log 2>&1
w; node precise.js L/precise_1280.json 1280x720 40 250 > L/precise_1280.log 2>&1
w; node precise.js L/precise_390.json 390x844m 60 250 > L/precise_390.log 2>&1
echo done > L/chain8.done
