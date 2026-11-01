#!/bin/bash
cd "$(dirname "$0")"
for pg in / /tos/ /slots/ /404.html; do
  n=$(echo $pg | tr -dc 'a-z0-9'); [ -z "$n" ] && n=index
  for vp in "1440x900:" "390x844:mobile"; do
    sz=${vp%%:*}; mob=${vp##*:}; w=${sz%%x*}
    for v in baseline:A baseline:B prad:prad pradf:pradf; do
      node comp.js ${v%%:*} ${n}_${w}_${v##*:} $pg $sz $mob 2>&1 | cut -c1-600
    done
  done
done
echo DONE
