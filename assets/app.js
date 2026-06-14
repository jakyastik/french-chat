/**
 * French Learning Chat App - Frontend Controller
 */

// Application State
const state = {
    userId: null,
    activeConversationId: null,
    activeDifficulty: 'A1',
    conversations: [],
    vocabList: [],
    sentencesList: [],
    replayMessages: [],
    replayIndex: 0,
    replayIsPlaying: false,
    replayTimeoutId: null
};

// Syllabus Topics for each CEFR Level (Targeted for TEF Canada Preparation)
const SYLLABUS_TOPICS = {
    'A1': [
        { id: 'General', name: 'Conversation générale (TEF A1)' },
        { id: 'TEF Oral A - Club de sport', name: 'TEF Oral Sec A : S\'inscrire à un club de sport' },
        { id: 'TEF Oral A - Cours de cuisine', name: 'TEF Oral Sec A : S\'informer sur un cours de cuisine' },
        { id: 'TEF Ecrit A - Fait divers simple', name: 'TEF Écrit Sec A : Rédiger un fait divers simple' }
    ],
    'A2': [
        { id: 'General', name: 'Conversation générale (TEF A2)' },
        { id: 'TEF Oral A - Location d\'appartement', name: 'TEF Oral Sec A : Se renseigner sur un logement' },
        { id: 'TEF Oral A - Emploi d\'ete', name: 'TEF Oral Sec A : Postuler pour un job d\'été' },
        { id: 'TEF Ecrit A - Fait divers insolite', name: 'TEF Écrit Sec A : Rédiger un fait divers insolite' }
    ],
    'B1': [
        { id: 'General', name: 'Conversation générale (TEF B1)' },
        { id: 'TEF Oral A - Renseignements voyage', name: 'TEF Oral Sec A : Détails sur un séjour organisé' },
        { id: 'TEF Oral B - Activite de benevolat', name: 'TEF Oral Sec B : Convaincre d\'adhérer à une association' },
        { id: 'TEF Ecrit B - Devoirs a la maison', name: 'TEF Écrit Sec B : Pour ou contre les devoirs scolaires' }
    ],
    'B2': [
        { id: 'General', name: 'Conversation générale (TEF B2)' },
        { id: 'TEF Oral B - Essayer le covoiturage', name: 'TEF Oral Sec B : Convaincre d\'essayer le covoiturage' },
        { id: 'TEF Oral B - Acheter en vrac', name: 'TEF Oral Sec B : Convaincre d\'acheter zéro déchet' },
        { id: 'TEF Ecrit B - Teletravail obligatoire', name: 'TEF Écrit Sec B : Débat sur le télétravail obligatoire' }
    ],
    'C1': [
        { id: 'General', name: 'Conversation générale (TEF C1)' },
        { id: 'TEF Oral B - Energie solaire commune', name: 'TEF Oral Sec B : Adhérer à un projet solaire collectif' },
        { id: 'TEF Ecrit B - IA et emploi', name: 'TEF Écrit Sec B : L\'impact de l\'IA sur l\'emploi' },
        { id: 'TEF Ecrit B - Taxe carbone universelle', name: 'TEF Écrit Sec B : Débat sur la taxe carbone universelle' }
    ],
    'C2': [
        { id: 'General', name: 'Conversation générale (TEF C2)' },
        { id: 'TEF Oral B - Adopter la decroissance', name: 'TEF Oral Sec B : Argumenter en faveur de la décroissance' },
        { id: 'TEF Ecrit B - Limites biotechnologiques', name: 'TEF Écrit Sec B : Les limites des biotechnologies' },
        { id: 'TEF Ecrit B - Souverainete numerique', name: 'TEF Écrit Sec B : La souveraineté numérique des nations' }
    ]
};

// Tooltip state
let activeTooltip = null;
let tooltipHideTimeout = null;
let hoverTranslateTimeout = null;

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    initApiKey();
    initEventListeners();
    initAuthListeners();
    checkAuthStatus();
    
    // Load voices and bind change listener to handle async loading
    if ('speechSynthesis' in window) {
        window.speechSynthesis.getVoices();
        window.speechSynthesis.onvoiceschanged = () => {
            const availableVoices = window.speechSynthesis.getVoices();
            console.log("EnChat TTS: Loaded " + availableVoices.length + " voices.");
            const frVoices = availableVoices.filter(v => v.lang.startsWith('fr'));
            console.log("EnChat TTS: French voices available:", frVoices.map(v => `${v.name} (${v.lang})`));
        };
    }
});

// 1. Authentication and User Session Management
let activeAuthTab = 'login'; // 'login' or 'register'

function initAuthListeners() {
    const loginTabBtn = document.getElementById('auth-tab-login');
    const registerTabBtn = document.getElementById('auth-tab-register');
    const authForm = document.getElementById('auth-form');
    const logoutBtn = document.getElementById('logout-btn');
    
    if (loginTabBtn && registerTabBtn) {
        loginTabBtn.addEventListener('click', () => {
            activeAuthTab = 'login';
            loginTabBtn.classList.add('active');
            registerTabBtn.classList.remove('active');
            document.getElementById('auth-submit-btn').innerHTML = 'Log In <i data-lucide="log-in" style="margin-left: 6px;"></i>';
            document.getElementById('auth-error-msg').style.display = 'none';
            document.getElementById('auth-form').reset();
            lucide.createIcons();
        });
        
        registerTabBtn.addEventListener('click', () => {
            activeAuthTab = 'register';
            registerTabBtn.classList.add('active');
            loginTabBtn.classList.remove('active');
            document.getElementById('auth-submit-btn').innerHTML = 'Register <i data-lucide="user-plus" style="margin-left: 6px;"></i>';
            document.getElementById('auth-error-msg').style.display = 'none';
            document.getElementById('auth-form').reset();
            lucide.createIcons();
        });
    }
    
    if (authForm) {
        authForm.addEventListener('submit', handleAuthSubmit);
    }
    
    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
    }
}

async function handleAuthSubmit(e) {
    e.preventDefault();
    const emailInput = document.getElementById('auth-email');
    const passwordInput = document.getElementById('auth-password');
    const errorMsg = document.getElementById('auth-error-msg');
    
    if (!emailInput || !passwordInput || !errorMsg) return;
    
    errorMsg.style.display = 'none';
    
    const email = emailInput.value.trim();
    const password = passwordInput.value;
    
    try {
        const res = await apiFetch(`api/auth.php?action=${activeAuthTab}`, {
            method: 'POST',
            body: JSON.stringify({ email, password })
        });
        
        if (res.success) {
            emailInput.value = '';
            passwordInput.value = '';
            await checkAuthStatus();
        } else {
            errorMsg.innerText = res.error || 'Authentication failed.';
            errorMsg.style.display = 'block';
        }
    } catch (err) {
        errorMsg.innerText = err.message || 'An error occurred during authentication.';
        errorMsg.style.display = 'block';
    }
}

