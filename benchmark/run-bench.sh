#!/bin/bash
set -a
. /var/home/louie/Projects/Volunteering-Consulting/alex-cite-checker/.env
. /var/home/louie/Projects/Volunteering-Consulting/alex-cite-checker/workbench/.env
set +a
cd /var/home/louie/Projects/Volunteering-Consulting/alex-cite-checker/citation-checker-script/.worktrees/body-classifier-bench/benchmark
exec node run_benchmark.js --providers=claude-sonnet-4-5,gemini-2.5-flash,openrouter-olmo-3.1-32b,openrouter-mistral-small-3.2,openrouter-granite-4.1-8b,openrouter-gemma-4-26b-a4b,openrouter-qwen-3-32b,hf-qwen3-32b,hf-gpt-oss-20b,hf-deepseek-v3 > benchmark-run.log 2>&1
