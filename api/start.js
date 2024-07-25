import OpenAI from 'openai';

export const config = {
    runtime: 'edge',
};

export default async function handler(req) {
    if (req.method === 'OPTIONS') {
        return new Response(null, {
            status: 204,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type',
            },
        });
    }

    const { module, initialMessage } = await req.json();

    if (!module) {
        return new Response(JSON.stringify({ error: 'Missing module' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    let apiKey;
    let allowedDomains;

    if (module !== 'default') {
        apiKey = process.env[`${module.toUpperCase()}_OPENAI_API_KEY`];
        allowedDomains = process.env[`${module.toUpperCase()}_ALLOWED_DOMAINS_LIST`]?.split(',');
    } else {
        apiKey = process.env.OPENAI_API_KEY;
        allowedDomains = process.env.ALLOWED_DOMAINS_LIST;
    }

    if (allowedDomains && process.env.NODE_ENV === 'development') {
        allowedDomains.push('http://localhost:9000');
    }

    if (!apiKey) {
        return new Response(JSON.stringify({ error: 'Missing API key for module ' + module }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    const origin = req.headers.get('origin');
    if (allowedDomains && !allowedDomains.includes(origin) && process.env.CORS_ENABLED === 'true') {
        return new Response(JSON.stringify({ error: 'Not allowed' }), {
            status: 403,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    const client = new OpenAI({ apiKey: apiKey });

    try {
        const thread = await client.beta.threads.create();
        if (initialMessage) {
            await client.beta.threads.messages.create(thread.id, {
                role: 'assistant',
                content: initialMessage,
            });
        }

        return new Response(JSON.stringify({ threadId: thread.id }), {
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (error) {
        return new Response(JSON.stringify({ error: 'Error creating thread' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}
