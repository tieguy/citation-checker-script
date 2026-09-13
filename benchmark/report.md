# Citation Verification Benchmark Results

Generated: 2026-05-14T03:43:05.065Z

## Overview

- Total entries: 185
- Providers tested: openrouter-olmo-3.1-32b, hf-gpt-oss-20b, hf-qwen3-32b, openrouter-mistral-small-3.2, hf-deepseek-v3, claude-sonnet-4-5, gemini-2.5-flash, openrouter-gemma-4-26b-a4b, openrouter-qwen-3-32b, openrouter-granite-4.1-8b
- Total API calls: 1850
- Pipeline coverage: 95.1% (176/185 usable; 9 pipeline-attributed SU)

## Provider Comparison

| Provider | Model | Exact Accuracy | Lenient Accuracy | Binary Accuracy | Avg Latency |
|----------|-------|----------------|------------------|-----------------|-------------|
| Hf-deepseek-v3 | deepseek-ai/DeepSeek-V3 | 68.1% | 80.0% | 81.6% | 2653ms |
| Openrouter-qwen-3-32b | qwen/qwen3-32b | 65.0% | 79.8% | 81.4% | 11920ms |
| Hf-qwen3-32b | Qwen/Qwen3-32B | 64.9% | 79.5% | 81.6% | 1470ms |
| Gemini-2.5-flash | gemini-2.5-flash | 64.0% | 78.7% | 80.3% | 3797ms |
| Openrouter-granite-4.1-8b | ibm-granite/granite-4.1-8b | 60.5% | 77.8% | 79.5% | 1377ms |
| Hf-gpt-oss-20b | openai/gpt-oss-20b | 58.7% | 71.9% | 73.7% | 1466ms |
| Openrouter-gemma-4-26b-a4b | google/gemma-4-26b-a4b-it | 58.4% | 74.1% | 75.7% | 6484ms |
| Openrouter-mistral-small-3.2 | mistralai/mistral-small-3.2-24b-instruct | 57.3% | 75.7% | 77.3% | 2295ms |
| Claude-sonnet-4-5 | claude-sonnet-4-5-20250929 | 56.8% | 74.1% | 75.7% | 4171ms |
| Openrouter-olmo-3.1-32b | allenai/olmo-3.1-32b-instruct | 0.0% | 0.0% | 33.3% | 100ms |

## Detailed Results

### Hf-deepseek-v3 (deepseek-ai/DeepSeek-V3)

**Accuracy Metrics:**
- Exact match (all): 126/185 (68.1%)
- Exact match (model-attributed, excl. pipeline SU): 126/176 (71.6%)
- Lenient (includes partial): 148/185 (80.0%)
- Binary (support vs not): 81.6%
- Errors: 0

**Latency:**
- Average: 2653ms
- Range: 953ms - 5650ms

**Confidence Calibration:**
- Average confidence: 0.0
- When correct: 0.0
- When wrong: NaN
- Calibration gap: NaN (higher = better)

**Confusion Matrix:**

| Ground Truth \ Predicted | Supported | Partial | Not Supported | Unavailable |
|--------------------------|-----------|---------|---------------|-------------|
| Supported | 63 | 9 | 7 | 4 |
| Partial | 13 | 29 | 10 | 2 |
| Not Supported | 2 | 9 | 34 | 3 |
| Unavailable | 0 | 0 | 0 | 0 |

### Openrouter-qwen-3-32b (qwen/qwen3-32b)

**Accuracy Metrics:**
- Exact match (all): 119/183 (65.0%)
- Exact match (model-attributed, excl. pipeline SU): 119/174 (68.4%)
- Lenient (includes partial): 146/183 (79.8%)
- Binary (support vs not): 81.4%
- Errors: 2

**Latency:**
- Average: 11920ms
- Range: 898ms - 59739ms

**Confidence Calibration:**
- Average confidence: 0.0
- When correct: 0.0
- When wrong: NaN
- Calibration gap: NaN (higher = better)

**Confusion Matrix:**

| Ground Truth \ Predicted | Supported | Partial | Not Supported | Unavailable |
|--------------------------|-----------|---------|---------------|-------------|
| Supported | 50 | 17 | 11 | 4 |
| Partial | 10 | 31 | 10 | 2 |
| Not Supported | 2 | 5 | 38 | 3 |
| Unavailable | 0 | 0 | 0 | 0 |

