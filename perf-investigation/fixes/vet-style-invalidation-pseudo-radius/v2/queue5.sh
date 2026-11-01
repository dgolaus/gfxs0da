#!/bin/bash
cd "$(dirname "$0")"
node walk.js vetprad_w1440d 1440x900 / - ctrl prad pradf > walk1440d.log 2>&1
node walk.js vetprad_w390d 390x844 / mobile ctrl prad pradf > walk390d.log 2>&1
node sheenpx.js 1440x900 - / prad pradf > sheen2_1440_index.log 2>&1
node sheenpx.js 390x844 mobile / prad pradf > sheen2_390_index.log 2>&1
echo Q5DONE >> q5.log
