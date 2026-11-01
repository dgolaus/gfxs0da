#!/bin/bash
cd "$(dirname "$0")"
node inv.js baseline / 1440x900 "" sanity_base_index1440 2>&1 | head -12
for pg in / /tos/ /slots/ /404.html; do
  n=$(echo $pg | tr -dc 'a-z0-9'); [ -z "$n" ] && n=index
  for vp in "1440x900:" "390x844:mobile" "768x1024:" "1920x1080:" "320x640:mobile" "1024x768:"; do
    sz=${vp%%:*}; fl=${vp##*:}
    node inv.js pradf $pg $sz "$fl" pradf_${n}_${sz} 2>&1 | head -12
  done
done
for fl in reduced forced print light dpr2 contrast; do node inv.js pradf / 1440x900 $fl pradf_index_1440_$fl 2>&1 | head -12; done
node inv.js pradf / 390x844 mobile,reduced pradf_index_390_mreduced 2>&1 | head -12
node inv.js pradf /slots/ 1440x900 forced pradf_slots_1440_forced 2>&1 | head -12
node inv.js baseline /slots/ 768x1024 "" sanity_base_slots768 2>&1 | head -12
echo DONE
