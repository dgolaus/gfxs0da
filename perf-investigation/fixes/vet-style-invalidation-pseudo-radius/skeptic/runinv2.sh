#!/bin/bash
cd "$(dirname "$0")"
while pgrep -f runpx.sh >/dev/null; do sleep 20; done
node inv.js pradf / 1440x900 forced pradf_index_1440_forced 2>&1 | head -12
node inv.js pradf /slots/ 1440x900 forced pradf_slots_1440_forced 2>&1 | head -12
node inv.js prad / 1440x900 forced ctl_prad_index_1440_forced 2>&1 | head -4
echo DONE
