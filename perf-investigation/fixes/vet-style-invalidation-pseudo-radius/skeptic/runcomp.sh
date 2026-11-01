#!/bin/bash
cd "$(dirname "$0")"
while pgrep -f "inv.js" >/dev/null || pgrep -f runinv.sh >/dev/null; do sleep 20; done
run() { pg=$1; n=$2; sz=$3; fl=$4; t=$5; for v in baseline:A baseline:B pradf:pradf; do node comp.js ${v%%:*} ${t}_${v##*:} $pg $sz "$fl" 2>&1 | cut -c1-300; done; node cmp.js $t 2>&1; }
run / index 768x1024 "" index_768
run / index 1920x1080 "" index_1920
run / index 320x640 mobile index_320
run /slots/ slots 768x1024 "" slots_768
run /slots/ slots 1440x900 "" slots_1440s
run /tos/ tos 1024x768 "" tos_1024
run /404.html 404 1920x1080 "" 404_1920
run / index 1440x900 print index_1440print
run / index 1440x900 forced index_1440forced
run / index 1440x900 dpr2 index_1440dpr2
run / index 390x844 mobile,reduced index_390mred
echo DONE
