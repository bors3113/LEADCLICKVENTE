const axios = require('axios');
const config = require('../config');
const logger = require('../utils/logger');

// Thin client for OpenRouter's OpenAI-compatible chat completions API
// (https://openrouter.ai/api/v1). The model is env-selected (OPENROUTER_MODEL)
// so pricing/quality can be tuned without code changes.

// Thrown for any upstream failure so callers can map it to a 502 without
// charging credits.
class OpenRouterError extends Error {
    constructor(message, status) {
        super(message);
        this.name = 'OpenRouterError';
        this.status = status;
    }
}

/**
 * Run one chat completion. Returns the trimmed assistant message text.
 * Throws OpenRouterError on missing key, HTTP error, timeout, or empty output.
 *
 * @param {{system: string, user: string}} messages
 * @returns {Promise<string>}
 */
async function generateChat({ system, user }) {
    if (!config.openrouter.enabled) {
        throw new OpenRouterError('OpenRouter is not configured (OPENROUTER_API_KEY missing)');
    }

    let res;
    try {
        res = await axios.post(
            `${config.openrouter.baseUrl}/chat/completions`,
            {
                model: config.openrouter.model,
                max_tokens: config.openrouter.maxTokens,
                messages: [
                    { role: 'system', content: system },
                    { role: 'user', content: user },
                ],
            },
            {
                headers: {
                    Authorization: `Bearer ${config.openrouter.apiKey}`,
                    'Content-Type': 'application/json',
                },
                timeout: config.openrouter.timeoutMs,
            }
        );
    } catch (err) {
        const status = err.response ? err.response.status : undefined;
        const detail = err.response
            ? `${status} ${JSON.stringify(err.response.data && err.response.data.error) || ''}`
            : err.message;
        logger.warn(`OpenRouter request failed: ${detail}`);
        throw new OpenRouterError(`OpenRouter request failed: ${detail}`, status);
    }

    const text = res.data
        && res.data.choices
        && res.data.choices[0]
        && res.data.choices[0].message
        && res.data.choices[0].message.content;
    if (!text || !String(text).trim()) {
        throw new OpenRouterError('OpenRouter returned an empty completion');
    }
    return String(text).trim();
}

module.exports = { generateChat, OpenRouterError };
