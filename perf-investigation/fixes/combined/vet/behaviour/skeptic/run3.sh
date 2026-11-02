#!/bin/bash
cd "$(dirname "$0")"
until grep -q "== done" logs/run2.log; do sleep 5; done
echo "== probe3 $(date +%T)"; timeout 900 node probe3.js > logs/probe3.log 2>&1; echo "exit $?"
echo "== probe2b $(date +%T)"; OUTN=probe2_end_b.json timeout 1500 node probe2.js 6 > logs/probe2b.log 2>&1; echo "exit $?"
echo "== done $(date +%T)"
