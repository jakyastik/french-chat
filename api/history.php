<?php
/**
 * API Endpoint for Conversation History management
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
    $conversationId = $_GET['conversation_id'] ?? null;

    if ($conversationId) {
        // Fetch all messages for this specific conversation
        try {
            $stmt = $db->prepare("SELECT * FROM conversations WHERE id = ? AND user_id = ?");
            $stmt->execute([$conversationId, $userId]);
            $convo = $stmt->fetch();

            if (!$convo) {
                echo json_encode(['success' => false, 'error' => 'Conversation not found']);
                exit;
            }

            $stmtMsg = $db->prepare("SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC");
            $stmtMsg->execute([$conversationId]);
            $messages = $stmtMsg->fetchAll();

            echo json_encode([
                'success' => true,
                'conversation' => $convo,
                'messages' => $messages
            ]);
        } catch (PDOException $e) {
            echo json_encode(['success' => false, 'error' => $e->getMessage()]);
        }
    } else {
        // List all conversations for the user
        try {
            $stmt = $db->prepare("SELECT * FROM conversations WHERE user_id = ? ORDER BY created_at DESC");
            $stmt->execute([$userId]);
            $conversations = $stmt->fetchAll();

            echo json_encode([
                'success' => true,
                'data' => $conversations
            ]);
        } catch (PDOException $e) {
            echo json_encode(['success' => false, 'error' => $e->getMessage()]);
        }
    }
    exit;
}

if ($method === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true) ?? $_POST;
    $action = $input['action'] ?? $_GET['action'] ?? 'create';

    if ($action === 'create') {
        $difficulty = strtoupper(trim($input['difficulty'] ?? 'A1'));
        $validDifficulties = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
        
        if (!in_array($difficulty, $validDifficulties)) {
            $difficulty = 'A1';
        }

        $id = bin2hex(random_bytes(16)); // Generate UUID-like unique string
        $topic = trim($input['topic'] ?? 'General');
        $title = trim($input['title'] ?? '') ?: ($topic !== 'General' ? $topic : "Conversation ({$difficulty})");

        try {
            $stmt = $db->prepare("INSERT INTO conversations (id, user_id, title, difficulty, topic) VALUES (?, ?, ?, ?, ?)");
            $stmt->execute([$id, $userId, $title, $difficulty, $topic]);

            echo json_encode([
                'success' => true,
                'data' => [
                    'id' => $id,
                    'title' => $title,
                    'difficulty' => $difficulty,
                    'topic' => $topic
                ]
            ]);
        } catch (PDOException $e) {
            echo json_encode(['success' => false, 'error' => $e->getMessage()]);
        }
        exit;
    }

    if ($action === 'delete') {
        $conversationId = $input['conversation_id'] ?? null;

        if (empty($conversationId)) {
            echo json_encode(['success' => false, 'error' => 'Missing Conversation ID']);
            exit;
        }

        try {
            $stmt = $db->prepare("DELETE FROM conversations WHERE id = ? AND user_id = ?");
            $stmt->execute([$conversationId, $userId]);

            echo json_encode([
                'success' => true,
                'message' => 'Conversation deleted successfully'
            ]);
        } catch (PDOException $e) {
            echo json_encode(['success' => false, 'error' => $e->getMessage()]);
        }
        exit;
    }
}

echo json_encode(['success' => false, 'error' => 'Unsupported request method']);