async function handleLogout() {
    try {
        await apiFetch('api/auth.php?action=logout', { method: 'POST' });
    } catch (err) {
        console.error('Logout failed:', err);
    }
    // Reset state
    state.userId = null;
    state.email = null;
    state.activeConversationId = null;
    state.conversations = [];
    state.vocabList = [];
    state.sentencesList = [];
    
    // Clear UI
    document.getElementById('conversation-list-container').innerHTML = '';
    document.getElementById('vocab-list-container').innerHTML = '';
    document.getElementById('sentences-list-container').innerHTML = '';
    document.getElementById('chat-window-content').innerHTML = '';
    document.getElementById('chat-window-content').style.display = 'none';
    document.getElementById('chat-input-container').style.display = 'none';
    document.getElementById('main-header-content').style.display = 'none';
    document.getElementById('welcome-screen').style.display = 'flex';
    
    showAuthScreen();
}

async function checkAuthStatus() {
    try {
        const response = await fetch('api/auth.php?action=status');
        const res = await response.json();
        
        if (res.success && res.logged_in) {
            state.userId = res.user.id;
            state.email = res.user.email;
            document.getElementById('email-display').innerText = state.email;
            
            document.getElementById('auth-screen').style.display = 'none';
            document.querySelector('.app-container').style.display = 'flex';
            
            // Reload all user data
            loadConversations();
            loadVocabulary();
            loadSentences();
        } else {
            showAuthScreen();
        }
    } catch (err) {
        showAuthScreen();
    }
}

function showAuthScreen() {
    document.getElementById('auth-screen').style.display = 'flex';
    document.querySelector('.app-container').style.display = 'none';
    document.getElementById('auth-form').reset();
    document.getElementById('auth-error-msg').style.display = 'none';
}

// 2. Client-side API Key setup
function initApiKey() {
    const apiKey = localStorage.getItem('gemini_api_key');
    const input = document.getElementById('api-key-input');
    if (apiKey && input) {
        input.value = apiKey;
    }
}

// 3. Setup event listeners
function initEventListeners() {
    // Text selection listener for vocabulary saving
    setupTextSelectionListener();

    // Send message triggers
    const sendBtn = document.getElementById('send-btn');
    const chatInput = document.getElementById('chat-input');
    
    if (sendBtn && chatInput) {
        sendBtn.addEventListener('click', handleSendMessage);
        chatInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
            }
        });
    }

    // API key save button
    const saveApiKeyBtn = document.getElementById('save-api-key-btn');
    const apiKeyInput = document.getElementById('api-key-input');
    if (saveApiKeyBtn && apiKeyInput) {
        saveApiKeyBtn.addEventListener('click', () => {
            const val = apiKeyInput.value.trim();
            if (val) {
                localStorage.setItem('gemini_api_key', val);
                showToast('API Key saved to browser!');
            } else {
                localStorage.removeItem('gemini_api_key');
                showToast('API Key cleared from browser.');
            }
        });
    }

    // Sidebar tab switching
    const tabConvos = document.getElementById('tab-convos');
    const tabVocab = document.getElementById('tab-vocab');
    const tabSentences = document.getElementById('tab-sentences');

    if (tabConvos) tabConvos.addEventListener('click', () => setView('chat'));
    if (tabVocab) tabVocab.addEventListener('click', () => setView('words'));
    if (tabSentences) tabSentences.addEventListener('click', () => setView('sentences'));

    // Search inputs for Vocabulary Dashboards
    const wordsSearch = document.getElementById('words-search-input');
    if (wordsSearch) {
        wordsSearch.addEventListener('input', renderVocabulary);
    }
    const sentencesSearch = document.getElementById('sentences-search-input');
    if (sentencesSearch) {
        sentencesSearch.addEventListener('input', renderSentences);
    }

    // New Chat Button
    const newChatBtn = document.getElementById('new-chat-btn');
    if (newChatBtn) {
        newChatBtn.addEventListener('click', () => {
            showWelcomeScreen();
        });
    }

    // Difficulty selection from Welcome Screen cards
    const welcomeTopicContainer = document.getElementById('welcome-topic-container');
    const welcomeTopicSelect = document.getElementById('welcome-topic-select');
    const startChatBtn = document.getElementById('start-chat-btn');

    document.querySelectorAll('.diff-card').forEach(card => {
        card.addEventListener('click', () => {
            document.querySelectorAll('.diff-card').forEach(c => c.classList.remove('active'));
            card.classList.add('active');
            state.activeDifficulty = card.dataset.diff;
            
            // Populate topics
            const topics = SYLLABUS_TOPICS[state.activeDifficulty] || [];
            welcomeTopicSelect.innerHTML = topics.map(t => `<option value="${t.id}">${t.name}</option>`).join('');
            
            // Show selection container
            if (welcomeTopicContainer) welcomeTopicContainer.style.display = 'flex';
        });
    });

    if (startChatBtn) {
        startChatBtn.addEventListener('click', () => {
            if (state.activeDifficulty) {
                const selectedTopic = welcomeTopicSelect ? welcomeTopicSelect.value : 'General';
                startNewConversation(state.activeDifficulty, selectedTopic);
            }
        });
    }

    // Difficulty Selector (Header)
    const headerDiffSelect = document.getElementById('header-difficulty-select');
    if (headerDiffSelect) {
        headerDiffSelect.addEventListener('change', (e) => {
            // Update current conversation difficulty level (UI only, or start new if wanted)
            state.activeDifficulty = e.target.value;
            showToast(`Next messages will adapt to ${state.activeDifficulty} difficulty.`);
        });
    }

    // Replay Buttons
    const replayBtn = document.getElementById('replay-btn');
    const replayClose = document.getElementById('replay-close');
    const replayPlayPause = document.getElementById('replay-play-pause');
    const replayNext = document.getElementById('replay-next');

    if (replayBtn) replayBtn.addEventListener('click', openReplayMode);
    if (replayClose) replayClose.addEventListener('click', closeReplayMode);
    if (replayPlayPause) replayPlayPause.addEventListener('click', toggleReplayPlayback);
    if (replayNext) replayNext.addEventListener('click', advanceReplayStep);

    // Sidebar toggle (desktop & mobile)
    const sidebarToggle = document.getElementById('sidebar-toggle-btn');
    const appContainer = document.querySelector('.app-container');
    if (sidebarToggle && appContainer) {
        if (window.innerWidth <= 768) {
            appContainer.classList.remove('sidebar-open');
        }
        sidebarToggle.addEventListener('click', () => {
            appContainer.classList.toggle('sidebar-open');
        });
    }
}

// 4. API Request Wrapper
async function apiFetch(url, options = {}) {
    // Add headers
    const headers = {
        'Content-Type': 'application/json',
        'X-User-ID': state.userId,
        ...options.headers
    };

    // Client-supplied API key
    const clientKey = localStorage.getItem('gemini_api_key');
    if (clientKey) {
        headers['X-Gemini-Key'] = clientKey;
    }

    const response = await fetch(url, {
        ...options,
        headers
    });

    if (response.status === 401) {
        showAuthScreen();
        throw new Error('Unauthorized');
    }

    const data = await response.json();
    if (!data.success) {
        throw new Error(data.error || 'Request failed');
    }
    return data;
}

// 5. Load Sidebar Conversations List
async function loadConversations() {
    try {
        const res = await apiFetch('api/history.php');
        state.conversations = res.data;
        renderConversations();
    } catch (err) {
        console.error('Failed to load conversations:', err);
    }
}