### Hf-qwen3-32b (Qwen/Qwen3-32B)

**Accuracy Metrics:**
- Exact match (all): 120/185 (64.9%)
- Exact match (model-attributed, excl. pipeline SU): 120/176 (68.2%)
- Lenient (includes partial): 147/185 (79.5%)
- Binary (support vs not): 81.6%
- Errors: 0

**Latency:**
- Average: 1470ms
- Range: 778ms - 2698ms

**Confidence Calibration:**
- Average confidence: 0.0
- When correct: 0.0
- When wrong: NaN
- Calibration gap: NaN (higher = better)

**Confusion Matrix:**

| Ground Truth \ Predicted | Supported | Partial | Not Supported | Unavailable |
|--------------------------|-----------|---------|---------------|-------------|
| Supported | 52 | 18 | 9 | 4 |
| Partial | 9 | 31 | 11 | 2 |
| Not Supported | 3 | 4 | 37 | 3 |
| Unavailable | 0 | 0 | 0 | 0 |

### Gemini-2.5-flash (gemini-2.5-flash)

**Accuracy Metrics:**
- Exact match (all): 114/178 (64.0%)
- Exact match (model-attributed, excl. pipeline SU): 114/169 (67.5%)
- Lenient (includes partial): 140/178 (78.7%)
- Binary (support vs not): 80.3%
- Errors: 7

**Latency:**
- Average: 3797ms
- Range: 868ms - 9446ms

**Confidence Calibration:**
- Average confidence: 0.0
- When correct: 0.0
- When wrong: NaN
- Calibration gap: NaN (higher = better)

**Confusion Matrix:**

| Ground Truth \ Predicted | Supported | Partial | Not Supported | Unavailable |
|--------------------------|-----------|---------|---------------|-------------|
| Supported | 47 | 18 | 12 | 4 |
| Partial | 8 | 31 | 9 | 2 |
| Not Supported | 2 | 6 | 36 | 3 |
| Unavailable | 0 | 0 | 0 | 0 |

### Openrouter-granite-4.1-8b (ibm-granite/granite-4.1-8b)

**Accuracy Metrics:**
- Exact match (all): 112/185 (60.5%)
- Exact match (model-attributed, excl. pipeline SU): 112/176 (63.6%)
- Lenient (includes partial): 144/185 (77.8%)
- Binary (support vs not): 79.5%
- Errors: 0

**Latency:**
- Average: 1377ms
- Range: 470ms - 8410ms

**Confidence Calibration:**
- Average confidence: 0.0
- When correct: 0.0
- When wrong: NaN
- Calibration gap: NaN (higher = better)

**Confusion Matrix:**

| Ground Truth \ Predicted | Supported | Partial | Not Supported | Unavailable |
|--------------------------|-----------|---------|---------------|-------------|
| Supported | 62 | 10 | 7 | 4 |
| Partial | 22 | 19 | 11 | 2 |
| Not Supported | 5 | 9 | 31 | 3 |
| Unavailable | 0 | 0 | 0 | 0 |

### Hf-gpt-oss-20b (openai/gpt-oss-20b)

**Accuracy Metrics:**
- Exact match (all): 98/167 (58.7%)
- Exact match (model-attributed, excl. pipeline SU): 98/158 (62.0%)
- Lenient (includes partial): 120/167 (71.9%)
- Binary (support vs not): 73.7%
- Errors: 18

**Latency:**
- Average: 1466ms
- Range: 495ms - 3918ms

**Confidence Calibration:**
- Average confidence: 0.0
- When correct: 0.0
- When wrong: NaN
- Calibration gap: NaN (higher = better)

**Confusion Matrix:**

| Ground Truth \ Predicted | Supported | Partial | Not Supported | Unavailable |
|--------------------------|-----------|---------|---------------|-------------|
| Supported | 35 | 18 | 20 | 4 |
| Partial | 4 | 24 | 16 | 2 |
| Not Supported | 1 | 1 | 39 | 3 |
| Unavailable | 0 | 0 | 0 | 0 |

### Openrouter-gemma-4-26b-a4b (google/gemma-4-26b-a4b-it)

