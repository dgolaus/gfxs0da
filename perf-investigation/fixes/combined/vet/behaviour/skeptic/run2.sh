#!/bin/bash
cd "$(dirname "$0")"
until [ "$(grep -c exit logs/run_all.log)" -ge 11 ]; do sleep 5; done
echo "== probe2 $(date +%T)"; timeout 900 node probe2.js 4 > logs/probe2.log 2>&1; echo "exit $?"
echo "== rasterY $(date +%T)"; Y=4300 N=4 timeout 1200 node sk.js rasterY > logs/rasterY_4300.log 2>&1; echo "exit $?"
echo "== rasterYhist $(date +%T)"; HIST=1 TAGX=_hist Y=4300 N=3 timeout 1500 node sk.js rasterY > logs/rasterY_4300_hist.log 2>&1; echo "exit $?"
echo "== done $(date +%T)"