function renderConversations() {
    const container = document.getElementById('conversation-list-container');
    if (!container) return;

    if (state.conversations.length === 0) {
        container.innerHTML = '<div class="text-center p-4 text-secondary text-sm">No conversations yet</div>';
        return;
    }

    container.innerHTML = state.conversations.map(convo => {
        const isActive = convo.id === state.activeConversationId ? 'active' : '';
        const diffClass = `difficulty-${convo.difficulty.toLowerCase()}`;
        const dateFormatted = new Date(convo.created_at).toLocaleDateString(undefined, {month: 'short', day: 'numeric'});
        
        return `
            <div class="convo-item ${isActive}" data-id="${convo.id}" onclick="selectConversation('${convo.id}')">
                <div class="convo-info">
                    <div class="convo-title">${escapeHtml(convo.title)}</div>
                    <div class="convo-meta">
                        <span class="badge-difficulty ${diffClass}">${convo.difficulty}</span>
                        <span class="convo-date">${dateFormatted}</span>
                    </div>
                </div>
                <div class="convo-actions">
                    <button class="btn-icon" onclick="deleteConversation(event, '${convo.id}')" title="Delete conversation"><i data-lucide="trash-2"></i></button>
                </div>
            </div>
        `;
    }).join('');

    if (window.lucide) { window.lucide.createIcons(); }
}

// 6. Start a New Conversation
async function startNewConversation(difficulty, topic = 'General') {
    const startChatBtn = document.getElementById('start-chat-btn');
    if (startChatBtn) startChatBtn.disabled = true;
    try {
        const res = await apiFetch('api/history.php?action=create', {
            method: 'POST',
            body: JSON.stringify({ difficulty, topic })
        });
        
        const newConvo = res.data;
        state.activeConversationId = newConvo.id;
        state.activeDifficulty = newConvo.difficulty;
        
        // Hide welcome screen, show chat window
        showChatWindow();
        updateHeaderInfo(newConvo.title, newConvo.difficulty, newConvo.topic);
        
        // Reload conversations list
        await loadConversations();
        
        // Trigger bot greeting
        appendBotLoadingBubble();
        const startRes = await apiFetch('api/chat.php?action=start', {
            method: 'POST',
            body: JSON.stringify({ conversation_id: newConvo.id })
        });
        
        removeBotLoadingBubble();
        appendMessage(startRes.bot_message);
        
    } catch (err) {
        removeBotLoadingBubble();
        showToast(err.message, true);
    } finally {
        if (startChatBtn) startChatBtn.disabled = false;
    }
}

// 7. Select and Load Conversation
async function selectConversation(id) {
    // Close mobile menu if open
    document.querySelector('.sidebar').classList.remove('mobile-open');

    try {
        state.activeConversationId = id;
        renderConversations(); // highlight active
        showChatWindow();
        
        // Clear chat view and show loader
        const chatWindow = document.getElementById('chat-window-content');
        chatWindow.innerHTML = '<div class="text-center p-8 text-secondary">Loading messages...</div>';

        const res = await apiFetch(`api/history.php?conversation_id=${id}`);
        const convo = res.conversation;
        state.activeDifficulty = convo.difficulty;
        
        updateHeaderInfo(convo.title, convo.difficulty, convo.topic || 'General');
        
        // Render messages
        chatWindow.innerHTML = '';
        if (res.messages && res.messages.length > 0) {
            res.messages.forEach(msg => appendMessage(msg));
        } else {
            // Trigger start
            appendBotLoadingBubble();
            const startRes = await apiFetch('api/chat.php?action=start', {
                method: 'POST',
                body: JSON.stringify({ conversation_id: id })
            });
            removeBotLoadingBubble();
            appendMessage(startRes.bot_message);
        }
        
        scrollToBottom();
    } catch (err) {
        showToast(err.message, true);
    }
}

// 8. Delete Conversation
async function deleteConversation(event, id) {
    event.stopPropagation();
    if (!confirm('Are you sure you want to delete this conversation?')) return;

    try {
        await apiFetch('api/history.php?action=delete', {
            method: 'POST',
            body: JSON.stringify({ conversation_id: id })
        });

        if (state.activeConversationId === id) {
            state.activeConversationId = null;
            showWelcomeScreen();
        }

        await loadConversations();
        showToast('Conversation deleted.');
    } catch (err) {
        showToast(err.message, true);
    }
}

// 9. Send Chat Message
async function handleSendMessage() {
    const chatInput = document.getElementById('chat-input');
    const sendBtn = document.getElementById('send-btn');
    const text = chatInput.value.trim();
    if (!text || !state.activeConversationId) return;

    // Disable input and button to prevent double submission
    chatInput.disabled = true;
    if (sendBtn) sendBtn.disabled = true;

    // Clear input and auto-resize
    chatInput.value = '';
    chatInput.style.height = 'auto';

    // Add user's message bubble immediately (local state)
    const tempUserMsgId = 'temp_usr_' + Date.now();
    appendMessage({
        id: tempUserMsgId,
        sender: 'user',
        message: text
    });
    scrollToBottom();

    // Show bot typing bubble
    appendBotLoadingBubble();

    try {
        const res = await apiFetch('api/chat.php', {
            method: 'POST',
            body: JSON.stringify({
                conversation_id: state.activeConversationId,
                message: text
            })
        });

        removeBotLoadingBubble();

        // Update the user message to include corrections if any were returned
        if (res.user_message) {
            updateUserMessageCorrection(tempUserMsgId, res.user_message);
        }

        // Add bot message
        if (res.bot_message) {
            appendMessage(res.bot_message);
            // Optionally speak the bot response
            speakFrench(res.bot_message.message);
        }

        scrollToBottom();
    } catch (err) {
        removeBotLoadingBubble();
        showToast(err.message, true);
    } finally {
        // Re-enable input and button
        chatInput.disabled = false;
        if (sendBtn) sendBtn.disabled = false;
        chatInput.focus();
    }
}

// 10. Speech Synthesis (TTS)
function speakFrench(text) {
    if ('speechSynthesis' in window) {
        // Cancel any ongoing speech to clear queue
        window.speechSynthesis.cancel();
        
        // Strip out HTML tags if present (e.g. from corrections or tokens)
        const cleanText = text.replace(/<[^>]*>/g, '');
        
        const utterance = new SpeechSynthesisUtterance(cleanText);
        utterance.lang = 'fr-FR';
        utterance.rate = 0.9; // Slightly slower for language learners
        
        // Get all available voices
        const voices = window.speechSynthesis.getVoices();
        
        // Find best matching French voice
        let frVoice = voices.find(v => v.lang === 'fr-FR' || v.lang === 'fr_FR');
        if (!frVoice) {
            frVoice = voices.find(v => v.lang.startsWith('fr'));
        }
        
        if (frVoice) {
            utterance.voice = frVoice;
            console.log("EnChat TTS: Speaking using voice: " + frVoice.name);
        } else {
            console.warn("EnChat TTS: No French voice found. Using browser default voice for lang 'fr-FR'.");
        }
        
        utterance.onerror = (e) => {
            console.error("EnChat TTS: Error playing speech:", e);
        };
        
        window.speechSynthesis.speak(utterance);
    } else {
        console.warn("EnChat TTS: Speech Synthesis is not supported in this browser.");
    }
}