**Accuracy Metrics:**
- Exact match (all): 108/185 (58.4%)
- Exact match (model-attributed, excl. pipeline SU): 108/176 (61.4%)
- Lenient (includes partial): 137/185 (74.1%)
- Binary (support vs not): 75.7%
- Errors: 0

**Latency:**
- Average: 6484ms
- Range: 646ms - 44583ms

**Confidence Calibration:**
- Average confidence: 0.0
- When correct: 0.0
- When wrong: NaN
- Calibration gap: NaN (higher = better)

**Confusion Matrix:**

| Ground Truth \ Predicted | Supported | Partial | Not Supported | Unavailable |
|--------------------------|-----------|---------|---------------|-------------|
| Supported | 39 | 25 | 15 | 4 |
| Partial | 4 | 31 | 17 | 2 |
| Not Supported | 2 | 5 | 38 | 3 |
| Unavailable | 0 | 0 | 0 | 0 |

### Openrouter-mistral-small-3.2 (mistralai/mistral-small-3.2-24b-instruct)

**Accuracy Metrics:**
- Exact match (all): 106/185 (57.3%)
- Exact match (model-attributed, excl. pipeline SU): 106/176 (60.2%)
- Lenient (includes partial): 140/185 (75.7%)
- Binary (support vs not): 77.3%
- Errors: 0

**Latency:**
- Average: 2295ms
- Range: 746ms - 25410ms

**Confidence Calibration:**
- Average confidence: 0.0
- When correct: 0.0
- When wrong: NaN
- Calibration gap: NaN (higher = better)

**Confusion Matrix:**

| Ground Truth \ Predicted | Supported | Partial | Not Supported | Unavailable |
|--------------------------|-----------|---------|---------------|-------------|
| Supported | 66 | 7 | 6 | 4 |
| Partial | 27 | 20 | 5 | 2 |
| Not Supported | 3 | 22 | 20 | 3 |
| Unavailable | 0 | 0 | 0 | 0 |

### Claude-sonnet-4-5 (claude-sonnet-4-5-20250929)

**Accuracy Metrics:**
- Exact match (all): 105/185 (56.8%)
- Exact match (model-attributed, excl. pipeline SU): 105/176 (59.7%)
- Lenient (includes partial): 137/185 (74.1%)
- Binary (support vs not): 75.7%
- Errors: 0

**Latency:**
- Average: 4171ms
- Range: 2168ms - 7986ms

**Confidence Calibration:**
- Average confidence: 0.0
- When correct: 0.0
- When wrong: NaN
- Calibration gap: NaN (higher = better)

**Confusion Matrix:**

| Ground Truth \ Predicted | Supported | Partial | Not Supported | Unavailable |
|--------------------------|-----------|---------|---------------|-------------|
| Supported | 50 | 16 | 13 | 4 |
| Partial | 16 | 20 | 16 | 2 |
| Not Supported | 1 | 9 | 35 | 3 |
| Unavailable | 0 | 0 | 0 | 0 |

### Openrouter-olmo-3.1-32b (allenai/olmo-3.1-32b-instruct)

**Accuracy Metrics:**
- Exact match (all): 0/9 (0.0%)
- Exact match (model-attributed, excl. pipeline SU): 0/0 (0.0%)
- Lenient (includes partial): 0/9 (0.0%)
- Binary (support vs not): 33.3%
- Errors: 176

**Latency:**
- Average: 100ms
- Range: 20ms - 7337ms

**Confidence Calibration:**
- Average confidence: 0.0
- When correct: 0.0
- When wrong: NaN
- Calibration gap: NaN (higher = better)

**Confusion Matrix:**

| Ground Truth \ Predicted | Supported | Partial | Not Supported | Unavailable |
|--------------------------|-----------|---------|---------------|-------------|
| Supported | 0 | 0 | 0 | 4 |
| Partial | 0 | 0 | 0 | 2 |
| Not Supported | 0 | 0 | 0 | 3 |
| Unavailable | 0 | 0 | 0 | 0 |

## Recommendations

Based on the benchmark results:

1. **Best overall accuracy**: Hf-deepseek-v3 with 68.1% exact match
2. **Fastest response**: Openrouter-olmo-3.1-32b with 100ms average
3. **Best calibrated**: Openrouter-olmo-3.1-32b (confidence scores correlate with correctness)
