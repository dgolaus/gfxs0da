#!/bin/bash
cd /home/user/gfxs0da/perf-investigation/fixes/vet-offscreen-work-cv-defer/cloud
until [ -f L/chain15.done ]; do sleep 5; done
w() { until curl -s -o /dev/null http://localhost:5173/; do sleep 5; done; }
w; (node sub1366.js 2500 1; node sub1366.js 2500 0; node sub1366.js 12000 0) > L/sub1366.log 2>&1
echo done > L/chain16.done