// 11. Helper to tokenize French Text into Spans
function tokenizeFrenchText(text) {
    // Escapes text for context attribute in span
    const escapedContext = text.replace(/"/g, '&quot;');
    // Match word tokens (letters, accents, and hyphens)
    const regex = /([A-Za-zÀ-ÿœæÇç-]+)/g;
    
    return text.replace(regex, (match) => {
        const escapedWord = match.replace(/"/g, '&quot;');
        return `<span class="word-span" data-word="${escapedWord}" data-context="${escapedContext}">${match}</span>`;
    });
}

// 12. Appending and Managing UI Elements
function appendMessage(msg) {
    const container = document.getElementById('chat-window-content');
    if (!container) return;

    const div = document.createElement('div');
    div.className = `message-bubble ${msg.sender}`;
    div.id = `msg-${msg.id}`;

    const isBot = msg.sender === 'bot';
    const senderName = isBot ? 'Assistant' : 'Vous';
    
    // Process text to include hoverable word spans
    const processedText = tokenizeFrenchText(msg.message);

    let correctionHtml = '';
    if (msg.corrected_message) {
        correctionHtml = `
            <div class="correction-box">
                <div class="correction-title" style="display: flex; justify-content: space-between; align-items: center;">
                    <span style="display: inline-flex; align-items: center; gap: 6px;"><i data-lucide="info"></i> Correction :</span>
                    <div class="message-meta-actions">
                        <button class="tts-button translate-correction-btn" title="Toggle Translation"><i data-lucide="languages"></i></button>
                        <button class="tts-button-correction" title="Listen corrected"><i data-lucide="volume-2"></i></button>
                        <button class="save-sentence-btn-correction" title="Save corrected sentence"><i data-lucide="star"></i></button>
                    </div>
                </div>
                <div class="corrected-phrase">${tokenizeFrenchText(msg.corrected_message)}</div>
                <div class="correction-explanation">${escapeHtml(msg.correction_explanation)}</div>
            </div>
        `;
    }

    div.innerHTML = `
        <div class="message-meta">
            <span>${senderName}</span>
            <div class="message-meta-actions">
                <button class="tts-button translate-bubble-btn" title="Toggle Translation"><i data-lucide="languages"></i></button>
                <button class="tts-button speak-bubble-btn" title="Listen"><i data-lucide="volume-2"></i></button>
                <button class="save-sentence-btn" title="Save Sentence"><i data-lucide="star"></i></button>
            </div>
        </div>
        <div class="message-content">
            ${processedText}
        </div>
        ${correctionHtml}
    `;

    // Toggle translation for main message
    const translateBtn = div.querySelector('.translate-bubble-btn');
    if (translateBtn) {
        translateBtn.addEventListener('click', async () => {
            let translationDiv = div.querySelector('.message-translation');
            if (!translationDiv) {
                translationDiv = document.createElement('div');
                translationDiv.className = 'message-translation';
                translationDiv.style.cssText = 'font-size: 0.9em; opacity: 0.85; margin-top: 8px; padding-top: 8px; border-top: 1px dashed rgba(255,255,255,0.15);';
                
                if (msg.sender === 'user') {
                    translationDiv.style.borderTopColor = 'rgba(255,255,255,0.2)';
                } else {
                    translationDiv.style.borderTopColor = 'var(--border-color, #e2e8f0)';
                }
                
                translationDiv.innerHTML = '<em>Translating...</em>';
                translationDiv.style.display = 'none';
                div.querySelector('.message-content').after(translationDiv);
            }

            if (translationDiv.style.display === 'none' || translationDiv.style.display === '') {
                translationDiv.style.display = 'block';
                translateBtn.classList.add('active');
                if (translationDiv.innerHTML === '<em>Translating...</em>') {
                    try {
                        const data = await apiFetch(`api/translate.php?word=${encodeURIComponent(msg.message)}&is_sentence=true`);
                        translationDiv.textContent = data.translation;
                    } catch (err) {
                        translationDiv.innerHTML = '<span class="text-danger">Failed to translate.</span>';
                    }
                }
            } else {
                translationDiv.style.display = 'none';
                translateBtn.classList.remove('active');
            }
        });
    }

    // Toggle translation for corrected message (if loaded in history)
    const translateCorrectedBtn = div.querySelector('.translate-correction-btn');
    if (translateCorrectedBtn) {
        translateCorrectedBtn.addEventListener('click', async () => {
            let translationDiv = div.querySelector('.corrected-translation');
            if (!translationDiv) {
                translationDiv = document.createElement('div');
                translationDiv.className = 'corrected-translation';
                translationDiv.style.cssText = 'font-size: 0.85em; opacity: 0.85; margin-top: 6px; padding-top: 6px; border-top: 1px dashed var(--border-color, #e2e8f0); color: var(--text-muted, #718096);';
                translationDiv.innerHTML = '<em>Translating...</em>';
                translationDiv.style.display = 'none';
                div.querySelector('.corrected-phrase').after(translationDiv);
            }

            if (translationDiv.style.display === 'none' || translationDiv.style.display === '') {
                translationDiv.style.display = 'block';
                translateCorrectedBtn.classList.add('active');
                if (translationDiv.innerHTML === '<em>Translating...</em>') {
                    try {
                        const data = await apiFetch(`api/translate.php?word=${encodeURIComponent(msg.corrected_message)}&is_sentence=true`);
                        translationDiv.textContent = data.translation;
                    } catch (err) {
                        translationDiv.innerHTML = '<span class="text-danger">Failed to translate.</span>';
                    }
                }
            } else {
                translationDiv.style.display = 'none';
                translateCorrectedBtn.classList.remove('active');
            }
        });
    }

    // Dynamic click listener for speech synthesis
    const ttsBtn = div.querySelector('.speak-bubble-btn');
    if (ttsBtn) {
        ttsBtn.addEventListener('click', () => {
            speakFrench(msg.message);
        });
    }

    // Dynamic click listener for sentence saving
    const saveBtn = div.querySelector('.save-sentence-btn');
    if (saveBtn) {
        saveBtn.addEventListener('click', () => {
            handleSaveSentence(msg.message);
        });
    }

    // Listeners for correction box if present
    const ttsCorrectedBtn = div.querySelector('.tts-button-correction');
    if (ttsCorrectedBtn) {
        ttsCorrectedBtn.addEventListener('click', () => {
            speakFrench(msg.corrected_message);
        });
    }
    const saveCorrectedBtn = div.querySelector('.save-sentence-btn-correction');
    if (saveCorrectedBtn) {
        saveCorrectedBtn.addEventListener('click', () => {
            handleSaveSentence(msg.corrected_message);
        });
    }

    container.appendChild(div);
    setupWordHoverEvents(div);
    if (window.lucide) { window.lucide.createIcons(); }
}

function updateUserMessageCorrection(tempId, finalMsg) {
    const el = document.getElementById(`msg-${tempId}`);
    if (!el) return;

    // Update ID
    el.id = `msg-${finalMsg.id}`;

    // Add correction box if errors were found
    if (finalMsg.corrected_message) {
        const div = document.createElement('div');
        div.className = 'correction-box';
        div.innerHTML = `
            <div class="correction-title" style="display: flex; justify-content: space-between; align-items: center;">
                <span style="display: inline-flex; align-items: center; gap: 6px;"><i data-lucide="info"></i> Correction :</span>
                <div class="message-meta-actions">
                    <button class="tts-button translate-correction-btn" title="Toggle Translation"><i data-lucide="languages"></i></button>
                    <button class="tts-button-correction" title="Listen corrected"><i data-lucide="volume-2"></i></button>
                    <button class="save-sentence-btn-correction" title="Save corrected sentence"><i data-lucide="star"></i></button>
                </div>
            </div>
            <div class="corrected-phrase">${tokenizeFrenchText(finalMsg.corrected_message)}</div>
            <div class="correction-explanation">${escapeHtml(finalMsg.correction_explanation)}</div>
        `;
        el.appendChild(div);
        
        // Listeners for correction
        const translateCorrectedBtn = div.querySelector('.translate-correction-btn');
        if (translateCorrectedBtn) {
            translateCorrectedBtn.addEventListener('click', async () => {
                let translationDiv = div.querySelector('.corrected-translation');
                if (!translationDiv) {
                    translationDiv = document.createElement('div');
                    translationDiv.className = 'corrected-translation';
                    translationDiv.style.cssText = 'font-size: 0.85em; opacity: 0.85; margin-top: 6px; padding-top: 6px; border-top: 1px dashed var(--border-color, #e2e8f0); color: var(--text-muted, #718096);';
                    translationDiv.innerHTML = '<em>Translating...</em>';
                    translationDiv.style.display = 'none';
                    div.querySelector('.corrected-phrase').after(translationDiv);
                }

                if (translationDiv.style.display === 'none' || translationDiv.style.display === '') {
                    translationDiv.style.display = 'block';
                    translateCorrectedBtn.classList.add('active');
                    if (translationDiv.innerHTML === '<em>Translating...</em>') {
                        try {
                            const data = await apiFetch(`api/translate.php?word=${encodeURIComponent(finalMsg.corrected_message)}&is_sentence=true`);
                            translationDiv.textContent = data.translation;
                        } catch (err) {
                            translationDiv.innerHTML = '<span class="text-danger">Failed to translate.</span>';
                        }
                    }
                } else {
                    translationDiv.style.display = 'none';
                    translateCorrectedBtn.classList.remove('active');
                }
            });
        }

        const ttsCorrectedBtn = div.querySelector('.tts-button-correction');
        if (ttsCorrectedBtn) {
            ttsCorrectedBtn.addEventListener('click', () => {
                speakFrench(finalMsg.corrected_message);
            });
        }
        const saveCorrectedBtn = div.querySelector('.save-sentence-btn-correction');
        if (saveCorrectedBtn) {
            saveCorrectedBtn.addEventListener('click', () => {
                handleSaveSentence(finalMsg.corrected_message);
            });
        }

        setupWordHoverEvents(div);
        if (window.lucide) { window.lucide.createIcons(); }
    }
}

function appendBotLoadingBubble() {
    const container = document.getElementById('chat-window-content');
    if (!container) return;

    const div = document.createElement('div');
    div.className = 'message-bubble bot';
    div.id = 'bot-loading-bubble';
    div.innerHTML = `
        <div class="message-meta">Assistant</div>
        <div class="message-content" style="display: flex; gap: 4px; padding: 12px 20px;">
            <span class="loading-dot">•</span>
            <span class="loading-dot">•</span>
            <span class="loading-dot">•</span>
        </div>
    `;
    
    // Add simple inline style for typing dot animation if stylesheet lacks it
    const style = document.createElement('style');
    style.id = 'typing-dot-styles';
    style.innerHTML = `
        .loading-dot { animation: typingBlink 1.4s infinite both; font-size: 20px; font-weight: bold; }
        .loading-dot:nth-child(2) { animation-delay: .2s; }
        .loading-dot:nth-child(3) { animation-delay: .4s; }
        @keyframes typingBlink {
            0% { opacity: .2; }
            20% { opacity: 1; }
            100% { opacity: .2; }
        }
    `;
    if (!document.getElementById('typing-dot-styles')) {
        document.head.appendChild(style);
    }

    container.appendChild(div);
    scrollToBottom();
}

function removeBotLoadingBubble() {
    const bubble = document.getElementById('bot-loading-bubble');
    if (bubble) bubble.remove();
}

// 13. Word Hover / Translation Tooltip logic
function setupWordHoverEvents(container) {
    const spans = container.querySelectorAll('.word-span');
    spans.forEach(span => {
        span.addEventListener('mouseenter', handleWordMouseEnter);
        span.addEventListener('mouseleave', handleWordMouseLeave);
    });
}

function handleWordMouseEnter(e) {
    const span = e.currentTarget;
    const word = span.dataset.word;
    const context = span.dataset.context;

    clearTimeout(tooltipHideTimeout);
    clearTimeout(hoverTranslateTimeout);

    // Debounce hover to prevent instant triggers when scrolling past words
    hoverTranslateTimeout = setTimeout(() => {
        showTranslationTooltip(span, word, context);
    }, 350);
}

function handleWordMouseLeave() {
    clearTimeout(hoverTranslateTimeout);
    
    // Add small delay to allow moving mouse into tooltip card
    tooltipHideTimeout = setTimeout(() => {
        hideTranslationTooltip();
    }, 400);
}

async function showTranslationTooltip(targetSpan, word, context) {
    // If tooltip doesn't exist, create it
    if (!activeTooltip) {
        activeTooltip = document.createElement('div');
        activeTooltip.className = 'translation-tooltip';
        activeTooltip.addEventListener('mouseenter', () => clearTimeout(tooltipHideTimeout));
        activeTooltip.addEventListener('mouseleave', hideTranslationTooltip);
        document.body.appendChild(activeTooltip);
    }

    // Position tooltip initially (relative to target word span)
    const rect = targetSpan.getBoundingClientRect();
    activeTooltip.style.left = `${rect.left + window.scrollX}px`;
    activeTooltip.style.top = `${rect.top + window.scrollY - 38}px`; // 38px above the word
    activeTooltip.innerHTML = `<span class="tooltip-translation">Loading...</span>`;
    activeTooltip.style.display = 'flex';

    try {
        // Fetch translation
        const data = await apiFetch(`api/translate.php?word=${encodeURIComponent(word)}&context=${encodeURIComponent(context)}`);
        
        // Update tooltip content
        const translation = escapeHtml(data.translation);
        const escapedWord = escapeHtml(word).replace(/'/g, "\\'");
        const escapedContext = escapeHtml(context).replace(/'/g, "\\'");
        const escapedTranslation = translation.replace(/'/g, "\\'");
        
        activeTooltip.innerHTML = `
            <span class="tooltip-translation">${translation}</span>
            <button class="tooltip-add-btn" title="Save to Vocabulary">+</button>
        `;

        // Dynamic click listener to avoid single/double quote escaping bugs in HTML attributes
        const addBtn = activeTooltip.querySelector('.tooltip-add-btn');
        if (addBtn) {
            addBtn.addEventListener('click', () => {
                addWordToVocab(word, translation, context);
            });
        }

        // Reposition just in case tooltip width changed
        const tooltipRect = activeTooltip.getBoundingClientRect();
        const leftPos = rect.left + (rect.width / 2) - (tooltipRect.width / 2);
        activeTooltip.style.left = `${Math.max(10, Math.min(window.innerWidth - tooltipRect.width - 10, leftPos))}px`;

    } catch (err) {
        activeTooltip.innerHTML = `<span class="tooltip-translation" style="color: #ef4444;">Error</span>`;
    }
}

function hideTranslationTooltip() {
    if (activeTooltip) {
        activeTooltip.style.display = 'none';
    }
}

// 14. Vocabulary Manager
async function loadVocabulary() {
    try {
        const res = await apiFetch('api/vocab.php');
        state.vocabList = res.data;
        renderVocabulary();
    } catch (err) {
        console.error('Failed to load vocabulary:', err);
    }
}

async function addWordToVocab(word, translation, context) {
    try {
        await apiFetch('api/vocab.php?action=add', {
            method: 'POST',
            body: JSON.stringify({ word, translation, context })
        });
        
        showToast(`Saved "${word}" to vocabulary!`);
        hideTranslationTooltip();
        loadVocabulary(); // Refresh sidebar list
    } catch (err) {
        showToast(err.message, true);
    }
}

async function deleteVocabWord(id) {
    try {
        await apiFetch('api/vocab.php?action=delete', {
            method: 'POST',
            body: JSON.stringify({ id })
        });
        loadVocabulary();
        showToast('Word removed.');
    } catch (err) {
        showToast(err.message, true);
    }
}

function renderVocabulary() {
    const container = document.getElementById('words-grid');
    const badge = document.getElementById('words-count-badge');
    if (!container) return;

    const query = (document.getElementById('words-search-input')?.value || '').toLowerCase().trim();
    const filteredVocab = state.vocabList.filter(item => 
        item.word.toLowerCase().includes(query) || 
        (item.translation && item.translation.toLowerCase().includes(query)) ||
        (item.context && item.context.toLowerCase().includes(query))
    );

    if (badge) {
        badge.textContent = `${filteredVocab.length} word${filteredVocab.length === 1 ? '' : 's'}`;
    }

    if (filteredVocab.length === 0) {
        if (query) {
            container.innerHTML = '<div class="text-center p-8 text-secondary text-sm" style="grid-column: 1/-1;">No matching words found.</div>';
        } else {
            container.innerHTML = '<div class="text-center p-8 text-secondary text-sm" style="grid-column: 1/-1;">No words saved yet. Highlight or hover over French words in the chat to translate and save them!</div>';
        }
        return;
    }

    container.innerHTML = filteredVocab.map((item, idx) => {
        return `
            <div class="vocab-card" data-idx="${idx}">
                <div class="vocab-card-header">
                    <h3 class="vocab-card-word">${escapeHtml(item.word)}</h3>
                    <button class="vocab-card-delete-btn delete-btn-word" data-id="${item.id}" title="Remove word"><i data-lucide="trash-2" style="width: 16px; height: 16px;"></i></button>
                </div>
                <div class="vocab-card-translation-container">
                    <button class="vocab-card-reveal-btn reveal-btn" style="display: flex; align-items: center; gap: 4px;"><i data-lucide="eye" style="width: 14px; height: 14px;"></i> Show Translation</button>
                    <span class="vocab-card-translation" style="display: none;">${escapeHtml(item.translation)}</span>
                </div>
                ${item.context ? `<p class="vocab-card-context">${tokenizeFrenchText(item.context)}</p>` : ''}
                <div class="vocab-card-actions">
                    <button class="vocab-card-speak-btn speak-btn-word" data-word="${escapeHtml(item.word)}" title="Listen"><i data-lucide="volume-2" style="width: 16px; height: 16px;"></i></button>
                </div>
            </div>
        `;
    }).join('');

    if (window.lucide) { window.lucide.createIcons({ node: container }); }

    container.querySelectorAll('.delete-btn-word').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const id = btn.dataset.id;
            deleteVocabWord(id);
        });
    });

    container.querySelectorAll('.speak-btn-word').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const w = btn.dataset.word;
            speakFrench(w);
        });
    });

    container.querySelectorAll('.reveal-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const container = btn.closest('.vocab-card-translation-container');
            const translationEl = container.querySelector('.vocab-card-translation');
            if (translationEl) {
                if (translationEl.style.display === 'none') {
                    translationEl.style.display = 'block';
                    btn.style.display = 'none';
                }
            }
        });
    });

    setupWordHoverEvents(container);
}

