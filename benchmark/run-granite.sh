#!/bin/bash
set -a
. /var/home/louie/Projects/Volunteering-Consulting/alex-cite-checker/.env
. /var/home/louie/Projects/Volunteering-Consulting/alex-cite-checker/workbench/.env
set +a
cd /var/home/louie/Projects/Volunteering-Consulting/alex-cite-checker/citation-checker-script/.worktrees/body-classifier-bench/benchmark
exec node run_benchmark.js --providers=openrouter-granite-4.1-8b > granite-rerun.log 2>&1
