<?php
/**
 * Configuration File for French Learning Chat App
 */

// Enable error reporting during development
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

// Google Gemini API Key
// You can set it here directly, or define it as an environment variable GEMINI_API_KEY
define('GEMINI_API_KEY', getenv('GEMINI_API_KEY') ?: '');

// Gemini Model to use (gemini-1.5-flash or gemini-2.5-flash)
define('GEMINI_MODEL', 'gemini-flash-latest');

// Database Directory Paths
// Default: outside public_html if uploaded to public_html/myapp/
define('DB_PRIMARY_DIR', __DIR__ . '/../../database');
define('DB_PRIMARY_PATH', DB_PRIMARY_DIR . '/french_chat.db');

// Fallback: inside the project folder in db/
define('DB_FALLBACK_DIR', __DIR__ . '/db');
define('DB_FALLBACK_PATH', DB_FALLBACK_DIR . '/french_chat.db');