// 14.5. Model Sentence Manager
async function loadSentences() {
    try {
        const res = await apiFetch('api/sentences.php');
        state.sentencesList = res.data;
        renderSentences();
    } catch (err) {
        console.error('Failed to load model sentences:', err);
    }
}

async function handleSaveSentence(sentence) {
    try {
        showToast('Translating sentence...');
        
        // Translate the sentence first
        const transRes = await apiFetch(`api/translate.php?word=${encodeURIComponent(sentence)}&is_sentence=true`);
        const translation = transRes.translation;
        
        // Add to sentences database
        await apiFetch('api/sentences.php?action=add', {
            method: 'POST',
            body: JSON.stringify({ sentence, translation })
        });
        
        showToast('Sentence saved to Phrases!');
        loadSentences(); // Refresh list
    } catch (err) {
        showToast(err.message, true);
    }
}

async function deleteSentence(id) {
    try {
        await apiFetch('api/sentences.php?action=delete', {
            method: 'POST',
            body: JSON.stringify({ id })
        });
        loadSentences();
        showToast('Sentence removed.');
    } catch (err) {
        showToast(err.message, true);
    }
}

function renderSentences() {
    const container = document.getElementById('sentences-grid');
    const badge = document.getElementById('sentences-count-badge');
    if (!container) return;

    const query = (document.getElementById('sentences-search-input')?.value || '').toLowerCase().trim();
    const filteredSentences = (state.sentencesList || []).filter(item => 
        item.sentence.toLowerCase().includes(query) || 
        (item.translation && item.translation.toLowerCase().includes(query))
    );

    if (badge) {
        badge.textContent = `${filteredSentences.length} sentence${filteredSentences.length === 1 ? '' : 's'}`;
    }

    if (filteredSentences.length === 0) {
        if (query) {
            container.innerHTML = '<div class="text-center p-8 text-secondary text-sm" style="grid-column: 1/-1;">No matching sentences found.</div>';
        } else {
            container.innerHTML = '<div class="text-center p-8 text-secondary text-sm" style="grid-column: 1/-1;">No sentences saved yet. Click the star icon next to any sentence in the chat to save it!</div>';
        }
        return;
    }

    container.innerHTML = filteredSentences.map((item, idx) => {
        const tokenized = tokenizeFrenchText(item.sentence);
        return `
            <div class="vocab-card sentence-card" data-idx="${idx}">
                <div class="vocab-card-header">
                    <div class="vocab-card-word sentence-text">${tokenized}</div>
                    <button class="vocab-card-delete-btn delete-btn-sentence" data-id="${item.id}" title="Remove sentence"><i data-lucide="trash-2" style="width: 16px; height: 16px;"></i></button>
                </div>
                <div class="vocab-card-translation-container">
                    <button class="vocab-card-reveal-btn reveal-btn" style="display: flex; align-items: center; gap: 4px;"><i data-lucide="eye" style="width: 14px; height: 14px;"></i> Show Translation</button>
                    <span class="vocab-card-translation" style="display: none;">${escapeHtml(item.translation)}</span>
                </div>
                <div class="vocab-card-actions">
                    <button class="vocab-card-speak-btn speak-btn-sentence" data-sentence="${escapeHtml(item.sentence)}" title="Listen"><i data-lucide="volume-2" style="width: 16px; height: 16px;"></i></button>
                </div>
            </div>
        `;
    }).join('');

    if (window.lucide) { window.lucide.createIcons({ node: container }); }

    container.querySelectorAll('.delete-btn-sentence').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const id = btn.dataset.id;
            deleteSentence(id);
        });
    });

    container.querySelectorAll('.speak-btn-sentence').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const s = btn.dataset.sentence;
            speakFrench(s);
        });
    });

    container.querySelectorAll('.reveal-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const container = btn.closest('.vocab-card-translation-container');
            const translationEl = container.querySelector('.vocab-card-translation');
            if (translationEl) {
                if (translationEl.style.display === 'none') {
                    translationEl.style.display = 'block';
                    btn.style.display = 'none';
                }
            }
        });
    });

    setupWordHoverEvents(container);
}

