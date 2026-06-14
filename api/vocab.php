<?php
/**
 * API Endpoint for Vocabulary management
 */

header('Content-Type: application/json');
require_once __DIR__ . '/../db.php';

$db = getDatabaseConnection();

session_start();

// Get the user ID from session, headers or request
$userId = $_SESSION['user_id'] ?? $_SERVER['HTTP_X_USER_ID'] ?? $_REQUEST['user_id'] ?? null;

if (empty($userId)) {
    http_response_code(401);
    echo json_encode(['success' => false, 'error' => 'Unauthorized']);
    exit;
}

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    // Get all vocabulary for this user
    try {
        $stmt = $db->prepare("SELECT * FROM vocabulary WHERE user_id = ? ORDER BY created_at DESC");
        $stmt->execute([$userId]);
        $vocab = $stmt->fetchAll();
        
        echo json_encode([
            'success' => true,
            'data' => $vocab
        ]);
    } catch (PDOException $e) {
        echo json_encode(['success' => false, 'error' => $e->getMessage()]);
    }
    exit;
}

if ($method === 'POST') {
    // Determine the action (add or delete)
    $input = json_decode(file_get_contents('php://input'), true) ?? $_POST;
    $action = $input['action'] ?? $_GET['action'] ?? 'add';

    if ($action === 'add') {
        $word = trim($input['word'] ?? '');
        $translation = trim($input['translation'] ?? '');
        $context = trim($input['context'] ?? '');

        if (empty($word) || empty($translation)) {
            echo json_encode(['success' => false, 'error' => 'Missing word or translation']);
            exit;
        }

        try {
            // Check if already exists for this user to avoid duplicates
            $stmt = $db->prepare("SELECT id FROM vocabulary WHERE user_id = ? AND LOWER(word) = LOWER(?)");
            $stmt->execute([$userId, $word]);
            $existing = $stmt->fetch();

            if ($existing) {
                echo json_encode([
                    'success' => true, 
                    'message' => 'Word already in vocabulary list',
                    'id' => $existing['id']
                ]);
                exit;
            }

            $stmt = $db->prepare("INSERT INTO vocabulary (user_id, word, translation, context) VALUES (?, ?, ?, ?)");
            $stmt->execute([$userId, $word, $translation, $context]);
            $newId = $db->lastInsertId();

            echo json_encode([
                'success' => true,
                'data' => [
                    'id' => $newId,
                    'word' => $word,
                    'translation' => $translation,
                    'context' => $context
                ]
            ]);
        } catch (PDOException $e) {
            echo json_encode(['success' => false, 'error' => $e->getMessage()]);
        }
        exit;
    }

    if ($action === 'delete') {
        $id = $input['id'] ?? null;

        if (empty($id)) {
            echo json_encode(['success' => false, 'error' => 'Missing item ID']);
            exit;
        }

        try {
            $stmt = $db->prepare("DELETE FROM vocabulary WHERE id = ? AND user_id = ?");
            $stmt->execute([$id, $userId]);

            echo json_encode([
                'success' => true,
                'message' => 'Vocabulary word deleted successfully'
            ]);
        } catch (PDOException $e) {
            echo json_encode(['success' => false, 'error' => $e->getMessage()]);
        }
        exit;
    }
}

// Fallback for unsupported methods
echo json_encode(['success' => false, 'error' => 'Unsupported request method']);
