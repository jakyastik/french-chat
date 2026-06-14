<?php
/**
 * Database Connection & Schema Setup
 */

require_once __DIR__ . '/config.php';

function getDatabaseConnection() {
    static $pdo = null;
    if ($pdo !== null) {
        return $pdo;
    }

    $dbPath = null;
    $primaryDir = DB_PRIMARY_DIR;
    $fallbackDir = DB_FALLBACK_DIR;

    // Try primary path first (outside public_html)
    if (is_dir($primaryDir) && is_writable($primaryDir)) {
        $dbPath = DB_PRIMARY_PATH;
    } else {
        // Try creating the primary directory
        if (@mkdir($primaryDir, 0755, true)) {
            $dbPath = DB_PRIMARY_PATH;
        } else {
            // Fall back to local folder
            if (!is_dir($fallbackDir)) {
                if (@mkdir($fallbackDir, 0755, true)) {
                    // Create .htaccess to block direct download of the DB file
                    $htaccessContent = "Order Deny,Allow\nDeny from all\n";
                    @file_put_contents($fallbackDir . '/.htaccess', $htaccessContent);
                }
            }
            $dbPath = DB_FALLBACK_PATH;
        }
    }

    try {
        $pdo = new PDO("sqlite:" . $dbPath);
        $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
        
        // Enable foreign keys
        $pdo->exec("PRAGMA foreign_keys = ON;");

        // Initialize Schema
        initializeSchema($pdo);
        
        return $pdo;
    } catch (PDOException $e) {
        // Return JSON error if this is called via API
        if (strpos($_SERVER['REQUEST_URI'] ?? '', '/api/') !== false) {
            header('Content-Type: application/json');
            echo json_encode([
                'success' => false,
                'error' => 'Database connection failed: ' . $e->getMessage()
            ]);
            exit;
        } else {
            die("Database connection failed: " . $e->getMessage());
        }
    }
}

function initializeSchema(PDO $db) {
    // Recreate users table if it has the old username schema
    try {
        $db->query("SELECT email FROM users LIMIT 1");
    } catch (PDOException $e) {
        $db->exec("DROP TABLE IF EXISTS users");
    }

    // 0. Users
    $db->exec("CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )");

    // 1. Conversations
    $db->exec("CREATE TABLE IF NOT EXISTS conversations (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        title TEXT NOT NULL,
        difficulty TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )");

    // 2. Messages
    $db->exec("CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        conversation_id TEXT NOT NULL,
        sender TEXT NOT NULL,
        message TEXT NOT NULL,
        corrected_message TEXT,
        correction_explanation TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
    )");

    // 3. Vocabulary
    $db->exec("CREATE TABLE IF NOT EXISTS vocabulary (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        word TEXT NOT NULL,
        translation TEXT NOT NULL,
        context TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )");

    // 4. Translation Cache
    $db->exec("CREATE TABLE IF NOT EXISTS translation_cache (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        word TEXT NOT NULL,
        context TEXT NOT NULL,
        translation TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(word, context)
    )");

    // 5. Model Sentences
    $db->exec("CREATE TABLE IF NOT EXISTS model_sentences (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        sentence TEXT NOT NULL,
        translation TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )");

    // Add topic column migration if not exists
    try {
        $db->exec("ALTER TABLE conversations ADD COLUMN topic TEXT DEFAULT 'General'");
    } catch (PDOException $e) {
        // Column already exists, safe to ignore
    }
}