// 15. Cinematic Conversation Replay Mode
async function openReplayMode() {
    if (!state.activeConversationId) return;

    try {
        const res = await apiFetch(`api/history.php?conversation_id=${state.activeConversationId}`);
        state.replayMessages = res.messages || [];
        
        if (state.replayMessages.length === 0) {
            showToast('No messages to replay.', true);
            return;
        }

        state.replayIndex = 0;
        state.replayIsPlaying = false;
        
        // Show overlay
        document.getElementById('replay-overlay').classList.add('active');
        
        // Populate first card
        showReplayStep();
    } catch (err) {
        showToast(err.message, true);
    }
}

function closeReplayMode() {
    state.replayIsPlaying = false;
    clearTimeout(state.replayTimeoutId);
    document.getElementById('replay-overlay').classList.remove('active');
    if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
    }
}

function showReplayStep() {
    const msg = state.replayMessages[state.replayIndex];
    if (!msg) return;

    const senderText = msg.sender === 'bot' ? 'Assistant' : 'Vous';
    document.getElementById('replay-sender').innerText = senderText;
    
    // Display with hover support in replay
    document.getElementById('replay-content').innerHTML = tokenizeFrenchText(msg.message);
    setupWordHoverEvents(document.getElementById('replay-content'));

    // Progress Bar
    const pct = ((state.replayIndex + 1) / state.replayMessages.length) * 100;
    document.getElementById('replay-progress-bar').style.width = `${pct}%`;

    // Speak it
    speakFrench(msg.message);

    // Update play button text
    const playPauseBtn = document.getElementById('replay-play-pause');
    if (playPauseBtn) {
        playPauseBtn.innerHTML = state.replayIsPlaying 
            ? `<span id="replay-play-btn-content" style="display: inline-flex; align-items: center; gap: 6px;"><i data-lucide="pause"></i> Pause</span>`
            : `<span id="replay-play-btn-content" style="display: inline-flex; align-items: center; gap: 6px;"><i data-lucide="play"></i> Play</span>`;
        if (window.lucide) { window.lucide.createIcons(); }
    }

    // Auto-advance loop if playing
    if (state.replayIsPlaying) {
        clearTimeout(state.replayTimeoutId);
        // Compute duration based on message length (approx 150ms per character, min 3s)
        const duration = Math.max(3000, msg.message.length * 90);
        state.replayTimeoutId = setTimeout(() => {
            advanceReplayStep();
        }, duration);
    }
}

