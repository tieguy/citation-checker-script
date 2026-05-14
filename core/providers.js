// LLM provider dispatch. Pure HTTP routing — callers build the prompt.

// Shared call shape for OpenAI-compatible chat-completion upstreams.
// Used by PublicAI/HF (proxy-routed; key injected upstream), HF when the
// caller supplies their own bearer token (direct call to the HF router),
// OpenRouter (which adds attribution headers and surfaces per-call cost),
// and the benchmark runner (which calls direct PublicAI/OpenAI endpoints
// with bearer auth from environment variables).
// `responseFormat` is OpenAI-compatible structured-output: pass
// `{ type: 'json_object' }` to force JSON-only output, or a JSON-schema
// object on backends that support it. OpenRouter passes the param
// through to the underlying model; backends that don't recognise it
// generally ignore it rather than error. Small / weaker instruction-tuned
// models benefit most — Granite 4.1 8B in particular regressed from
// ~0.5% to 13% JSON-parse failures under terser prompts until this
// hint was supplied, after which parse failures returned to 0.
export async function callOpenAICompatibleChat({ url, apiKey, model, systemPrompt, userContent, label, extraHeaders, maxTokens = 2048, temperature = 0.1, responseFormat }) {
    const requestBody = {
        model: model,
        messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userContent }
        ],
        max_tokens: maxTokens,
        temperature: temperature
    };
    if (responseFormat) requestBody.response_format = responseFormat;

    const headers = { 'Content-Type': 'application/json' };
    if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;
    if (extraHeaders) Object.assign(headers, extraHeaders);

    const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
        const errorText = await response.text();
        let errorMessage;
        try {
            const errorData = JSON.parse(errorText);
            errorMessage = errorData.error?.message || errorText;
        } catch {
            errorMessage = errorText;
        }
        throw new Error(`${label} API request failed (${response.status}): ${errorMessage}`);
    }

    const data = await response.json();

    if (!data.choices?.[0]?.message?.content) {
        throw new Error('Invalid API response format');
    }

    return {
        text: data.choices[0].message.content,
        usage: {
            input: data.usage?.prompt_tokens || 0,
            output: data.usage?.completion_tokens || 0,
            cost_usd: data.usage?.cost ?? null
        }
    };
}

export async function callPublicAIAPI({ apiKey, model, systemPrompt, userContent, workerBase = 'https://publicai-proxy.alaexis.workers.dev', maxTokens, temperature }) {
    return callOpenAICompatibleChat({
        url: workerBase,
        apiKey,
        model, systemPrompt, userContent, maxTokens, temperature,
        label: 'PublicAI',
    });
}

// HF direct router endpoint, used when the caller supplies an apiKey.
// Without one, the call falls back to the worker proxy's /hf path, which
// injects an upstream key on the user's behalf.
const HF_DIRECT_URL = 'https://router.huggingface.co/v1/chat/completions';

export async function callHuggingFaceAPI({ apiKey, model, systemPrompt, userContent, workerBase = 'https://publicai-proxy.alaexis.workers.dev', maxTokens, temperature }) {
    const direct = Boolean(apiKey);
    return callOpenAICompatibleChat({
        url: direct ? HF_DIRECT_URL : `${workerBase}/hf`,
        apiKey: direct ? apiKey : undefined,
        model, systemPrompt, userContent, maxTokens, temperature,
        label: 'HuggingFace',
    });
}

// OpenRouter routes OpenAI-compatible requests across many open-weight backends.
// Per-call USD cost is surfaced on response.usage.cost (no opt-in flag required
// as of 2026; the older `usage: { include: true }` parameter is deprecated).
// Attribution headers (HTTP-Referer + X-Title) are recommended by OpenRouter
// for analytics; they don't affect routing.
export async function callOpenRouterAPI({ apiKey, model, systemPrompt, userContent, maxTokens, temperature, responseFormat }) {
    return callOpenAICompatibleChat({
        url: 'https://openrouter.ai/api/v1/chat/completions',
        apiKey,
        model, systemPrompt, userContent, maxTokens, temperature, responseFormat,
        label: 'OpenRouter',
        extraHeaders: {
            'HTTP-Referer': 'https://github.com/alex-o-748/citation-checker-script',
            'X-Title': 'citation-checker-script',
        },
    });
}

export async function callClaudeAPI({ apiKey, model, systemPrompt, userContent, maxTokens = 3000 }) {
    const requestBody = {
        model: model,
        max_tokens: maxTokens,
        system: systemPrompt,
        messages: [{ role: "user", content: userContent }]
    };

    const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'anthropic-dangerous-direct-browser-access': 'true'
        },
        body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API request failed (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    return {
        text: data.content[0].text,
        usage: {
            input: data.usage?.input_tokens || 0,
            output: data.usage?.output_tokens || 0,
            cost_usd: null
        }
    };
}

