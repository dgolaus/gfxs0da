#!/bin/bash
cd /home/user/gfxs0da/perf-investigation/fixes/combined/vet/behaviour
for t in navmorph accent walkvars anchors testimonials lightbox parallax rail visits pages reduced discord; do
  echo "=== $t $(date +%T)" ; timeout 2400 node beh.js $t > logs/$t.log 2>&1; echo "exit $? $(date +%T)"
done
touch logs/ALL.done
