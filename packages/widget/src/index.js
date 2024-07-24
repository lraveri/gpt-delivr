import './chat.css';

(function() {
    let threadId = null;

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

            const xhr = new XMLHttpRequest();
            xhr.timeout = 30000;
            xhr.open('POST', `${baseURL}/api/v1/${module}/chat`, true);
            xhr.setRequestHeader('Content-Type', 'application/json');
            xhr.onreadystatechange = function() {
                if (xhr.readyState === 4) {
                    if (xhr.status === 200) {
                        const response = JSON.parse(xhr.responseText);
                        const chatBody = document.getElementById('chat-body');
                        chatBody.removeChild(chatBody.lastChild);
                        displayMessage(response.responseMessage, 'assistant');
                    }
                }
            };
            xhr.send(JSON.stringify({ threadId: threadId, message: message, assistantId: assistantId }));
        }

        function displayMessage(message, sender) {
            const cleanedMessage = message.replace(/【\d+(?::\d+)?†source】/g, '');
            const messageDiv = document.createElement('div');
            messageDiv.className = sender;
            messageDiv.textContent = cleanedMessage;
            document.getElementById('chat-body').appendChild(messageDiv);
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

        const xhr = new XMLHttpRequest();
        xhr.timeout = 30000;
        xhr.open('POST', `${baseURL}/api/v1/${module}/start`, true);
        xhr.onreadystatechange = function() {
            if (xhr.readyState === 4) {
                if (xhr.status === 200) {
                    const response = JSON.parse(xhr.responseText);
                    threadId = response.threadId;
                    if(initialMessage !== '') {
                        displayMessage(initialMessage, 'assistant');
                    }
                }
            }
        };
        xhr.send(JSON.stringify({ initialMessage: initialMessage }));
    }

    window.initializeChat = initializeChat;
})();