export async function callGeminiAPI({ apiKey, model, systemPrompt, userContent, maxTokens = 2048, temperature = 0.1, useStructuredPrompt = true }) {
    const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    // useStructuredPrompt:true (default) uses Gemini's proper systemInstruction
    // + contents shape; the userscript and CLI have always used this.
    // useStructuredPrompt:false concatenates `${systemPrompt}\n\n${userContent}`
    // into a single user turn — the historical benchmark-runner shape, kept
    // available so past benchmark numbers stay reproducible until a deliberate
    // re-baselining run picks the canonical shape.
    const requestBody = useStructuredPrompt
        ? {
            contents: [{ parts: [{ text: userContent }] }],
            systemInstruction: { parts: [{ text: systemPrompt }] },
        }
        : {
            contents: [{ parts: [{ text: `${systemPrompt}\n\n${userContent}` }] }],
        };
    requestBody.generationConfig = {
        maxOutputTokens: maxTokens,
        temperature: temperature,
        // responseMimeType: 'application/json' constrains Gemini to emit
        // syntactically valid JSON only. Without it, Gemini occasionally
        // wraps output in markdown fences or emits prose, both of which
        // the verdict parser fails on. See issue #75.
        responseMimeType: 'application/json'
    };

    const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
    });

    const responseData = await response.json();

    if (!response.ok) {
        const errorDetail = responseData.error?.message || response.statusText;
        throw new Error(`API request failed (${response.status}): ${errorDetail}`);
    }

    if (!responseData.candidates?.[0]?.content?.parts?.[0]?.text) {
        throw new Error('Invalid API response format or no content generated.');
    }

    return {
        text: responseData.candidates[0].content.parts[0].text,
        usage: {
            input: responseData.usageMetadata?.promptTokenCount || 0,
            output: responseData.usageMetadata?.candidatesTokenCount || 0,
            cost_usd: null
        }
    };
}

export async function callOpenAIAPI({ apiKey, model, systemPrompt, userContent, maxTokens = 2000, temperature = 0.1 }) {
    const requestBody = {
        model: model,
        max_tokens: maxTokens,
        messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userContent }
        ],
        temperature: temperature
    };

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
        const errorText = await response.text();
        let errorMessage;
        try {
            const errorData = JSON.parse(errorText);
            errorMessage = errorData.error?.message || errorText;
        } catch {
            errorMessage = errorText;
        }
        throw new Error(`API request failed (${response.status}): ${errorMessage}`);
    }

    const data = await response.json();

    if (!data.choices?.[0]?.message?.content) {
        throw new Error('Invalid API response format');
    }

    return {
        text: data.choices[0].message.content,
        usage: {
            input: data.usage?.prompt_tokens || 0,
            output: data.usage?.completion_tokens || 0,
            cost_usd: null
        }
    };
}

export async function callProviderAPI(name, config) {
    switch (name) {
        case 'publicai':    return await callPublicAIAPI(config);
        case 'huggingface': return await callHuggingFaceAPI(config);
        case 'openrouter':  return await callOpenRouterAPI(config);
        case 'claude':      return await callClaudeAPI(config);
        case 'gemini':      return await callGeminiAPI(config);
        case 'openai':      return await callOpenAIAPI(config);
        default: throw new Error(`Unknown provider: ${name}`);
    }
}

