#!/bin/bash
cd "$(dirname "$0")"
until grep -q Q2DONE q.log; do sleep 10; done
node walk.js vetprad_w1440c 1440x900 / - ctrl prad pradf > walk1440c.log 2>&1
echo Q3DONE >> q.log
