#!/bin/bash
cd "$(dirname "$0")"
until grep -q Q3DONE q.log; do sleep 10; done
node walk.js vetprad_w390c 390x844 / mobile ctrl prad pradf > walk390c.log 2>&1
echo Q4DONE >> q.log