// Provider metadata registry. Source of truth for atomized-pipeline
// orchestration (atomize, verifyAtoms, rollup) and for the benchmark
// runner. The userscript (main.js) keeps its own UI-facing registry in
// the WikipediaSourceVerifier constructor — that one carries BYOK key
// names, colors, and display labels. This one carries model IDs and
// the atomized-pipeline knobs (`smallModel`, `supportsAtomize`,
// `responseFormat`).
//
// Conventions:
//   - `smallModel` names the cheap variant for atomizer/judge calls.
//     When unset, the atomizer uses `model`.
//   - `supportsAtomize` defaults true. Flip to false per-provider if
//     Cell 1 vs Cell 2 ablation shows atomizer-quality issues; the
//     dispatcher in core/worker.js will fall back to the single-pass
//     verifier for those.
//   - `responseFormat` is forwarded to the OpenAI-compatible upstream
//     when present. Granite-4.1-8B opts in to JSON-mode this way.
export const PROVIDERS = {
    // Open-source models via PublicAI (direct API)
    'apertus-70b': {
        name: 'Apertus 70B',
        model: 'swiss-ai/apertus-70b-instruct',
        endpoint: 'https://api.publicai.co/v1/chat/completions',
        requiresKey: true,
        keyEnv: 'PUBLICAI_API_KEY',
        type: 'publicai',
        supportsAtomize: true
    },
    'qwen-sealion': {
        name: 'Qwen SEA-LION v4',
        model: 'aisingapore/Qwen-SEA-LION-v4-32B-IT',
        endpoint: 'https://api.publicai.co/v1/chat/completions',
        requiresKey: true,
        keyEnv: 'PUBLICAI_API_KEY',
        type: 'publicai',
        supportsAtomize: true
    },
    'olmo-32b': {
        name: 'OLMo 3.1 32B',
        model: 'allenai/Olmo-3.1-32B-Instruct',
        endpoint: 'https://api.publicai.co/v1/chat/completions',
        requiresKey: true,
        keyEnv: 'PUBLICAI_API_KEY',
        type: 'publicai',
        supportsAtomize: true
    },
    // Claude
    'claude-sonnet-4-5': {
        name: 'Claude Sonnet 4.5',
        model: 'claude-sonnet-4-5-20250929',
        endpoint: 'https://api.anthropic.com/v1/messages',
        requiresKey: true,
        keyEnv: 'ANTHROPIC_API_KEY',
        type: 'claude',
        supportsAtomize: true,
        smallModel: 'claude-haiku-4-5-20251001'
    },
    // Gemini
    'gemini-2.5-flash': {
        name: 'Gemini 2.5 Flash',
        model: 'gemini-2.5-flash',
        endpoint: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',
        requiresKey: true,
        keyEnv: 'GEMINI_API_KEY',
        type: 'gemini',
        supportsAtomize: true,
        smallModel: 'gemini-2.5-flash'
    },
    // Open-weights candidates via OpenRouter for the voting-panel selection sweep.
    // All five carry an OSI-compliant license (Apache 2.0 or MIT).
    'openrouter-mistral-small-3.2': {
        name: 'Mistral Small 3.2 24B (OpenRouter)',
        model: 'mistralai/mistral-small-3.2-24b-instruct',
        endpoint: 'https://openrouter.ai/api/v1/chat/completions',
        requiresKey: true,
        keyEnv: 'OPENROUTER_API_KEY',
        type: 'openrouter',
        supportsAtomize: true
    },
    'openrouter-olmo-3.1-32b': {
        name: 'OLMo 3.1 32B (OpenRouter)',
        model: 'allenai/olmo-3.1-32b-instruct',
        endpoint: 'https://openrouter.ai/api/v1/chat/completions',
        requiresKey: true,
        keyEnv: 'OPENROUTER_API_KEY',
        type: 'openrouter',
        supportsAtomize: true
    },
    'openrouter-deepseek-v3.2': {
        name: 'DeepSeek V3.2 (OpenRouter)',
        model: 'deepseek/deepseek-v3.2',
        endpoint: 'https://openrouter.ai/api/v1/chat/completions',
        requiresKey: true,
        keyEnv: 'OPENROUTER_API_KEY',
        type: 'openrouter',
        supportsAtomize: true
    },
    'openrouter-granite-4.1-8b': {
        name: 'Granite 4.1 8B (OpenRouter)',
        model: 'ibm-granite/granite-4.1-8b',
        endpoint: 'https://openrouter.ai/api/v1/chat/completions',
        requiresKey: true,
        keyEnv: 'OPENROUTER_API_KEY',
        type: 'openrouter',
        supportsAtomize: true,
        // Forces JSON-only output. Granite-8B's parse-error rate jumps from
        // ~0.5% to 13% under terser prompts without this hint; with it
        // supplied, parse failures return to 0.
        responseFormat: { type: 'json_object' }
    },
    'openrouter-gemma-4-26b-a4b': {
        name: 'Gemma 4 26B-A4B (OpenRouter)',
        model: 'google/gemma-4-26b-a4b-it',
        endpoint: 'https://openrouter.ai/api/v1/chat/completions',
        requiresKey: true,
        keyEnv: 'OPENROUTER_API_KEY',
        type: 'openrouter',
        supportsAtomize: true
    },
    'openrouter-qwen-3-32b': {
        name: 'Qwen 3 32B Instruct (OpenRouter)',
        model: 'qwen/qwen3-32b',
        endpoint: 'https://openrouter.ai/api/v1/chat/completions',
        requiresKey: true,
        keyEnv: 'OPENROUTER_API_KEY',
        type: 'openrouter',
        supportsAtomize: true
    },
    // Hugging Face Inference Providers — routed through router.huggingface.co.
    // Same OpenAI-compatible request shape as OpenRouter; the per-provider
    // backend (Groq, Together, Fireworks, PublicAI, etc.) is auto-selected
    // by HF based on which providers the token has enabled. HF's response
    // does not include a per-call cost field, so cost_usd is left null and
    // token counts are captured for external rate-table computation.
    'hf-qwen3-32b': {
        name: 'Qwen3-32B (HF Inference)',
        model: 'Qwen/Qwen3-32B',
        endpoint: 'https://router.huggingface.co/v1/chat/completions',
        requiresKey: true,
        keyEnv: 'HF_TOKEN',
        type: 'huggingface',
        supportsAtomize: true
    },
    'hf-gpt-oss-20b': {
        name: 'gpt-oss-20b (HF Inference)',
        model: 'openai/gpt-oss-20b',
        endpoint: 'https://router.huggingface.co/v1/chat/completions',
        requiresKey: true,
        keyEnv: 'HF_TOKEN',
        type: 'huggingface',
        supportsAtomize: true
    },
    'hf-deepseek-v3': {
        name: 'DeepSeek-V3 (HF Inference)',
        model: 'deepseek-ai/DeepSeek-V3',
        endpoint: 'https://router.huggingface.co/v1/chat/completions',
        requiresKey: true,
        keyEnv: 'HF_TOKEN',
        type: 'huggingface',
        supportsAtomize: true
    }
};
