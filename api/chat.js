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

    const { module, threadId, message, assistantId } = await req.json();

    if (!module) {
        return new Response(JSON.stringify({ error: 'Missing module' }), {
            status: 400,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
        });
    }

    let apiKey = process.env.OPENAI_API_KEY; // Usa la chiave API globale per impostazione predefinita
    let allowedDomains;

    if (module !== 'default') {
        apiKey = process.env[`${module.toUpperCase()}_OPENAI_API_KEY`] || apiKey; // Usa la chiave specifica del modulo se disponibile
        allowedDomains = process.env[`${module.toUpperCase()}_ALLOWED_DOMAINS_LIST`]?.split(',');
    } else {
        allowedDomains = process.env.ALLOWED_DOMAINS_LIST;
    }

    if (allowedDomains && process.env.NODE_ENV === 'development') {
        allowedDomains.push('http://localhost:9000');
    }

    if (!apiKey) {
        return new Response(JSON.stringify({ error: 'Missing API key for module ' + module }), {
            status: 400,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
        });
    }

    const origin = req.headers.get('origin');
    if (allowedDomains && !allowedDomains.includes(origin) && process.env.CORS_ENABLED === 'true') {
        return new Response(JSON.stringify({ error: 'Not allowed' }), {
            status: 403,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
        });
    }

    const client = new OpenAI({ apiKey: apiKey });

    if (!threadId) {
        return new Response(JSON.stringify({ error: 'Missing threadId' }), {
            status: 400,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
        });
    }

    if (!assistantId) {
        return new Response(JSON.stringify({ error: 'Missing assistantId' }), {
            status: 400,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
        });
    }

    try {
        await client.beta.threads.messages.create(threadId, {
            role: 'user',
            content: message,
        });

        const run = client.beta.threads.runs.stream(threadId, {
            assistant_id: assistantId,
        });

        const encoder = new TextEncoder();
        const readableStream = new ReadableStream({
            start(controller) {
                run.on('textCreated', (text) => {
                    controller.enqueue(encoder.encode(`event: textCreated\ndata: ${JSON.stringify({ event: 'textCreated', data: text })}\n\n`));
                });

                run.on('textDelta', (textDelta) => {
                    controller.enqueue(encoder.encode(`event: textDelta\ndata: ${JSON.stringify({ event: 'textDelta', data: textDelta.value })}\n\n`));
                });

                run.on('close', () => {
                    controller.close();
                });

                run.on('error', (error) => {
                    controller.enqueue(encoder.encode(`event: error\ndata: ${JSON.stringify({ error: 'Error during chat process' })}\n\n`));
                    controller.close();
                });
            }
        });

        return new Response(readableStream, {
            headers: {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
                'Access-Control-Allow-Origin': '*'
            },
        });
    } catch (error) {
        return new Response(JSON.stringify({ error: 'Error during chat process' }), {
            status: 500,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
        });
    }
}
