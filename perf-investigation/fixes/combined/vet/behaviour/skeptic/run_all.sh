#!/bin/bash
cd "$(dirname "$0")"
for t in resize keys wheel4x history navclicks1920 navclicks1024 navclicks1440dpr2 navclicks1440cpu4 navclicks768touch navclicks2560 mobheight; do
  echo "== $t $(date +%T)"; timeout 900 node sk.js $t > logs/$t.log 2>&1; echo "exit $? $(date +%T)"
done
