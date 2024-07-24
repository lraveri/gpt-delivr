const express = require('express');
const path = require('path');
const OpenAI = require('openai');
const bodyParser = require('body-parser');
const expressWs = require('express-ws');

require('dotenv').config({ path: __dirname + '/../.env' });

const app = express();
expressWs(app);

const port = 3000;

app.use(express.static(path.join(__dirname, '../public')));
app.use(bodyParser.json());

app.use('/api/v1/:module/*', (req, res, next) => {
    const module = req.params.module;

    if (!module) {
        return res.status(400).send({ error: 'Missing module' });
    }

    let apiKey;
    let allowedDomains;

    if(module !== 'default') {
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
        return res.status(400).send({ error: 'Missing API key for module ' + module });
    }

    const origin = req.headers.origin;
    if (allowedDomains && !allowedDomains.includes(origin) && process.env.CORS_ENABLED === "true") {
        return res.status(403).send({ error: 'Not allowed' });
    }

    req.client = new OpenAI({ apiKey: apiKey });
    next();
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../public', 'index.html'));
});

app.get('/health', (req, res) => {
    res.json({ message: 'Server healthy' });
});

app.post('/api/v1/:module/start', async (req, res) => {
    const { initialMessage } = req.body;

    try {
        const client = req.client;
        const thread = await client.beta.threads.create();
        console.log(`New thread created with ID: ${thread.id}`);

        if (initialMessage) {
            await client.beta.threads.messages.create(thread.id, {
                role: 'assistant',
                content: initialMessage
            });
        }

        res.json({ threadId: thread.id });
    } catch (error) {
        console.log(error.message);
        res.status(500).json({ error: 'Error creating thread' });
    }
});

app.post('/api/v1/:module/chat', async (req, res) => {
    const { threadId, message, assistantId } = req.body;
    const client = req.client;

    if (!threadId) {
        return res.status(400).json({ error: 'Missing threadId' });
    }

    if (!assistantId) {
        return res.status(400).json({ error: 'Missing assistantId' });
    }

    try {
        await client.beta.threads.messages.create(threadId, {
            role: 'user',
            content: message
        });

        const run = await client.beta.threads.runs.create(threadId, {
            assistant_id: assistantId
        });

        let runStatus;
        do {
            runStatus = await client.beta.threads.runs.retrieve(threadId, run.id);
            console.log(`Run status: ${runStatus.status}`);
        } while (runStatus.status !== 'completed');

        const messages = await client.beta.threads.messages.list(threadId);
        const data = messages.data;
        const assistantResponse = data.find(m => m.role === 'assistant').content[0].text.value;

        res.json({ responseMessage: assistantResponse });
    } catch (error) {
        res.status(500).json({ error: 'Error during chat process' });
    }
});

// Aggiungi un endpoint WebSocket
app.ws('/api/v1/:module/chat-stream', (ws, req) => {
    ws.on('message', async (msg) => {
        const { threadId, message, assistantId } = JSON.parse(msg);
        const client = req.client;

        if (!threadId) {
            ws.send(JSON.stringify({ error: 'Missing threadId' }));
            return ws.close();
        }

        if (!assistantId) {
            ws.send(JSON.stringify({ error: 'Missing assistantId' }));
            return ws.close();
        }

        try {
            await client.beta.threads.messages.create(threadId, {
                role: 'user',
                content: message
            });

            const run = client.beta.threads.runs.stream(threadId, {
                assistant_id: assistantId
            });

            run.on('textCreated', (text) => {
                ws.send(JSON.stringify({ event: 'textCreated', data: text }));
            });

            run.on('textDelta', (textDelta) => {
                ws.send(JSON.stringify({ event: 'textDelta', data: textDelta.value }));
            });

            run.on('toolCallCreated', (toolCall) => {
                ws.send(JSON.stringify({ event: 'toolCallCreated', data: toolCall.type }));
            });

            run.on('toolCallDelta', (toolCallDelta) => {
                if (toolCallDelta.type === 'code_interpreter') {
                    if (toolCallDelta.code_interpreter.input) {
                        ws.send(JSON.stringify({ event: 'codeInterpreterInput', data: toolCallDelta.code_interpreter.input }));
                    }
                    if (toolCallDelta.code_interpreter.outputs) {
                        ws.send(JSON.stringify({ event: 'codeInterpreterOutput', data: toolCallDelta.code_interpreter.outputs }));
                    }
                }
            });

            run.on('close', () => {
                ws.close();
            });

            run.on('error', (error) => {
                ws.send(JSON.stringify({ error: 'Error during chat process' }));
                ws.close();
            });
        } catch (error) {
            ws.send(JSON.stringify({ error: 'Error during chat process' }));
            ws.close();
        }
    });
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
