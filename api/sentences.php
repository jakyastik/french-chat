<?php
/**
 * API Endpoint for Model Sentences management
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
    // Get all model sentences for this user
    try {
        $stmt = $db->prepare("SELECT * FROM model_sentences WHERE user_id = ? ORDER BY created_at DESC");
        $stmt->execute([$userId]);
        $sentences = $stmt->fetchAll();
        
        echo json_encode([
            'success' => true,
            'data' => $sentences
        ]);
    } catch (PDOException $e) {
        echo json_encode(['success' => false, 'error' => $e->getMessage()]);
    }
    exit;
}

if ($method === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true) ?? $_POST;
    $action = $input['action'] ?? $_GET['action'] ?? 'add';

    if ($action === 'add') {
        $sentence = trim($input['sentence'] ?? '');
        $translation = trim($input['translation'] ?? '');

        if (empty($sentence) || empty($translation)) {
            echo json_encode(['success' => false, 'error' => 'Missing sentence or translation']);
            exit;
        }

        try {
            // Avoid duplicate sentences for the same user
            $stmt = $db->prepare("SELECT id FROM model_sentences WHERE user_id = ? AND LOWER(sentence) = LOWER(?)");
            $stmt->execute([$userId, $sentence]);
            $existing = $stmt->fetch();

            if ($existing) {
                echo json_encode([
                    'success' => true, 
                    'message' => 'Sentence already saved',
                    'id' => $existing['id']
                ]);
                exit;
            }

            $stmt = $db->prepare("INSERT INTO model_sentences (user_id, sentence, translation) VALUES (?, ?, ?)");
            $stmt->execute([$userId, $sentence, $translation]);
            $newId = $db->lastInsertId();

            echo json_encode([
                'success' => true,
                'data' => [
                    'id' => $newId,
                    'sentence' => $sentence,
                    'translation' => $translation
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
            echo json_encode(['success' => false, 'error' => 'Missing sentence ID']);
            exit;
        }

        try {
            $stmt = $db->prepare("DELETE FROM model_sentences WHERE id = ? AND user_id = ?");
            $stmt->execute([$id, $userId]);

            echo json_encode([
                'success' => true,
                'message' => 'Model sentence deleted successfully'
            ]);
        } catch (PDOException $e) {
            echo json_encode(['success' => false, 'error' => $e->getMessage()]);
        }
        exit;
    }
}

echo json_encode(['success' => false, 'error' => 'Unsupported request method']);