function toggleReplayPlayback() {
    state.replayIsPlaying = !state.replayIsPlaying;
    showReplayStep();
}

function advanceReplayStep() {
    if (state.replayIndex < state.replayMessages.length - 1) {
        state.replayIndex++;
        showReplayStep();
    } else {
        // Conversation finished replaying
        state.replayIsPlaying = false;
        showReplayStep();
        showToast('Replay finished!');
    }
}

// 16. UI Toggle Helpers
function showWelcomeScreen() {
    setView('chat');
    state.activeConversationId = null;
    renderConversations(); // clear active selection
    document.querySelectorAll('.diff-card').forEach(c => c.classList.remove('active'));
    const wtContainer = document.getElementById('welcome-topic-container');
    if (wtContainer) wtContainer.style.display = 'none';
    
    document.getElementById('welcome-screen').style.display = 'flex';
    document.getElementById('chat-window-content').style.display = 'none';
    document.getElementById('main-header-content').style.display = 'none';
    document.getElementById('chat-input-container').style.display = 'none';
}

function showChatWindow() {
    setView('chat');
    document.getElementById('welcome-screen').style.display = 'none';
    document.getElementById('chat-window-content').style.display = 'flex';
    document.getElementById('main-header-content').style.display = 'flex';
    document.getElementById('chat-input-container').style.display = 'block';
}

function updateHeaderInfo(title, difficulty, topic = 'General') {
    document.getElementById('header-convo-title').innerText = title;
    
    const select = document.getElementById('header-difficulty-select');
    if (select) {
        select.value = difficulty;
    }
    
    const topicSpan = document.getElementById('header-topic-name');
    if (topicSpan) {
        // Find human readable topic name
        const topicsList = SYLLABUS_TOPICS[difficulty] || [];
        const found = topicsList.find(t => t.id === topic);
        topicSpan.innerText = found ? found.name : topic;
    }
}

function scrollToBottom() {
    const el = document.getElementById('chat-window-content');
    if (el) {
        el.scrollTop = el.scrollHeight;
    }
}

