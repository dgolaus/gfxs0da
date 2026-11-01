#!/bin/bash
cd "$(dirname "$0")"
until grep -q QDONE q.log; do sleep 10; done
node sheenpx.js 1440x900 - / prad pradf > sheen2_1440_index.log 2>&1
node sheenpx.js 1440x900 - /404.html prad pradf > sheen2_1440_404.log 2>&1
echo Q2DONE >> q.log
