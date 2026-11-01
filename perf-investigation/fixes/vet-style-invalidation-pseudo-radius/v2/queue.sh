#!/bin/bash
cd "$(dirname "$0")"
until grep -q EXIT sheen_1440_index.log; do sleep 10; done
node comp.js pradf index_1440_pradf2 / 1440x900 > q.log 2>&1
node comp.js baseline index_1440_C / 1440x900 >> q.log 2>&1
node ect.js 2 baseline prad pradf > ect.log 2>&1
node walk.js vetprad_w1440 1440x900 / - prad pradf > walk1440.log 2>&1
node walk.js vetprad_w390 390x844 / mobile prad pradf > walk390.log 2>&1
node sheenpx.js 390x844 mobile / prad pradf > sheen_390_index.log 2>&1
echo QDONE >> q.log
