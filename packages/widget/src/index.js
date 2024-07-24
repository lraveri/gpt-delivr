import './chat.css';

(function() {
    let threadId = null;
    let currentMessage = '';
    let buffer = ''; // Dichiarazione della variabile buffer

    function loadCSS(href) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = href;
        document.head.appendChild(link);
    }

    loadCSS('https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css');
    loadCSS('https://fonts.googleapis.com/css2?family=Roboto:wght@400;700&display=swap');

    function initializeChat(config) {

        const {
            baseURL,
            baseColor,
            module = 'default',
            assistantId,
            initialMessage
        } = config;

        const chatButton = document.createElement('div');
        chatButton.id = 'chat-button';
        chatButton.style.backgroundColor = baseColor;
        chatButton.innerHTML = `<i class="fas fa-comment"></i>`;
        document.body.appendChild(chatButton);

        const chatWindow = document.createElement('div');
        chatWindow.id = 'chat-window';
        chatWindow.style.visibility = 'hidden';
        chatWindow.innerHTML = `
            <div id="chat-header"> <span id="chat-close">&times;</span></div>
            <div id="chat-body"></div>
            <div id="chat-input-container">
                <input id="chat-input" type="text" placeholder="Type a message..." />
                <button id="chat-send"><i class="fas fa-paper-plane"></i></button>
            </div>
        `;
        document.body.appendChild(chatWindow);

        document.getElementById('chat-header').style.backgroundColor = baseColor;

        const chatClose = chatWindow.querySelector('#chat-close');
        chatClose.addEventListener('click', function() {
            chatWindow.style.visibility = 'hidden';
        });

        chatButton.addEventListener('click', function() {
            chatWindow.style.visibility = chatWindow.style.visibility === 'hidden' ? 'visible' : 'hidden'; // Alterna visibility
        });

        function sendMessage(message) {
            if (!threadId) {
                console.error('Thread ID is not set.');
                return;
            }

            displayMessage('...', 'assistant');

            fetch(`${baseURL}/api/v1/${module}/chat-stream`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ threadId: threadId, message: message, assistantId: assistantId })
            }).then(response => {
                const reader = response.body.getReader();
                const decoder = new TextDecoder();

                function readStream() {
                    reader.read().then(({ done, value }) => {
                        if (done) {
                            return;
                        }
                        buffer += decoder.decode(value, { stream: true });
                        processStreamChunk();
                        readStream();
                    });
                }
                readStream();
            }).catch(error => {
                console.error('Error sending message: ', error);
            });
        }

        function processStreamChunk() {
            let position;
            while ((position = buffer.indexOf('\n\n')) !== -1) {
                const eventStr = buffer.slice(0, position).trim();
                buffer = buffer.slice(position + 2);

                if (eventStr) {
                    const lines = eventStr.split('\n');
                    const eventObj = {};

                    lines.forEach(line => {
                        const [key, ...valueParts] = line.split(':');
                        const value = valueParts.join(':').trim();
                        eventObj[key.trim()] = value;
                    });

                    if (eventObj.event === 'textCreated') {
                        currentMessage = '';
                    } else if (eventObj.event === 'textDelta') {
                        const eventParsed = JSON.parse(eventObj.data);
                        currentMessage += eventParsed.data;
                        console.log('Current message: ', eventParsed.data);
                        displayMessage(currentMessage, 'assistant');
                    } else if (eventObj.error) {
                        console.error('Error: ', eventObj.error);
                    }
                }
            }
        }

        function scrollToBottom() {
            const chatBody = document.getElementById('chat-body');
            chatBody.scrollTop = chatBody.scrollHeight;
        }

        function displayMessage(message, sender) {
            let cleanedMessage;
            if (typeof message === 'string') {
                cleanedMessage = message.replace(/【\d+(?::\d+)?†source】/g, '');
            } else {
                cleanedMessage = JSON.stringify(message);
            }

            if (sender === 'assistant' && document.getElementById('chat-body').lastChild && document.getElementById('chat-body').lastChild.className === 'assistant') {
                document.getElementById('chat-body').lastChild.textContent = cleanedMessage;
            } else {
                const messageDiv = document.createElement('div');
                messageDiv.className = sender;
                messageDiv.textContent = cleanedMessage;
                document.getElementById('chat-body').appendChild(messageDiv);
            }

            scrollToBottom();
        }

        document.getElementById('chat-send').addEventListener('click', function() {
            const input = document.getElementById('chat-input');
            const message = input.value;
            if (message.trim() !== '') {
                displayMessage(message, 'user');
                sendMessage(message);
                input.value = '';
            }
        });

        document.getElementById('chat-send').style.backgroundColor = baseColor;

        document.getElementById('chat-input').addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                document.getElementById('chat-send').click();
            }
        });

        // Inizializza la conversazione
        const xhr = new XMLHttpRequest();
        xhr.timeout = 30000;
        xhr.open('POST', `${baseURL}/api/v1/${module}/start`, true);
        xhr.onreadystatechange = function() {
            if (xhr.readyState === 4) {
                if (xhr.status === 200) {
                    const response = JSON.parse(xhr.responseText);
                    threadId = response.threadId;
                    if (initialMessage !== '') {
                        displayMessage(initialMessage, 'assistant');
                    }
                }
            }
        };
        xhr.send(JSON.stringify({ initialMessage: initialMessage }));
    }

    window.initializeChat = initializeChat;
})();