// 17. Simple Utility Helpers
function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;')
              .replace(/</g, '&lt;')
              .replace(/>/g, '&gt;')
              .replace(/"/g, '&quot;')
              .replace(/'/g, '&#039;');
}

function showToast(msg, isError = false) {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.style.cssText = 'position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%); z-index: 10000; display: flex; flex-direction: column; gap: 8px; pointer-events: none;';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.style.cssText = `
        padding: 10px 20px;
        border-radius: 8px;
        color: var(--bg-main);
        font-size: 13.5px;
        font-weight: 600;
        box-shadow: var(--card-shadow);
        background: ${isError ? '#ef4444' : 'var(--primary)'};
        border: 1px solid var(--border-color);
        animation: toastFade 0.25s cubic-bezier(0, 0, 0.2, 1);
        pointer-events: auto;
        max-width: 450px;
        text-align: center;
        line-height: 1.4;
        word-break: break-word;
    `;
    toast.innerText = msg;
    
    // Add animation style if not present
    if (!document.getElementById('toast-style')) {
        const style = document.createElement('style');
        style.id = 'toast-style';
        style.innerHTML = `
            @keyframes toastFade {
                from { opacity: 0; transform: translateY(8px); }
                to { opacity: 1; transform: translateY(0); }
            }
        `;
        document.head.appendChild(style);
    }

    container.appendChild(toast);

    setTimeout(() => {
        toast.style.transition = 'opacity 0.3s ease';
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// 17. Theme Management
function initTheme() {
    const currentTheme = localStorage.getItem('theme') || 'dark';
    document.documentElement.setAttribute('data-theme', currentTheme);
    updateThemeIcon(currentTheme);

    const themeToggleBtn = document.getElementById('theme-toggle-btn');
    if (themeToggleBtn) {
        themeToggleBtn.addEventListener('click', () => {
            const activeTheme = document.documentElement.getAttribute('data-theme');
            const newTheme = activeTheme === 'light' ? 'dark' : 'light';
            document.documentElement.setAttribute('data-theme', newTheme);
            localStorage.setItem('theme', newTheme);
            updateThemeIcon(newTheme);
        });
    }
}

function updateThemeIcon(theme) {
    const iconEl = document.getElementById('theme-toggle-icon');
    if (iconEl) {
        if (theme === 'light') {
            iconEl.setAttribute('data-lucide', 'moon');
        } else {
            iconEl.setAttribute('data-lucide', 'sun');
        }
        if (window.lucide) {
            window.lucide.createIcons();
        }
    }
}

// 14. Text Selection / Multi-word Vocabulary Saving logic
let selectionTooltip = null;

function setupTextSelectionListener() {
    document.addEventListener('mouseup', handleTextSelection);
}

function handleTextSelection(e) {
    setTimeout(() => {
        const selection = window.getSelection();
        const selectedText = selection.toString().trim();

        if (!selectedText) {
            hideSelectionTooltip();
            return;
        }

        const anchorNode = selection.anchorNode;
        if (!anchorNode) return;

        const parentElement = anchorNode.parentElement;
        const isWithinChat = parentElement.closest('.message-content') || parentElement.closest('.corrected-phrase');

        if (!isWithinChat) {
            hideSelectionTooltip();
            return;
        }

        const range = selection.getRangeAt(0);
        const rects = range.getClientRects();
        if (rects.length === 0) return;
        
        const rect = rects[0];
        showSelectionTooltip(rect, selectedText, parentElement.closest('.message-bubble')?.textContent || '');
    }, 50);
}

function showSelectionTooltip(rect, selectedText, fullContext) {
    if (!selectionTooltip) {
        selectionTooltip = document.createElement('div');
        selectionTooltip.className = 'selection-tooltip';
        document.body.appendChild(selectionTooltip);
    }

    selectionTooltip.innerHTML = `
        <span class="selection-text">"${selectedText}"</span>
        <button class="selection-add-btn" title="Save to Vocabulary"><i data-lucide="plus" style="width: 14px; height: 14px;"></i> Save</button>
    `;

    const tooltipWidth = 180;
    const left = rect.left + (rect.width / 2) - (tooltipWidth / 2);
    const top = rect.top + window.scrollY - 40;

    selectionTooltip.style.left = `${Math.max(10, left)}px`;
    selectionTooltip.style.top = `${top}px`;
    selectionTooltip.style.display = 'flex';

    if (window.lucide) { window.lucide.createIcons({ node: selectionTooltip }); }

    const saveBtn = selectionTooltip.querySelector('.selection-add-btn');
    saveBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        saveBtn.disabled = true;
        saveBtn.innerHTML = 'Saving...';
        
        try {
            const data = await apiFetch(`api/translate.php?word=${encodeURIComponent(selectedText)}&is_sentence=true`);
            const translation = data.translation;
            
            await addWordToVocab(selectedText, translation, fullContext.substring(0, 200).replace(/\s+/g, ' ').trim());
            hideSelectionTooltip();
        } catch (err) {
            showToast(err.message, true);
            saveBtn.disabled = false;
            saveBtn.innerHTML = '<i data-lucide="plus" style="width: 14px; height: 14px;"></i> Save';
            if (window.lucide) { window.lucide.createIcons({ node: saveBtn }); }
        }
    });
}

function hideSelectionTooltip() {
    if (selectionTooltip) {
        selectionTooltip.style.display = 'none';
    }
}

// 17. View Navigation Logic (Switching between Chat, Words Dashboard, and Sentences Dashboard)
function setView(viewName) {
    const tabConvos = document.getElementById('tab-convos');
    const tabVocab = document.getElementById('tab-vocab');
    const tabSentences = document.getElementById('tab-sentences');
    const panelConvos = document.getElementById('panel-convos');
    const panelVocab = document.getElementById('panel-vocab');
    const panelSentences = document.getElementById('panel-sentences');

    const chatWindow = document.querySelector('.chat-window');
    const chatInputContainer = document.getElementById('chat-input-container');
    const wordsDashboard = document.getElementById('words-dashboard');
    const sentencesDashboard = document.getElementById('sentences-dashboard');
    const mainHeaderContent = document.getElementById('main-header-content');
    const dashboardHeaderTitle = document.getElementById('dashboard-header-title');
    const dashboardHeaderText = document.getElementById('dashboard-header-text');
    const replayBtn = document.getElementById('replay-btn');

    // Remove active class from tabs & panels
    [tabConvos, tabVocab, tabSentences].forEach(t => t && t.classList.remove('active'));
    [panelConvos, panelVocab, panelSentences].forEach(p => p && p.classList.remove('active'));

    if (viewName === 'chat') {
        if (tabConvos) tabConvos.classList.add('active');
        if (panelConvos) panelConvos.classList.add('active');

        if (chatWindow) chatWindow.style.display = 'block';
        if (wordsDashboard) wordsDashboard.style.display = 'none';
        if (sentencesDashboard) sentencesDashboard.style.display = 'none';
        if (dashboardHeaderTitle) dashboardHeaderTitle.style.display = 'none';
        
        if (state.activeConversationId) {
            if (chatInputContainer) chatInputContainer.style.display = 'block';
            if (mainHeaderContent) mainHeaderContent.style.display = 'flex';
            if (replayBtn) replayBtn.style.display = 'inline-flex';
        } else {
            if (chatInputContainer) chatInputContainer.style.display = 'none';
            if (mainHeaderContent) mainHeaderContent.style.display = 'none';
            if (replayBtn) replayBtn.style.display = 'none';
        }
    } else if (viewName === 'words') {
        if (tabVocab) tabVocab.classList.add('active');
        if (panelVocab) panelVocab.classList.add('active');

        if (chatWindow) chatWindow.style.display = 'none';
        if (chatInputContainer) chatInputContainer.style.display = 'none';
        if (wordsDashboard) wordsDashboard.style.display = 'block';
        if (sentencesDashboard) sentencesDashboard.style.display = 'none';
        
        if (mainHeaderContent) mainHeaderContent.style.display = 'none';
        if (replayBtn) replayBtn.style.display = 'none';
        if (dashboardHeaderTitle) {
            dashboardHeaderTitle.style.display = 'flex';
            if (dashboardHeaderText) dashboardHeaderText.textContent = 'Vocabulary / Words';
        }
        renderVocabulary();
    } else if (viewName === 'sentences') {
        if (tabSentences) tabSentences.classList.add('active');
        if (panelSentences) panelSentences.classList.add('active');

        if (chatWindow) chatWindow.style.display = 'none';
        if (chatInputContainer) chatInputContainer.style.display = 'none';
        if (wordsDashboard) wordsDashboard.style.display = 'none';
        if (sentencesDashboard) sentencesDashboard.style.display = 'block';
        
        if (mainHeaderContent) mainHeaderContent.style.display = 'none';
        if (replayBtn) replayBtn.style.display = 'none';
        if (dashboardHeaderTitle) {
            dashboardHeaderTitle.style.display = 'flex';
            if (dashboardHeaderText) dashboardHeaderText.textContent = 'Vocabulary / Sentences';
        }
        renderSentences();
    }
}
