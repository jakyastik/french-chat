<?php
/**
 * French Chat App - Main Entry Point
 */

require_once __DIR__ . '/db.php';

// Initialize/Test DB connection
$db = getDatabaseConnection();

// Check if Gemini API key is configured
$apiConfigured = (GEMINI_API_KEY !== 'YOUR_GEMINI_API_KEY_HERE' && !empty(GEMINI_API_KEY));
?>
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>EnChat — Apprendre le français par la conversation</title>
    <!-- Favicon -->
    <link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🇫🇷</text></svg>">
    <!-- Main Stylesheet -->
    <link rel="stylesheet" href="assets/style.css">
</head>
<body>

    <!-- Auth Screen -->
    <div id="auth-screen" class="auth-screen" style="display: flex;">
        <div class="auth-card">
            <div class="auth-header">
                <div class="auth-logo"><i data-lucide="languages"></i></div>
                <h2>Welcome to EnChat</h2>
                <p id="auth-subtitle">Learn French through conversation</p>
            </div>
            
            <div class="auth-tabs">
                <button id="auth-tab-login" class="auth-tab-btn active">Log In</button>
                <button id="auth-tab-register" class="auth-tab-btn">Register</button>
            </div>
            
            <form id="auth-form" class="auth-form">
                <div class="auth-input-group">
                    <label for="auth-email">Email</label>
                    <input type="email" id="auth-email" required placeholder="e.g. john@example.com" autocomplete="email">
                </div>
                <div class="auth-input-group">
                    <label for="auth-password">Password</label>
                    <input type="password" id="auth-password" required placeholder="••••••••" autocomplete="current-password">
                </div>
                <div id="auth-error-msg" class="auth-error-msg" style="display: none;"></div>
                <button type="submit" id="auth-submit-btn" class="btn btn-primary auth-submit-btn" style="width: 100%; justify-content: center; margin-top: 12px;">
                    Log In <i data-lucide="log-in" style="margin-left: 6px;"></i>
                </button>
            </form>
        </div>
    </div>

    <div class="app-container sidebar-open" style="display: none;">

        <!-- Sidebar -->
        <aside class="sidebar">
            <div class="sidebar-header">
                <div class="brand">
                    <div class="brand-logo"><i data-lucide="languages"></i></div>
                    <h1 class="brand-title">EnChat</h1>
                </div>
                <button id="new-chat-btn" class="btn btn-primary" style="width: 100%;">
                    <i data-lucide="plus" style="margin-right: 6px;"></i> New Chat
                </button>
            </div>

            <!-- Sidebar Navigation Tabs -->
            <div class="sidebar-tabs">
                <button id="tab-convos" class="tab-btn active"><i data-lucide="message-square" style="margin-right: 6px;"></i>Convos</button>
                <button id="tab-vocab" class="tab-btn"><i data-lucide="book-open" style="margin-right: 6px;"></i>Words</button>
                <button id="tab-sentences" class="tab-btn"><i data-lucide="star" style="margin-right: 6px;"></i>Sentences</button>
            </div>

            <!-- Scrollable Panels -->
            <div class="sidebar-panels">
                <!-- Conversations Tab Panel -->
                <div id="panel-convos" class="sidebar-panel active">
                    <div id="conversation-list-container" class="conversation-list">
                        <!-- Loaded dynamically -->
                    </div>
                </div>

                <!-- Vocabulary Tab Panel -->
                <div id="panel-vocab" class="sidebar-panel">
                    <div id="vocab-list-container" class="vocab-list">
                        <!-- Loaded dynamically -->
                    </div>
                </div>

                <!-- Sentences Tab Panel -->
                <div id="panel-sentences" class="sidebar-panel">
                    <div id="sentences-list-container" class="vocab-list">
                        <!-- Loaded dynamically -->
                    </div>
                </div>
            </div>

            <!-- Sidebar Footer / Settings Panel -->
            <div class="sidebar-footer" style="display: flex; flex-direction: column; gap: 12px;">
                <div class="api-config">
                    <label for="api-key-input">Clé API Google Gemini</label>
                    <div class="api-input-group">
                        <input type="password" id="api-key-input" class="api-input" placeholder="<?php echo $apiConfigured ? 'Configure in config.php' : 'Paste Gemini API Key...'; ?>">
                        <button id="save-api-key-btn" class="btn btn-secondary btn-icon" title="Sauvegarder"><i data-lucide="save"></i></button>
                    </div>
                </div>
                
                <div class="user-profile" style="display: flex; align-items: center; justify-content: space-between; padding-top: 10px; border-top: 1px solid var(--border-color); font-size: 12px; color: var(--text-secondary);">
                    <span>Logged in: <strong id="email-display" style="color: var(--text-primary);">...</strong></span>
                    <button id="logout-btn" class="btn btn-secondary btn-icon" title="Log Out" style="padding: 4px;"><i data-lucide="log-out" style="width: 14px; height: 14px;"></i></button>
                </div>
            </div>
        </aside>

        <!-- Main Content Area -->
        <main class="main-content">
            
            <header class="main-header">
                <div class="header-active-convo">
                    <button id="sidebar-toggle-btn" class="btn btn-secondary btn-icon" title="Toggle Sidebar" style="margin-right: 12px;">
                        <i data-lucide="menu"></i>
                    </button>
                    <div id="main-header-content" style="display: none; align-items: center; gap: 16px;">
                        <span id="header-convo-title" class="convo-title-header">Conversation</span>
                        
                        <!-- Difficulty Selector Dropdown (Active Session) -->
                        <div class="difficulty-selector">
                            <label for="header-difficulty-select">Level:</label>
                            <select id="header-difficulty-select">
                                <option value="A1">A1 - Beginner</option>
                                <option value="A2">A2 - Elementary</option>
                                <option value="B1">B1 - Intermediate</option>
                                <option value="B2">B2 - Upper Intermediate</option>
                                <option value="C1">C1 - Advanced</option>
                                <option value="C2">C2 - Mastery</option>
                            </select>
                        </div>
 
                        <!-- Active Topic Display -->
                        <div id="header-topic-display" style="font-size: 12px; color: var(--text-secondary); border-left: 1px solid var(--border-color); padding-left: 12px; height: 18px; display: flex; align-items: center;">
                            Topic: <span id="header-topic-name" style="font-weight: 600; color: var(--text-primary); margin-left: 6px;">General</span>
                        </div>
                    </div>
                </div>
                
                <div class="header-actions">
                    <button id="theme-toggle-btn" class="btn btn-secondary btn-icon" title="Toggle Theme">
                        <i data-lucide="sun" id="theme-toggle-icon"></i>
                    </button>
                    <button id="replay-btn" class="btn btn-secondary" title="Replay Conversation">
                        <i data-lucide="play" style="margin-right: 6px;"></i> Replay
                    </button>
                </div>
            </header>

            <!-- Chat Window Content Area -->
            <div class="chat-window">
                
                <!-- Welcome Screen (Shown when no chat is active) -->
                <div id="welcome-screen" class="welcome-screen">
                    <div class="welcome-icon"><i data-lucide="message-square"></i></div>
                    <h2>Speak French with Gemini</h2>
                    <p>Select a difficulty level to start an interactive conversation. You can hover over any French word to see its contextual translation and save it to your vocabulary list.</p>
                    
                    <div class="difficulty-cards">
                        <div class="diff-card" data-diff="A1">
                            <div class="diff-name">A1</div>
                            <div class="diff-desc">Beginner (Simple words)</div>
                        </div>
                        <div class="diff-card" data-diff="A2">
                            <div class="diff-name">A2</div>
                            <div class="diff-desc">Elementary (Basic terms)</div>
                        </div>
                        <div class="diff-card" data-diff="B1">
                            <div class="diff-name">B1</div>
                            <div class="diff-desc">Intermediate (Common speech)</div>
                        </div>
                        <div class="diff-card" data-diff="B2">
                            <div class="diff-name">B2</div>
                            <div class="diff-desc">Upper Intermediate (Abstract ideas)</div>
                        </div>
                        <div class="diff-card" data-diff="C1">
                            <div class="diff-name">C1</div>
                            <div class="diff-desc">Advanced (Nuanced complex)</div>
                        </div>
                        <div class="diff-card" data-diff="C2">
                            <div class="diff-name">C2</div>
                            <div class="diff-desc">Mastery (Native level)</div>
                        </div>
                    </div>

                    <!-- Topic Selection (Revealed when a level card is clicked) -->
                    <div id="welcome-topic-container" style="display: none; margin-top: 24px; flex-direction: column; align-items: center; gap: 12px; width: 100%; animation: fadeIn 0.3s ease;">
                        <div style="display: flex; flex-direction: column; align-items: center; gap: 6px; width: 100%;">
                            <label for="welcome-topic-select" style="font-size: 12px; color: var(--text-secondary); font-weight: 500;">Study Topic:</label>
                            <select id="welcome-topic-select" style="background: var(--bg-card); color: var(--text-primary); border: 1px solid var(--border-color); border-radius: 8px; padding: 6px 12px; font-size: 13px; width: 100%; max-width: 320px; outline: none; cursor: pointer;">
                                <!-- Dynamically populated -->
                            </select>
                        </div>
                        <button id="start-chat-btn" class="btn btn-primary" style="width: 100%; max-width: 200px;">
                            Start <i data-lucide="arrow-right" style="margin-left: 6px;"></i>
                        </button>
                    </div>
                </div>

                <!-- Chat Message Stream -->
                <div id="chat-window-content" style="display: none; flex-direction: column; gap: 24px;">
                    <!-- Appended dynamically -->
                </div>
                
            </div>

            <!-- Chat Input Area -->
            <div id="chat-input-container" class="input-area" style="display: none;">
                <div class="input-container">
                    <textarea id="chat-input" class="chat-input" placeholder="Type your response in French..." rows="1"></textarea>
                    <button id="send-btn" class="btn btn-primary" title="Send">
                        Send
                    </button>
                </div>
            </div>

            <!-- Cinematic Replay Overlay -->
            <div id="replay-overlay" class="replay-overlay">
                <div class="replay-card">
                    <div class="replay-header">
                        <span class="replay-title">Cinematic Replay</span>
                        <button id="replay-close" class="btn btn-secondary btn-icon" title="Exit"><i data-lucide="x"></i></button>
                    </div>

                    <div class="replay-bubble-container">
                        <div class="replay-bubble">
                            <div id="replay-sender" class="replay-bubble-sender">Assistant</div>
                            <div id="replay-content" class="replay-bubble-content">Bonjour ! Prêt à pratiquer ?</div>
                        </div>
                    </div>

                    <div class="replay-progress">
                        <div id="replay-progress-bar" class="replay-progress-bar"></div>
                    </div>

                    <div class="replay-controls">
                        <button id="replay-play-pause" class="btn btn-primary" style="min-width: 110px;">
                            <span id="replay-play-btn-content" style="display: inline-flex; align-items: center; gap: 6px;"><i data-lucide="play"></i> Play</span>
                        </button>
                        <button id="replay-next" class="btn btn-secondary">
                            <i data-lucide="skip-forward" style="margin-right: 6px;"></i> Next
                        </button>
                    </div>
                </div>
            </div>

        </main>

    </div>

    <!-- Lucide Icons -->
    <script src="https://unpkg.com/lucide@latest"></script>
    <!-- Application Script -->
    <script src="assets/app.js"></script>
</body>
</html>
