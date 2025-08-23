// AxCrew provider
// Exposes: AxCrewProvider.validateApiKey, createLLM, createStreamingLLM, createSTT (noop)

class AxCrewProvider {
    static async validateApiKey(key) {
        if (!key || typeof key !== 'string' || key.trim() === '') {
            return { success: false, error: 'API key cannot be empty.' };
        }
        // Be permissive: accept any non-empty key to avoid network dependency during validation
        return { success: true };
    }
}

async function createSTT() {
    // AxCrew STT not supported, return noop session
    return {
        sendRealtimeInput: async () => {},
        close: async () => {},
    };
}

function createLLM({ apiKey, model = 'axcrew-pro', temperature = 0.7, maxTokens = 2048, ...config }) {
    const endpoint = 'https://api.axcrew.ai/v1/chat/completions';

    const call = async (messages) => {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ model, messages, temperature, max_tokens: maxTokens }),
        });
        if (!response.ok) {
            throw new Error(`AxCrew API error: ${response.status} ${response.statusText}`);
        }
        const result = await response.json();
        return {
            content: result.choices?.[0]?.message?.content?.trim?.() || '',
            raw: result,
        };
    };

    return {
        chat: async (messages) => call(messages),
    };
}

function createStreamingLLM({ apiKey, model = 'axcrew-pro', temperature = 0.7, maxTokens = 2048, ...config }) {
    const endpoint = 'https://api.axcrew.ai/v1/chat/completions';
    return {
        streamChat: async (messages) => {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${apiKey}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ model, messages, temperature, max_tokens: maxTokens, stream: true }),
            });
            if (!response.ok) {
                throw new Error(`AxCrew API error: ${response.status} ${response.statusText}`);
            }
            // Response should be an SSE stream compatible with AskService reader
            return response;
        },
    };
}

module.exports = {
    AxCrewProvider,
    createSTT,
    createLLM,
    createStreamingLLM,
};


